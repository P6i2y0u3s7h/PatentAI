import React, { useState } from 'react';
import { SearchForm } from '../components/SearchForm';
import { ResultList } from '../components/ResultList';
import { SummaryCard } from '../components/SummaryCard';
import { AiLoadingScreen } from '../components/Loading';
import { useSearchText, useSearchPdf } from '../hooks/useSearch';
import { useSummarizeText, useSummarizePdf } from '../hooks/useSummary';
import { PatentResult, SummaryResponse } from '../types/patent';
import { Sparkles, Shield, Cpu, Zap } from 'lucide-react';

export const Home: React.FC = () => {
  const searchTextMutation = useSearchText();
  const searchPdfMutation = useSearchPdf();
  const summarizeTextMutation = useSummarizeText();
  const summarizePdfMutation = useSummarizePdf();

  const [searchResults, setSearchResults] = useState<PatentResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [searchTimeMs, setSearchTimeMs] = useState(0);
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);

  const isLoadingSearch = searchTextMutation.isPending || searchPdfMutation.isPending;
  const isLoadingSummary = summarizeTextMutation.isPending || summarizePdfMutation.isPending;

  const handleSearch = (mode: 'text' | 'pdf', content: string | File, topK: number) => {
    setSummaryData(null);
    if (mode === 'text') {
      searchTextMutation.mutate(
        { query: content as string, top_k: topK },
        {
          onSuccess: (data) => {
            setSearchResults(data.results);
            setTotalFound(data.total_found);
            setSearchTimeMs(data.search_time_ms);
          },
        }
      );
    } else {
      searchPdfMutation.mutate(
        { file: content as File, top_k: topK },
        {
          onSuccess: (data) => {
            setSearchResults(data.results);
            setTotalFound(data.total_found);
            setSearchTimeMs(data.search_time_ms);
          },
        }
      );
    }
  };

  const handleSummarize = (mode: 'text' | 'pdf', content: string | File) => {
    setSearchResults([]);
    if (mode === 'text') {
      summarizeTextMutation.mutate(
        { text: content as string },
        {
          onSuccess: (data) => {
            setSummaryData(data);
          },
        }
      );
    } else {
      summarizePdfMutation.mutate(
        { file: content as File },
        {
          onSuccess: (data) => {
            setSummaryData(data);
          },
        }
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Hero Section */}
      <section className="relative pt-16 pb-12 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        {/* Background gradient Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/20 to-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-card border border-blue-500/30 text-xs font-semibold text-blue-400">
            <Sparkles size={14} className="animate-spin text-blue-400" />
            <span>AI Semantic Vector Prior-Art Search Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold font-heading text-slate-100 tracking-tight leading-tight">
            Discover Patent Prior-Art with{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Deep Neural Intelligence
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Instantly search vector embeddings of millions of patent abstracts and claims using FAISS index and MiniLM transformer models.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5"><Zap size={15} className="text-blue-400" /> Sub-10ms Cosine Search</span>
            <span className="flex items-center gap-1.5"><Cpu size={15} className="text-blue-400" /> PDF OCR Extraction</span>
            <span className="flex items-center gap-1.5"><Shield size={15} className="text-blue-400" /> BART Executive Summaries</span>
          </div>
        </div>
      </section>

      {/* Main Search Section */}
      <section className="px-4 sm:px-6 lg:px-8">
        <SearchForm
          onSearch={handleSearch}
          onSummarize={handleSummarize}
          isLoadingSearch={isLoadingSearch}
          isLoadingSummary={isLoadingSummary}
        />

        {/* Loading Indicator */}
        {isLoadingSearch && <AiLoadingScreen message="Searching FAISS prior-art vector index..." />}
        {isLoadingSummary && <AiLoadingScreen message="Generating BART-large-CNN summary..." />}

        {/* Results */}
        {!isLoadingSearch && (
          <ResultList
            results={searchResults}
            totalFound={totalFound}
            searchTimeMs={searchTimeMs}
            isLoading={false}
          />
        )}

        {/* Summary Output */}
        {!isLoadingSummary && summaryData && <SummaryCard summaryData={summaryData} />}
      </section>
    </div>
  );
};
