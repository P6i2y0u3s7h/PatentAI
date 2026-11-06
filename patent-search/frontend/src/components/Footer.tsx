import React from 'react';
import { Cpu, Github, Shield, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/[0.07] bg-[#05070D] mt-24 relative overflow-hidden">
      {/* Subtle Ambient Floor Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center border border-white/10 shadow-sm shadow-cyan-500/20">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="font-heading font-bold text-lg text-white">
                Patent<span className="text-cyan-400">AI</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Next-generation Neural Patent Prior-Art Intelligence platform powered by FAISS vector similarity search, MiniLM transformer embeddings, and RAG claim analysis.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Neural Index Status: Healthy & Online</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 mb-4 font-mono uppercase tracking-wider">Models & Stack</h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-2"><Terminal size={13} className="text-cyan-400" /> all-MiniLM-L6-v2</li>
              <li className="flex items-center gap-2"><Terminal size={13} className="text-cyan-400" /> bart-large-cnn</li>
              <li className="flex items-center gap-2"><Shield size={13} className="text-blue-400" /> FAISS IndexFlatIP</li>
              <li className="flex items-center gap-2"><Github size={13} className="text-violet-400" /> FastAPI + React 19</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 mb-4 font-mono uppercase tracking-wider">Legal & Status</h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li><a href="#" className="hover:text-cyan-300 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-cyan-300 transition-colors">Terms of Service</a></li>
              <li><a href="/api/health" className="hover:text-cyan-300 transition-colors">System Health API</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.06] mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PatentAI Platform. All rights reserved.</p>
          <p className="mt-2 sm:mt-0 font-mono text-[11px] text-slate-500">Neural Intelligence v2.0</p>
        </div>
      </div>
    </footer>
  );
};
