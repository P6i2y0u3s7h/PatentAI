import React, { useState, useEffect } from 'react';
import { Search, Sparkles, FileText, SlidersHorizontal } from 'lucide-react';
import { Dropzone } from './Dropzone';

const TYPEWRITER_PROMPTS = [
  'Paste patent abstract, technical claim, or detailed description here to search for prior-art...',
  'e.g. Deep neural network for transformer-based vector search and claim extraction...',
  'e.g. Solid-state lithium battery electrolyte with ceramic nanostructure coating...',
  'e.g. Autonomous flight control system utilizing reinforcement learning and LiDAR...',
  'e.g. CRISPR Cas-12 gene editing method for targeted sequence alteration in eukaryotic cells...',
];

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
  const [placeholderText, setPlaceholderText] = useState(TYPEWRITER_PROMPTS[0]);

  // Typewriter animation for placeholder text
  useEffect(() => {
    if (activeTab !== 'text' || textQuery) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let promptIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timeoutId: any;

    const tick = () => {
      const currentPrompt = TYPEWRITER_PROMPTS[promptIdx];

      if (!isDeleting) {
        charIdx++;
        setPlaceholderText(currentPrompt.slice(0, charIdx));
        if (charIdx >= currentPrompt.length) {
          isDeleting = true;
          timeoutId = setTimeout(tick, 2600);
          return;
        }
        timeoutId = setTimeout(tick, 32);
      } else {
        charIdx -= 2;
        setPlaceholderText(currentPrompt.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          isDeleting = false;
          promptIdx = (promptIdx + 1) % TYPEWRITER_PROMPTS.length;
          timeoutId = setTimeout(tick, 450);
          return;
        }
        timeoutId = setTimeout(tick, 18);
      }
    };

    timeoutId = setTimeout(tick, 2000);
    return () => clearTimeout(timeoutId);
  }, [activeTab, textQuery]);

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
      if (!textQuery.trim() || textQuery.trim().length < 10) {
        setErrorMsg('Please enter at least 10 characters to summarize.');
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
    <div className="w-full max-w-4xl mx-auto rounded-3xl p-6 sm:p-8 bg-[#0B1020]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_0_50px_-15px_rgba(6,182,212,0.18)] relative overflow-hidden transition-all duration-300">
      {/* Background ambient lighting behind form */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6 relative z-10">
        <div className="flex gap-2 p-1 bg-[#05070D]/90 rounded-xl border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'text'
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Search size={16} /> Paste Patent Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'pdf'
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <FileText size={16} /> Upload Patent PDF
          </button>
        </div>

        {/* Top K selector */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <SlidersHorizontal size={14} className="text-cyan-400" />
          <span>Top Results:</span>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="bg-[#05070D] border border-white/[0.12] text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="space-y-6 relative z-10">
        {activeTab === 'text' ? (
          <div>
            <textarea
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder={placeholderText}
              rows={6}
              className="w-full bg-[#05070D]/90 border border-white/[0.08] rounded-2xl p-4 sm:p-5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 focus:shadow-[0_0_30px_-5px_rgba(6,182,212,0.25)] transition-all duration-300 font-mono text-sm leading-relaxed shadow-inner"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-500 px-1">
              <span>Supports up to 10,000 characters</span>
              <span className="font-mono text-cyan-400/80">{textQuery.length} chars</span>
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
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isLoadingSearch || isLoadingSummary}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Search size={18} />
              {isLoadingSearch
                ? activeTab === 'pdf'
                  ? 'Searching PDF...'
                  : 'Searching Vector Index...'
                : 'Search Prior-Art'}
            </button>

            <button
              type="button"
              onClick={handleSummarizeClick}
              disabled={isLoadingSearch || isLoadingSummary}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-semibold bg-[#0B1020] hover:bg-slate-800/90 border border-violet-500/30 text-violet-300 hover:text-violet-200 hover:border-violet-400/60 shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles size={18} className="text-violet-400" />
              {isLoadingSummary
                ? activeTab === 'pdf'
                  ? 'Summarizing PDF...'
                  : 'Summarizing...'
                : activeTab === 'pdf'
                ? 'Summarize PDF'
                : 'Summarize Text'}
            </button>
          </div>

          <p className="text-xs text-slate-500 italic">
            Embeddings generated with <span className="font-mono text-cyan-400">all-MiniLM-L6-v2</span>
          </p>
        </div>
      </form>
    </div>
  );
};
