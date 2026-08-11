import React, { useState } from 'react';
import { SearchForm } from '../components/SearchForm';
import { ResultList } from '../components/ResultList';
import { SummaryCard } from '../components/SummaryCard';
import { AiLoadingScreen } from '../components/Loading';
import { useSearchText, useSearchPdf } from '../hooks/useSearch';
import { useSummarizeText, useSummarizePdf } from '../hooks/useSummary';
import { PatentResult, SummaryResponse } from '../types/patent';
import { ApiError } from '../api/api';
import { Sparkles, Shield, Cpu, Zap, AlertTriangle, RefreshCw } from 'lucide-react';

/** Map known API error codes / status to user-readable error messages. */
function getSearchErrorMessage(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) {
      return {
        title: 'Session Expired',
        detail: 'Your login session has expired. Please sign in again to continue.',
      };
    }
    if (error.statusCode === 413) {
      return {
        title: 'File Too Large',
        detail: 'The uploaded PDF exceeds the 20 MB limit. Please use a smaller file.',
      };
    }
    if (error.statusCode === 415) {
      return {
        title: 'Invalid File Type',
        detail: 'Only PDF files are supported. Please upload a valid .pdf document.',
      };
    }
    if (error.statusCode === 422) {
      // 422 can be PDF extraction failed OR short query
      if (error.message.toLowerCase().includes('scan') || error.message.toLowerCase().includes('image')) {
        return {
          title: 'Scanned / Image-Only PDF',
          detail:
            'No readable text could be extracted from this PDF. The document appears to be a scanned image. Please upload a text-based PDF.',
        };
      }
      if (error.message.toLowerCase().includes('extract') || error.message.toLowerCase().includes('text')) {
        return {
          title: 'PDF Text Extraction Failed',
          detail: 'Could not extract readable text from this PDF. Please ensure it is a text-based (not scanned) PDF.',
        };
      }
      return {
        title: 'Invalid Input',
        detail: error.message || 'Please check your search input and try again.',
      };
    }
    if (error.statusCode === 429) {
      return {
        title: 'Too Many Requests',
        detail: 'You are sending requests too quickly. Please wait a moment and try again.',
      };
    }
    if (error.statusCode === 503) {
      return {
        title: 'Search Index Unavailable',
        detail:
          'The patent search index is not currently loaded. Please ensure the backend is fully started and the index has been built.',
      };
    }
    if (error.statusCode >= 500) {
      return {
        title: 'Server Error',
        detail: 'An internal server error occurred. Please try again shortly.',
      };
    }
    if (error.statusCode === 0) {
      return {
        title: 'Cannot Connect to Server',
        detail:
          'Could not reach the PatentAI backend. Please ensure the server is running at localhost:8000.',
      };
    }
    return {
      title: 'Search Failed',
      detail: error.message || 'An unexpected error occurred.',
    };
  }

  return {
    title: 'Search Failed',
    detail: error instanceof Error ? error.message : 'An unexpected error occurred.',
  };
}

interface SearchError {
  title: string;
  detail: string;
}

export const Home: React.FC = () => {
  const searchTextMutation = useSearchText();
  const searchPdfMutation = useSearchPdf();
  const summarizeTextMutation = useSummarizeText();
  const summarizePdfMutation = useSummarizePdf();

  const [searchResults, setSearchResults] = useState<PatentResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [searchTimeMs, setSearchTimeMs] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<SearchError | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);

  const isLoadingSearch = searchTextMutation.isPending || searchPdfMutation.isPending;
  const isLoadingSummary = summarizeTextMutation.isPending || summarizePdfMutation.isPending;

  const handleSearch = (mode: 'text' | 'pdf', content: string | File, topK: number) => {
    setSummaryData(null);
    setSearchError(null);
    setHasSearched(true);

    const onSuccess = (data: { results: PatentResult[]; total_found: number; search_time_ms: number }) => {
      setSearchResults(data.results);
      setTotalFound(data.total_found);
      setSearchTimeMs(data.search_time_ms);
      setSearchError(null);
    };

    const onError = (error: unknown) => {
      setSearchResults([]);
      setTotalFound(0);
      setSearchError(getSearchErrorMessage(error));
    };

    if (mode === 'text') {
      searchTextMutation.mutate(
        { query: content as string, top_k: topK },
        { onSuccess, onError }
      );
    } else {
      searchPdfMutation.mutate(
        { file: content as File, top_k: topK },
        { onSuccess, onError }
      );
    }
  };

  const handleSummarize = (mode: 'text' | 'pdf', content: string | File) => {
    setSearchResults([]);
    setSearchError(null);
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
            <span className="flex items-center gap-1.5"><Cpu size={15} className="text-blue-400" /> PDF Text Extraction</span>
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

        {/* Error Display — shown when search failed */}
        {!isLoadingSearch && searchError && (
          <div className="w-full max-w-4xl mx-auto mt-8">
            <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6 flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-red-300">{searchError.title}</h3>
                <p className="text-sm text-red-400/80 mt-1 leading-relaxed">{searchError.detail}</p>
              </div>
              <button
                onClick={() => setSearchError(null)}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/60 hover:text-red-400 transition-colors"
                title="Dismiss"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        )}

        {/* No Results — only when search succeeded but returned empty */}
        {!isLoadingSearch && !searchError && hasSearched && searchResults.length === 0 && (
          <div className="w-full max-w-4xl mx-auto mt-8">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-slate-700 mx-auto mb-4">
                <Shield size={24} className="text-slate-500" />
              </div>
              <h3 className="text-base font-bold text-slate-300">No Prior-Art Found</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                No sufficiently similar patents were found in the database. Try adding more technical details or using different terminology.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoadingSearch && !searchError && (
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
