import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';
import { useAuth } from '../hooks/useAuth';
import { Cpu, UserPlus, AlertCircle } from 'lucide-react';

function formatRegisterError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';

  if (code === 'auth/email-already-in-use') {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please provide a valid email address.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled in your Firebase Console. Enable it under Authentication > Sign-in method.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase Console. Add your production domain in Firebase Console > Authentication > Settings > Authorized domains.';
  }
  return (
    msg.replace(/^Firebase:\s*/i, '').replace(/\(auth\/[^)]+\)\.?/i, '').trim() ||
    'Failed to create account. Please check your information and try again.'
  );
}

export const Register: React.FC = () => {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await register(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatRegisterError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatRegisterError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full glass-panel rounded-3xl p-8 border border-slate-800 shadow-[0_0_50px_-15px_rgba(6,182,212,0.15)] space-y-6 relative overflow-hidden"
      >
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-12 h-12 rounded-2xl bg-[#0B1020] border border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)]"
          >
            <Cpu size={24} />
          </motion.div>

          <HeroWordReveal
            prefixText="Create"
            gradientText="Account"
            className="text-2xl font-bold font-heading text-slate-100 tracking-tight"
          />

          <motion.p
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xs text-slate-400"
          >
            Register to save searches & manage prior-art history
          </motion.p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 leading-relaxed">
            <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@company.com"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <UserPlus size={16} /> {loading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono">
            <span className="bg-[#05070D] px-2 text-slate-500">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={googleLoading || loading}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-3.1z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17.1c1.8 3.7 5.6 6.4 10.1 6.4z"
            />
          </svg>
          {googleLoading ? 'Connecting...' : 'Continue with Google'}
        </button>

        <div className="text-center text-xs text-slate-400 border-t border-slate-800 pt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-400 font-semibold hover:underline">
            Sign in here
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
