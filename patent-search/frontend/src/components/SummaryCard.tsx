import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Copy, Download, Check, FileText } from 'lucide-react';
import { SummaryResponse } from '../types/patent';

interface SummaryCardProps {
  summaryData: SummaryResponse;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summaryData }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryData.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([summaryData.summary], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `patent_ai_summary_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const compressionRatio = Math.round((1 - summaryData.summary_length / summaryData.original_length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl mx-auto mt-8 glass-panel rounded-3xl p-6 sm:p-8 border border-blue-500/30 shadow-2xl relative overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 font-heading">AI Executive Patent Summary</h3>
            <p className="text-xs text-slate-400">Generated using facebook/bart-large-cnn model</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            {compressionRatio}% Compressed
          </span>
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Copy Summary"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Download TXT"
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-slate-200 text-sm leading-relaxed font-sans bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80">
          {summaryData.summary}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/60">
        <span className="flex items-center gap-1">
          <FileText size={12} /> Original: {summaryData.original_length} chars → Summary: {summaryData.summary_length} chars
        </span>
        <span>Processed in {summaryData.processing_time_ms.toFixed(1)} ms</span>
      </div>
    </motion.div>
  );
};
