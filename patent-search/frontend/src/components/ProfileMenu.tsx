import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const ProfileMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : 'US';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold border border-blue-400/40 shadow-md group-hover:scale-105 transition-transform">
          {initials}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 glass-panel rounded-2xl shadow-2xl border border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-800/80">
            <p className="text-xs text-slate-400 font-medium">Signed in as</p>
            <p className="text-sm font-semibold text-slate-100 truncate">{user.email}</p>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
              <ShieldCheck size={12} /> Verified Session
            </div>
          </div>

          <div className="py-1">
            <div className="px-4 py-2 text-xs text-slate-400 flex items-center gap-2">
              <UserIcon size={14} className="text-blue-400" />
              UID: <span className="font-mono text-[10px] text-slate-300 truncate">{user.uid}</span>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
