import React from 'react';
import { Trash2, FileText, Search, ExternalLink } from 'lucide-react';
import { SearchHistoryEntry } from '../types/patent';
import { useDeleteHistory } from '../hooks/useSearch';

interface HistoryTableProps {
  entries: SearchHistoryEntry[];
  isLoading: boolean;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ entries, isLoading }) => {
  const deleteMutation = useDeleteHistory();

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center text-slate-400">
        Loading search history...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 space-y-3">
        <Search className="w-10 h-10 text-slate-600 mx-auto" />
        <h4 className="text-base font-semibold text-slate-200">No Search History Yet</h4>
        <p className="text-xs text-slate-500">Your prior-art searches will automatically be logged here.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800 font-heading">
            <tr>
              <th className="px-6 py-4">Source</th>
              <th className="px-6 py-4">Query Snippet</th>
              <th className="px-6 py-4">Top Result</th>
              <th className="px-6 py-4">Similarity</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-900/40 transition-colors">
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold ${
                      entry.source === 'pdf'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {entry.source === 'pdf' ? <FileText size={12} /> : <Search size={12} />}
                    {entry.source.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 max-w-xs font-mono text-xs truncate text-slate-300">
                  {entry.query_snippet}
                </td>
                <td className="px-6 py-4 max-w-xs truncate font-medium text-slate-200">
                  {entry.top_result_title || 'N/A'}
                </td>
                <td className="px-6 py-4">
                  {entry.top_result_score !== undefined && entry.top_result_score !== null ? (
                    <span className="font-mono font-bold text-xs text-blue-400">
                      {(entry.top_result_score * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(entry.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete Entry"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
