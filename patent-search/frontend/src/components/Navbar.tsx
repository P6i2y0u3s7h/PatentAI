import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cpu, Search, History, LayoutDashboard, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ProfileMenu } from './ProfileMenu';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Patent<span className="text-blue-500">AI</span>
            </span>
            <span className="text-[10px] text-blue-400 font-mono tracking-wider uppercase font-semibold">
              Prior-Art Intelligence
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isActive('/')
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <Search size={16} /> Search
          </Link>

          {user && (
            <>
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive('/dashboard')
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              <Link
                to="/history"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive('/history')
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <History size={16} /> History
              </Link>
            </>
          )}
        </nav>

        {/* Auth Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <ProfileMenu />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
              >
                <LogIn size={16} /> Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <UserPlus size={16} /> Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
