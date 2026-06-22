'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEmptySession } from '../actions/quiz';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirectorPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initLobby() {
      try {
        const result = await createEmptySession();
        if (!active) return;

        if (result && result.success && result.sessionId) {
          router.push(`/quiz/${result.sessionId}`);
        } else {
          setError(result?.error || 'Failed to initialize session.');
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'An unexpected error occurred.');
      }
    }

    initLobby();

    return () => {
      active = false;
    };
  }, [router]);

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
