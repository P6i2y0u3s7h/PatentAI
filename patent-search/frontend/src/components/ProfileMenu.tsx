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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!user) return null;

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : 'US';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User account menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 p-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center text-xs font-bold border border-white/15 shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 group-hover:scale-105 transition-all duration-200">
          {initials}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-64 glass-panel rounded-2xl shadow-2xl shadow-black/80 border border-slate-800 p-2 z-50 animate-fadeIn backdrop-blur-2xl">
          <div className="px-3.5 py-3 border-b border-slate-800/80">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-medium">Signed in as</p>
            <p className="text-sm font-semibold text-slate-100 truncate mt-0.5">{user.email}</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Verified Session</span>
            </div>
          </div>

          <div className="py-1.5">
            <div className="px-3.5 py-2 text-xs text-slate-400 flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-800/60 my-1">
              <UserIcon size={14} className="text-blue-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-500 block uppercase font-mono">UID</span>
                <span className="font-mono text-[11px] text-slate-300 truncate block">{user.uid}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-colors flex items-center gap-2 group"
            >
              <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
