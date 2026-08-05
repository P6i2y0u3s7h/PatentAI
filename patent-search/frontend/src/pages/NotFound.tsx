import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Home } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 text-center">
      <div className="space-y-6 max-w-md">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
          <Cpu size={32} />
        </div>
        <h1 className="text-6xl font-extrabold font-heading text-slate-100">404</h1>
        <h2 className="text-xl font-bold text-slate-300">Patent Route Not Found</h2>
        <p className="text-xs text-slate-400">The requested page or resource does not exist in the platform index.</p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all text-sm"
        >
          <Home size={16} /> Return to Search Engine
        </Link>
      </div>
    </div>
  );
};
