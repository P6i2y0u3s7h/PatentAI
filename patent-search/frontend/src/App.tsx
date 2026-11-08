import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FloatingAssistant } from './components/FloatingAssistant';

import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { NotFound } from './pages/NotFound';
import { Assistant } from './pages/Assistant';
import { Comparison } from './pages/Comparison';
import { NoveltyAnalysis } from './pages/NoveltyAnalysis';
import { ResearchAgent } from './pages/ResearchAgent';
import { DraftReviewer } from './pages/DraftReviewer';
import { SimilarityNetwork } from './pages/SimilarityNetwork';
import { ClaimChart } from './pages/ClaimChart';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <p className="text-xs font-mono text-cyan-300 tracking-wider">Verifying Session...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppLayout: React.FC = () => {
  const location = useLocation();
  const isAssistant = location.pathname === '/assistant';

  return (
    <div
      className={
        isAssistant
          ? 'h-[100dvh] overflow-hidden bg-[#05070D] text-slate-100 flex flex-col'
          : 'flex flex-col min-h-screen bg-[#05070D] text-slate-100'
      }
    >
      <Navbar />
      <main className={isAssistant ? 'flex-1 overflow-hidden relative' : 'flex-1'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute>
                <Assistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <Comparison />
              </ProtectedRoute>
            }
          />
          <Route
            path="/novelty"
            element={
              <ProtectedRoute>
                <NoveltyAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/research"
            element={
              <ProtectedRoute>
                <ResearchAgent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/draft-reviewer"
            element={
              <ProtectedRoute>
                <DraftReviewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/similarity-network"
            element={
              <ProtectedRoute>
                <SimilarityNetwork />
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim-chart"
            element={
              <ProtectedRoute>
                <ClaimChart />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {/* Hide footer on full-screen AI Assistant chat */}
      {!isAssistant && <Footer />}

      {/* Floating AI Patent Assistant Widget (Bottom Right) */}
      <FloatingAssistant />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
