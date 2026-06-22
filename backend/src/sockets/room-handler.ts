import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

interface GameSessionState {
  quizSessionId: string;
  theme: any | null;
  questions: any[];
  currentQuestionIndex: number;
  timer: NodeJS.Timeout | null;
  advanceTimer: NodeJS.Timeout | null;
  secondsLeft: number;
  startTime: number;
  questionEndsAt: number;
  answersSubmitted: Set<string>; // userIds
  activePlayerSockets: Map<string, Set<string>>; // userId -> active socketIds
  hostForfeitTimer: NodeJS.Timeout | null;
  hostForfeited: boolean;
  roundEnded: boolean;
  gameOver: boolean;
  quizReady: boolean;
  preparingNextQuiz: boolean;
  lastLeaderboard: any[];
  nextQuestionAt: number | null;
  answersByQuestion: Map<number, Map<string, string>>;
}

// In-memory registry of running quizzes
const activeSessions = new Map<string, GameSessionState>();
const closedSessions = new Map<string, 'host_forfeited' | 'new_session'>();

export function registerSocketHandlers(io: Server, prisma: PrismaClient) {
  io.on('connection', (socket: Socket) => {
    let currentSessionId: string | null = null;
    let currentUserId: string | null = null;

    const authorizeHost = async (quizSessionId: string) => {
      if (!currentUserId || currentSessionId !== quizSessionId) {
        socket.emit('error_message', { message: 'You are not joined to this lobby.' });
        return false;
      }

      const participant = await prisma.participant.findFirst({
        where: {
          quizSessionId,
          userId: currentUserId,
          isHost: true
        }
      });

      if (!participant) {
        socket.emit('error_message', { message: 'Only the lobby host can perform this action.' });
        return false;
      }

      return true;
    };

    console.log(`[Socket] Client connected: ${socket.id}`);

    // JOIN ROOM EVENT
    socket.on('join_room', async (data: { quizSessionId: string }) => {
      const { quizSessionId } = data;
      const authenticatedUser = socket.data.user as { userId: string; username: string; isGuest: boolean } | undefined;

      if (!authenticatedUser) {
        return socket.emit('error_message', { message: 'Authentication is required to join a lobby.' });
      }

      const closedReason = closedSessions.get(quizSessionId);
      if (closedReason) {
        socket.emit('session_closed', { reason: closedReason });
        return;
      }

      const { userId, username } = authenticatedUser;
      currentSessionId = quizSessionId;
      currentUserId = userId;

      console.log(`[Socket] User ${username} (${userId}) joining room: ${quizSessionId}`);

      try {
        // 1. Ensure participant record exists in DB
        const participant = await prisma.participant.upsert({
          where: {
            id: await (async () => {
              const existing = await prisma.participant.findFirst({
                where: { quizSessionId, userId }
              });
              return existing?.id || 'temp-id-will-create';
            })()
          },
          update: {
            // Keep existing isHost status; do not let the client demote themselves
          },
          create: {
            quizSessionId,
            userId,
            isHost: false,
            score: 0
          }
        });

        // 2. Put socket into room channel
        socket.join(quizSessionId);

        // 3. Initialize or update session state in memory
        if (!activeSessions.has(quizSessionId)) {
          const dbSession = await prisma.quizSession.findUnique({
            where: { id: quizSessionId },
            select: { theme: true }
          });
          const dbQuestions = await prisma.question.findMany({
            where: { quizSessionId }
          });
          activeSessions.set(quizSessionId, {
            quizSessionId,
            theme: dbSession?.theme || null,
            questions: dbQuestions || [],
            currentQuestionIndex: -1,
            timer: null,
            advanceTimer: null,
            secondsLeft: 30,
            startTime: 0,
            questionEndsAt: 0,
            answersSubmitted: new Set(),
            activePlayerSockets: new Map(),
            hostForfeitTimer: null,
            hostForfeited: false,
            roundEnded: false,
            gameOver: false,
            quizReady: dbQuestions.length > 0,
            preparingNextQuiz: false,
            lastLeaderboard: [],
            nextQuestionAt: null,
            answersByQuestion: new Map()
          });
        }

        const session = activeSessions.get(quizSessionId)!;
        const userSockets = session.activePlayerSockets.get(userId) || new Set<string>();
        userSockets.add(socket.id);
        session.activePlayerSockets.set(userId, userSockets);

        if (participant.isHost && session.hostForfeitTimer) {
          clearTimeout(session.hostForfeitTimer);
          session.hostForfeitTimer = null;
        }

        // 4. Retrieve list of all participants to broadcast presence
        await broadcastPresence(io, prisma, quizSessionId);

        if (session.timer) {
          session.secondsLeft = Math.max(
            0,
            Math.ceil((session.questionEndsAt - Date.now()) / 1000)
          );
        }

        // 5. Build current question info if active
        const currentQuestion = session.currentQuestionIndex >= 0 && session.questions.length > 0
          ? {
              questionIndex: session.currentQuestionIndex,
              questionText: session.questions[session.currentQuestionIndex].questionText,
              options: session.questions[session.currentQuestionIndex].options,
              totalQuestions: session.questions.length
            }
          : null;

        // 6. Send current game status to the client who just joined
        socket.emit('room_status', {
          joined: true,
          isHost: participant.isHost,
          currentQuestionIndex: session.currentQuestionIndex,
          isPlaying: session.currentQuestionIndex >= 0,
          secondsLeft: session.secondsLeft,
          theme: session.theme,
          currentQuestion,
          quizReady: session.quizReady,
          hostForfeited: session.hostForfeited,
          preparingNextQuiz: session.preparingNextQuiz,
          gameOver: session.gameOver,
          roundEnded: session.roundEnded,
          correctAnswer: session.roundEnded && currentQuestion
            ? session.questions[session.currentQuestionIndex].correctAnswer
            : null,
          explanation: session.roundEnded && currentQuestion
            ? session.questions[session.currentQuestionIndex].explanation
            : null,
          leaderboard: session.lastLeaderboard,
          nextQuestionAt: session.nextQuestionAt
        });

      } catch (err) {
        console.error('Error handling join_room:', err);
        socket.emit('error_message', { message: 'Failed to join the quiz session room.' });
      }
    });

    socket.on('quiz_generation_started', async (data: { quizSessionId: string }) => {
      const { quizSessionId } = data;
      if (!(await authorizeHost(quizSessionId))) return;

      const session = activeSessions.get(quizSessionId);
      if (!session || session.hostForfeited) return;

      session.preparingNextQuiz = true;
      session.quizReady = false;
      io.to(quizSessionId).emit('quiz_generation_started');
    });

    socket.on('quiz_generation_cancelled', async (data: { quizSessionId: string }) => {
      const { quizSessionId } = data;
      if (!(await authorizeHost(quizSessionId))) return;

      const session = activeSessions.get(quizSessionId);
      if (!session) return;

      session.preparingNextQuiz = false;
      io.to(quizSessionId).emit('quiz_generation_cancelled');
    });

    // QUIZ GENERATED EVENT
    socket.on('quiz_generated', async (data: { quizSessionId: string }) => {
      const { quizSessionId } = data;
      if (!(await authorizeHost(quizSessionId))) return;

      const session = activeSessions.get(quizSessionId);
      if (session) {
        try {
          const dbSession = await prisma.quizSession.findUnique({
            where: { id: quizSessionId },
            select: { theme: true }
          });
          const dbQuestions = await prisma.question.findMany({
            where: { quizSessionId }
          });
          session.theme = dbSession?.theme || null;
          session.questions = dbQuestions;
          session.currentQuestionIndex = -1;
          session.roundEnded = false;
          session.gameOver = false;
          session.quizReady = dbQuestions.length > 0;
          session.preparingNextQuiz = false;
          session.lastLeaderboard = [];
          session.nextQuestionAt = null;
          session.answersByQuestion.clear();
          io.to(quizSessionId).emit('quiz_ready', { theme: session.theme });
        } catch (err) {
          console.error('Error syncing generated quiz details:', err);
        }
      }
    });

    // START GAME EVENT
    socket.on('start_game', async (data: { quizSessionId: string }) => {
      const { quizSessionId } = data;
      if (!(await authorizeHost(quizSessionId))) return;

      const session = activeSessions.get(quizSessionId);

      if (!session) {
        return socket.emit('error_message', { message: 'Session not found.' });
      }

      try {
        const dbSession = await prisma.quizSession.findUnique({
          where: { id: quizSessionId },
          select: { theme: true }
        });
        const dbQuestions = await prisma.question.findMany({
          where: { quizSessionId }
        });

        if (dbQuestions.length === 0) {
          return socket.emit('error_message', { message: 'No questions generated for this session yet.' });
        }

        // Reset scores in database
        await prisma.participant.updateMany({
          where: { quizSessionId },
          data: { score: 0 }
        });

        session.theme = dbSession?.theme || null;
        session.questions = dbQuestions;
        session.currentQuestionIndex = 0;
        session.hostForfeited = false;
        session.roundEnded = false;
        session.gameOver = false;
        session.quizReady = true;
        session.preparingNextQuiz = false;
        session.lastLeaderboard = [];
        session.nextQuestionAt = null;
        session.answersByQuestion.clear();
        
        io.to(quizSessionId).emit('game_started', { theme: session.theme });
        startQuestionCycle(io, prisma, quizSessionId, 0);

      } catch (err) {
        console.error('Error starting game:', err);
        socket.emit('error_message', { message: 'Failed to start the game.' });
      }
    });

    // SUBMIT ANSWER EVENT
    socket.on('submit_answer', async (data: { quizSessionId: string; userId: string; answer: string }) => {
      const { quizSessionId, answer } = data;
      const userId = currentUserId;

      if (!userId || currentSessionId !== quizSessionId) {
        return socket.emit('error_message', { message: 'You are not joined to this lobby.' });
      }

      const session = activeSessions.get(quizSessionId);

      if (!session || session.currentQuestionIndex < 0 || session.hostForfeited || session.gameOver) {
        return socket.emit('error_message', { message: 'Active game session not found.' });
      }

      if (session.answersSubmitted.has(userId)) {
        return socket.emit('error_message', { message: 'Answer already submitted for this round.' });
      }

      try {
        const question = session.questions[session.currentQuestionIndex];
        const isCorrect = question.correctAnswer.trim().toLowerCase() === answer.trim().toLowerCase();

        let pointsEarned = 0;
        if (isCorrect) {
          // Speed multiplier calculation
          const elapsed = (Date.now() - session.startTime) / 1000; // seconds
          pointsEarned = 500 + Math.round(500 * (Math.max(0, 30 - elapsed) / 30));
          
          // Increment player score in DB
          const pRecord = await prisma.participant.findFirst({
            where: { quizSessionId, userId }
          });
          if (pRecord) {
            await prisma.participant.update({
              where: { id: pRecord.id },
              data: { score: pRecord.score + pointsEarned }
            });
            // Immediately broadcast latest scores to the sidebar standings pane
            await broadcastPresence(io, prisma, quizSessionId);
          }
        }

        session.answersSubmitted.add(userId);
        const questionAnswers = session.answersByQuestion.get(session.currentQuestionIndex) || new Map<string, string>();
        questionAnswers.set(userId, answer);
        session.answersByQuestion.set(session.currentQuestionIndex, questionAnswers);
        
        // Lookup username
        const userRecord = await prisma.user.findUnique({ where: { id: userId } });
        const username = userRecord?.username || 'Player';

        // Broadcast player submission event (renders checkmarks on screen)
        io.to(quizSessionId).emit('player_answered', {
          userId,
          username,
          pointsEarned,
          isCorrect
        });

        // If everyone has answered, fast-forward and end the round
        const activeUsersCount = session.activePlayerSockets.size;
        if (session.answersSubmitted.size >= activeUsersCount) {
          endRound(io, prisma, quizSessionId);
        }

      } catch (err) {
        console.error('Error submitting answer:', err);
      }
    });

    // CHAT MESSAGE EVENT
    socket.on('send_chat', async (data: { quizSessionId: string; userId: string; message: string }) => {
      const { quizSessionId, message } = data;
      const userId = currentUserId;

      if (!userId || currentSessionId !== quizSessionId) {
        return socket.emit('error_message', { message: 'You are not joined to this lobby.' });
      }

      if (!activeSessions.has(quizSessionId)) {
        return socket.emit('error_message', { message: 'This session is closed.' });
      }

      try {
        const userRecord = await prisma.user.findUnique({ where: { id: userId } });
        const username = userRecord?.username || 'Player';
        
        io.to(quizSessionId).emit('chat_message', {
          userId,
          username,
          message: message.trim(),
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Error broadcasting chat:', err);
      }
    });

    // NEXT QUESTION EVENT
    socket.on('next_question', async (data: { quizSessionId: string }) => {
      const { quizSessionId } = data;
      if (!(await authorizeHost(quizSessionId))) return;

      const session = activeSessions.get(quizSessionId);

      if (!session || session.hostForfeited || session.gameOver) return;
      advanceToNextQuestion(io, prisma, quizSessionId);
    });

    socket.on('close_session', async (
      data: { quizSessionId: string },
      acknowledge?: (result: { success: boolean }) => void
    ) => {
      const { quizSessionId } = data;
      if (!(await authorizeHost(quizSessionId))) {
        acknowledge?.({ success: false });
        return;
      }

      closeSession(io, quizSessionId, 'new_session');
      acknowledge?.({ success: true });
    });

    // DISCONNECT EVENT
    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      
      if (currentSessionId && currentUserId) {
        const session = activeSessions.get(currentSessionId);
        if (session) {
          const userSockets = session.activePlayerSockets.get(currentUserId);
          if (!userSockets?.has(socket.id)) return;

          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            session.activePlayerSockets.delete(currentUserId);
          }
          
          // Clean up session if empty
          if (session.activePlayerSockets.size === 0) {
            if (session.timer) clearInterval(session.timer);
            if (session.advanceTimer) clearTimeout(session.advanceTimer);
            if (session.hostForfeitTimer) clearTimeout(session.hostForfeitTimer);
            activeSessions.delete(currentSessionId);
            console.log(`[Socket] Cleaned up empty session: ${currentSessionId}`);
          } else {
            // Update presence for remaining players
            await broadcastPresence(io, prisma, currentSessionId);

            const disconnectedParticipant = await prisma.participant.findFirst({
              where: {
                quizSessionId: currentSessionId,
                userId: currentUserId,
                isHost: true
              }
            });

            if (disconnectedParticipant && !session.activePlayerSockets.has(currentUserId)) {
              if (session.hostForfeitTimer) clearTimeout(session.hostForfeitTimer);

              const forfeitedSessionId = currentSessionId;
              const forfeitedUserId = currentUserId;

              session.hostForfeitTimer = setTimeout(() => {
                const latestSession = activeSessions.get(forfeitedSessionId);
                if (!latestSession || latestSession.activePlayerSockets.has(forfeitedUserId)) return;

                if (latestSession.timer) {
                  clearInterval(latestSession.timer);
                  latestSession.timer = null;
                }

                latestSession.hostForfeited = true;
                latestSession.hostForfeitTimer = null;
                closeSession(io, forfeitedSessionId, 'host_forfeited');
              }, 5000);
            }
            
            // If we were waiting on answers, check if remaining players have all submitted
            if (session.currentQuestionIndex >= 0 && session.timer) {
              if (session.answersSubmitted.size >= session.activePlayerSockets.size) {
                endRound(io, prisma, currentSessionId);
              }
            }
          }
        }
      }
    });
  });
}

// HELPER: Broadcast live players presence state
async function broadcastPresence(io: Server, prisma: PrismaClient, quizSessionId: string) {
  const session = activeSessions.get(quizSessionId);
  const activeUserIds = session ? Array.from(session.activePlayerSockets.keys()) : [];

  try {
    const participants = await prisma.participant.findMany({
      where: { quizSessionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            isGuest: true
          }
        }
      }
    });

    const activePlayersList = participants.map(p => ({
      userId: p.userId,
      username: p.user.username,
      isGuest: p.user.isGuest,
      isHost: p.isHost,
      score: p.score,
      isOnline: activeUserIds.includes(p.userId)
    }));

    io.to(quizSessionId).emit('presence_update', activePlayersList);
  } catch (err) {
    console.error('Error broadcasting presence:', err);
  }
}

// HELPER: Core Question Cycle Management
function startQuestionCycle(io: Server, prisma: PrismaClient, quizSessionId: string, questionIndex: number) {
  const session = activeSessions.get(quizSessionId);
  if (!session) return;

  // Clear any existing timers
  if (session.timer) clearInterval(session.timer);
  if (session.advanceTimer) clearTimeout(session.advanceTimer);
  session.advanceTimer = null;
  session.nextQuestionAt = null;

  const question = session.questions[questionIndex];
  session.answersSubmitted.clear();
  session.secondsLeft = 30;
  session.startTime = Date.now();
  session.questionEndsAt = session.startTime + 30_000;
  session.roundEnded = false;

  // Send question details (excluding the correct answer and explanation for security!)
  io.to(quizSessionId).emit('question_start', {
    questionIndex,
    questionText: question.questionText,
    options: question.options,
    totalQuestions: session.questions.length,
    endsAt: session.questionEndsAt
  });

  // Authoritative countdown loop
  session.timer = setInterval(() => {
    session.secondsLeft = Math.max(0, Math.ceil((session.questionEndsAt - Date.now()) / 1000));
    io.to(quizSessionId).emit('timer_tick', {
      secondsLeft: session.secondsLeft,
      endsAt: session.questionEndsAt
    });

    if (session.secondsLeft <= 0) {
      endRound(io, prisma, quizSessionId);
    }
  }, 1000);
}

// HELPER: Conclude Question Round
async function endRound(io: Server, prisma: PrismaClient, quizSessionId: string) {
  const session = activeSessions.get(quizSessionId);
  if (!session || !session.timer) return;

  clearInterval(session.timer);
  session.timer = null;

  const currentQuestion = session.questions[session.currentQuestionIndex];

  try {
    // Get updated leaderboard
    const participants = await prisma.participant.findMany({
      where: { quizSessionId },
      include: {
        user: { select: { username: true, isGuest: true } }
      },
      orderBy: { score: 'desc' }
    });

    const leaderboard = participants.map(p => ({
      userId: p.userId,
      username: p.user.username,
      isGuest: p.user.isGuest,
      score: p.score,
      isHost: p.isHost
    }));

    session.roundEnded = true;
    session.lastLeaderboard = leaderboard;

    session.nextQuestionAt = Date.now() + 10_000;

    // Broadcast correct details
    io.to(quizSessionId).emit('round_ended', {
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation,
      leaderboard,
      nextQuestionAt: session.nextQuestionAt
    });

    session.advanceTimer = setTimeout(() => {
      advanceToNextQuestion(io, prisma, quizSessionId);
    }, 10_000);
  } catch (err) {
    console.error('Error concluding round:', err);
  }
}

// HELPER: End Game Session
async function endGame(io: Server, prisma: PrismaClient, quizSessionId: string) {
  const session = activeSessions.get(quizSessionId);
  if (!session) return;

  if (session.timer) clearInterval(session.timer);
  if (session.advanceTimer) clearTimeout(session.advanceTimer);
  if (session.hostForfeitTimer) clearTimeout(session.hostForfeitTimer);
  
  try {
    const participants = await prisma.participant.findMany({
      where: { quizSessionId },
      include: {
        user: { select: { username: true, isGuest: true } }
      },
      orderBy: { score: 'desc' }
    });

    const leaderboard = participants.map(p => ({
      userId: p.userId,
      username: p.user.username,
      isGuest: p.user.isGuest,
      score: p.score,
      isHost: p.isHost
    }));

    session.gameOver = true;
    session.quizReady = false;
    session.preparingNextQuiz = false;
    session.roundEnded = false;
    session.currentQuestionIndex = -1;
    session.lastLeaderboard = leaderboard;
    session.nextQuestionAt = null;

    session.activePlayerSockets.forEach((socketIds, userId) => {
      const summary = session.questions.map((question, questionIndex) => ({
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        submittedAnswer: session.answersByQuestion.get(questionIndex)?.get(userId) || null
      }));

      socketIds.forEach((socketId) => {
        io.to(socketId).emit('game_over', { leaderboard, summary });
      });
    });
  } catch (err) {
    console.error('Error ending game:', err);
  }
}

function advanceToNextQuestion(io: Server, prisma: PrismaClient, quizSessionId: string) {
  const session = activeSessions.get(quizSessionId);
  if (!session || session.hostForfeited || session.gameOver) return;

  if (session.advanceTimer) clearTimeout(session.advanceTimer);
  session.advanceTimer = null;
  session.nextQuestionAt = null;

  const nextIndex = session.currentQuestionIndex + 1;
  if (nextIndex < session.questions.length) {
    session.currentQuestionIndex = nextIndex;
    startQuestionCycle(io, prisma, quizSessionId, nextIndex);
  } else {
    void endGame(io, prisma, quizSessionId);
  }
}

function closeSession(
  io: Server,
  quizSessionId: string,
  reason: 'host_forfeited' | 'new_session'
) {
  const session = activeSessions.get(quizSessionId);
  if (session?.timer) clearInterval(session.timer);
  if (session?.advanceTimer) clearTimeout(session.advanceTimer);
  if (session?.hostForfeitTimer) clearTimeout(session.hostForfeitTimer);

  closedSessions.set(quizSessionId, reason);
  io.to(quizSessionId).emit('session_closed', { reason });
  activeSessions.delete(quizSessionId);
}
