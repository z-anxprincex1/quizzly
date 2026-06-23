import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface Player {
  userId: string;
  username: string;
  isGuest: boolean;
  isHost: boolean;
  score: number;
  isOnline: boolean;
  avatar?: string | null;
}

interface Question {
  questionIndex: number;
  questionText: string;
  options: string[];
  totalQuestions: number;
  endsAt?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  receivedAt: number;
}

export interface QuizSummaryItem {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  submittedAnswer: string | null;
  correctPlayers: {
    userId: string;
    username: string;
    avatar?: string | null;
  }[];
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  roomPlayers: Player[];
  gameStarted: boolean;
  currentQuestion: Question | null;
  secondsLeft: number;
  correctAnswer: string | null;
  explanation: string | null;
  leaderboard: Player[];
  hasAnswered: boolean;
  submittedAnswer: string | null;
  answeredUserIds: string[];
  isHost: boolean;
  isGameOver: boolean;
  pointsEarned: number | null;
  isCorrect: boolean | null;
  chatMessages: ChatMessage[];
  theme: any | null;
  quizReady: boolean;
  hasJoinedRoom: boolean;
  errorMessage: string | null;
  hostForfeited: boolean;
  preparingNextQuiz: boolean;
  sessionClosedReason: 'host_forfeited' | 'new_session' | null;
  nextQuestionAt: number | null;
  gameSummary: QuizSummaryItem[];

  connect: (userId: string, quizSessionId: string, authToken: string) => void;
  disconnect: () => void;
  startGame: (quizSessionId: string) => void;
  submitAnswer: (quizSessionId: string, userId: string, answer: string) => void;
  nextQuestion: (quizSessionId: string) => void;
  sendChat: (quizSessionId: string, userId: string, message: string) => void;
  notifyQuizGenerated: (quizSessionId: string) => void;
  notifyQuizGenerationStarted: (quizSessionId: string) => void;
  notifyQuizGenerationCancelled: (quizSessionId: string) => void;
  closeSession: (quizSessionId: string) => Promise<boolean>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  roomPlayers: [],
  gameStarted: false,
  currentQuestion: null,
  secondsLeft: 30,
  correctAnswer: null,
  explanation: null,
  leaderboard: [],
  hasAnswered: false,
  submittedAnswer: null,
  answeredUserIds: [],
  isHost: false,
  isGameOver: false,
  pointsEarned: null,
  isCorrect: null,
  chatMessages: [],
  theme: null,
  quizReady: false,
  hasJoinedRoom: false,
  errorMessage: null,
  hostForfeited: false,
  preparingNextQuiz: false,
  sessionClosedReason: null,
  nextQuestionAt: null,
  gameSummary: [],

  connect: (userId, quizSessionId, authToken) => {
    if (get().socket) get().disconnect();

    set({
      isHost: false,
      hasJoinedRoom: false,
      errorMessage: null,
      sessionClosedReason: null,
      hostForfeited: false,
      preparingNextQuiz: false
    });

    const socket = io(BACKEND_URL, {
      auth: { token: `Bearer ${authToken}` }
    });
    const isCurrentSocket = () => get().socket === socket;

    socket.on('connect', () => {
      if (!isCurrentSocket()) return;
      set({ isConnected: true, socket, errorMessage: null });
      socket.emit('join_room', { quizSessionId });
    });

    socket.on('connect_error', (err) => {
      if (!isCurrentSocket()) return;
      set({
        isConnected: false,
        hasJoinedRoom: false,
        errorMessage: err.message || 'Unable to connect to the quiz server.'
      });
    });

    socket.on('disconnect', () => {
      if (!isCurrentSocket()) return;
      set({ isConnected: false, hasJoinedRoom: false });
    });

    socket.on('presence_update', (players: Player[]) => {
      if (!isCurrentSocket()) return;
      set({ roomPlayers: players });
    });

    socket.on('room_status', (status: {
      joined: boolean;
      isHost: boolean;
      currentQuestionIndex: number;
      isPlaying: boolean;
      secondsLeft: number;
      theme: any | null;
      currentQuestion?: Question | null;
      quizReady?: boolean;
      hostForfeited?: boolean;
      preparingNextQuiz?: boolean;
      gameOver?: boolean;
      roundEnded?: boolean;
      correctAnswer?: string | null;
      explanation?: string | null;
      leaderboard?: Player[];
      nextQuestionAt?: number | null;
    }) => {
      if (!isCurrentSocket()) return;

      set({
        isHost: status.isHost,
        theme: status.theme,
        quizReady: status.quizReady || false,
        hasJoinedRoom: status.joined,
        errorMessage: null,
        hostForfeited: status.hostForfeited || false,
        preparingNextQuiz: status.preparingNextQuiz || false,
        isGameOver: status.gameOver || false,
        leaderboard: status.leaderboard || [],
        correctAnswer: status.roundEnded ? status.correctAnswer || null : null,
        explanation: status.roundEnded ? status.explanation || null : null,
        nextQuestionAt: status.nextQuestionAt || null
      });

      if (status.isPlaying || status.gameOver) {
        set({
          gameStarted: true,
          secondsLeft: status.secondsLeft,
          currentQuestion: status.currentQuestion || null
        });
      }
    });

    socket.on('quiz_ready', (data: { theme: any | null }) => {
      if (!isCurrentSocket()) return;
      set({
        quizReady: true,
        theme: data.theme,
        preparingNextQuiz: false,
        gameStarted: false,
        isGameOver: false,
        currentQuestion: null,
        correctAnswer: null,
        explanation: null,
        nextQuestionAt: null,
        gameSummary: []
      });
    });

    socket.on('quiz_generation_started', () => {
      if (!isCurrentSocket()) return;
      set({ preparingNextQuiz: true, quizReady: false });
    });

    socket.on('quiz_generation_cancelled', () => {
      if (!isCurrentSocket()) return;
      set({ preparingNextQuiz: false });
    });

    socket.on('game_started', (data?: { theme?: any }) => {
      if (!isCurrentSocket()) return;
      set({
        gameStarted: true,
        isGameOver: false,
        theme: data?.theme || get().theme,
        quizReady: true,
        currentQuestion: null,
        correctAnswer: null,
        explanation: null,
        hasAnswered: false,
        submittedAnswer: null,
        answeredUserIds: [],
        pointsEarned: null,
        isCorrect: null,
        hostForfeited: false,
        preparingNextQuiz: false,
        sessionClosedReason: null,
        nextQuestionAt: null,
        gameSummary: []
      });
    });

    socket.on('question_start', (question: Question) => {
      if (!isCurrentSocket()) return;
      set({
        currentQuestion: question,
        secondsLeft: 30,
        correctAnswer: null,
        explanation: null,
        hasAnswered: false,
        submittedAnswer: null,
        answeredUserIds: [],
        pointsEarned: null,
        isCorrect: null,
        nextQuestionAt: null
      });
    });

    socket.on('timer_tick', (data: { secondsLeft: number }) => {
      if (!isCurrentSocket()) return;
      set({ secondsLeft: data.secondsLeft });
    });

    socket.on('player_answered', (data: { userId: string; username: string; pointsEarned: number; isCorrect: boolean }) => {
      if (!isCurrentSocket()) return;
      set({ answeredUserIds: [...get().answeredUserIds, data.userId] });
      if (data.userId === userId) {
        set({ pointsEarned: data.pointsEarned, isCorrect: data.isCorrect });
      }
    });

    socket.on('round_ended', (data: {
      correctAnswer: string;
      explanation: string;
      leaderboard: Player[];
      nextQuestionAt: number;
    }) => {
      if (!isCurrentSocket()) return;
      set({
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        leaderboard: data.leaderboard,
        nextQuestionAt: data.nextQuestionAt
      });
    });

    socket.on('game_over', (data: { leaderboard: Player[]; summary: QuizSummaryItem[] }) => {
      if (!isCurrentSocket()) return;
      set({
        isGameOver: true,
        leaderboard: data.leaderboard,
        preparingNextQuiz: false,
        gameSummary: data.summary,
        nextQuestionAt: null
      });
    });

    socket.on('session_closed', (data: { reason: 'host_forfeited' | 'new_session' }) => {
      if (!isCurrentSocket()) return;
      set({
        hostForfeited: data.reason === 'host_forfeited',
        sessionClosedReason: data.reason,
        preparingNextQuiz: false
      });
    });

    socket.on('chat_message', (data: { userId: string; username: string; message: string; timestamp?: number }) => {
      if (!isCurrentSocket()) return;
      set({
        chatMessages: [
          ...get().chatMessages,
          {
            id: `${data.timestamp || Date.now()}-${data.userId}-${crypto.randomUUID()}`,
            userId: data.userId,
            username: data.username,
            message: data.message,
            receivedAt: Date.now()
          }
        ]
      });
    });

    socket.on('error_message', (data: { message: string }) => {
      if (!isCurrentSocket()) return;
      console.error('[Socket Error]:', data.message);
      set({ errorMessage: data.message });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) socket.disconnect();
    set({
      socket: null,
      isConnected: false,
      roomPlayers: [],
      gameStarted: false,
      currentQuestion: null,
      secondsLeft: 30,
      correctAnswer: null,
      explanation: null,
      leaderboard: [],
      hasAnswered: false,
      submittedAnswer: null,
      answeredUserIds: [],
      isHost: false,
      isGameOver: false,
      pointsEarned: null,
      isCorrect: null,
      chatMessages: [],
      theme: null,
      quizReady: false,
      hasJoinedRoom: false,
      errorMessage: null,
      hostForfeited: false,
      preparingNextQuiz: false,
      sessionClosedReason: null,
      nextQuestionAt: null,
      gameSummary: []
    });
  },

  startGame: (quizSessionId) => {
    get().socket?.emit('start_game', { quizSessionId });
  },

  submitAnswer: (quizSessionId, userId, answer) => {
    const { socket, hasAnswered } = get();
    if (socket && !hasAnswered) {
      socket.emit('submit_answer', { quizSessionId, userId, answer });
      set({ hasAnswered: true, submittedAnswer: answer });
    }
  },

  nextQuestion: (quizSessionId) => {
    get().socket?.emit('next_question', { quizSessionId });
  },

  sendChat: (quizSessionId, userId, message) => {
    const { socket } = get();
    if (socket && message.trim()) {
      socket.emit('send_chat', { quizSessionId, userId, message });
    }
  },

  notifyQuizGenerated: (quizSessionId) => {
    get().socket?.emit('quiz_generated', { quizSessionId });
  },

  notifyQuizGenerationStarted: (quizSessionId) => {
    get().socket?.emit('quiz_generation_started', { quizSessionId });
  },

  notifyQuizGenerationCancelled: (quizSessionId) => {
    get().socket?.emit('quiz_generation_cancelled', { quizSessionId });
    set({ preparingNextQuiz: false });
  },

  closeSession: (quizSessionId) => {
    const { socket } = get();
    if (!socket) return Promise.resolve(false);

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 2000);
      socket.emit('close_session', { quizSessionId }, (result: { success: boolean }) => {
        window.clearTimeout(timeout);
        resolve(result.success);
      });
    });
  }
}));
