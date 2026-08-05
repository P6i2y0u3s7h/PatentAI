import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <Loader2 size={size} className={`animate-spin text-blue-500 ${className}`} />
);

export const LoadingSkeletonCard: React.FC = () => (
  <div className="glass-card rounded-2xl p-6 border border-slate-800 animate-pulse space-y-4">
    <div className="flex justify-between items-start">
      <div className="h-6 bg-slate-800 rounded-md w-3/4"></div>
      <div className="h-6 bg-slate-800 rounded-full w-20"></div>
    </div>
    <div className="h-4 bg-slate-800/60 rounded w-1/3"></div>
    <div className="space-y-2 pt-2">
      <div className="h-3 bg-slate-800/40 rounded w-full"></div>
      <div className="h-3 bg-slate-800/40 rounded w-5/6"></div>
      <div className="h-3 bg-slate-800/40 rounded w-4/6"></div>
    </div>
    <div className="flex gap-2 pt-2">
      <div className="h-6 bg-slate-800/50 rounded-lg w-16"></div>
      <div className="h-6 bg-slate-800/50 rounded-lg w-16"></div>
      <div className="h-6 bg-slate-800/50 rounded-lg w-16"></div>
    </div>
  </div>
);

export const AiLoadingScreen: React.FC<{ message?: string }> = ({ message = 'Analyzing prior-art with AI models...' }) => (
  <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center">
    <div className="relative">
      <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30 animate-pulse">
        <Sparkles className="w-10 h-10 text-blue-400 animate-bounce" />
      </div>
      <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 border-t-transparent animate-spin"></div>
    </div>
    <div className="space-y-2 max-w-sm">
      <h4 className="text-lg font-semibold text-slate-100 font-heading">{message}</h4>
      <p className="text-sm text-slate-400">Embedding vector search & semantic similarity scoring in progress...</p>
    </div>
  </div>
);
