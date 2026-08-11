import React, { useState, useMemo } from 'react';
import { PatentResult } from '../types/patent';
import { PatentCard } from './PatentCard';
import { LoadingSkeletonCard } from './Loading';
import { Clock, Database, Download, Filter, ArrowUpDown } from 'lucide-react';

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
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc' | 'title-asc' | 'date-desc'>('score-desc');
  const [selectedIpc, setSelectedIpc] = useState<string>('ALL');

  const ipcClasses = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      if (r.ipc_class) set.add(r.ipc_class);
    });
    return Array.from(set).sort();
  }, [results]);

  const filteredAndSortedResults = useMemo(() => {
    let list = [...results];
    if (selectedIpc !== 'ALL') {
      list = list.filter((r) => r.ipc_class === selectedIpc);
    }
    list.sort((a, b) => {
      if (sortBy === 'score-desc') return b.similarity_score - a.similarity_score;
      if (sortBy === 'score-asc') return a.similarity_score - b.similarity_score;
      if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
      if (sortBy === 'date-desc') return b.publication_date.localeCompare(a.publication_date);
      return 0;
    });
    return list;
  }, [results, selectedIpc, sortBy]);

  const exportAsJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `patentai_results_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportAsCSV = () => {
    const headers = ['ID', 'Title', 'SimilarityScore', 'IPCClass', 'Assignee', 'PublicationDate', 'Country'];
    const rows = results.map((r) => [
      `"${r.id}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      r.similarity_score,
      `"${r.ipc_class}"`,
      `"${r.assignee.replace(/"/g, '""')}"`,
      `"${r.publication_date}"`,
      `"${r.country}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `patentai_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-100 font-heading">Prior-Art Search Results</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold">
            {filteredAndSortedResults.length} of {totalFound} Matched
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
            <ArrowUpDown size={13} className="text-blue-400" />
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="score-desc" className="bg-slate-900">Highest Score</option>
              <option value="score-asc" className="bg-slate-900">Lowest Score</option>
              <option value="title-asc" className="bg-slate-900">Title A-Z</option>
              <option value="date-desc" className="bg-slate-900">Newest Date</option>
            </select>
          </div>

          {ipcClasses.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
              <Filter size={13} className="text-blue-400" />
              <span>IPC:</span>
              <select
                value={selectedIpc}
                onChange={(e) => setSelectedIpc(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none font-medium cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All IPC Classes</option>
                {ipcClasses.map((ipc) => (
                  <option key={ipc} value={ipc} className="bg-slate-900">{ipc}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={exportAsCSV}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1 font-medium"
              title="Export CSV"
            >
              <Download size={13} className="text-emerald-400" /> CSV
            </button>
            <button
              onClick={exportAsJSON}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1 font-medium"
              title="Export JSON"
            >
              <Download size={13} className="text-blue-400" /> JSON
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1">
          <Clock size={13} className="text-blue-400" /> Latency: {searchTimeMs.toFixed(1)} ms
        </span>
        <span className="flex items-center gap-1">
          <Database size={13} className="text-blue-400" /> Engine: FAISS IP (Inner Product Cosine)
        </span>
      </div>

      {/* List of Cards */}
      <div className="space-y-4">
        {filteredAndSortedResults.map((patent, index) => (
          <PatentCard key={patent.id || index} patent={patent} index={index} />
        ))}
      </div>
    </div>
  );
};

