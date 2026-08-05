import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Bookmark, Check, Calendar, User, Globe, Tag, ExternalLink } from 'lucide-react';
import { PatentResult } from '../types/patent';

interface PatentCardProps {
  patent: PatentResult;
  index: number;
}

export const PatentCard: React.FC<PatentCardProps> = ({ patent, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const matchPercent = Math.round(patent.similarity_score * 100);

  const handleCopy = () => {
    const textToCopy = `Patent ID: ${patent.id}\nTitle: ${patent.title}\nSimilarity: ${matchPercent}%\nAbstract: ${patent.abstract}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (score >= 0.6) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.6) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="glass-card rounded-2xl p-6 border border-slate-800 hover:border-slate-700/80 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/5 group"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-800 text-blue-400 font-semibold border border-slate-700">
              {patent.id}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/60 text-slate-300 flex items-center gap-1">
              <Tag size={12} className="text-slate-400" /> {patent.ipc_class}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/60 text-slate-300 flex items-center gap-1">
              <Globe size={12} className="text-slate-400" /> {patent.country}
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-100 font-heading leading-snug group-hover:text-blue-400 transition-colors">
            {patent.title}
          </h3>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <User size={13} className="text-slate-500" /> {patent.assignee}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-slate-500" /> {patent.publication_date}
            </span>
          </div>
        </div>

        {/* Similarity Score */}
        <div className="flex flex-col items-start md:items-end gap-1.5 flex-shrink-0">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getScoreBadgeColor(patent.similarity_score)}`}>
            <span>{matchPercent}% Similarity</span>
          </div>
          <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressBarColor(patent.similarity_score)}`}
              style={{ width: `${matchPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Snippet / Abstract Preview */}
      <div className="mt-4 pt-4 border-t border-slate-800/80">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Snippet Match</p>
        <p className="text-sm text-slate-300 leading-relaxed font-mono bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
          "{patent.snippet}"
        </p>
      </div>

      {/* Matching Keywords */}
      {patent.matching_keywords && patent.matching_keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">Matching terms:</span>
          {patent.matching_keywords.map((kw, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Expandable Section */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-slate-800/80 space-y-4"
        >
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Abstract</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/40 p-3.5 rounded-xl border border-slate-800">
              {patent.abstract}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Detailed Description</h4>
            <p className="text-sm text-slate-400 leading-relaxed bg-slate-900/40 p-3.5 rounded-xl border border-slate-800 max-h-48 overflow-y-auto font-mono text-xs">
              {patent.description}
            </p>
          </div>
        </motion.div>
      )}

      {/* Card Footer Actions */}
      <div className="mt-4 pt-3 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>Less Details <ChevronUp size={14} /></>
          ) : (
            <>Expand Details & Abstract <ChevronDown size={14} /></>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`p-2 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
              bookmarked
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Save Patent"
          >
            <Bookmark size={14} className={bookmarked ? 'fill-amber-400' : ''} />
          </button>

          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors flex items-center gap-1"
            title="Copy Patent Info"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
