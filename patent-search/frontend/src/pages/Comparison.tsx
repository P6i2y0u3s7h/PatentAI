import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';
import {
  GitCompare,
  Search,
  CheckCircle2,
  Download,
  Layers,
  ArrowRight,
  Shield,
  Zap,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { compareApi } from '../api/compareApi';
import {
  PatentComparisonResponse,
  PatentSummaryItem,
  ComparisonHistoryEntry,
} from '../types/patent';

export const Comparison: React.FC = () => {
  const [catalog, setCatalog] = useState<PatentSummaryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Selected patent IDs
  const [patentAId, setPatentAId] = useState<string>('US-2024-001');
  const [patentBId, setPatentBId] = useState<string>('US-2024-005');

  // Search filter query for selectors
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [selectorOpenA, setSelectorOpenA] = useState(false);
  const [selectorOpenB, setSelectorOpenB] = useState(false);

  // Comparison state
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<PatentComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<ComparisonHistoryEntry[]>([]);

  useEffect(() => {
    loadCatalogAndHistory();
  }, []);

  const loadCatalogAndHistory = async () => {
    try {
      setLoadingCatalog(true);
      const [catRes, histRes] = await Promise.all([
        compareApi.listPatents(),
        compareApi.getHistory().catch(() => ({ entries: [], total: 0 })),
      ]);
      setCatalog(catRes.patents || []);
      setHistory(histRes.entries || []);

      // If patents available, default to first two
      if (catRes.patents && catRes.patents.length >= 2) {
        setPatentAId(catRes.patents[0].id);
        setPatentBId(catRes.patents[1].id);
      }
    } catch (err: any) {
      console.warn('Could not load patent catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleCompare = async () => {
    if (!patentAId || !patentBId) {
      setError('Please select both Patent A and Patent B to proceed.');
      return;
    }
    if (patentAId === patentBId) {
      setError('Please select two distinct patents to compare.');
      return;
    }

    try {
      setComparing(true);
      setError(null);
      const res = await compareApi.comparePatents(patentAId, patentBId);
      setComparisonResult(res);
      // Refresh history
      compareApi.getHistory().then((h) => setHistory(h.entries || [])).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Failed to compare patents. Please verify patent IDs.');
    } finally {
      setComparing(false);
    }
  };

  const selectPredefinedPair = (idA: string, idB: string) => {
    setPatentAId(idA);
    setPatentBId(idB);
    setSelectorOpenA(false);
    setSelectorOpenB(false);
  };

  const filteredCatalogA = catalog.filter(
    (p) =>
      p.id.toLowerCase().includes(searchA.toLowerCase()) ||
      p.title.toLowerCase().includes(searchA.toLowerCase()) ||
      p.ipc_class.toLowerCase().includes(searchA.toLowerCase())
  );

  const filteredCatalogB = catalog.filter(
    (p) =>
      p.id.toLowerCase().includes(searchB.toLowerCase()) ||
      p.title.toLowerCase().includes(searchB.toLowerCase()) ||
      p.ipc_class.toLowerCase().includes(searchB.toLowerCase())
  );

  const patentAData = catalog.find((p) => p.id === patentAId);
  const patentBData = catalog.find((p) => p.id === patentBId);

  // Print/Download PDF report
  const handleDownloadReport = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0B1020] border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-2.5"
          >
            <GitCompare size={14} className="text-cyan-400" />
            <span>Technical Prior-Art Analysis</span>
          </motion.div>

          <HeroWordReveal
            prefixText="Patent Comparison"
            gradientText="Workspace"
            className="text-3xl sm:text-4xl font-bold font-heading text-slate-100 tracking-tight"
          />

          <motion.p
            initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed"
          >
            Side-by-side technical evaluation of patent specifications, claim boundaries, and architectural methodologies.
          </motion.p>
        </div>

        {comparisonResult && (
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition-all shadow-md shrink-0 self-start sm:self-auto"
          >
            <Download size={16} /> Download PDF Report
          </button>
        )}
      </div>

      {/* ── Selection Workspace ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* Patent A Selector */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[11px] text-blue-300 font-mono">
                A
              </span>
              Patent A (Primary Reference)
            </span>
            <span className="text-xs text-slate-500 font-mono">{patentAId}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setSelectorOpenA(!selectorOpenA)}
              className="w-full p-4 rounded-xl glass-card border border-slate-800 hover:border-blue-500/50 text-left transition-all flex items-center justify-between"
            >
              <div className="min-w-0 pr-3">
                <p className="text-xs text-slate-500 font-mono uppercase">
                  {patentAData?.id || patentAId} • {patentAData?.ipc_class || 'IPC Class'}
                </p>
                <p className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                  {patentAData?.title || 'Select a patent from dataset...'}
                </p>
                <p className="text-xs text-slate-400 truncate mt-1">
                  Assignee: {patentAData?.assignee || 'Unknown'}
                </p>
              </div>
              <ChevronRight size={18} className="text-slate-500 shrink-0" />
            </button>

            {/* Dropdown Modal for A */}
            {selectorOpenA && (
              <div className="absolute top-full left-0 right-0 mt-2 z-30 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-2 max-h-80 flex flex-col">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchA}
                    onChange={(e) => setSearchA(e.target.value)}
                    placeholder="Search by ID, title, or IPC class..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="overflow-y-auto space-y-1 flex-1">
                  {filteredCatalogA.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setPatentAId(p.id);
                        setSelectorOpenA(false);
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        patentAId === p.id
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                        <span>{p.id}</span>
                        <span>{p.ipc_class}</span>
                      </div>
                      <p className="font-medium text-slate-200 truncate mt-0.5">{p.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.assignee}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Patent B Selector */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[11px] text-indigo-300 font-mono">
                B
              </span>
              Patent B (Comparative Reference)
            </span>
            <span className="text-xs text-slate-500 font-mono">{patentBId}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setSelectorOpenB(!selectorOpenB)}
              className="w-full p-4 rounded-xl glass-card border border-slate-800 hover:border-indigo-500/50 text-left transition-all flex items-center justify-between"
            >
              <div className="min-w-0 pr-3">
                <p className="text-xs text-slate-500 font-mono uppercase">
                  {patentBData?.id || patentBId} • {patentBData?.ipc_class || 'IPC Class'}
                </p>
                <p className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                  {patentBData?.title || 'Select a patent from dataset...'}
                </p>
                <p className="text-xs text-slate-400 truncate mt-1">
                  Assignee: {patentBData?.assignee || 'Unknown'}
                </p>
              </div>
              <ChevronRight size={18} className="text-slate-500 shrink-0" />
            </button>

            {/* Dropdown Modal for B */}
            {selectorOpenB && (
              <div className="absolute top-full left-0 right-0 mt-2 z-30 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-2 max-h-80 flex flex-col">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchB}
                    onChange={(e) => setSearchB(e.target.value)}
                    placeholder="Search by ID, title, or IPC class..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="overflow-y-auto space-y-1 flex-1">
                  {filteredCatalogB.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setPatentBId(p.id);
                        setSelectorOpenB(false);
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        patentBId === p.id
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                        <span>{p.id}</span>
                        <span>{p.ipc_class}</span>
                      </div>
                      <p className="font-medium text-slate-200 truncate mt-0.5">{p.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.assignee}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="text-center">
        <button
          onClick={handleCompare}
          disabled={comparing}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-blue-500/25 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 mx-auto"
        >
          {comparing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing Claims & Semantic Distance...</span>
            </>
          ) : (
            <>
              <GitCompare size={18} />
              <span>Compare Patents Now</span>
            </>
          )}
        </button>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>

      {/* ── Comparison Results View ─────────────────────────────────────── */}
      {comparisonResult && (
        <div id="printable-comparison" className="space-y-10 pt-4 animate-in fade-in duration-500">
          {/* Similarity & Executive Gauge */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Calculated Semantic Overlap
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-100 flex items-center gap-3 justify-center md:justify-start">
                <span>{comparisonResult.similarity_percentage}% Semantic Similarity</span>
              </h2>
              <p className="text-xs text-slate-400 max-w-xl">
                Derived via 384-dimensional cosine similarity across specification disclosures, claims terminology, and IPC classification overlap.
              </p>
            </div>

            {/* Progress Bar / Gauge */}
            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Distinct</span>
                <span className="text-blue-400 font-bold">{comparisonResult.similarity_percentage}%</span>
                <span>Overlap</span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(5, comparisonResult.similarity_percentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Side-by-Side Parameter Comparison Table ───────────────────── */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
              <Layers size={18} className="text-blue-400" />
              Side-by-Side Parameter Specifications
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-800/80 glass-panel">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                    <th className="p-4 w-1/4">Parameter</th>
                    <th className="p-4 w-3/8 text-blue-300 bg-blue-950/20">
                      Patent A ({comparisonResult.patent_a.id})
                    </th>
                    <th className="p-4 w-3/8 text-indigo-300 bg-indigo-950/20">
                      Patent B ({comparisonResult.patent_b.id})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {comparisonResult.parameters_table.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 font-semibold text-slate-300 align-top bg-slate-900/30">
                        {row.parameter}
                      </td>
                      <td className="p-4 text-slate-200 align-top whitespace-pre-line leading-relaxed">
                        {row.patent_a}
                      </td>
                      <td className="p-4 text-slate-200 align-top whitespace-pre-line leading-relaxed">
                        {row.patent_b}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Highlighted Features Comparison ──────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Common / Matching Technical Features */}
            <div className="glass-panel rounded-2xl p-6 border border-emerald-900/40 space-y-4">
              <h4 className="text-sm font-bold font-heading text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} /> Matching & Common Technical Features
              </h4>
              <div className="space-y-2">
                {comparisonResult.common_features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-xs text-emerald-200 flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Differentiating / Unique Features */}
            <div className="glass-panel rounded-2xl p-6 border border-blue-900/40 space-y-4">
              <h4 className="text-sm font-bold font-heading text-blue-400 flex items-center gap-2">
                <Sparkles size={16} /> Distinguishing Features
              </h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                    Unique to Patent A ({comparisonResult.patent_a.id}):
                  </span>
                  {comparisonResult.unique_features_a.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-800/30 text-xs text-blue-200 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                    Unique to Patent B ({comparisonResult.patent_b.id}):
                  </span>
                  {comparisonResult.unique_features_b.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 text-xs text-indigo-200 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── AI Comparison Analysis (Methodology, Claims, Summary) ───── */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800/80 space-y-6">
            <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
              <Zap size={18} className="text-purple-400" />
              AI Deep Comparison Breakdown
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Methodology Comparison */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-400" /> Differences in Methodology
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  {comparisonResult.methodology_comparison}
                </p>
              </div>

              {/* Patent Claims Comparison */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileCheck size={14} className="text-indigo-400" /> Comparison of Patent Claims
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  {comparisonResult.claims_comparison}
                </p>
              </div>
            </div>

            {/* Technical Advantages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Technical Advantages ({comparisonResult.patent_a.id})
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {comparisonResult.technical_advantages_a.map((adv, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Technical Advantages ({comparisonResult.patent_b.id})
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {comparisonResult.technical_advantages_b.map((adv, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Overall Summary Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-800/30 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Info size={14} /> Overall Comparison Summary
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed">
                {comparisonResult.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison History Section */}
      {history.length > 0 && (
        <div className="border-t border-slate-800/80 pt-8 space-y-4">
          <h3 className="text-sm font-bold font-heading text-slate-300 flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            Previous Comparisons
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.slice(0, 6).map((h) => (
              <div
                key={h.id}
                onClick={() => selectPredefinedPair(h.patent_a_id, h.patent_b_id)}
                className="p-3.5 rounded-xl glass-card border border-slate-800 hover:border-blue-500/40 cursor-pointer transition-all hover:scale-[1.01] space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{h.patent_a_id} vs {h.patent_b_id}</span>
                  <span className="text-blue-400 font-bold">{h.similarity_percentage}%</span>
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {h.patent_a_title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Comparison;

