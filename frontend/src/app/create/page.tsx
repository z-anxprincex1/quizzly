'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../actions/auth';
import { saveQuizSession } from '../actions/quiz';
import { Upload, FileText, ArrowLeft, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';

export default function CreateQuizPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push(`/?redirect=/create`);
    }
  }, [router, user, userLoading]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Only PDF documents are supported for ingestion.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Only PDF documents are supported.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !topic.trim()) {
      setError("Please upload a PDF document or type a topic prompt.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      setLoadingStep("Extracting text and chunking content...");
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      }
      if (topic.trim()) {
        formData.append("topic", topic.trim());
      }

      setLoadingStep("Invoking Gemini 2.5 API with Pydantic schemas...");
      const response = await fetch(`${AI_SERVICE_URL}/generate-quiz`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to communicate with AI worker.");
      }

      const generatedData = await response.json();

      setLoadingStep("Storing quiz sessions and question records in MySQL...");
      const dbResult = await saveQuizSession(generatedData.topic, generatedData.questions, generatedData.theme);

      if (dbResult.error) {
        throw new Error(dbResult.error);
      }

      setLoadingStep("Redirecting to your game lobby...");
      router.push(`/quiz/${dbResult.sessionId}`);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during quiz generation.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-grid p-6 md:p-12 relative overflow-hidden flex flex-col items-center justify-center">
      <div className="absolute top-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }}></div>

      <div className="w-full max-w-2xl z-10">
        
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm font-semibold cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h2 className="text-3xl font-black text-white flex items-center gap-2">
            <Sparkles className="text-purple-400" />
            Generate a Quiz
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Provide a document or write a detailed topic prompt. Our AI will compile a specialized multiple-choice quiz.
          </p>
        </div>

        <div className="glass-panel border border-white/10 rounded-2xl p-8 relative overflow-hidden">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="animate-spin text-purple-500 mb-6" size={48} />
              <h3 className="text-xl font-bold text-white mb-2">Analyzing Material</h3>
              <p className="text-purple-400 font-semibold text-sm animate-pulse">{loadingStep}</p>
              
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mt-6 max-w-xs relative border border-white/5">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 w-1/3 rounded-full absolute animate-[shimmer_1.5s_infinite]" style={{
                  animationName: 'shimmer',
                  animationDuration: '1.5s',
                  animationIterationCount: 'infinite'
                }}></div>
              </div>
              <style jsx>{`
                @keyframes shimmer {
                  0% { left: -33%; }
                  100% { left: 100%; }
                }
              `}</style>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-4 rounded-xl flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Generation Failed:</span> {error}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Ingest PDF Document (Optional)
                </label>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
                    dragActive 
                      ? "border-purple-500 bg-purple-500/5" 
                      : file 
                        ? "border-emerald-500/50 bg-emerald-500/5" 
                        : "border-white/10 hover:border-white/20 bg-white/2"
                  }`}
                  onClick={() => document.getElementById('pdf-file')?.click()}
                >
                  <input
                    type="file"
                    id="pdf-file"
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleFileChange}
                  />
                  {file ? (
                    <div className="text-center space-y-2">
                      <FileText className="text-emerald-400 mx-auto" size={40} />
                      <p className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</p>
                      <p className="text-[10px] text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB • Click to replace</p>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload className="text-gray-500 mx-auto" size={40} />
                      <p className="text-sm text-gray-300 font-medium">Drag & drop your study PDF here, or click to browse</p>
                      <p className="text-xs text-gray-500">Supports PDF files only</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Topic Prompt
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter a topic or outline (e.g. 'JavaScript Closures and Execution Context', 'The cell division process in biology', etc.)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-purple-500 placeholder:text-gray-600 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 hover:shadow-purple-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                Generate Quiz
              </button>

            </form>
          )}

        </div>

      </div>
    </main>
  );
}
