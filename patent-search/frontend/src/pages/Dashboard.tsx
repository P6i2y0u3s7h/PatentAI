import React from 'react';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';
import { useSearchHistory } from '../hooks/useSearch';
import { HistoryTable } from '../components/HistoryTable';
import { Search, TrendingUp, Cpu, Award, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { data: historyData, isLoading } = useSearchHistory(20);

  const entries = historyData?.entries || [];
  const totalSearches = entries.length;

  const validScores = entries.filter((e) => e.top_result_score !== undefined && e.top_result_score !== null);
  const avgSimilarity =
    validScores.length > 0
      ? (validScores.reduce((acc, curr) => acc + (curr.top_result_score || 0), 0) / validScores.length) * 100
      : 0;

  // Chart data from history
  const chartData = entries
    .slice()
    .reverse()
    .map((e, idx) => ({
      name: `Search ${idx + 1}`,
      score: Math.round((e.top_result_score || 0) * 100),
    }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0B1020] border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-2.5"
        >
          <Activity size={14} className="text-cyan-400" />
          <span>Vector Search Analytics</span>
        </motion.div>

        <HeroWordReveal
          prefixText="Platform"
          gradientText="Analytics Dashboard"
          className="text-3xl sm:text-4xl font-bold font-heading text-slate-100 tracking-tight"
        />

        <motion.p
          initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed"
        >
          Overview of your patent prior-art searches and similarity metrics across the neural FAISS index.
        </motion.p>
      </div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2 hover:border-cyan-500/30 hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)] transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Searches</span>
            <Search size={18} className="text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100 font-heading">{totalSearches}</p>
          <p className="text-xs text-slate-500">Logged in your account</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2 hover:border-cyan-500/30 hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)] transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Similarity</span>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100 font-heading">{avgSimilarity.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">Top-match average</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2 hover:border-cyan-500/30 hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)] transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Index Engine</span>
            <Cpu size={18} className="text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100 font-heading">FAISS IP</p>
          <p className="text-xs text-slate-500">384-dim L2 Normalized</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2 hover:border-cyan-500/30 hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)] transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Model Status</span>
            <Award size={18} className="text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400 font-heading">Active</p>
          <p className="text-xs text-slate-500">MiniLM-L6-v2 + BART</p>
        </div>
      </motion.div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4"
        >
          <h3 className="text-lg font-bold text-slate-100 font-heading">Recent Similarity Scores Trend</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#scoreGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Recent Activity Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100 font-heading">Recent Search Activity</h3>
        <HistoryTable entries={entries.slice(0, 5)} isLoading={isLoading} />
      </div>
    </div>
  );
};
