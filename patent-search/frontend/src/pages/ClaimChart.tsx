import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Printer,
  Download,
  RotateCcw,
  Clock,
  Layers,
  ShieldAlert,
  FolderOpen,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { HeroWordReveal } from '../components/AnimatedText';
import { claimChartApi } from '../api/claimChartApi';
import { compareApi } from '../api/compareApi';
import {
  ClaimChartResponse,
  ClaimChartHistoryEntry,
  ClaimElementComparison,
  PatentSummaryItem,
} from '../types/patent';

export const ClaimChart: React.FC = () => {
  // Document A states
  const [docAMode, setDocAMode] = useState<'catalog' | 'upload' | 'paste'>('catalog');
  const [docAPatentId, setDocAPatentId] = useState('US-2024-001');
  const [docAText, setDocAText] = useState('');
  const [docAFile, setDocAFile] = useState<File | null>(null);
  const [docAName, setDocAName] = useState('');

  // Document B states
  const [docBMode, setDocBMode] = useState<'catalog' | 'upload' | 'paste'>('catalog');
  const [docBPatentId, setDocBPatentId] = useState('US-2024-005');
  const [docBText, setDocBText] = useState('');
  const [docBFile, setDocBFile] = useState<File | null>(null);
  const [docBName, setDocBName] = useState('');

  // General settings
  const [chartTitle, setChartTitle] = useState('');
  const [catalog, setCatalog] = useState<PatentSummaryItem[]>([]);

  // Generation & Results states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ClaimChartResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedAll, setCopiedAll] = useState(false);

  // History state
  const [history, setHistory] = useState<ClaimChartHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load catalog & history
  useEffect(() => {
    loadCatalog();
    loadHistory();
  }, []);

  const loadCatalog = async () => {
    try {
      const res = await compareApi.listPatents();
      setCatalog(res.patents || []);
    } catch (_) {}
  };

  const loadHistory = async () => {
    try {
      const res = await claimChartApi.getHistory(15);
      setHistory(res.entries || []);
    } catch (_) {}
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append('comparison_title', chartTitle.trim());

    // Document A
    if (docAMode === 'catalog') {
      formData.append('doc_a_patent_id', docAPatentId);
    } else if (docAMode === 'upload') {
      if (!docAFile) {
        setError('Please upload a PDF document for Document A (Patent Claims).');
        return;
      }
      formData.append('doc_a_file', docAFile);
      formData.append('doc_a_name', docAFile.name);
    } else {
      if (!docAText.trim() || docAText.trim().length < 30) {
        setError('Please paste at least 30 characters of claim text for Document A.');
        return;
      }
      formData.append('doc_a_text', docAText.trim());
      formData.append('doc_a_name', docAName.trim() || 'Pasted Patent Claims');
    }

    // Document B
    if (docBMode === 'catalog') {
      formData.append('doc_b_patent_id', docBPatentId);
    } else if (docBMode === 'upload') {
      if (!docBFile) {
        setError('Please upload a PDF or DOCX document for Document B (Comparison Disclosure).');
        return;
      }
      formData.append('doc_b_file', docBFile);
      formData.append('doc_b_name', docBFile.name);
    } else {
      if (!docBText.trim() || docBText.trim().length < 30) {
        setError('Please paste at least 30 characters of technical description for Document B.');
        return;
      }
      formData.append('doc_b_text', docBText.trim());
      formData.append('doc_b_name', docBName.trim() || 'Pasted Comparison Text');
    }

    setLoading(true);
    try {
      const result = await claimChartApi.generateClaimChart(formData);
      setChartData(result);
      loadHistory();
    } catch (err: any) {
      console.error('[ClaimChart] Error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to generate claim chart.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = async (id: string) => {
    setLoading(true);
    try {
      const data = await claimChartApi.getClaimChart(id);
      setChartData(data);
      setShowHistory(false);
    } catch (err: any) {
      setError('Could not load selected claim chart.');
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (!chartData) return;

    const headers = ['Claim No.', 'Claim Element / Limitation', 'Evidence from Document B', 'Evidence Source', 'Match Status', 'Technical Analysis'];
    const rows = chartData.elements.map((el) => [
      `"${el.claim_number}"`,
      `"${el.element_text.replace(/"/g, '""')}"`,
      `"${el.evidence_text.replace(/"/g, '""')}"`,
      `"${el.evidence_source.replace(/"/g, '""')}"`,
      `"${el.match_status}"`,
      `"${el.explanation.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Claim_Chart_${chartData.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReport = () => {
    if (!chartData) return;
    const text = [
      `=== AI PATENT CLAIM CHART ===`,
      `Title: ${chartData.title}`,
      `Document A (Claims): ${chartData.doc_a_name}`,
      `Document B (Evidence): ${chartData.doc_b_name}`,
      `Coverage Score: ${chartData.coverage_score}% (${chartData.risk_level})`,
      `\n--- SUMMARY ANALYSIS ---`,
      chartData.summary_analysis,
      `\n--- CLAIM ELEMENTS MAPPING ---`,
      ...chartData.elements.map(
        (el) =>
          `\n[${el.claim_number} | ${el.element_id}] ${el.element_text}\n` +
          `Status: ${el.match_status}\n` +
          `Evidence: ${el.evidence_text} (${el.evidence_source})\n` +
          `Explanation: ${el.explanation}`
      ),
      `\n--- RECOMMENDATIONS ---`,
      ...chartData.recommendations.map((r, i) => `${i + 1}. ${r}`),
      `\n--- DISCLAIMER ---`,
      chartData.disclaimer,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Filter elements
  const filteredElements = chartData
    ? chartData.elements.filter((el) => {
        if (filterStatus === 'all') return true;
        return el.match_status === filterStatus;
      })
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0B1020] border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-2.5"
          >
            <FileSpreadsheet size={14} className="text-cyan-400" />
            <span>AI Claim Chart Generator</span>
          </motion.div>

          <HeroWordReveal
            prefixText="Limitation-by-Limitation"
            gradientText="Prior-Art Claim Mapping"
            className="text-3xl sm:text-4xl font-bold font-heading text-slate-100 tracking-tight"
          />

          <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
            Deconstruct patent claims into discrete technical limitations and autonomously map them against
            prior-art disclosures, competitor specifications, or product documentation.
          </p>
        </div>

        {/* History Drawer Button */}
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500/40 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <FolderOpen size={15} className="text-cyan-400" />
            <span>Past Claim Charts ({history.length})</span>
          </button>
        )}
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#0B1020]/90 space-y-3">
              <span className="text-xs font-semibold text-slate-200">Saved Claim Charts</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleSelectHistoryItem(h.id)}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                      {h.title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1 flex justify-between">
                      <span>Score: {Math.round(h.coverage_score)}%</span>
                      <span>{h.total_elements} elements</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form Panel */}
      {!chartData && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6"
        >
          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 font-mono">
                Claim Chart Title / Case Reference (Optional)
              </label>
              <input
                type="text"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
                placeholder="e.g. Infringement & Novelty Chart - Neural Accelerator vs NeuraTech Prior Art"
                className="w-full bg-[#070A14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-all"
              />
            </div>

            {/* Document A vs Document B Two-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document A: Patent Claims */}
              <div className="p-5 rounded-2xl bg-[#070A14]/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs font-mono">
                      A
                    </span>
                    <span className="text-xs font-bold text-slate-200">Document A: Patent Claims</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Target Claims</span>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDocAMode('catalog')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      docAMode === 'catalog'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Catalog Patent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocAMode('upload')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      docAMode === 'upload'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Upload PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocAMode('paste')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      docAMode === 'paste'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Paste Text
                  </button>
                </div>

                {/* Content Input for Doc A */}
                {docAMode === 'catalog' ? (
                  <select
                    value={docAPatentId}
                    onChange={(e) => setDocAPatentId(e.target.value)}
                    className="w-full bg-[#05070D] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {catalog.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.title}
                      </option>
                    ))}
                  </select>
                ) : docAMode === 'upload' ? (
                  <div className="border border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl p-6 text-center bg-[#05070D] relative cursor-pointer group">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => e.target.files && setDocAFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload size={18} className="mx-auto text-cyan-400 mb-1" />
                    <p className="text-xs text-slate-300">
                      {docAFile ? docAFile.name : 'Upload Claims Document (.pdf)'}
                    </p>
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={docAText}
                    onChange={(e) => setDocAText(e.target.value)}
                    placeholder="1. A system for neural network inference, comprising: a quantum processor...&#10;2. The system of claim 1, further comprising..."
                    className="w-full bg-[#05070D] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Document B: Comparison Document */}
              <div className="p-5 rounded-2xl bg-[#070A14]/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs font-mono">
                      B
                    </span>
                    <span className="text-xs font-bold text-slate-200">Document B: Comparison Document</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Prior Art / Disclosure</span>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDocBMode('catalog')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      docBMode === 'catalog'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Catalog Patent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocBMode('upload')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      docBMode === 'upload'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Upload Document
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocBMode('paste')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      docBMode === 'paste'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Paste Text
                  </button>
                </div>

                {/* Content Input for Doc B */}
                {docBMode === 'catalog' ? (
                  <select
                    value={docBPatentId}
                    onChange={(e) => setDocBPatentId(e.target.value)}
                    className="w-full bg-[#05070D] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {catalog.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.title}
                      </option>
                    ))}
                  </select>
                ) : docBMode === 'upload' ? (
                  <div className="border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-xl p-6 text-center bg-[#05070D] relative cursor-pointer group">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => e.target.files && setDocBFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload size={18} className="mx-auto text-indigo-400 mb-1" />
                    <p className="text-xs text-slate-300">
                      {docBFile ? docBFile.name : 'Upload Prior Art / Spec (.pdf or .docx)'}
                    </p>
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={docBText}
                    onChange={(e) => setDocBText(e.target.value)}
                    placeholder="Paste the technical description, prior-art patent specification, or whitepaper disclosure to be searched for evidence..."
                    className="w-full bg-[#05070D] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertOctagon size={16} className="text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500 hover:from-teal-300 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Mapping Claim Elements to Evidence...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={15} />
                    <span>Generate AI Claim Chart</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Claim Chart Results Dashboard */}
      {chartData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Top Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100">{chartData.title}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                <span>Claims: <strong className="text-cyan-300">{chartData.doc_a_name}</strong></span>
                <span>•</span>
                <span>Evidence: <strong className="text-indigo-300">{chartData.doc_b_name}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-cyan-500 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Export Excel / CSV</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-cyan-500 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Export PDF</span>
              </button>

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-cyan-500 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5"
              >
                {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedAll ? 'Chart Copied' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => setChartData(null)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>Compare Another</span>
              </button>
            </div>
          </div>

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Claim Coverage Score
              </span>
              <p className="text-3xl font-bold font-heading text-cyan-300">
                {chartData.coverage_score}%
              </p>
              <p className="text-[11px] text-slate-400 truncate">{chartData.risk_level}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Full Matches
              </span>
              <p className="text-3xl font-bold font-heading text-emerald-400">
                {chartData.matches_count}
              </p>
              <p className="text-[11px] text-slate-500">Explicit evidence found</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Partial Matches
              </span>
              <p className="text-3xl font-bold font-heading text-amber-400">
                {chartData.partial_matches_count}
              </p>
              <p className="text-[11px] text-slate-500">Analogous teaching</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Not Found (Whitespace)
              </span>
              <p className="text-3xl font-bold font-heading text-rose-400">
                {chartData.not_found_count}
              </p>
              <p className="text-[11px] text-slate-500">Absent from Doc B</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Total Limitations
              </span>
              <p className="text-3xl font-bold font-heading text-slate-200">
                {chartData.total_elements}
              </p>
              <p className="text-[11px] text-slate-500">Discrete clauses</p>
            </div>
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Filter By Status:</span>
              {[
                { key: 'all', label: `All (${chartData.elements.length})` },
                { key: 'Match', label: `Match (${chartData.matches_count})` },
                { key: 'Partial Match', label: `Partial (${chartData.partial_matches_count})` },
                { key: 'Not Found', label: `Not Found (${chartData.not_found_count})` },
                { key: 'Requires Manual Review', label: `Review (${chartData.requires_review_count})` },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setFilterStatus(btn.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filterStatus === btn.key
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono text-slate-500">
              Showing {filteredElements.length} of {chartData.elements.length} limitations
            </span>
          </div>

          {/* The Institutional Claim Chart Table */}
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B1020] border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 w-28">Claim No.</th>
                    <th className="py-3.5 px-4 w-1/3">Claim Element / Technical Limitation</th>
                    <th className="py-3.5 px-4 w-1/3">Evidence from Document B</th>
                    <th className="py-3.5 px-4 w-28 text-center">Status</th>
                    <th className="py-3.5 px-4 w-1/4">Analysis & Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredElements.map((el, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-900/40 transition-colors"
                    >
                      {/* Claim Number */}
                      <td className="py-4 px-4 align-top font-mono font-bold text-cyan-300 whitespace-nowrap">
                        <div>{el.claim_number}</div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          Elem {el.element_id}
                        </span>
                      </td>

                      {/* Claim Element Text */}
                      <td className="py-4 px-4 align-top text-slate-200 leading-relaxed font-sans">
                        <div className="space-y-1">
                          {el.is_preamble && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-slate-400 uppercase mr-1.5">
                              Preamble
                            </span>
                          )}
                          <span>{el.element_text}</span>
                        </div>
                      </td>

                      {/* Evidence Text & Source */}
                      <td className="py-4 px-4 align-top space-y-1.5">
                        <div
                          className={`p-2.5 rounded-xl text-xs font-mono leading-relaxed ${
                            el.match_status === 'Match'
                              ? 'bg-emerald-950/20 border border-emerald-800/40 text-emerald-200'
                              : el.match_status === 'Partial Match'
                              ? 'bg-amber-950/20 border border-amber-800/40 text-amber-200'
                              : 'bg-rose-950/20 border border-rose-800/40 text-rose-300'
                          }`}
                        >
                          "{el.evidence_text}"
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <span className="font-semibold text-slate-300">Cited Location:</span>
                          <span>{el.evidence_source}</span>
                        </div>
                      </td>

                      {/* Match Status Badge */}
                      <td className="py-4 px-4 align-top text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase whitespace-nowrap ${
                            el.match_status === 'Match'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : el.match_status === 'Partial Match'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : el.match_status === 'Not Found'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          }`}
                        >
                          {el.match_status}
                        </span>
                      </td>

                      {/* Technical Explanation */}
                      <td className="py-4 px-4 align-top text-slate-300 text-[11px] leading-relaxed">
                        {el.explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legal Notice Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-500 font-mono leading-relaxed">
            {chartData.disclaimer}
          </div>
        </motion.div>
      )}
    </div>
  );
};
