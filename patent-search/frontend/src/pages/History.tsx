import React from 'react';
import { useSearchHistory } from '../hooks/useSearch';
import { HistoryTable } from '../components/HistoryTable';
import { History as HistoryIcon } from 'lucide-react';

export const History: React.FC = () => {
  const { data: historyData, isLoading } = useSearchHistory(100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <HistoryIcon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-100">Search History Log</h1>
          <p className="text-slate-400 text-xs">All past prior-art queries and top matched results saved in Firestore.</p>
        </div>
      </div>

      <HistoryTable entries={historyData?.entries || []} isLoading={isLoading} />
    </div>
  );
};
