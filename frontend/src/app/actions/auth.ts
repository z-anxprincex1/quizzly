'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'quizly-jwt-secret-key-super-secure-change-in-prod';
const COOKIE_NAME = 'quizly_session';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function setSessionCookie(userId: string, username: string, isGuest: boolean, avatar?: string | null) {
  const token = jwt.sign(
    { userId, username, isGuest, avatar: avatar || null },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isGuest || !user.passwordHash) {
      return { error: 'Invalid email or password.' };
    }

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return { error: 'Invalid email or password.' };
    }

    await setSessionCookie(user.id, user.username, false);
    return { success: true, user: { id: user.id, username: user.username, isGuest: false } };
  } catch (err: any) {
    console.error('Login error:', err);
    return { error: 'An unexpected database error occurred.' };
  }
}

export async function signUp(formData: FormData) {
  const username = formData.get('username') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!username || !email || !password) {
    return { error: 'Please fill in all fields.' };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: 'An account with this email already exists.' };
    }

    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        isGuest: false
      }
    });

    await setSessionCookie(user.id, user.username, false);
    return { success: true, user: { id: user.id, username: user.username, isGuest: false } };
  } catch (err: any) {
    console.error('Sign-up error:', err);
    return { error: 'An unexpected database error occurred.' };
  }
}

const GUEST_NAMES = [
  'MindMaven', 'BrainBooster', 'QuizQuestor', 'ScholarSpark',
  'TriviaTitan', 'LogicLord', 'CerebralSage', 'QuantumQuizzer',
  'KnowledgeKnight', 'FactFinder'
];

export async function loginAsGuest(formData: FormData) {
  let username = formData.get('username') as string;
  const avatar = formData.get('avatar') as string || null;
  
  if (!username || !username.trim()) {
    const randIndex = Math.floor(Math.random() * GUEST_NAMES.length);
    const randNum = Math.floor(1000 + Math.random() * 9000);
    username = `${GUEST_NAMES[randIndex]}-${randNum}`;
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        isGuest: true,
        avatar
      }
    });

    await setSessionCookie(user.id, user.username, true, user.avatar);
    return { success: true, user: { id: user.id, username: user.username, isGuest: true, avatar: user.avatar } };
  } catch (err: any) {
    console.error('Guest login error:', err);
    return { error: 'An unexpected database error occurred.' };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return { success: true };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; isGuest: boolean };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: user.isGuest,
      avatar: user.avatar
    };
  } catch (err) {
    return null;
  }
}

export async function getSocketAuthToken() {
  const user = await getCurrentUser();
  if (!user) return null;

  return jwt.sign(
    { userId: user.id, username: user.username, isGuest: user.isGuest, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}
