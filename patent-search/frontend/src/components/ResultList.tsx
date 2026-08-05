import React from 'react';
import { PatentResult } from '../types/patent';
import { PatentCard } from './PatentCard';
import { LoadingSkeletonCard } from './Loading';
import { SearchX, Clock, Database } from 'lucide-react';

interface ResultListProps {
  results: PatentResult[];
  totalFound: number;
  searchTimeMs: number;
  isLoading: boolean;
}

export const ResultList: React.FC<ResultListProps> = ({
  results,
  totalFound,
  searchTimeMs,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4 mt-8">
        <LoadingSkeletonCard />
        <LoadingSkeletonCard />
        <LoadingSkeletonCard />
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-100 font-heading">Prior-Art Search Results</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold">
            {totalFound} Matched
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={13} className="text-blue-400" /> {searchTimeMs.toFixed(1)} ms latency
          </span>
          <span className="flex items-center gap-1">
            <Database size={13} className="text-blue-400" /> FAISS Cosine Index
          </span>
        </div>
      </div>

      {/* List of Cards */}
      <div className="space-y-4">
        {results.map((patent, index) => (
          <PatentCard key={patent.id || index} patent={patent} index={index} />
        ))}
      </div>
    </div>
  );
};
