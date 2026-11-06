import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';
import { Cpu, Home } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 max-w-md"
      >
        <div className="w-16 h-16 rounded-3xl bg-[#0B1020] border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)]">
          <Cpu size={32} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-6xl font-extrabold font-heading text-white tracking-widest"
        >
          4<span className="animate-neural-gradient neural-gradient-glow font-black">0</span>4
        </motion.div>

        <HeroWordReveal
          prefixText="Patent Route"
          gradientText="Not Found"
          className="text-xl sm:text-2xl font-bold text-slate-200 tracking-tight"
        />

        <motion.p
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-xs text-slate-400"
        >
          The requested page or resource does not exist in the neural platform index.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Home size={16} /> Return to Search Engine
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};
