import React from 'react';
import { Cpu, Github, Shield, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950/80 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-blue-400" />
              </div>
              <span className="font-heading font-bold text-lg text-slate-100">PatentAI</span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Enterprise-grade Patent Prior-Art search platform powered by FAISS vector similarity search and HuggingFace transformer models.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-4 font-heading uppercase tracking-wider">Models & Stack</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2"><Terminal size={14} className="text-blue-400" /> all-MiniLM-L6-v2</li>
              <li className="flex items-center gap-2"><Terminal size={14} className="text-blue-400" /> bart-large-cnn</li>
              <li className="flex items-center gap-2"><Shield size={14} className="text-blue-400" /> FAISS IndexFlatIP</li>
              <li className="flex items-center gap-2"><Github size={14} className="text-blue-400" /> FastAPI + React 19</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-4 font-heading uppercase tracking-wider">Legal & Status</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
              <li><a href="/api/health" className="hover:text-blue-400 transition-colors">System Health API</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PatentAI Platform. All rights reserved.</p>
          <p className="mt-2 sm:mt-0 font-mono">v1.0.0 Production</p>
        </div>
      </div>
    </footer>
  );
};
