import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SearchForm } from '../components/SearchForm';
import { ResultList } from '../components/ResultList';
import { SummaryCard } from '../components/SummaryCard';
import { AiLoadingScreen } from '../components/Loading';
import { NeuralParticleSphere } from '../components/NeuralParticleSphere';
import { AssistantAvatar } from '../components/AssistantAvatar';
import { HeroWordReveal, ScrollRevealSection } from '../components/AnimatedText';
import { useSearchText, useSearchPdf } from '../hooks/useSearch';
import { useSummarizeText, useSummarizePdf } from '../hooks/useSummary';
import { useAuth } from '../hooks/useAuth';
import { PatentResult, SummaryResponse } from '../types/patent';
import { ApiError } from '../api/api';
import {
  Sparkles,
  Shield,
  Cpu,
  Zap,
  AlertTriangle,
  RefreshCw,
  Lock,
  UserPlus,
  LogIn,
  ArrowRight,
  Layers,
  FileText,
  CheckCircle2,
  Scale,
  Search,
  Activity,
  Bot,
} from 'lucide-react';

/** Map known API error codes / status to user-readable error messages. */
function getSearchErrorMessage(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) {
      return {
        title: 'Login Required',
        detail: 'Please login to continue.',
      };
    }
    if (error.statusCode === 403) {
      return {
        title: 'Not Authorized',
        detail: 'You are not authorized to perform this action.',
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
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchResults, setSearchResults] = useState<PatentResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [searchTimeMs, setSearchTimeMs] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<SearchError | null>(null);

  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [authGateVisible, setAuthGateVisible] = useState(false);

  const searchTextMutation = useSearchText();
  const searchPdfMutation = useSearchPdf();
  const summarizeTextMutation = useSummarizeText();
  const summarizePdfMutation = useSummarizePdf();

  const isLoadingSearch = searchTextMutation.isPending || searchPdfMutation.isPending;
  const isLoadingSummary = summarizeTextMutation.isPending || summarizePdfMutation.isPending;

  const scrollToSearch = () => {
    const el = document.getElementById('search-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearch = (mode: 'text' | 'pdf', content: string | File, topK: number) => {
    if (!user) {
      setAuthGateVisible(true);
      setSearchError(null);
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    setAuthGateVisible(false);
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
    if (!user) {
      setAuthGateVisible(true);
      setSearchError(null);
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    setAuthGateVisible(false);
    setSearchResults([]);
    setSearchError(null);
    setHasSearched(false);
    setSummaryData(null);

    const onError = (error: unknown) => {
      setSearchError(getSearchErrorMessage(error));
    };

    if (mode === 'text') {
      summarizeTextMutation.mutate(
        { text: content as string },
        {
          onSuccess: (data) => {
            setSummaryData(data);
          },
          onError,
        }
      );
    } else {
      summarizePdfMutation.mutate(
        { file: content as File },
        {
          onSuccess: (data) => {
            setSummaryData(data);
          },
          onError,
        }
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05070D] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ── 1. CINEMATIC TWO-COLUMN HERO SECTION (ROSE AI VISUAL THEME) ── */}
      <section className="relative pt-6 sm:pt-12 lg:pt-16 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
        {/* Subtle Ambient Background Lighting */}
        <div
          className="absolute top-1/3 left-10 w-[450px] h-[450px] rounded-full pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute top-1/4 right-10 w-[500px] h-[500px] rounded-full pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(circle, rgba(217, 70, 239, 0.10) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* LEFT COLUMN: Cinematic Typography & CTAs */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left z-10">
            {/* AI Badge Animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#0B1020]/90 border border-cyan-500/35 text-xs font-mono font-semibold text-cyan-300 shadow-[0_0_20px_-3px_rgba(6,182,212,0.35)]"
            >
              <Sparkles size={14} className="text-cyan-400 animate-spin [animation-duration:8s]" />
              <span>AI Semantic Vector Prior-Art Search Engine</span>
            </motion.div>

            {/* Main Headline with Cinematic Word-by-Word Reveal */}
            <HeroWordReveal
              prefixText="Discover Patent Prior-Art with"
              gradientText="Deep Neural Intelligence"
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-heading tracking-tight leading-[1.08]"
            />

            {/* Description Animation */}
            <motion.p
              initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed"
            >
              Instantly search vector embeddings of millions of patent abstracts and claims using FAISS index and MiniLM transformer models.
            </motion.p>

            {/* Feature Highlights Line with Staggered Entrance and Hover Glow */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1 text-xs font-medium text-slate-300">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 group cursor-default"
              >
                <Zap size={15} className="text-cyan-400 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.9)] transition-all duration-200" />
                <span className="group-hover:text-cyan-200 transition-colors duration-200">Sub-10ms Cosine Search</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.98, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 group cursor-default"
              >
                <Cpu size={15} className="text-blue-400 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.9)] transition-all duration-200" />
                <span className="group-hover:text-blue-200 transition-colors duration-200">PDF Text Extraction</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 group cursor-default"
              >
                <Shield size={15} className="text-fuchsia-400 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(217,70,239,0.9)] transition-all duration-200" />
                <span className="group-hover:text-fuchsia-200 transition-colors duration-200">BART Executive Summaries</span>
              </motion.div>
            </div>

            {/* Hero Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <button
                type="button"
                onClick={scrollToSearch}
                className="px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start Prior-Art Search</span>
                <ArrowRight size={17} />
              </button>

              <Link
                to="/assistant"
                className="px-5 py-3.5 rounded-xl font-semibold bg-[#0B1020]/90 hover:bg-[#0B1020] border border-cyan-500/30 hover:border-cyan-400/60 text-slate-200 hover:text-white transition-all flex items-center gap-2.5 shadow-md hover:shadow-cyan-500/10"
              >
                <AssistantAvatar size={22} />
                <span>Open AI Assistant</span>
              </Link>
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Futuristic 3D Neural Particle Sphere */}
          <div className="lg:col-span-5 flex items-center justify-center relative">
            <NeuralParticleSphere />
          </div>
        </div>
      </section>

      {/* ── 2. MAIN SEARCH PANEL (REDESIGNED DARK GLASSMORPHISM) ── */}
      <section id="search-panel" className="px-4 sm:px-6 lg:px-8 py-12 scroll-mt-20">
        <ScrollRevealSection
          badge="Prior-Art Vector Neural Engine"
          badgeIcon={<Zap size={12} className="text-cyan-400" />}
          heading="High-Dimensional Prior-Art Search"
          highlightedWord="Prior-Art"
          description="Query dense vector embeddings across millions of patent abstracts and claims in sub-10ms."
          className="mb-8"
        />

        <SearchForm
          onSearch={handleSearch}
          onSummarize={handleSummarize}
          isLoadingSearch={isLoadingSearch}
          isLoadingSummary={isLoadingSummary}
        />

        {/* Loading Indicator */}
        {isLoadingSearch && <AiLoadingScreen message="Searching FAISS prior-art vector index..." />}
        {isLoadingSummary && <AiLoadingScreen message="Generating BART-large-CNN summary..." />}

        {/* Auth Gate Banner — shown when unauthenticated user attempts search/summary */}
        {authGateVisible && (
          <div
            id="auth-gate-banner"
            className="w-full max-w-4xl mx-auto mt-8 animate-pulse-once"
          >
            <div className="rounded-2xl border border-amber-500/40 bg-[#0B1020]/95 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-2xl">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
                <Lock size={22} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-amber-300">
                  🔐 Please login to search prior art.
                </h3>
                <p className="text-sm text-amber-400/80 mt-1">
                  Create a free account or sign in to run patent searches, generate AI summaries, and save your history.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link
                  to="/login"
                  id="auth-gate-login-btn"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold shadow-md shadow-cyan-500/20 transition-all"
                >
                  <LogIn size={14} /> Login
                </Link>
                <Link
                  to="/register"
                  id="auth-gate-register-btn"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.12] hover:border-white/30 text-slate-300 hover:text-white text-sm font-semibold transition-all bg-[#05070D]/80"
                >
                  <UserPlus size={14} /> Create Account
                </Link>
                <button
                  onClick={() => setAuthGateVisible(false)}
                  className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-500/60 hover:text-amber-400 transition-colors"
                  title="Dismiss"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display — shown when search API call failed */}
        {!isLoadingSearch && searchError && (
          <div className="w-full max-w-4xl mx-auto mt-8">
            <div className="rounded-2xl border border-red-500/30 bg-[#0B1020]/95 p-6 flex items-start gap-4 shadow-xl">
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
        {!isLoadingSearch && !isLoadingSummary && !searchError && hasSearched && searchResults.length === 0 && !summaryData && (
          <div className="w-full max-w-4xl mx-auto mt-8">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0B1020]/80 p-10 text-center shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-[#05070D] flex items-center justify-center border border-white/[0.08] mx-auto mb-4 text-cyan-400">
                <Shield size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-200">No Prior-Art Found</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
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

      {/* ── 3. AI TOOLS SHOWCASE (INTERACTIVE PATENT SUITE) ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto w-full">
        <ScrollRevealSection
          badge="Intelligent Patent Research Suite"
          badgeIcon={<Cpu size={12} className="text-cyan-400" />}
          heading="Specialized AI Patent Workflows"
          highlightedWord="Patent"
          description="Purpose-built neural models for patent attorneys, researchers, and enterprise IP teams."
          className="mb-12"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tool 1: Prior-Art Vector Search */}
          <div
            onClick={scrollToSearch}
            className="neural-card p-6 rounded-2xl cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 transition-transform shadow-sm shadow-cyan-500/20">
                <Search size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                Semantic Prior-Art Search
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Scan FAISS high-dimensional vector embeddings with cosine similarity for fast prior-art retrieval.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span>Search Patents</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Tool 2: AI Patent Assistant */}
          <Link
            to="/assistant"
            className="neural-card p-6 rounded-2xl group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform shadow-sm shadow-teal-500/20">
                <Bot size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                AI Patent Assistant
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Conversational RAG agent grounded on actual patent disclosures with PDF upload context.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-teal-400">
              <span>Open Assistant</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Tool 3: Patent Comparison */}
          <Link
            to="/compare"
            className="neural-card p-6 rounded-2xl group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-110 transition-transform shadow-sm shadow-indigo-500/20">
                <Scale size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                Patent Comparison
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Side-by-side comparative analysis of independent claims, limitations, and embodiments.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span>Compare Patents</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Tool 4: Novelty Analysis */}
          <Link
            to="/novelty"
            className="neural-card p-6 rounded-2xl group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 mb-5 group-hover:scale-110 transition-transform shadow-sm shadow-fuchsia-500/20">
                <Sparkles size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-fuchsia-300 transition-colors">
                Novelty Analysis
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Screen invention disclosures against prior art for novelty, non-obviousness, and patentability.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-fuchsia-400">
              <span>Analyze Novelty</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS (NEURAL PIPELINE ARCHITECTURE) ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto w-full relative">
        <ScrollRevealSection
          badge="Neural Pipeline Architecture"
          badgeIcon={<Activity size={12} className="text-blue-400" />}
          heading="How PatentAI Delivers Deep Intelligence"
          highlightedWord="Intelligence"
          description="From raw text and patent PDFs to sub-10ms semantic vector matches and grounded synthesis."
          className="mb-14"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Step 1 */}
          <div className="p-7 rounded-2xl bg-[#0B1020]/70 border border-white/[0.07] backdrop-blur-xl relative">
            <span className="text-3xl font-mono font-bold text-cyan-400/40 block mb-4">01</span>
            <h3 className="text-lg font-bold text-white mb-2">Dense Vector Ingestion</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Patent abstracts and technical claims are converted into 384-dimensional dense semantic embeddings using Sentence Transformers (all-MiniLM-L6-v2).
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-7 rounded-2xl bg-[#0B1020]/70 border border-white/[0.07] backdrop-blur-xl relative">
            <span className="text-3xl font-mono font-bold text-blue-400/40 block mb-4">02</span>
            <h3 className="text-lg font-bold text-white mb-2">Sub-10ms FAISS Search</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-performance IndexFlatIP performs exact cosine distance matrix scans over millions of indexed disclosures, identifying relevant prior art in milliseconds.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-7 rounded-2xl bg-[#0B1020]/70 border border-white/[0.07] backdrop-blur-xl relative">
            <span className="text-3xl font-mono font-bold text-fuchsia-400/40 block mb-4">03</span>
            <h3 className="text-lg font-bold text-white mb-2">Grounded AI Synthesis</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              BART-large-CNN generates executive summaries while the RAG engine grounds responses on factual disclosures with zero fabricated citations.
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. PATENT SEARCH BENEFITS / METRICS ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-cyan-950/20 via-[#0B1020] to-fuchsia-950/20 border border-white/[0.08] backdrop-blur-2xl shadow-2xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-5xl font-extrabold font-heading text-white tracking-tight">
                &lt;10<span className="text-cyan-400 text-2xl sm:text-3xl">ms</span>
              </p>
              <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">Search Latency</p>
            </div>
            <div>
              <p className="text-3xl sm:text-5xl font-extrabold font-heading text-white tracking-tight">
                384<span className="text-blue-400 text-2xl sm:text-3xl">-D</span>
              </p>
              <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">Dense Vectors</p>
            </div>
            <div>
              <p className="text-3xl sm:text-5xl font-extrabold font-heading text-white tracking-tight">
                100<span className="text-teal-400 text-2xl sm:text-3xl">%</span>
              </p>
              <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">Grounded Evidence</p>
            </div>
            <div>
              <p className="text-3xl sm:text-5xl font-extrabold font-heading text-white tracking-tight">
                20<span className="text-fuchsia-400 text-2xl sm:text-3xl">MB</span>
              </p>
              <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">PDF Extraction</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
