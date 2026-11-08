import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Printer,
  RotateCcw,
  Clock,
  Layers,
  ShieldAlert,
  HelpCircle,
  FolderOpen,
  ArrowRight,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { HeroWordReveal } from '../components/AnimatedText';
import { draftReviewApi } from '../api/draftReviewApi';
import {
  DraftReviewResponse,
  DraftReviewHistoryEntry,
  DraftIssue,
  DraftSectionStatus,
} from '../types/patent';

export const DraftReviewer: React.FC = () => {
  // Input states
  const [inventionTitle, setInventionTitle] = useState('');
  const [technicalField, setTechnicalField] = useState('Artificial Intelligence & Software');
  const [reviewType, setReviewType] = useState('Comprehensive Review');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');

  // Execution & Results states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<DraftReviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'technical' | 'structure' | 'claims' | 'missing'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // History state
  const [history, setHistory] = useState<DraftReviewHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await draftReviewApi.getHistory(15);
      setHistory(res.entries || []);
    } catch (_) {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const name = file.name.toLowerCase();
      if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.txt')) {
        setError('Please upload a PDF (.pdf) or Word document (.docx).');
        return;
      }
      setSelectedFile(file);
      setError(null);
      if (!inventionTitle) {
        // Pre-fill title from filename
        setInventionTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (inputMode === 'upload' && !selectedFile) {
      setError('Please upload a patent draft in PDF or DOCX format.');
      return;
    }
    if (inputMode === 'paste' && (!pastedText.trim() || pastedText.trim().length < 30)) {
      setError('Please paste at least 30 characters of patent draft text.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('invention_title', inventionTitle.trim());
      formData.append('technical_field', technicalField);
      formData.append('review_type', reviewType);

      if (inputMode === 'upload' && selectedFile) {
        formData.append('draft_file', selectedFile);
      } else {
        formData.append('pasted_text', pastedText.trim());
      }

      const result = await draftReviewApi.analyzeDraft(formData);
      setReviewData(result);
      loadHistory();
    } catch (err: any) {
      console.error('[DraftReviewer] Error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to analyze patent draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = async (id: string) => {
    setLoading(true);
    try {
      const data = await draftReviewApi.getReview(id);
      setReviewData(data);
      setShowHistory(false);
    } catch (err: any) {
      setError('Could not load selected draft review report.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySuggestion = (issue: DraftIssue) => {
    navigator.clipboard.writeText(issue.suggested_improvement);
    setCopiedId(issue.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllRecommendations = () => {
    if (!reviewData) return;
    const text = [
      `=== AI PATENT DRAFT REVIEW REPORT ===`,
      `Title: ${reviewData.title}`,
      `Technical Field: ${reviewData.technical_field}`,
      `Quality Indicator: ${reviewData.quality_score}/100 (${reviewData.score_verdict})`,
      `\n--- EXECUTIVE SUMMARY ---`,
      reviewData.overall_summary,
      `\n--- KEY RECOMMENDATIONS ---`,
      ...reviewData.recommendations.map((r, i) => `${i + 1}. ${r}`),
      `\n--- DETAILED ISSUES (${reviewData.issues.length}) ---`,
      ...reviewData.issues.map(
        (iss, idx) =>
          `\nIssue #${idx + 1}: [${iss.severity}] ${iss.title} (${iss.category})\n` +
          `Original: ${iss.original_text || 'N/A'}\n` +
          `Explanation: ${iss.explanation}\n` +
          `Suggested Revision: ${iss.suggested_improvement}\n` +
          `Reason: ${iss.reason}`
      ),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter issues based on active tab
  const filteredIssues = reviewData
    ? reviewData.issues.filter((iss) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'technical') return iss.category === 'technical';
        if (activeTab === 'structure') return iss.category === 'structure';
        if (activeTab === 'claims') return iss.category === 'claims';
        if (activeTab === 'missing') return iss.category === 'missing_info';
        return true;
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
            <Sparkles size={14} className="text-cyan-400" />
            <span>AI Patent Draft Reviewer</span>
          </motion.div>

          <HeroWordReveal
            prefixText="Autonomous"
            gradientText="Patent Quality & Claims Auditor"
            className="text-3xl sm:text-4xl font-bold font-heading text-slate-100 tracking-tight"
          />

          <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
            Examine patent draft applications against USPTO/EPO formalities: detect missing sections,
            indefinite claim terms, antecedent basis defects, and get actionable text improvements.
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
            <span>Past Reviews ({history.length})</span>
          </button>
        )}
      </div>

      {/* Past Reviews Quick Select Drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#0B1020]/80 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200">Saved Patent Draft Reviews</span>
                <span className="text-[11px] font-mono">Select a report to inspect</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleSelectHistoryItem(h.id)}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/50 text-left transition-all group"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                      {h.title}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
                      <span>Score: {Math.round(h.quality_score)}%</span>
                      <span>{h.issue_count} issues</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Input Panel */}
      {!reviewData && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Invention Title */}
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 font-mono">
                  <span>Invention Title</span>
                </label>
                <input
                  type="text"
                  value={inventionTitle}
                  onChange={(e) => setInventionTitle(e.target.value)}
                  placeholder="e.g. Neuromorphic Edge Vision Processor"
                  className="w-full bg-[#070A14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-all"
                />
              </div>

              {/* Technical Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-mono">
                  Technical Field
                </label>
                <select
                  value={technicalField}
                  onChange={(e) => setTechnicalField(e.target.value)}
                  className="w-full bg-[#070A14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none transition-all"
                >
                  <option>Artificial Intelligence & Software</option>
                  <option>Semiconductors & Quantum Hardware</option>
                  <option>Biomedical Devices & Diagnostics</option>
                  <option>Autonomous Systems & Robotics</option>
                  <option>Telecommunications & Wireless IoT</option>
                  <option>Renewable Energy & Battery Chemistry</option>
                  <option>Mechanical & Structural Systems</option>
                </select>
              </div>

              {/* Review Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-mono">
                  Review Depth
                </label>
                <select
                  value={reviewType}
                  onChange={(e) => setReviewType(e.target.value)}
                  className="w-full bg-[#070A14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none transition-all"
                >
                  <option>Comprehensive Review (Full Formalities & Claims)</option>
                  <option>Claims-Only Deep Audit</option>
                  <option>Structure & Formalities Check</option>
                  <option>Technical Clarity & Enablement</option>
                </select>
              </div>
            </div>

            {/* Input Mode Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      inputMode === 'upload'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                    }`}
                  >
                    Upload Document (PDF / DOCX)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      inputMode === 'paste'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                    }`}
                  >
                    Paste Draft Text
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Supports .pdf, .docx, and raw claim text
                </span>
              </div>

              {/* Upload Dropzone */}
              {inputMode === 'upload' ? (
                <div className="relative border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-8 text-center bg-[#070A14]/70 transition-all group">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                      <Upload size={22} />
                    </div>
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-cyan-300 flex items-center justify-center gap-2">
                          <CheckCircle2 size={16} /> {selectedFile.name}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for audit
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-300">
                          Drop your patent draft here, or{' '}
                          <span className="text-cyan-400 underline underline-offset-2">browse</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Supports Microsoft Word (.docx), Adobe Acrobat (.pdf), and text drafts (up to 25 MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <textarea
                    rows={12}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste the Title, Abstract, Detailed Description, and Claims of your patent draft here..."
                    className="w-full bg-[#070A14] border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 placeholder-slate-500 font-mono leading-relaxed focus:border-cyan-500 focus:outline-none transition-all"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>{pastedText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>{pastedText.length} characters</span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertOctagon size={16} className="text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500 hover:from-teal-300 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Patent Draft...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Start AI Patent Draft Review</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Review Results Dashboard */}
      {reviewData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Top Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold font-mono">
                {Math.round(reviewData.quality_score)}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-200">{reviewData.title}</h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  {reviewData.technical_field} • Reviewed in {reviewData.processing_time_ms}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyAllRecommendations}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-cyan-500 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5"
              >
                {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedAll ? 'Report Copied' : 'Copy Full Report'}</span>
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
                onClick={() => setReviewData(null)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>Review Another Draft</span>
              </button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Score Card */}
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1.5 bg-gradient-to-br from-cyan-950/20 to-slate-900/60">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Draft Quality Indicator
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-heading text-cyan-300">
                  {reviewData.quality_score}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 100</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {reviewData.score_verdict}
              </p>
            </div>

            {/* Technical Issues */}
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Technical Clarity
              </span>
              <p className="text-3xl font-bold font-heading text-amber-400">
                {reviewData.technical_issues_count}
              </p>
              <p className="text-[11px] text-slate-500">Unclear terms & ranges</p>
            </div>

            {/* Structure Issues */}
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Structure & Sections
              </span>
              <p className="text-3xl font-bold font-heading text-blue-400">
                {reviewData.structure_issues_count}
              </p>
              <p className="text-[11px] text-slate-500">Missing/incomplete parts</p>
            </div>

            {/* Claims Issues */}
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Claims Defects
              </span>
              <p className="text-3xl font-bold font-heading text-rose-400">
                {reviewData.claims_issues_count}
              </p>
              <p className="text-[11px] text-slate-500">Antecedent & scope risks</p>
            </div>

            {/* Missing Information */}
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Missing Information
              </span>
              <p className="text-3xl font-bold font-heading text-emerald-400">
                {reviewData.missing_info_count}
              </p>
              <p className="text-[11px] text-slate-500">Figures & parameter gaps</p>
            </div>
          </div>

          {/* Section Completeness Audit */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers size={14} className="text-cyan-400" />
              <span>Standard Patent Sections Compliance (USPTO / EPO)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {reviewData.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-center space-y-1 transition-all ${
                    sec.status === 'Complete'
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                      : sec.status === 'Needs Improvement'
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                      : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                  }`}
                >
                  <div className="text-[11px] font-semibold truncate" title={sec.section_name}>
                    {sec.section_name}
                  </div>
                  <div className="text-[10px] font-mono font-bold">{sec.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Summary & Strategic Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <FileText size={14} className="text-cyan-400" />
                <span>Executive Summary</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {reviewData.overall_summary}
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldAlert size={14} className="text-cyan-400" />
                <span>Top Drafting Recommendations</span>
              </h3>
              <ul className="space-y-2">
                {reviewData.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-mono font-bold mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Issue Filter Tabs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {[
                  { key: 'all', label: `All Observations (${reviewData.issues.length})` },
                  { key: 'technical', label: `Technical Issues (${reviewData.technical_issues_count})` },
                  { key: 'structure', label: `Structure (${reviewData.structure_issues_count})` },
                  { key: 'claims', label: `Claims (${reviewData.claims_issues_count})` },
                  { key: 'missing', label: `Missing Info (${reviewData.missing_info_count})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === tab.key
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Issues Cards */}
            <div className="space-y-4">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="glass-card rounded-2xl p-5 border border-slate-800/90 space-y-3.5 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                          issue.severity === 'High'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : issue.severity === 'Medium'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-200">{issue.title}</span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Category: {issue.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{issue.explanation}</p>

                  {/* Side-by-Side Original vs. Suggested Revision */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {issue.original_text && (
                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Draft Excerpt (Flagged Text)
                        </span>
                        <div className="text-rose-300/90 line-through decoration-rose-500/50">
                          {issue.original_text}
                        </div>
                      </div>
                    )}

                    <div
                      className={`p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs font-mono space-y-1.5 ${
                        !issue.original_text ? 'md:col-span-2' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                          Suggested Patent Improvement
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopySuggestion(issue)}
                          className="text-[10px] font-mono text-cyan-300 hover:text-white flex items-center gap-1 hover:underline"
                        >
                          {copiedId === issue.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedId === issue.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="text-cyan-200 leading-relaxed">
                        {issue.suggested_improvement}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 italic pt-1">
                    <span className="font-semibold text-slate-300">Examination Rationale: </span>
                    {issue.reason}
                  </div>
                </div>
              ))}

              {filteredIssues.length === 0 && (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                  No issues found in this category.
                </div>
              )}
            </div>
          </div>

          {/* Legal Disclaimer Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-500 font-mono leading-relaxed">
            {reviewData.disclaimer}
          </div>
        </motion.div>
      )}
    </div>
  );
};
