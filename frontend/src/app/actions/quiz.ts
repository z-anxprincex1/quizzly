'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from './auth';

interface QuestionInput {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export async function createEmptySession() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'You must be authenticated to create a session.' };
  }

  try {
    const session = await prisma.quizSession.create({
      data: {
        topic: 'Pending Prompt...'
      }
    });

    await prisma.participant.create({
      data: {
        quizSessionId: session.id,
        userId: user.id,
        isHost: true,
        score: 0
      }
    });

    return { success: true, sessionId: session.id };
  } catch (err: any) {
    console.error('Error creating empty session:', err);
    return { error: 'Failed to create lobby.' };
  }
}

export async function saveQuizQuestionsForSession(sessionId: string, topic: string, questions: QuestionInput[], theme?: any) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'You must be authenticated to save a quiz.' };
  }

  try {
    const hostParticipant = await prisma.participant.findFirst({
      where: {
        quizSessionId: sessionId,
        userId: user.id,
        isHost: true
      }
    });

    if (!hostParticipant) {
      return { error: 'Only the lobby host can generate this quiz.' };
    }

    await prisma.$transaction([
      prisma.question.deleteMany({
        where: { quizSessionId: sessionId }
      }),
      prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          topic,
          theme: theme || undefined,
          questions: {
            create: questions.map(q => ({
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation
            }))
          }
        }
      })
    ]);

    return { success: true };
  } catch (err: any) {
    console.error('Error saving quiz questions to session:', err);
    return { error: 'Failed to write quiz configuration to database.' };
  }
}

export async function saveQuizSession(topic: string, questions: QuestionInput[], theme?: any) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'You must be authenticated to create a quiz.' };
  }

  try {
    // 1. Create Quiz Session with questions relation
    const session = await prisma.quizSession.create({
      data: {
        topic,
        theme: theme || undefined,
        questions: {
          create: questions.map(q => ({
            questionText: q.questionText,
            options: q.options, // Prisma maps this automatically to Json column in MySQL
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          }))
        }
      }
    });

    // 2. Automatically register the creator as the Host participant
    await prisma.participant.create({
      data: {
        quizSessionId: session.id,
        userId: user.id,
        isHost: true,
        score: 0
      }
    });

    return { success: true, sessionId: session.id };
  } catch (err: any) {
    console.error('Error saving quiz session to MySQL:', err);
    return { error: 'Failed to write quiz configuration to database.' };
  }
}
