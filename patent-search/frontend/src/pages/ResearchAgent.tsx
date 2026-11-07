import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  BookOpen,
  FileText,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Download,
  Printer,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Send,
  Trash2,
  ChevronRight,
  Cpu,
  ShieldAlert,
  Bot,
  Activity,
  Compass,
} from 'lucide-react';
import {
  researchApi,
  ResearchStatusResponse,
  ResearchResults,
  ResearchHistoryItem,
  CitedPatent,
} from '../api/researchApi';
import { Dropzone } from '../components/Dropzone';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { AssistantAvatar } from '../components/AssistantAvatar';

const PRESET_IDEAS = [
  {
    title: 'Satellite Quantum Key Distribution (QKD) Mesh Network',
    field: 'Quantum Communications & Satellite Systems',
    techs: 'Entanglement distribution, adaptive optics, free-space laser, FPGA error correction',
    objective: 'Prior-Art Landscape & Novelty Clearance',
    desc: 'A decentralized constellation of low-Earth orbit satellites utilizing entangled photon pairs to negotiate quantum cryptographic keys with mobile ground stations, featuring real-time atmospheric beam steering and error-syndrome decoding.',
  },
  {
    title: 'Neuromorphic Edge Vision Processor for Surgical Robotics',
    field: 'Biomedical Devices & Computer Vision',
    techs: 'Event-based cameras, spiking neural networks, asynchronous crossbar arrays, ultra-low latency sub-millisecond tracking',
    objective: 'Novelty & Overlap Investigation',
    desc: 'An asynchronous event-driven vision co-processor that interfaces directly with dual-sensor stereoscopic endoscopes to execute real-time tissue tracking and instrument collision prevention with sub-millisecond reaction times and under 1.5W power consumption.',
  },
  {
    title: 'Solid-State Lithium-Sulfur Battery with Ceramic Nanowire Electrolyte',
    field: 'Clean Energy & Battery Technology',
    techs: 'Lithium-sulfur cathode, garnet-type LLZO ceramic nanowires, polymer composite electrolyte, dendritic lithium suppression',
    objective: 'Comprehensive Prior-Art Screening',
    desc: 'A solid-state rechargeable energy storage cell comprising a sulfur-carbon composite cathode and a hybrid solid electrolyte reinforced by vertically aligned garnet-type ceramic nanowires, preventing polysulfide shuttling and dendrite growth over 1000 fast-charge cycles.',
  },
];

export const ResearchAgent: React.FC = () => {
  // ── Input State ────────────────────────────────────────────────────────────
  const [inventionTitle, setInventionTitle] = useState('');
  const [inventionDescription, setInventionDescription] = useState('');
  const [technicalField, setTechnicalField] = useState('');
  const [keyTechnologies, setKeyTechnologies] = useState('');
  const [researchObjective, setResearchObjective] = useState(
    'Comprehensive Prior-Art Landscape & Novelty Clearance'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Execution State ────────────────────────────────────────────────────────
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<ResearchStatusResponse | null>(null);
  const [results, setResults] = useState<ResearchResults | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Follow-Up State ────────────────────────────────────────────────────────
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpThread, setFollowUpThread] = useState<
    Array<{ question: string; answer: string; citations?: any[]; timestamp: string }>
  >([]);

  // ── History & View State ───────────────────────────────────────────────────
  const [historyItems, setHistoryItems] = useState<ResearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'patents' | 'analysis'>('report');

  const pollIntervalRef = useRef<number | null>(null);
  const terminalLogsEndRef = useRef<HTMLDivElement | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const entries = await researchApi.getHistory();
      setHistoryItems(entries);
    } catch {
      // ignore unauthenticated history fetch
    }
  };

  // Scroll logs to bottom during live run
  useEffect(() => {
    if (taskStatus?.status === 'running') {
      terminalLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [taskStatus?.logs]);

  // ── Polling Hook ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTaskId) return;

    const poll = async () => {
      try {
        const statusData = await researchApi.getStatus(activeTaskId);
        setTaskStatus(statusData);

        if (statusData.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const fullResults = await researchApi.getResults(activeTaskId);
          setResults(fullResults);
          loadHistory();
        } else if (statusData.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setErrorMsg(statusData.error || 'Research agent execution failed.');
        }
      } catch (err: any) {
        console.error('Error polling research status:', err);
      }
    };

    poll();
    pollIntervalRef.current = window.setInterval(poll, 1600);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeTaskId]);

  // ── Start Research Handler ─────────────────────────────────────────────────
  const handleStartResearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inventionTitle.trim() || !inventionDescription.trim()) {
      setErrorMsg('Please provide both an Invention Title and Invention Description.');
      return;
    }

    setErrorMsg(null);
    setIsStarting(true);
    setResults(null);
    setTaskStatus(null);
    setFollowUpThread([]);

    const formData = new FormData();
    formData.append('invention_title', inventionTitle.trim());
    formData.append('invention_description', inventionDescription.trim());
    formData.append('technical_field', technicalField.trim());
    formData.append('key_technologies', keyTechnologies.trim());
    formData.append('research_objective', researchObjective);
    if (selectedFile) {
      formData.append('pdf_file', selectedFile);
    }

    try {
      const res = await researchApi.startResearch(formData);
      setActiveTaskId(res.task_id);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to start research task.');
    } finally {
      setIsStarting(false);
    }
  };

  // ── Follow-Up Question Handler ─────────────────────────────────────────────
  const handleSendFollowUp = async (customQ?: string) => {
    const q = (customQ || followUpQuestion).trim();
    if (!q || !activeTaskId || followUpLoading) return;

    setFollowUpLoading(true);
    setFollowUpQuestion('');

    try {
      const resp = await researchApi.askFollowUp(activeTaskId, q);
      setFollowUpThread((prev) => [
        ...prev,
        {
          question: q,
          answer: resp.answer,
          citations: resp.citations,
          timestamp: resp.timestamp,
        },
      ]);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to get follow-up answer.');
    } finally {
      setFollowUpLoading(false);
    }
  };

  // ── Action Handlers ────────────────────────────────────────────────────────
  const handleCopyReport = () => {
    if (!results?.report_markdown) return;
    navigator.clipboard.writeText(results.report_markdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2200);
  };

  const handleDownloadMarkdown = () => {
    if (!results) return;
    const blob = new Blob([results.report_markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PatentAI-Research-${results.invention_title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleApplyPreset = (preset: typeof PRESET_IDEAS[0]) => {
    setInventionTitle(preset.title);
    setTechnicalField(preset.field);
    setKeyTechnologies(preset.techs);
    setResearchObjective(preset.objective);
    setInventionDescription(preset.desc);
    setSelectedFile(null);
  };

  const handleLoadHistory = (item: ResearchHistoryItem) => {
    if (item.full_data) {
      setResults(item.full_data);
      setActiveTaskId(item.id);
      setInventionTitle(item.invention_title);
      setTechnicalField(item.technical_field);
      setShowHistory(false);
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await researchApi.deleteHistory(id);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      if (activeTaskId === id) {
        setResults(null);
        setActiveTaskId(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const isExecuting = taskStatus?.status === 'running' || isStarting;

  return (
    <div className="min-h-screen bg-[#05070D] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── HEADER SECTION ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0B1020]/90 via-[#070B16]/80 to-[#05070D] border border-cyan-500/20 p-6 sm:p-10 shadow-[0_0_50px_-10px_rgba(6,182,212,0.15)]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <AssistantAvatar size={60} animate={true} />
              <div>
                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Autonomous Multi-Stage Engine
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    554 Curated Patents Indexed
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight">
                  AI Patent Research Agent
                </h1>
                <p className="text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
                  Your intelligent research companion for discovering prior art, analyzing
                  inventions, and exploring patent opportunities.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 transition-all shadow-md"
              >
                <Clock size={14} className="text-cyan-400" />
                History {historyItems.length > 0 && `(${historyItems.length})`}
              </button>
            </div>
          </div>

          {/* Preset Ideas Pills */}
          <div className="mt-6 pt-5 border-t border-white/[0.08]">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-cyan-400" />
              Try Example Inventions:
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_IDEAS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/35 text-[11px] text-slate-300 hover:text-cyan-300 transition-all text-left flex items-center gap-1.5"
                >
                  <span className="text-cyan-400 font-mono">#{idx + 1}</span>
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── SAVED HISTORY DRAWER ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl bg-[#0B1020]/95 border border-slate-800 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Clock size={16} className="text-cyan-400" />
                  Saved Patent Research Reports
                </h3>
                <span className="text-xs text-slate-400 font-mono">{historyItems.length} records</span>
              </div>

              {historyItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No research history saved yet. Complete a research session to save your findings.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {historyItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleLoadHistory(item)}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all hover:bg-slate-800/80 group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 line-clamp-1">
                            {item.invention_title}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistory(e, item.id)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {item.summary || item.technical_field}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{item.patents_found} patents</span>
                        <span className="text-cyan-400 font-bold">
                          {intPercent(item.top_similarity)} match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RESEARCH INPUT PANEL ─────────────────────────────────────────── */}
        <div className="rounded-3xl bg-[#0B1020]/90 border border-white/[0.08] p-6 sm:p-8 backdrop-blur-xl shadow-xl">
          <form onSubmit={handleStartResearch} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold font-heading text-slate-200 flex items-center gap-1.5">
                  Invention Title <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={inventionTitle}
                  onChange={(e) => setInventionTitle(e.target.value)}
                  placeholder="e.g., Quantum Key Distribution Mesh Network with Optical Adaptive Steering"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold font-heading text-slate-200">
                  Technical Field
                </label>
                <input
                  type="text"
                  value={technicalField}
                  onChange={(e) => setTechnicalField(e.target.value)}
                  placeholder="e.g., Quantum Computing / Cryptography"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-heading text-slate-200">
                  Key Technologies & Components
                </label>
                <input
                  type="text"
                  value={keyTechnologies}
                  onChange={(e) => setKeyTechnologies(e.target.value)}
                  placeholder="e.g., Entanglement source, FPGA syndrome decoder, MEMS laser gimbal"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold font-heading text-slate-200">
                  Research Objective
                </label>
                <select
                  value={researchObjective}
                  onChange={(e) => setResearchObjective(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs sm:text-sm text-slate-100 outline-none transition-all cursor-pointer"
                >
                  <option value="Comprehensive Prior-Art Landscape & Novelty Clearance">
                    Comprehensive Prior-Art Landscape & Novelty Clearance
                  </option>
                  <option value="Freedom to Operate (FTO) Infringement Assessment">
                    Freedom to Operate (FTO) Infringement Assessment
                  </option>
                  <option value="Claim Boundary & Competitive Whitespace Discovery">
                    Claim Boundary & Competitive Whitespace Discovery
                  </option>
                  <option value="Technical Feasibility & Pre-Filing Diagnostic">
                    Technical Feasibility & Pre-Filing Diagnostic
                  </option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold font-heading text-slate-200 flex items-center gap-1.5">
                  Invention Description & Claims Disclosure <span className="text-cyan-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {inventionDescription.length} characters
                </span>
              </div>
              <textarea
                required
                rows={5}
                value={inventionDescription}
                onChange={(e) => setInventionDescription(e.target.value)}
                placeholder="Describe your technical invention in detail: explain the physical or logical architecture, algorithmic workflows, problem addressed, and how your proposed system improves over existing solutions..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none resize-y transition-all leading-relaxed"
              />
            </div>

            {/* Optional PDF Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold font-heading text-slate-200 flex items-center gap-2">
                <FileText size={14} className="text-cyan-400" />
                Attach Patent Draft or Technical Spec (Optional PDF)
              </label>
              <Dropzone
                onFileSelect={(f) => setSelectedFile(f)}
                selectedFile={selectedFile}
                onClearFile={() => setSelectedFile(null)}
                disabled={isExecuting}
              />
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
                <AlertCircle size={15} className="shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldAlert size={14} className="text-cyan-400 shrink-0" />
                <span>
                  Evaluated against indexed patent repository with zero hallucinations.
                </span>
              </div>

              <button
                type="submit"
                disabled={isExecuting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-600 hover:from-teal-300 hover:via-cyan-400 hover:to-blue-500 text-slate-950 font-heading font-extrabold text-sm tracking-wide shadow-[0_0_30px_rgba(45,212,191,0.4)] hover:shadow-[0_0_40px_rgba(45,212,191,0.6)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2.5"
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Executing Research Workflow...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Start AI Research</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── RESEARCH PROGRESS PANEL ──────────────────────────────────────── */}
        {taskStatus && (taskStatus.status === 'running' || taskStatus.status === 'pending') && (
          <div className="rounded-3xl bg-[#0B1020]/95 border border-cyan-500/30 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Active Agent Workflow • Task: {taskStatus.task_id}
                </div>
                <h3 className="text-lg font-bold font-heading text-white mt-1">
                  {taskStatus.current_step_name}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-cyan-300">
                  {taskStatus.progress_percent}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${taskStatus.progress_percent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* 6 Step Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {taskStatus.steps.map((st) => {
                const isCurrent = taskStatus.progress_step === st.step && taskStatus.status === 'running';
                const isDone = st.status === 'completed';

                return (
                  <div
                    key={st.step}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      isDone
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                        : isCurrent
                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold">Step {st.step}</div>
                    <div className="text-xs font-semibold line-clamp-1 mt-0.5">{st.name}</div>
                    <div className="text-[10px] mt-1 font-mono text-slate-400">
                      {isDone ? '✓ Completed' : isCurrent ? 'Running...' : 'Queued'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Agent Terminal Stream */}
            <div className="rounded-2xl bg-black/80 border border-slate-800/90 p-4 font-mono text-xs text-slate-300 h-44 overflow-y-auto space-y-1.5 shadow-inner">
              <div className="text-slate-500 text-[11px] pb-1 border-b border-slate-800/80 flex items-center justify-between">
                <span>Agent Execution Terminal Log</span>
                <span>all-MiniLM-L6-v2 + FAISS</span>
              </div>
              {taskStatus.logs.map((log, i) => (
                <div key={i} className="text-slate-300 leading-snug">
                  <span className="text-cyan-400">{log.slice(0, 22)}</span>{' '}
                  <span className="text-slate-200">{log.slice(22)}</span>
                </div>
              ))}
              <div ref={terminalLogsEndRef} />
            </div>
          </div>
        )}

        {/* ── RESEARCH RESULTS DASHBOARD ───────────────────────────────────── */}
        {results && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#0B1020]/90 border border-white/[0.08] shadow-lg">
                <div className="text-xs font-medium text-slate-400">Patents Retrieved</div>
                <div className="text-2xl sm:text-3xl font-extrabold font-heading text-white mt-1">
                  {results.metrics.patents_retrieved}
                </div>
                <div className="text-[11px] text-cyan-400 font-mono mt-1">
                  Across {results.metrics.query_count} Concept Queries
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B1020]/90 border border-white/[0.08] shadow-lg">
                <div className="text-xs font-medium text-slate-400">Top Similarity Match</div>
                <div className="text-2xl sm:text-3xl font-extrabold font-heading text-cyan-300 mt-1">
                  {intPercent(results.metrics.top_similarity)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Cosine Similarity Score
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B1020]/90 border border-white/[0.08] shadow-lg">
                <div className="text-xs font-medium text-slate-400">Close Citations (&gt;70%)</div>
                <div className="text-2xl sm:text-3xl font-extrabold font-heading text-emerald-400 mt-1">
                  {results.metrics.highly_relevant_count}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">Relevant References</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B1020]/90 border border-white/[0.08] shadow-lg">
                <div className="text-xs font-medium text-slate-400">Agent Execution Time</div>
                <div className="text-2xl sm:text-3xl font-extrabold font-heading text-blue-400 mt-1">
                  {results.execution_time_seconds}s
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">6 Stages Completed</div>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'report'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Full Research Report
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('patents')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'patents'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Cited Patents ({results.patents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('analysis')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'analysis'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Comparative Feature Mapping
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all"
                  title="Copy full markdown report"
                >
                  {copiedReport ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedReport ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all"
                  title="Download Markdown (.md)"
                >
                  <Download size={14} />
                  <span>Download .MD</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all"
                  title="Print / Save PDF"
                >
                  <Printer size={14} />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* TAB 1: COMPLETE RESEARCH REPORT */}
            {activeTab === 'report' && (
              <div className="rounded-3xl bg-[#0B1020]/90 border border-white/[0.08] p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
                <MarkdownRenderer content={results.report_markdown} />
              </div>
            )}

            {/* TAB 2: CITED PATENTS CARDS */}
            {activeTab === 'patents' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.patents.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-2xl bg-[#0B1020]/90 border border-slate-800/90 hover:border-cyan-500/40 transition-all flex flex-col justify-between shadow-lg"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-mono text-xs font-bold">
                          #{idx + 1} • {p.id}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-extrabold font-mono text-cyan-400">
                            {intPercent(p.similarity_score)}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-mono">Similarity</span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">
                        {p.title}
                      </h4>

                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3 flex-wrap">
                        <span>Assignee: {p.assignee}</span>
                        <span>Published: {p.publication_date}</span>
                        <span>Class: {p.ipc_class}</span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                        {p.abstract || p.snippet}
                      </p>

                      {p.matched_queries && p.matched_queries.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {p.matched_queries.map((q, qIdx) => (
                            <span
                              key={qIdx}
                              className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/60 text-[10px] text-slate-400 font-mono"
                            >
                              Concept: {q}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Official Google Patents Record
                      </span>
                      <a
                        href={p.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-cyan-500/30"
                      >
                        <span>View Document</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: COMPARATIVE FEATURE MAPPING */}
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                {results.analyses.map((a, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-[#0B1020]/90 border border-slate-800 shadow-xl space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-xs font-mono text-cyan-400 font-bold">
                          Patent {a.patent_id}
                        </span>
                        <h4 className="text-sm font-bold text-slate-100">{a.patent_title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                            a.threat_level === 'High'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : a.threat_level === 'Moderate'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          Threat: {a.threat_level}
                        </span>
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {intPercent(a.similarity_score)} Match
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>Similar / Overlapping Disclosures</span>
                        </div>
                        <ul className="space-y-1 text-slate-300 list-disc list-inside">
                          {a.similar_features.map((sf, sfIdx) => (
                            <li key={sfIdx}>{sf}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <span>Distinctive Invention Features (Not Found)</span>
                        </div>
                        <ul className="space-y-1 text-slate-300 list-disc list-inside">
                          {a.different_features.map((df, dfIdx) => (
                            <li key={dfIdx}>{df}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                      <span className="font-bold text-cyan-400 font-mono">Scope Summary: </span>
                      {a.overlapping_scope}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── INTERACTIVE FOLLOW-UP ASSISTANT ────────────────────────────── */}
            <div className="rounded-3xl bg-gradient-to-b from-[#0B1020]/95 to-[#070B16] border border-cyan-500/25 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-5">
              <div className="flex items-center gap-3">
                <AssistantAvatar size={42} animate={true} />
                <div>
                  <h3 className="text-sm font-bold font-heading text-white">
                    Ask Follow-up Questions Grounded in this Research
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inquire about specific patent claims, novelty boundaries, or drafting
                    recommendations.
                  </p>
                </div>
              </div>

              {/* Sample follow-up buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  'How can I draft Claim 1 to overcome the top patent?',
                  'Which retrieved patent poses the highest infringement risk?',
                  'What are the strongest technical gaps to emphasize?',
                  'Suggest 3 novel dependent claim features based on these results.',
                ].map((sampleQ, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handleSendFollowUp(sampleQ)}
                    disabled={followUpLoading}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-[11px] text-cyan-300 hover:text-white transition-all text-left"
                  >
                    "{sampleQ}"
                  </button>
                ))}
              </div>

              {/* Follow-up Q&A Thread */}
              {followUpThread.length > 0 && (
                <div className="space-y-4 pt-2">
                  {followUpThread.map((item, idx) => (
                    <div key={idx} className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/30 text-xs text-cyan-200 font-medium">
                        <span className="font-bold text-cyan-400">You: </span>
                        {item.question}
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 leading-relaxed space-y-2">
                        <MarkdownRenderer content={item.answer} />
                        {item.citations && item.citations.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-mono">
                            <span>Cited:</span>
                            {item.citations.map((c, cIdx) => (
                              <a
                                key={cIdx}
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:underline"
                              >
                                {c.id} ({intPercent(c.score)})
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Question Input Form */}
              <div className="flex items-center gap-2 bg-slate-950 rounded-2xl border border-slate-800 px-3 py-2 focus-within:border-cyan-500">
                <input
                  type="text"
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendFollowUp();
                    }
                  }}
                  placeholder="Ask a question about these patents, claim drafting, or novelty gaps..."
                  className="flex-1 bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSendFollowUp()}
                  disabled={!followUpQuestion.trim() || followUpLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-300 hover:to-cyan-400 text-slate-950 text-xs font-bold disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  {followUpLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Ask</span>
                      <Send size={12} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function intPercent(score: number): string {
  if (!score || isNaN(score)) return '0%';
  return `${Math.round(score * 100)}%`;
}

