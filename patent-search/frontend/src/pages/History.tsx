import React from 'react';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';
import { useSearchHistory } from '../hooks/useSearch';
import { HistoryTable } from '../components/HistoryTable';
import { History as HistoryIcon, AlertTriangle } from 'lucide-react';

export const History: React.FC = () => {
  const { data: historyData, isLoading, error } = useSearchHistory(100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0B1020] border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-2.5"
        >
          <HistoryIcon size={14} className="text-cyan-400" />
          <span>Audit & Prior-Art Records</span>
        </motion.div>

        <HeroWordReveal
          prefixText="Query"
          gradientText="Search History Log"
          className="text-3xl sm:text-4xl font-bold font-heading text-slate-100 tracking-tight"
        />

        <motion.p
          initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed"
        >
          All past prior-art queries, similarity thresholds, and top matched results saved in your cloud session.
        </motion.p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-200">Unable to synchronize history records</p>
            <p className="text-slate-400 text-[11px] mt-0.5">{error.message || 'Check your network connection or verify that the production backend API URL is active.'}</p>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <HistoryTable entries={historyData?.entries || []} isLoading={isLoading} />
      </motion.div>
    </div>
  );
};
