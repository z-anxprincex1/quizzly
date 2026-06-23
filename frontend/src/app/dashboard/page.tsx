'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createEmptySession } from '../actions/quiz';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirectorPage() {
  const router = useRouter();
  const createSessionMutation = useMutation({
    mutationFn: createEmptySession,
    onSuccess: (result) => {
      if (result && result.success && result.sessionId) {
        router.push(`/quiz/${result.sessionId}`);
      }
    },
  });
  const { mutate: createSession, isIdle } = createSessionMutation;

  const error =
    createSessionMutation.data && !createSessionMutation.data.success
      ? createSessionMutation.data.error || 'Failed to initialize session.'
      : createSessionMutation.error?.message || null;

  useEffect(() => {
    if (isIdle) {
      createSession();
    }
  }, [createSession, isIdle]);

  if (error) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-6 font-mono text-white text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-500">Lobby Creation Failed</h2>
          <p className="text-xs text-gray-400">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black hover:bg-gray-200 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none border border-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center font-mono text-xs text-gray-400 select-none">
      <div className="text-center">
        <Loader2 className="animate-spin text-white mx-auto mb-4" size={24} />
        <p className="tracking-widest uppercase font-bold">Creating lobby room...</p>
      </div>
    </main>
  );
}
