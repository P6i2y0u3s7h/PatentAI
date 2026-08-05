import React, { useState } from 'react';
import { Search, Sparkles, FileText, SlidersHorizontal } from 'lucide-react';
import { Dropzone } from './Dropzone';

interface SearchFormProps {
  onSearch: (mode: 'text' | 'pdf', content: string | File, topK: number) => void;
  onSummarize: (mode: 'text' | 'pdf', content: string | File) => void;
  isLoadingSearch: boolean;
  isLoadingSummary: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  onSearch,
  onSummarize,
  isLoadingSearch,
  isLoadingSummary,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'pdf'>('text');
  const [textQuery, setTextQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [topK, setTopK] = useState(10);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (activeTab === 'text') {
      if (!textQuery.trim() || textQuery.trim().length < 10) {
        setErrorMsg('Please enter at least 10 characters for prior-art search.');
        return;
      }
      onSearch('text', textQuery, topK);
    } else {
      if (!selectedFile) {
        setErrorMsg('Please upload a PDF file to analyze.');
        return;
      }
      onSearch('pdf', selectedFile, topK);
    }
  };

  const handleSummarizeClick = () => {
    setErrorMsg('');
    if (activeTab === 'text') {
      if (!textQuery.trim() || textQuery.trim().length < 50) {
        setErrorMsg('Please enter at least 50 characters to summarize.');
        return;
      }
      onSummarize('text', textQuery);
    } else {
      if (!selectedFile) {
        setErrorMsg('Please upload a PDF file to summarize.');
        return;
      }
      onSummarize('pdf', selectedFile);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
      {/* Background glow behind form */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'text'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search size={16} /> Paste Patent Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'pdf'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={16} /> Upload Patent PDF
          </button>
        </div>

        {/* Top K selector */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <SlidersHorizontal size={14} className="text-blue-400" />
          <span>Top Results:</span>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="space-y-6">
        {activeTab === 'text' ? (
          <div>
            <textarea
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder="Paste patent abstract, technical claim, or detailed description here to search for prior-art..."
              rows={6}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm leading-relaxed"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-500 px-1">
              <span>Supports up to 10,000 characters</span>
              <span>{textQuery.length} chars</span>
            </div>
          </div>
        ) : (
          <Dropzone
            onFileSelect={(file) => setSelectedFile(file)}
            selectedFile={selectedFile}
            onClearFile={() => setSelectedFile(null)}
            disabled={isLoadingSearch || isLoadingSummary}
          />
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="w-full sm:w-auto flex items-center gap-3">
            <button
              type="submit"
              disabled={isLoadingSearch || isLoadingSummary}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Search size={18} />
              {isLoadingSearch ? 'Searching Vector Index...' : 'Search Prior-Art'}
            </button>

            <button
              type="button"
              onClick={handleSummarizeClick}
              disabled={isLoadingSearch || isLoadingSummary}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-semibold bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-blue-300 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles size={18} className="text-blue-400" />
              {isLoadingSummary ? 'Summarizing...' : 'Summarize Text'}
            </button>
          </div>

          <p className="text-xs text-slate-500 italic">
            Embeddings generated with <span className="font-mono text-slate-400">all-MiniLM-L6-v2</span>
          </p>
        </div>
      </form>
    </div>
  );
};
