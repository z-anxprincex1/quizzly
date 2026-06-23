'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser, getSocketAuthToken, logout } from '../../actions/auth';
import { saveQuizQuestionsForSession } from '../../actions/quiz';
import { type ChatMessage, useSocketStore } from '../../../store/useSocketStore';
import { MathText } from '../../../components/MathText';
import { 
  Copy, Check, Crown, Shield, Users, Clock, 
  Trophy, LogOut, ArrowRight, Home,
  Zap, MessageSquare, Loader2, AlertCircle
} from 'lucide-react';

const forceSquare = (classes: string | null | undefined): string => {
  if (!classes) return 'rounded-none';
  return classes.replace(/\brounded(-[a-z0-9]+)?\b/g, 'rounded-none');
};

const preserveAuthoredCase = (classes: string | null | undefined): string =>
  forceSquare(classes).replace(/\b(?:uppercase|lowercase|capitalize|normal-case)\b/g, 'normal-case');

const LOBBY_CODE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getLobbyCodeFromInput = (value: string): string | null => {
  const trimmedValue = value.trim();
  if (LOBBY_CODE_PATTERN.test(trimmedValue)) return trimmedValue;

  if (trimmedValue.toLowerCase().startsWith('/join ')) {
    const commandCode = trimmedValue.slice(6).trim();
    return LOBBY_CODE_PATTERN.test(commandCode) ? commandCode : null;
  }

  return null;
};

const isLobbyJoinInput = (value: string): boolean => getLobbyCodeFromInput(value) !== null;

export default function QuizRoomPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const sessionId = params.id;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Chat/Prompt input states
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const playersButtonRef = useRef<HTMLButtonElement>(null);
  const playersListRef = useRef<HTMLDivElement>(null);

  // Bind state store
  const store = useSocketStore();

  const lobbyDisplayNames = useMemo(() => {
    const groups = new Map<string, typeof store.roomPlayers>();

    store.roomPlayers.forEach((player) => {
      const normalizedName = player.username.trim().toLocaleLowerCase();
      const group = groups.get(normalizedName) || [];
      group.push(player);
      groups.set(normalizedName, group);
    });

    const names = new Map<string, string>();
    groups.forEach((players) => {
      const orderedPlayers = [...players].sort((a, b) => a.userId.localeCompare(b.userId));
      orderedPlayers.forEach((player, index) => {
        names.set(
          player.userId,
          orderedPlayers.length > 1
            ? `${player.username} (suspect ${index + 1})`
            : player.username
        );
      });
    });

    return names;
  }, [store.roomPlayers]);

  const lobbyPlayerColors = useMemo(() => {
    const colors = new Map<string, string>();
    const orderedPlayers = [...store.roomPlayers].sort((a, b) =>
      a.userId.localeCompare(b.userId)
    );

    orderedPlayers.forEach((player, index) => {
      const hue = Math.round((index * 137.508) % 360);
      colors.set(player.userId, `hsl(${hue} 85% 68%)`);
    });

    return colors;
  }, [store.roomPlayers]);

  const getDisplayUsername = (userId: string | undefined, fallback: string) =>
    (userId && lobbyDisplayNames.get(userId)) || fallback;

  const getPlayerColor = (userId: string | undefined) =>
    (userId && lobbyPlayerColors.get(userId)) || 'hsl(263 85% 68%)';
  
  // UI states
  const [showLogout, setShowLogout] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showSlogan, setShowSlogan] = useState(true);
  const [activeTab, setActiveTab] = useState<'prompt' | 'chat'>('prompt');
  const [readChatMessageCount, setReadChatMessageCount] = useState(0);
  const [promptTransientMessages, setPromptTransientMessages] = useState<ChatMessage[]>([]);
  const processedChatMessageCountRef = useRef(0);
  const promptMessageTimeoutsRef = useRef<number[]>([]);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const [closedSessionCode, setClosedSessionCode] = useState('');
  const [roundAdvanceSeconds, setRoundAdvanceSeconds] = useState(0);

  // AI Quiz generation states
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Inactivity tracking (2 mins idle + 1 min warning)
  const [isIdle, setIsIdle] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);

  useEffect(() => {
    // 120000ms = 2 minutes
    const IDLE_TIMEOUT_MS = 120000;
    let idleTimer: any;

    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      setIsIdle(false);
      setIdleCountdown(60);
      idleTimer = window.setTimeout(() => {
        setIsIdle(true);
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetIdleTimer);
    });

    resetIdleTimer();

    return () => {
      window.clearTimeout(idleTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, []);

  useEffect(() => {
    if (!isIdle) return;

    const interval = window.setInterval(() => {
      setIdleCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(interval);
          store.disconnect();
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isIdle, store, router]);

  useEffect(() => {
    getCurrentUser().then((currentUser) => {
      if (!currentUser) {
        router.push(`/?redirect=/quiz/${sessionId}`);
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
  }, [sessionId, router]);

  useEffect(() => {
    if (user) {
      let active = true;

      getSocketAuthToken().then((token) => {
        if (active && token) {
          store.connect(user.id, sessionId, token);
        }
      });

      return () => {
        active = false;
        store.disconnect();
      };
    }
  }, [user, sessionId]);

  useEffect(() => {
    if (!showPlayers) return;

    const closePlayersOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !playersButtonRef.current?.contains(target) &&
        !playersListRef.current?.contains(target)
      ) {
        setShowPlayers(false);
      }
    };

    document.addEventListener('pointerdown', closePlayersOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closePlayersOnOutsideClick);
  }, [showPlayers]);

  useEffect(() => {
    const disconnectBeforeWindowCloses = () => {
      useSocketStore.getState().socket?.disconnect();
    };

    window.addEventListener('beforeunload', disconnectBeforeWindowCloses);
    return () => window.removeEventListener('beforeunload', disconnectBeforeWindowCloses);
  }, []);

  // Scroll to bottom of chat list on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.chatMessages, activeTab]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setReadChatMessageCount(store.chatMessages.length);
      if (!store.gameStarted || store.isGameOver) {
        setPromptTransientMessages([]);
      }
    }
  }, [activeTab, store.chatMessages.length, store.gameStarted, store.isGameOver]);

  useEffect(() => {
    if (store.gameStarted && !store.isGameOver) {
      setActiveTab('chat');
    }
  }, [store.gameStarted, store.isGameOver]);

  useEffect(() => {
    const previousCount = processedChatMessageCountRef.current;
    const newMessages = store.chatMessages.slice(previousCount);
    processedChatMessageCountRef.current = store.chatMessages.length;

    const shouldUseTransientMessages =
      activeTab === 'prompt' || (store.gameStarted && !store.isGameOver);

    if (!shouldUseTransientMessages || newMessages.length === 0) return;

    setPromptTransientMessages((messages) => [...messages, ...newMessages]);

    const timeouts = newMessages.map((message) =>
      window.setTimeout(() => {
        setPromptTransientMessages((messages) =>
          messages.filter((candidate) => candidate.id !== message.id)
        );
      }, 5000)
    );
    promptMessageTimeoutsRef.current.push(...timeouts);
  }, [activeTab, store.chatMessages, store.gameStarted, store.isGameOver]);

  useEffect(() => () => {
    promptMessageTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
  }, []);

  useEffect(() => {
    if (!store.nextQuestionAt) {
      setRoundAdvanceSeconds(0);
      return;
    }

    const updateCountdown = () => {
      setRoundAdvanceSeconds(
        Math.max(0, Math.ceil((store.nextQuestionAt! - Date.now()) / 1000))
      );
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [store.nextQuestionAt]);

  const unreadChatMessageCount = Math.max(
    0,
    store.chatMessages.length - readChatMessageCount
  );

  const shouldUseTransientMessages =
    activeTab === 'prompt' || (store.gameStarted && !store.isGameOver);

  const displayedChatMessages = shouldUseTransientMessages
    ? promptTransientMessages
    : store.chatMessages;

  const generationInProgress = generating || store.preparingNextQuiz;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectOption = (option: string) => {
    if (store.hasAnswered || store.correctAnswer) return;
    store.submitAnswer(sessionId, user.id, option);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;

    const lobbyCode = getLobbyCodeFromInput(chatInput);
    if (lobbyCode) {
      setChatInput('');
      router.push(`/quiz/${lobbyCode}`);
      return;
    }

    store.sendChat(sessionId, user.id, chatInput.trim());
    setChatInput('');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleNewSessionRequest = () => {
    if (store.isHost) {
      setShowNewSessionConfirm(true);
      return;
    }

    router.push('/dashboard');
  };

  const confirmNewSession = async () => {
    const closed = await store.closeSession(sessionId);
    if (closed) {
      router.push('/dashboard');
    } else {
      setError('The current session could not be closed. Please try again.');
      setShowNewSessionConfirm(false);
    }
  };

  const handleClosedSessionJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const lobbyCode = getLobbyCodeFromInput(closedSessionCode);
    if (lobbyCode) router.push(`/quiz/${lobbyCode}`);
  };

  const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';

  const handleGenerateOrJoinQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = prompt.trim();
    if (!trimmedInput || generating) return;

    setError(null);

    // 1. Check if the input is a UUID (Lobby Room Code)
    const lobbyCode = getLobbyCodeFromInput(trimmedInput);
    if (lobbyCode) {
      router.push(`/quiz/${lobbyCode}`);
      return;
    }

    if (store.gameStarted && !store.isGameOver) {
      setError('Finish the active quiz before generating the next one.');
      return;
    }

    // Only host can trigger AI quiz generation
    if (!store.isHost) return;

    setShowSlogan(false);
    setGenerating(true);
    store.notifyQuizGenerationStarted(sessionId);

    try {
      setGeneratingStep("Invoking Gemini 3.5 AI model...");
      
      const formData = new FormData();
      formData.append("topic", trimmedInput);

      const response = await fetch(`${AI_SERVICE_URL}/generate-quiz`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to communicate with AI worker.");
      }

      const generatedData = await response.json(); // { topic: string, questions: [...], theme: {...} }

      setGeneratingStep("Writing quiz questions to database...");
      const dbResult = await saveQuizQuestionsForSession(sessionId, generatedData.topic, generatedData.questions, generatedData.theme);

      if (dbResult.error) {
        throw new Error(dbResult.error);
      }

      setGenerating(false);
      setPrompt('');
      
      // Notify other lobby players that the quiz has been generated!
      store.notifyQuizGenerated(sessionId);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during quiz generation.");
      setGenerating(false);
      setShowSlogan(true);
      store.notifyQuizGenerationCancelled(sessionId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-xs text-gray-400">
        <div className="text-center">
          <Loader2 className="animate-spin text-white mx-auto mb-4" size={24} />
          <p className="tracking-widest uppercase font-bold">Connecting to Lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen bg-black flex font-mono text-gray-200 overflow-hidden relative select-none">

      {/* Lobby branding for guests and for hosts after submitting a prompt */}
      {store.hasJoinedRoom && !store.gameStarted && (!store.isHost || !showSlogan) && (
        <div
          className="fixed top-20 sm:top-4 left-1/2 -translate-x-1/2 z-40 text-2xl sm:text-4xl font-black text-white tracking-tighter lowercase whitespace-nowrap"
          style={{ textShadow: '4px 4px 0 #a78bfa' }}
        >
          quizzly!
        </div>
      )}
      
      {/* Floating User Panel (Top Right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
        <div 
          onClick={() => setShowLogout(!showLogout)}
          className="bg-black/80 backdrop-blur border border-white/10 px-4 py-2 text-xs text-white cursor-pointer hover:border-white/20 select-none flex items-center gap-2 rounded-none max-w-[150px] sm:max-w-xs"
          title="Click to toggle logout"
        >
          <div
            className="w-1.5 h-1.5 animate-pulse shrink-0"
            style={{ backgroundColor: getPlayerColor(user?.id) }}
          ></div>
          <span className="font-semibold truncate block" style={{ color: getPlayerColor(user?.id) }}>
            {getDisplayUsername(user?.id, user?.username || 'Player')}
          </span>
        </div>
        
        {showLogout && (
          <div className="mt-2 flex justify-end z-50">
            <button
              onClick={handleLogout}
              className="h-10 w-10 bg-black border border-white/15 text-gray-400 hover:text-red-400 hover:border-red-400/40 transition-all flex items-center justify-center rounded-none shadow-xl"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button for New Session (Top Left) */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={handleNewSessionRequest}
          className="group flex items-center justify-start bg-white text-black hover:bg-gray-200 h-10 w-10 hover:w-48 transition-all duration-300 overflow-hidden whitespace-nowrap cursor-pointer shadow-lg rounded-none"
          title="new session"
        >
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-xl select-none">
            +
          </div>
          <span className="text-[10px] font-bold tracking-wider lowercase opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none pr-3">
            new session
          </span>
        </button>
      </div>

      {/* Floating Lobby Code copy button (Top Left - below Dashboard Button) */}
      <div className="fixed top-16 left-4 z-50">
        <button
          onClick={copyRoomCode}
          className="group flex items-center justify-start bg-white text-black hover:bg-gray-200 h-10 w-fit min-w-10 max-w-10 hover:max-w-[32rem] transition-[max-width,background-color] duration-300 overflow-hidden whitespace-nowrap cursor-pointer shadow-lg rounded-none"
          title="copy lobby code"
        >
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold select-none">
            {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
          </div>
          <span className="text-[10px] font-mono tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-all pr-3">
            {copied ? 'copied!' : sessionId}
          </span>
        </button>
      </div>

      {/* Players toggle (Top Right - below Profile Panel) */}
      <button
        ref={playersButtonRef}
        onClick={() => setShowPlayers((visible) => !visible)}
        className={`fixed right-4 z-50 h-10 w-10 flex items-center justify-center bg-white text-black hover:bg-gray-200 cursor-pointer shadow-lg rounded-none transition-[top] duration-200 ${showLogout ? 'top-28' : 'top-16'}`}
        title="Show players"
        aria-label="Toggle player list"
        aria-expanded={showPlayers}
      >
        <Users size={17} />
      </button>

      {/* Unboxed floating player list */}
      {showPlayers && (
        <div ref={playersListRef} className={`fixed right-4 z-40 max-h-[260px] w-[calc(100vw-5rem)] max-w-64 overflow-y-auto space-y-3 pr-1 font-mono drop-shadow-[0_2px_3px_rgba(0,0,0,1)] transition-[top] duration-200 ${showLogout ? 'top-40' : 'top-28'}`}>
          {!store.isConnected ? (
            <p className="text-sm text-gray-400 text-right">Connecting players...</p>
          ) : store.roomPlayers.length === 0 ? (
            <p className="text-sm text-gray-400 text-right">No players connected</p>
          ) : store.roomPlayers.map((player) => {
            const hasSubmitted = store.answeredUserIds.includes(player.userId);
            const isOnline = player.isOnline;
            return (
              <div key={player.userId} className="flex justify-between items-center gap-2 text-xs sm:text-sm min-w-0">
                <div className="flex items-center gap-2 min-w-0 truncate" title={getDisplayUsername(player.userId, player.username)}>
                  <span className={`w-2 h-2 rounded-none shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                  <span className="font-semibold truncate block max-w-[110px] sm:max-w-[150px]" style={{ color: getPlayerColor(player.userId) }}>
                    {getDisplayUsername(player.userId, player.username)}
                  </span>
                  {player.isHost && (
                    <span title="Host" className="shrink-0">
                      <Shield size={13} className="text-yellow-500" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-gray-400">{player.score} pt</span>
                  {store.gameStarted && !store.correctAnswer && !store.isGameOver && (
                    hasSubmitted ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <span className="w-2 h-2 bg-red-500 rounded-none animate-ping shrink-0" />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. CENTER PANEL (Main Game Board) */}
      <div className="flex-1 bg-[#09090b] flex flex-col justify-between relative">

        {store.sessionClosedReason && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-6 bg-black/75 backdrop-blur-md">
            <div className="text-center w-full max-w-xl">
              <p
                className="text-4xl md:text-6xl text-white font-black tracking-tighter lowercase"
                style={{ textShadow: '4px 4px 0 #ef4444' }}
              >
                {store.sessionClosedReason === 'host_forfeited'
                  ? 'host has forfeited'
                  : 'host started a new session'}
              </p>
              <p className="mt-4 text-sm text-gray-400 lowercase">
                this session is closed. enter a new lobby code to continue.
              </p>
              <form onSubmit={handleClosedSessionJoin} className="mt-8 flex border border-white/20 bg-black/70 p-1.5">
                <input
                  value={closedSessionCode}
                  onChange={(event) => setClosedSessionCode(event.target.value)}
                  placeholder="Paste a lobby code..."
                  className="flex-grow bg-transparent px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!isLobbyJoinInput(closedSessionCode)}
                  className="bg-white text-black disabled:bg-white/10 disabled:text-gray-600 px-4 text-xs font-bold"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Authoritative Thin Timer Line (Fixed top of main screen) */}
        {store.gameStarted && store.currentQuestion && !store.correctAnswer && (
          <div className="w-full h-1 bg-white/5 relative">
            <div 
              className="h-full bg-white transition-all duration-1000 ease-linear shadow-[0_0_8px_#ffffff]"
              style={{ width: `${(store.secondsLeft / 30) * 100}%` }}
            />
          </div>
        )}

        {/* Dynamic Center Panel */}
        <div className={`flex-grow overflow-y-auto no-scrollbar px-4 sm:px-8 py-8 flex flex-col items-center max-w-2xl mx-auto w-full ${
          store.gameStarted 
            ? 'justify-start pt-20 sm:pt-28' 
            : 'justify-center'
        } ${
          store.gameStarted && !store.isGameOver 
            ? 'pb-32 sm:pb-44' 
            : 'pb-20 sm:pb-24'
        }`}>
          
          {/* LOBBY / WAITING STATE */}
          {!store.gameStarted && (
            <div className="relative w-full max-w-xl flex items-center justify-center min-h-[300px]">
              
              {/* Generating overlay spinner */}
              {!store.hasJoinedRoom ? (
                store.errorMessage ? (
                  <p className="text-2xl font-black text-white tracking-tight lowercase">
                    lobby unavailable
                  </p>
                ) : (
                  <div className="text-center space-y-4 font-mono select-none">
                    <Loader2 className="animate-spin text-white mx-auto" size={28} />
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Joining lobby...</p>
                  </div>
                )
              ) : generationInProgress ? (
                <div className="text-center space-y-5 font-mono select-none">
                  <Loader2 className="animate-spin text-white mx-auto" size={32} />
                  <h3 className="text-3xl md:text-5xl text-white font-black tracking-tighter lowercase" style={{ textShadow: '4px 4px 0 #a78bfa' }}>
                    {store.isHost ? 'creating a new quizzly' : 'host is creating a new quizzly'}
                  </h3>
                  {generatingStep && (
                    <p className="text-[10px] text-purple-400 animate-pulse font-medium">{generatingStep}</p>
                  )}
                </div>
              ) : !store.quizReady ? (
                /* Slogan wait screen */
                <div 
                  className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
                    showSlogan ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                  }`}
                >
                  {store.isHost ? (
                    <div className="text-center select-none font-mono">
                      <p className="text-sm md:text-base text-gray-500 tracking-wider lowercase">
                        wanna learn something quickly?
                      </p>
                      <div className="mt-3 text-gray-400 tracking-widest lowercase flex items-baseline justify-center gap-2">
                        <span className="text-xs md:text-sm">try</span>
                        <span className="text-5xl md:text-6xl font-black text-white tracking-tighter lowercase" style={{ textShadow: '4px 4px 0 #a78bfa' }}>
                          quizzly!
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-8 text-center max-w-lg">
                      <p
                        className="text-2xl md:text-3xl text-white font-black tracking-tighter lowercase animate-pulse"
                        style={{ textShadow: '3px 3px 0 #a78bfa' }}
                      >
                        please wait while the host initiates a quizzly
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Slogan is done, Quiz is generated, waiting to start */
                <div className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out opacity-100 scale-100">
                  {store.isHost ? (
                    <div className="text-center space-y-4">
                      <button
                        onClick={() => store.startGame(sessionId)}
                        className="relative group px-10 py-5 bg-black text-white hover:text-black border-2 border-white text-base font-black uppercase tracking-widest cursor-pointer rounded-none shadow-[6px_6px_0_#a78bfa] hover:shadow-[0_0_25px_rgba(167,139,250,0.6)] active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#a78bfa] transition-all duration-200 overflow-hidden"
                      >
                        <span className="absolute inset-0 bg-[#a78bfa] -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out z-0" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          ⚡ start quiz ⚡
                        </span>
                      </button>
                      <p className="text-[10px] text-gray-500 lowercase">
                        quiz is ready. click start to initiate the game for all players.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center max-w-lg">
                      <p
                        className="text-3xl md:text-4xl text-white font-black tracking-tighter lowercase animate-pulse"
                        style={{ textShadow: '4px 4px 0 #34d399' }}
                      >
                        quizzly is ready!
                      </p>
                      <p className="text-lg text-white mt-4 lowercase">
                        but are you?
                      </p>
                      <p className="text-[10px] text-gray-500 mt-2 lowercase tracking-wider">
                        waiting on host to start the game
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Alert Box */}
          {(error || store.errorMessage) && !generating && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-200 text-xs p-4 flex items-start gap-2.5 max-w-xl w-full">
              <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
              <div>
                <span className="font-bold">Unable to continue:</span> {error || store.errorMessage}
              </div>
            </div>
          )}

          {store.gameStarted && store.isGameOver && generationInProgress && (
            <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
              <div className="text-center space-y-5">
                <Loader2 className="animate-spin text-white mx-auto" size={32} />
                <p className="text-3xl md:text-5xl text-white font-black tracking-tighter lowercase" style={{ textShadow: '4px 4px 0 #a78bfa' }}>
                  {store.isHost ? 'creating a new quizzly' : 'host is creating a new quizzly'}
                </p>
                {!store.isHost && (
                  <p className="text-xs text-gray-400 lowercase">you will stay in this lobby</p>
                )}
              </div>
            </div>
          )}

          {/* GAME OVER / PODIUM STANDS */}
          {store.gameStarted && store.isGameOver && (
            <div className={`w-full space-y-6 text-center transition-all duration-700 ${generationInProgress ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
              <Trophy className="text-white mx-auto mb-2" size={48} />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Quiz Completed</h2>
              
              {/* Standings List */}
              <div className="border border-white/10 bg-black/40 text-left font-mono rounded-none">
                <div className="border-b border-white/10 px-4 py-2 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Final Standings
                </div>
                <div className="divide-y divide-white/5">
                  {store.leaderboard.map((p, idx) => (
                    <div key={p.userId} className="flex justify-between items-center px-4 py-3 text-xs gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <span className="font-bold text-gray-500">#{idx + 1}</span>
                        <span className="font-semibold truncate block max-w-[120px] sm:max-w-[200px]" style={{ color: getPlayerColor(p.userId) }}>
                          {getDisplayUsername(p.userId, p.username)}
                        </span>
                        {p.isHost && <span className="text-[8px] border border-white/20 text-gray-400 px-1 rounded-none">Host</span>}
                      </div>
                      <span className="font-bold text-white">{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 text-left">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Your answer review</h3>
                {store.gameSummary.map((item, index) => {
                  const wasAnswered = item.submittedAnswer !== null;
                  const wasCorrect = item.submittedAnswer === item.correctAnswer;

                  return (
                    <div key={index} className="border border-white/10 bg-black/35 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Question {index + 1}
                      </p>
                      <div className="mt-2 text-sm font-bold leading-relaxed text-white normal-case">
                        <MathText>{item.questionText}</MathText>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs">
                        <p className={wasCorrect ? 'text-emerald-400' : wasAnswered ? 'text-red-400' : 'text-amber-300'}>
                          Your answer: {wasAnswered ? <MathText>{item.submittedAnswer!}</MathText> : 'No answer'}
                        </p>
                        <p className="text-emerald-400">
                          Correct answer: <MathText>{item.correctAnswer}</MathText>
                        </p>
                      </div>
                      <div className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-gray-300 normal-case">
                        <MathText>{item.explanation}</MathText>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ACTIVE GAMEPLAY QUESTION & REVEAL CARD */}
          {store.gameStarted && store.currentQuestion && !store.isGameOver && (
            <div 
              className={`w-full relative p-6 border flex flex-col gap-6 rounded-none ${
                store.theme 
                  ? forceSquare(store.theme.backgroundColor) 
                  : 'border-white/10 bg-black/40'
              }`}
              style={store.theme ? { fontFamily: store.theme.fontFamily } : {}}
            >
              {/* Custom Google Font Link Injection */}
              {store.theme && (
                <link rel="stylesheet" href={store.theme.fontUrl} />
              )}

              {/* Custom Card Decoration HTML (e.g. scanlines, grids, etc.) */}
              {store.theme?.cardDecorationHtml && (
                <div 
                  className="absolute inset-0 pointer-events-none overflow-hidden z-0"
                  dangerouslySetInnerHTML={{ __html: store.theme.cardDecorationHtml }}
                />
              )}

              <div className="relative z-10 flex flex-col gap-6 w-full">
                {/* Heading */}
                <div className="flex justify-between items-end border-b border-white/10 pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    Question {store.currentQuestion.questionIndex + 1} of {store.currentQuestion.totalQuestions}
                  </span>
                  <span className="text-xs font-mono font-bold">
                    Time: {store.correctAnswer ? roundAdvanceSeconds : store.secondsLeft}s
                  </span>
                </div>

                {/* Question Text */}
                <div className={store.theme ? preserveAuthoredCase(store.theme.questionStyle) : "border border-white/10 bg-black/50 p-6 text-center rounded-none normal-case"}>
                  <div className="text-md md:text-lg font-bold leading-relaxed normal-case">
                    <MathText>{store.currentQuestion.questionText}</MathText>
                  </div>
                </div>

                {/* Selections Grid */}
                <div className="grid grid-cols-1 gap-3">
                  {store.currentQuestion.options.map((option: string) => {
                    const isSelected = store.submittedAnswer === option;
                    const isCorrectOpt = store.correctAnswer === option;
                    const isIncorrectOpt = store.correctAnswer && isSelected && !isCorrectOpt;

                    const semanticResultStyle = store.correctAnswer
                      ? isCorrectOpt
                        ? '!border-emerald-400 !bg-emerald-500/20 !text-emerald-200 !shadow-[0_0_18px_rgba(52,211,153,0.35)]'
                        : isIncorrectOpt
                          ? '!border-red-500 !bg-red-500/20 !text-red-200 !shadow-[0_0_18px_rgba(239,68,68,0.3)]'
                          : ''
                      : '';

                    let btnStyle = "";
                    
                    if (store.theme) {
                      if (store.correctAnswer) {
                        if (isCorrectOpt) {
                          btnStyle = forceSquare(store.theme.optionCorrectStyle);
                        } else if (isIncorrectOpt) {
                          btnStyle = forceSquare(store.theme.optionIncorrectStyle);
                        } else {
                          btnStyle = `${forceSquare(store.theme.optionNormalStyle)} opacity-30 pointer-events-none`;
                        }
                      } else if (isSelected) {
                        btnStyle = forceSquare(store.theme.optionSelectedStyle);
                      } else {
                        btnStyle = forceSquare(store.theme.optionNormalStyle);
                      }
                    } else {
                      // Default styles fallback
                      btnStyle = "border-white/10 bg-black hover:border-white text-gray-300 rounded-none";
                      if (store.correctAnswer) {
                        if (isCorrectOpt) {
                          btnStyle = "border-emerald-500 bg-emerald-950/20 text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)] rounded-none";
                        } else if (isIncorrectOpt) {
                          btnStyle = "border-red-500 bg-red-950/20 text-red-400 rounded-none";
                        } else {
                          btnStyle = "border-white/5 bg-transparent text-gray-600 opacity-40 rounded-none";
                        }
                      } else if (isSelected) {
                        btnStyle = "border-white bg-white/5 text-white font-bold rounded-none";
                      }
                    }

                    // Keep blocky buttons without changing authored question/answer casing.
                    btnStyle = preserveAuthoredCase(btnStyle);

                    return (
                      <button
                        key={option}
                        disabled={store.hasAnswered || !!store.correctAnswer}
                        onClick={() => handleSelectOption(option)}
                        className={`w-full text-left p-4 border text-xs transition-all focus:outline-none cursor-pointer flex justify-between items-center rounded-none ${btnStyle} ${semanticResultStyle}`}
                      >
                        <MathText>{option}</MathText>
                        {isSelected && !store.correctAnswer && <Check size={14} />}
                        {store.correctAnswer && isCorrectOpt && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>

                {/* AI Explanation details */}
                {store.correctAnswer && (
                  <div className="space-y-4">
                    <div className={store.theme ? forceSquare(store.theme.explanationStyle) : "border border-white/10 bg-black/40 p-5 rounded-none"}>
                      <div className="flex gap-3 items-start">
                        <div className="p-1 mt-0.5 rounded-none shrink-0">
                          <Clock size={16} className="opacity-70" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                            store.submittedAnswer === null
                              ? 'text-amber-300'
                              : store.isCorrect
                                ? 'text-emerald-300'
                                : 'text-red-300'
                          }`}>
                            {store.submittedAnswer === null
                              ? 'No Answer '
                              : store.isCorrect
                                ? 'Correct Option '
                                : 'Incorrect Choice '} 
                            ({store.pointsEarned ? `+${store.pointsEarned} pts` : '+0 pts'})
                          </h4>
                          <div className="text-[10px] opacity-80 leading-relaxed normal-case">
                            <MathText>{store.explanation || ''}</MathText>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM CONTROLS & ANIMATED CONSOLE TOGGLES (Lobby room active) */}
        <div className="absolute inset-x-0 bottom-4 flex flex-col items-center justify-end z-25 px-4 pointer-events-none">
            
            {/* Chat Messages Overlay (Floats directly above the expanded chat bar) */}
            {displayedChatMessages.length > 0 && (
              <div className="max-w-2xl w-full h-36 overflow-y-auto flex flex-col justify-end font-mono text-xl mb-2 px-3 select-all pointer-events-auto">
                <div className="space-y-1.5">
                  {displayedChatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${shouldUseTransientMessages ? 'animate-chat-message-lifetime' : ''}`}
                    >
                      <span className="font-bold" style={{ color: getPlayerColor(msg.userId) }}>
                        {getDisplayUsername(msg.userId, msg.username)}:
                      </span>{' '}
                      <span className="text-gray-300 break-words">{msg.message}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {/* Dynamic Horizontal Sliding Toggles */}
            <div className="max-w-2xl w-full flex items-center justify-between gap-3 pointer-events-auto">
              
              {/* PROMPT PANEL CONTAINER */}
              <div 
                className={`transition-all duration-500 ease-in-out overflow-hidden flex items-center bg-black/60 backdrop-blur-xl border border-white/20 rounded-none p-1.5 ${
                  activeTab === 'prompt' 
                    ? 'flex-grow opacity-100' 
                    : 'w-12 h-12 flex-shrink-0 justify-center'
                }`}
              >
                {activeTab === 'prompt' ? (
                  <form onSubmit={handleGenerateOrJoinQuiz} className="flex gap-2 items-center w-full min-w-0">
                    <input
                      type="text"
                      disabled={generating || !store.isHost}
                      placeholder={!store.isHost ? "Only the host can use the quiz prompt..." : store.gameStarted && !store.isGameOver ? "Quiz active — wait until results to generate again..." : "Ask AI to generate a quiz..."}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="flex-grow min-w-0 bg-transparent px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none animate-fadeIn disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!store.isHost || !prompt.trim() || generating || (store.gameStarted && !store.isGameOver)}
                      className="bg-white text-black hover:bg-gray-200 disabled:bg-white/10 disabled:text-gray-600 p-2.5 transition-all cursor-pointer rounded-none flex-shrink-0"
                      title="Send Prompt"
                    >
                      <Zap size={14} className="fill-current" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setActiveTab('prompt')}
                    className="h-9 w-9 flex items-center justify-center rounded-none transition-all bg-white/10 border border-white/20 text-white hover:bg-white/20 cursor-pointer"
                    title="Switch to Prompt Box"
                  >
                    <Zap size={14} className={store.isHost ? 'fill-current' : ''} />
                  </button>
                )}
              </div>

              {/* CHAT PANEL CONTAINER */}
              <div 
                className={`transition-all duration-500 ease-in-out flex items-center bg-black/60 backdrop-blur-xl border border-white/20 rounded-none p-1.5 ${
                  activeTab === 'chat' 
                    ? 'flex-grow opacity-100 overflow-hidden' 
                    : 'w-12 h-12 flex-shrink-0 justify-center overflow-visible'
                }`}
              >
                {activeTab === 'chat' ? (
                  <form onSubmit={handleSendChatMessage} className="flex items-center w-full min-w-0">
                    <input
                      type="text"
                      placeholder="Type a message and press Enter..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-grow min-w-0 bg-transparent px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none animate-fadeIn"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="bg-white text-black hover:bg-gray-200 disabled:bg-white/10 disabled:text-gray-600 p-2.5 transition-all cursor-pointer rounded-none flex-shrink-0"
                      title="Send Chat"
                      aria-label="Send chat message"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="relative h-9 w-9 bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center justify-center cursor-pointer rounded-none transition-all"
                    title="Switch to Lobby Chat"
                  >
                    <MessageSquare size={14} />
                    {unreadChatMessageCount > 0 && (
                      <span className="absolute -top-3 -right-3 w-6 h-6 bg-purple-500 text-white text-[10px] font-black leading-6 text-center rounded-full shadow-lg">
                        {unreadChatMessageCount > 99 ? '99+' : unreadChatMessageCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

            </div>
        </div>

      </div>

      {showNewSessionConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 backdrop-blur-md px-6">
          <div className="w-full max-w-lg border border-white/20 bg-[#09090b] p-7 text-center shadow-2xl">
            <h2 className="text-2xl font-black text-white lowercase">start a new session?</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              This will disconnect every player in this lobby. They will need the new lobby code to join again.
            </p>
            <p className="mt-3 text-xs text-purple-300">
              To keep the same players, cancel and create the next quiz from the prompt box.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowNewSessionConfirm(false)}
                className="border border-white/20 px-4 py-3 text-xs font-bold text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={confirmNewSession}
                className="bg-white px-4 py-3 text-xs font-black text-black hover:bg-gray-200"
              >
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inactivity Warning Popup */}
      {isIdle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
          <div className="w-full max-w-md border border-white/20 bg-[#09090b] p-6 text-center shadow-2xl rounded-none">
            <h2 className="text-2xl font-black text-white lowercase">Are you still here?</h2>
            <p className="mt-4 text-xs leading-relaxed text-gray-400">
              We noticed you've been inactive. You will be automatically disconnected and returned to the home screen in:
            </p>
            <div className="my-6 text-5xl font-black text-purple-400 animate-pulse font-mono">
              {idleCountdown}s
            </div>
            <button
              onClick={() => {
                setIsIdle(false);
                setIdleCountdown(60);
              }}
              className="w-full bg-white text-black hover:bg-gray-200 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none border border-white hover:border-gray-200"
            >
              I'm still here
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
