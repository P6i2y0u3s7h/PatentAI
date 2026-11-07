import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Cpu,
  Search,
  History,
  LayoutDashboard,
  LogIn,
  UserPlus,
  Sparkles,
  Scale,
  Bot,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ProfileMenu } from './ProfileMenu';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isAiToolsOpen, setIsAiToolsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;
  const isAiToolsActive = ['/compare', '/novelty', '/research'].some((p) =>
    location.pathname.startsWith(p)
  );

  // Close AI Tools dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAiToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAiToolsOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsAiToolsOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 h-16 shrink-0 bg-[#05070D]/80 backdrop-blur-2xl border-b border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-200 border border-white/10">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-bold text-lg tracking-tight text-white flex items-center gap-0.5">
              Patent<span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">AI</span>
            </span>
            <span className="text-[9px] text-cyan-400 font-mono tracking-widest uppercase font-semibold">
              Prior-Art Intelligence
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          <Link
            to="/"
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              isActive('/')
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.25)]'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Search size={15} /> Search
          </Link>

          {/* AI Tools Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsAiToolsOpen(!isAiToolsOpen)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                isAiToolsActive || isAiToolsOpen
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.25)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Sparkles size={15} className="text-cyan-400" />
              <span>AI Tools</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${isAiToolsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isAiToolsOpen && (
              <div className="absolute left-0 mt-2.5 w-64 rounded-2xl bg-[#0B1020]/95 border border-white/[0.09] p-2 shadow-2xl backdrop-blur-2xl animate-fadeIn z-50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Advanced Patent Intelligence
                </div>

                <Link
                  to="/research"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive('/research')
                      ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-300">
                    <Bot size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>Research Agent</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-mono border border-cyan-500/30">
                        NEW
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">Autonomous Prior-Art Explorer</div>
                  </div>
                </Link>

                <Link
                  to="/compare"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive('/compare')
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Scale size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Patent Comparison</div>
                    <div className="text-[11px] text-slate-400">Side-by-side Claims & Specs</div>
                  </div>
                </Link>

                <Link
                  to="/novelty"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive('/novelty')
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Novelty Analysis</div>
                    <div className="text-[11px] text-slate-400">Invention Prior-Art Screening</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {user && (
            <>
              <Link
                to="/dashboard"
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                  isActive('/dashboard')
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.25)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <Link
                to="/history"
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                  isActive('/history')
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.25)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <History size={15} /> History
              </Link>
            </>
          )}
        </nav>

        {/* Auth Actions / Credits / Profile Menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Credits Indicator */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-xs font-mono font-medium text-cyan-300 shadow-[0_0_12px_-3px_rgba(6,182,212,0.25)]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>20 Credits</span>
              </div>
              <ProfileMenu />
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-1.5"
              >
                <LogIn size={15} /> Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5"
              >
                <UserPlus size={15} /> Register
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-4 py-4 space-y-3">
          <Link
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              isActive('/') ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300'
            }`}
          >
            <Search size={16} /> Search
          </Link>

          <div className="pt-2 border-t border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2 font-mono">
              AI Tools
            </div>
            <Link
              to="/research"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                isActive('/research') ? 'bg-cyan-600/20 text-cyan-300' : 'text-slate-300'
              }`}
            >
              <Bot size={16} className="text-teal-300" /> Research Agent (Autonomous)
            </Link>
            <Link
              to="/compare"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                isActive('/compare') ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300'
              }`}
            >
              <Scale size={16} className="text-indigo-400" /> Patent Comparison
            </Link>
            <Link
              to="/novelty"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                isActive('/novelty') ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300'
              }`}
            >
              <Sparkles size={16} className="text-emerald-400" /> Novelty Analysis
            </Link>
          </div>

          {user && (
            <div className="pt-2 border-t border-slate-800/60">
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive('/dashboard') ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300'
                }`}
              >
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              <Link
                to="/history"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive('/history') ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300'
                }`}
              >
                <History size={16} /> History
              </Link>
            </div>
          )}

          {!user && (
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <Link
                to="/login"
                className="flex-1 text-center py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="flex-1 text-center py-2 rounded-lg bg-blue-600 text-sm text-white font-medium"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
