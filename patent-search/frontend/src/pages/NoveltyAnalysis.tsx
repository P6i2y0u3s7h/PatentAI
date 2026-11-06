import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  Sliders,
  Layers,
  HelpCircle,
  History,
  X,
} from 'lucide-react';
import { noveltyApi } from '../api/noveltyApi';
import {
  NoveltyAnalysisResponse,
  NoveltyHistoryEntry,
  NoveltyPatentReference,
} from '../types/patent';

const SAMPLE_INVENTION = {
  title: 'Autonomous Distributed Grid Frequency Stabilizer via Edge Swarm Inverters',
  description:
    'A distributed power management system for renewable microgrids that detects localized sub-cycle frequency fluctuations and coordinates neighboring inverter-based resources via peer-to-peer low-latency mesh telemetry without requiring centralized substation dispatch.',
  technical_details:
    'Utilizes FPGA-driven sub-millisecond phase-locked loop (PLL) tracking combined with consensus-based token passing over 802.11ah HaLow mesh networks. Inverters dynamically adjust synthetic inertia and reactive power injection within 8 milliseconds of detecting ROCOF (Rate of Change of Frequency) thresholds exceeding 0.5 Hz/s.',
  claims:
    '1. A distributed grid stabilization apparatus comprising a local sensor measuring sub-cycle grid frequency variance, a peer-to-peer wireless transceiver, and a synthetic inertia controller that injects counter-phase reactive power within 10 ms.\n2. The system of claim 1, wherein inverter units determine compensation priority using localized consensus telemetry without master controller synchronization.',
};

export const NoveltyAnalysis: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [technicalDetails, setTechnicalDetails] = useState('');
  const [claims, setClaims] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NoveltyAnalysisResponse | null>(null);

  const [historyItems, setHistoryItems] = useState<NoveltyHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPatents, setExpandedPatents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await noveltyApi.getHistory();
      setHistoryItems(res.entries || []);
    } catch {
      // Non-blocking
    }
  };

  const loadSample = () => {
    setTitle(SAMPLE_INVENTION.title);
    setDescription(SAMPLE_INVENTION.description);
    setTechnicalDetails(SAMPLE_INVENTION.technical_details);
    setClaims(SAMPLE_INVENTION.claims);
    setSelectedFile(null);
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setTechnicalDetails('');
    setClaims('');
    setSelectedFile(null);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF documents are supported.');
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
      }
      setError(null);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile && !description.trim()) {
      setError('Please provide an invention description or upload a patent disclosure PDF.');
      return;
    }

    setLoading(true);
    setStepMessage('Extracting invention features and preparing disclosure text...');

    try {
      let response: NoveltyAnalysisResponse;

      if (selectedFile) {
        setStepMessage('Extracting text from uploaded disclosure PDF...');
        response = await noveltyApi.analyzePdf(
          selectedFile,
          title || selectedFile.name.replace(/\.pdf$/i, ''),
          description || '',
          technicalDetails || '',
          claims || ''
        );
      } else {
        setStepMessage('Embedding invention text via Sentence Transformer model...');
        response = await noveltyApi.analyzeJson({
          title: title || 'Proposed Invention Disclosure',
          description,
          technical_details: technicalDetails || undefined,
          claims: claims || undefined,
        });
      }

      setResult(response);
      loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to complete novelty analysis.');
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  const togglePatentExpanded = (id: string) => {
    setExpandedPatents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getVerdictStyle = (verdict?: string) => {
    const v = (verdict || '').toLowerCase();
    if (v.includes('high') || v.includes('strong') || v.includes('favorable')) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
        badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
        icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      };
    }
    if (v.includes('moderate') || v.includes('partial')) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
        icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      };
    }
    return {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/40',
      icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0B1020] border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-2.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin [animation-duration:8s]" />
              <span>Prior-Art Novelty Evaluator</span>
            </motion.div>

            <HeroWordReveal
              prefixText="AI Patent"
              gradientText="Novelty Analysis"
              className="font-heading font-bold text-3xl sm:text-4xl tracking-tight text-white"
            />

            <motion.p
              initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed"
            >
              Screen proposed inventions against the indexed patent repository. Evaluates semantic prior-art overlaps, isolates distinguishing technical features, and calculates preliminary novelty readiness.
            </motion.p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-2 transition-all shadow-sm"
            >
              <History className="w-4 h-4 text-blue-400" />
              <span>History</span>
              {historyItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-blue-500/20 text-blue-400 font-mono">
                  {historyItems.length}
                </span>
              )}
            </button>
            <button
              onClick={loadSample}
              className="px-3.5 py-2 rounded-xl text-sm font-medium bg-blue-600/15 border border-blue-500/30 hover:bg-blue-600/25 text-blue-300 flex items-center gap-2 transition-all"
            >
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Load Sample</span>
            </button>
          </div>
        </div>

        {/* History Drawer Modal */}
        {showHistory && (
          <div className="p-5 rounded-2xl glass-card border border-blue-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <History className="w-4 h-4 text-blue-400" />
                <span>Recent Novelty Analysis Reports</span>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {historyItems.length === 0 ? (
              <p className="text-xs text-slate-500">No previous novelty analyses found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 text-left transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-xs text-slate-200 line-clamp-1 group-hover:text-blue-400">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {item.highest_similarity_score}% max
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                      <span>{item.novelty_verdict}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Form Card */}
        <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span>Invention Disclosure Input</span>
            </h2>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear Form</span>
            </button>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Invention Title <span className="text-slate-500">(Optional for PDF upload)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Adaptive Multi-Modal Battery Degradation Estimator"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Invention Summary / Problem & Solution <span className="text-blue-400">*</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the invention is, the core problem it solves, how it functions, and its primary technical advantages over conventional solutions..."
                className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all resize-y"
              />
            </div>

            {/* Technical Details & Claims Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Technical Architecture / Implementation Details
                </label>
                <textarea
                  rows={4}
                  value={technicalDetails}
                  onChange={(e) => setTechnicalDetails(e.target.value)}
                  placeholder="Hardware/software components, communication protocols, sensor arrays, algorithmic pipelines..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Proposed Patent Claims <span className="text-slate-500">(Draft format)</span>
                </label>
                <textarea
                  rows={4}
                  value={claims}
                  onChange={(e) => setClaims(e.target.value)}
                  placeholder="1. An apparatus comprising...\n2. The system of claim 1, further comprising..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all resize-y font-mono text-xs"
                />
              </div>
            </div>

            {/* PDF Upload Area */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Or Upload Invention Document (PDF)
              </label>
              <div className="relative border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 sm:p-6 text-center bg-slate-900/40 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  {selectedFile ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-400 font-mono">
                        {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-slate-300">
                        Click to browse or drag & drop invention disclosure PDF
                      </p>
                      <p className="text-[11px] text-slate-500">
                        PDF text will be parsed and semantically vectorized automatically
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span>Searches 10 nearest prior-art patents via FAISS cosine index</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Invention...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyse My Invention</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Loading Pipeline Visualizer */}
          {loading && (
            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                  Analysis Pipeline Running
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{stepMessage}</p>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Novelty Assessment Report
                </h3>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Export / Print Report</span>
              </button>
            </div>

            {/* SECTION A: NOVELTY OVERVIEW */}
            {(() => {
              const verdictStyle = getVerdictStyle(result.overview.novelty_verdict);
              return (
                <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    <span>Section A</span>
                    <span>•</span>
                    <span>Novelty Overview</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Novelty Score Gauge */}
                    <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                      <span className="text-xs text-slate-400 uppercase font-medium">Preliminary Novelty</span>
                      <div className="my-2 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold font-mono text-white">
                          {result.overview.novelty_score}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2 rounded-full"
                          style={{ width: `${result.overview.novelty_score}%` }}
                        />
                      </div>
                    </div>

                    {/* Verdict */}
                    <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                      <span className="text-xs text-slate-400 uppercase font-medium">Novelty Verdict</span>
                      <div className="my-2">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${verdictStyle.badge}`}>
                          {verdictStyle.icon}
                          <span>{result.overview.novelty_verdict}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">Based on semantic claim similarity</span>
                    </div>

                    {/* Patents Analyzed */}
                    <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                      <span className="text-xs text-slate-400 uppercase font-medium">Relevant Prior-Art Found</span>
                      <div className="my-2">
                        <span className="text-4xl font-extrabold font-mono text-white">
                          {result.overview.relevant_patents_count}
                        </span>
                        <span className="text-xs text-slate-400 ml-1.5">patents</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Retrieved from FAISS repository</span>
                    </div>

                    {/* Closest Prior Art */}
                    <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                      <span className="text-xs text-slate-400 uppercase font-medium">Closest Prior-Art Match</span>
                      <div className="my-2">
                        <span className="text-xs font-mono font-bold text-blue-400 block truncate">
                          {result.overview.most_relevant_patent_id || 'N/A'}
                        </span>
                        <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
                          {result.overview.most_relevant_patent_title || 'N/A'}
                        </p>
                      </div>
                      <div className="text-[11px] text-amber-400 font-mono">
                        Max Sim: {result.overview.highest_similarity_score}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SECTION B: TECHNICAL FEATURE ANALYSIS */}
            <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                <span>Section B</span>
                <span>•</span>
                <span>Technical Feature Analysis</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Disclosed Features */}
                <div className="p-5 rounded-xl bg-slate-900/70 border border-rose-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Features Disclosed in Prior-Art</span>
                  </div>
                  {result.technical_features.disclosed_features.length === 0 ? (
                    <p className="text-xs text-slate-500">None detected in top prior-art cluster.</p>
                  ) : (
                    <div className="space-y-2">
                      {result.technical_features.disclosed_features.map((feat: string, i: number) => (
                        <div
                          key={i}
                          className="px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs text-rose-200"
                        >
                          {feat}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Distinguishing Features */}
                <div className="p-5 rounded-xl bg-slate-900/70 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    <span>Potentially Distinguishing Features</span>
                  </div>
                  {result.technical_features.distinguishing_features.length === 0 ? (
                    <p className="text-xs text-slate-500">No novel distinguishing features identified.</p>
                  ) : (
                    <div className="space-y-2">
                      {result.technical_features.distinguishing_features.map((feat: string, i: number) => (
                        <div
                          key={i}
                          className="px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-200"
                        >
                          {feat}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Similar Approaches */}
                <div className="p-5 rounded-xl bg-slate-900/70 border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    <span>Similar Technical Approaches in Art</span>
                  </div>
                  {result.technical_features.similar_technical_approaches.length === 0 ? (
                    <p className="text-xs text-slate-500">No parallel approaches found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {result.technical_features.similar_technical_approaches.map((app: string, i: number) => (
                        <li
                          key={i}
                          className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <span>{app}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Potential Overlaps */}
                <div className="p-5 rounded-xl bg-slate-900/70 border border-blue-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Key Prior-Art Overlaps & Boundaries</span>
                  </div>
                  {result.technical_features.potential_overlaps.length === 0 ? (
                    <p className="text-xs text-slate-500">No critical overlaps identified.</p>
                  ) : (
                    <ul className="space-y-2">
                      {result.technical_features.potential_overlaps.map((ov: string, i: number) => (
                        <li
                          key={i}
                          className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <span>{ov}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION C: TOP 10 PRIOR ART REFERENCES */}
            <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <span>Section C</span>
                  <span>•</span>
                  <span>Retrieved Prior-Art References ({result.prior_art_references.length} Patents)</span>
                </div>
                <span className="text-xs text-slate-500">Sorted by semantic vector similarity</span>
              </div>

              <div className="space-y-3">
                {result.prior_art_references.map((ref: NoveltyPatentReference, idx: number) => {
                  const isExpanded = !!expandedPatents[ref.id];
                  return (
                    <div
                      key={ref.id || idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-mono font-bold text-blue-400">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-400">{ref.id}</span>
                              {ref.assignee && (
                                <span className="text-[11px] text-slate-400 font-medium">({ref.assignee})</span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-white mt-0.5">{ref.title}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {ref.similarity_percentage}%
                            </span>
                            <span className="text-[10px] text-slate-500 block">similarity</span>
                          </div>
                          <button
                            onClick={() => togglePatentExpanded(ref.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable abstract and technical details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 animate-fadeIn">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                              Abstract
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                              {ref.abstract || 'No abstract text available.'}
                            </p>
                          </div>

                          {ref.relevant_features && ref.relevant_features.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                Overlapping Technical Elements
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {ref.relevant_features.map((feat: string, fi: number) => (
                                  <span
                                    key={fi}
                                    className="px-2.5 py-1 rounded-md text-[11px] bg-blue-500/10 border border-blue-500/20 text-blue-300"
                                  >
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION D: AI RECOMMENDATIONS */}
            <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                <span>Section D</span>
                <span>•</span>
                <span>AI Recommendations & Prosecution Strategy</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Investigation Areas */}
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
                    Areas for Investigation
                  </span>
                  <ul className="space-y-2">
                    {result.recommendations.areas_for_investigation.map((rec: string, i: number) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Distinguishing Features to Emphasize */}
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                    Features to Emphasize
                  </span>
                  <ul className="space-y-2">
                    {result.recommendations.distinguishing_features_guidance.map((rec: string, i: number) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Prior-Art Searches */}
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                    Additional Searches
                  </span>
                  <ul className="space-y-2">
                    {result.recommendations.suggested_prior_art_searches.map((rec: string, i: number) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* SECTION E: FINAL ANALYSIS & LEGAL DISCLAIMER */}
            <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                <span>Section E</span>
                <span>•</span>
                <span>Executive Summary & Legal Boundary</span>
              </div>

              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider block">
                  Synthesis Summary
                </span>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {result.final_summary}
                </p>
              </div>

              {/* Prominent Legal Disclaimer */}
              <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <span className="font-semibold text-xs uppercase tracking-wider text-amber-200 block">
                    Legal & Patentability Notice
                  </span>
                  <p className="text-xs text-amber-300/90 leading-relaxed">
                    {result.disclaimer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
