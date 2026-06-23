'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAsGuest } from './actions/auth';
import { User, Loader2 } from 'lucide-react';
import { AvatarCustomizer } from '@/components/AvatarCustomizer';

function RootAuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lobbyCode, setLobbyCode] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const lobbyCode = formData.get('lobbyCode') as string;
    const result = await loginAsGuest(formData);

    setLoading(false);

    if (result && result.error) {
      setError(result.error);
    } else if (result && result.success) {
      const cleanLobbyCode = lobbyCode?.trim();
      const finalRedirect = cleanLobbyCode 
        ? `/quiz/${cleanLobbyCode}` 
        : (redirectUrl === '/' ? '/dashboard' : redirectUrl);
      router.push(finalRedirect);
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 py-3 sm:p-6 font-mono text-white overflow-y-auto">
      <div className="w-full max-w-[20rem] sm:max-w-sm">
        
        <div className="text-center mb-3 sm:mb-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-white mb-1 lowercase pb-1 sm:pb-3" style={{ textShadow: '3px 3px 0 #a78bfa' }}>
            quizzly!
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-1.5 sm:space-y-4">
          <AvatarCustomizer />

          <div className="border border-white/10 bg-[#09090b] p-3 sm:p-6 rounded-none shadow-none space-y-2 sm:space-y-4">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs p-3 mb-4 flex items-center gap-2">
                <span className="font-bold">Error:</span> {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="block text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 sm:mb-2">
                username
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-500">
                  <User size={14} />
                </span>
                <input
                  type="text"
                  name="username"
                  id="username"
                  placeholder="goofy nickname (optional)..."
                  className="w-full bg-black border border-white/10 py-2 pl-8 sm:py-2.5 sm:pl-9 pr-3 text-[11px] sm:text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-all rounded-none"
                  maxLength={25}
                />
              </div>
            </div>

            <div>
              <label htmlFor="lobbyCode" className="block text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 sm:mb-2">
                Lobby Code (Optional)
              </label>
              <input
                type="text"
                name="lobbyCode"
                id="lobbyCode"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value)}
                placeholder="paste lobby code..."
                className="w-full bg-black border border-white/10 py-2 sm:py-2.5 px-3 text-[11px] sm:text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-all rounded-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-gray-200 disabled:bg-white/10 disabled:text-gray-600 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer rounded-none mt-1 sm:mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  {lobbyCode.trim() ? 'Joining Game...' : 'Creating Session...'}
                </>
              ) : (
                lobbyCode.trim() ? 'Join the game' : '+ new session'
              )}
            </button>

          </div>
        </form>



      </div>
    </main>
  );
}

export default function RootAuthPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <RootAuthPageContent />
    </Suspense>
  );
}
