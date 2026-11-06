import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowUp,
  Plus,
  Trash2,
  FileText,
  Copy,
  Check,
  Paperclip,
  X,
  MessageSquare,
  AlertCircle,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Search,
  BookOpen,
  Cpu,
  Layers,
  HelpCircle,
  Download,
  Square,
  Edit2,
  Upload,
} from 'lucide-react';
import { assistantApi } from '../api/assistantApi';
import { ChatMessage, AssistantSession } from '../types/patent';
import { useAuth } from '../hooks/useAuth';
import { AssistantAvatar } from '../components/AssistantAvatar';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { motion } from 'framer-motion';
import { HeroWordReveal } from '../components/AnimatedText';

interface SuggestionCard {
  title: string;
  subtitle: string;
  query: string;
  icon: React.ReactNode;
}

const WELCOME_CARDS: SuggestionCard[] = [
  {
    title: 'Explain a Patent',
    subtitle: 'Plain English summary & core concept',
    query: 'Explain this patent in plain, simple English with its core problem and technical solution.',
    icon: <BookOpen className="w-5 h-5 text-blue-400" />,
  },
  {
    title: 'Analyze Patent Claims',
    subtitle: 'Independent vs. dependent scope',
    query: 'Analyze the independent and dependent claims of this patent, highlighting the essential scope.',
    icon: <Layers className="w-5 h-5 text-indigo-400" />,
  },
  {
    title: 'Find Similar Patents',
    subtitle: 'Prior-art overlap & citations',
    query: 'What are the most relevant existing patents and prior-art references related to this invention?',
    icon: <Sparkles className="w-5 h-5 text-cyan-400" />,
  },
  {
    title: 'Understand Patent Terminology',
    subtitle: 'Novelty, non-obviousness, FTO',
    query: 'Explain key patent terminology such as prior art, novelty, non-obviousness, and Freedom to Operate (FTO).',
    icon: <HelpCircle className="w-5 h-5 text-cyan-400" />,
  },
];

const FOLLOW_UP_TEMPLATES = [
  'What are the key limitations in independent claim 1?',
  'What problem does this invention overcome compared to prior art?',
  'Explain the technical methodology and hardware architecture.',
];

/**
 * Group sessions into date categories: Today, Yesterday, Previous 7 Days, Older
 */
function groupSessionsByDate(sessions: AssistantSession[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last7DaysStart = todayStart - 7 * 86400000;

  const groups: { [key: string]: AssistantSession[] } = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  sessions.forEach((s) => {
    const time = new Date(s.updated_at || s.created_at).getTime();
    if (time >= todayStart) {
      groups.Today.push(s);
    } else if (time >= yesterdayStart) {
      groups.Yesterday.push(s);
    } else if (time >= last7DaysStart) {
      groups['Previous 7 Days'].push(s);
    } else {
      groups.Older.push(s);
    }
  });

  return groups;
}

export const Assistant: React.FC = () => {
  const { user } = useAuth();

  // Chat sessions state
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document context state (PDF upload)
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [uploadedDocContext, setUploadedDocContext] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Search and sidebar UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Rename session state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // Delete confirmation modal state
  const [sessionToDelete, setSessionToDelete] = useState<AssistantSession | null>(null);

  // Active generation abort controller
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat sessions on mount
  useEffect(() => {
    loadSessions();
  }, [user]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputMessage]);

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await assistantApi.getHistory();
      setSessions(res.sessions || []);
    } catch (err: any) {
      console.warn('Could not load chat history:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const selectSession = async (sessionId: string) => {
    try {
      setActiveSessionId(sessionId);
      setError(null);
      setLoading(true);

      const res = await assistantApi.getSessionDetail(sessionId);
      setMessages(res.messages || []);
      if (res.session.doc_name) {
        setUploadedDocName(res.session.doc_name);
      }
    } catch (err: any) {
      setError('Failed to load conversation history.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputMessage('');
    setError(null);
    setUploadedDocName(null);
    setUploadedDocContext(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  // Start renaming a session
  const startRenaming = (session: AssistantSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setNewTitle(session.title || '');
  };

  const saveRename = async (sessionId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await assistantApi.renameSession(sessionId, newTitle.trim());
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s))
      );
      setRenamingId(null);
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setNewTitle('');
  };

  // Delete session confirmation
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const sessionId = sessionToDelete.id;

    try {
      await assistantApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err: any) {
      console.error('Failed to delete chat:', err);
    } finally {
      setSessionToDelete(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF document.');
      return;
    }

    try {
      setUploadingPdf(true);
      setError(null);
      const res = await assistantApi.uploadPdf(file);
      setUploadedDocName(res.filename);
      setUploadedDocContext(res.doc_context);

      const noticeMsg: ChatMessage = {
        role: 'assistant',
        content: `### Document Attached & Grounded\n\nI've successfully indexed **${res.filename}** (${res.page_count} pages, ~${res.word_count.toLocaleString()} words).\n\nYou can now ask specific questions about:\n- **Independent & dependent claims**\n- **Technical methodology and architecture**\n- **Distinguishing novelty over prior art**\n- **Primary technical advantages**`,
        sources: [res.filename],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, noticeMsg]);
    } catch (err: any) {
      setError('Failed to extract text from the PDF file. Please try another document.');
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedDoc = () => {
    setUploadedDocName(null);
    setUploadedDocContext(null);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    setError(null);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await assistantApi.sendMessage({
        chat_id: activeSessionId || undefined,
        message: text,
        doc_context: uploadedDocContext || undefined,
        doc_name: uploadedDocName || undefined,
        history: messages,
      });

      if (!activeSessionId && response.chat_id) {
        setActiveSessionId(response.chat_id);
        loadSessions();
      }

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        console.log('Generation stopped by user.');
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Failed to generate response. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Regenerate last AI response
  const handleRegenerate = () => {
    if (messages.length === 0 || loading) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      setMessages((prev) => {
        const lastIdx = prev.length - 1;
        if (prev[lastIdx]?.role === 'assistant') {
          return prev.slice(0, lastIdx);
        }
        return prev;
      });
      handleSendMessage(lastUserMsg.content);
    }
  };

  // Export conversation as printable/PDF report
  const exportConversation = () => {
    if (messages.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>PatentAI Research Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            h1 { color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
            .header-info { color: #64748b; font-size: 13px; margin-bottom: 30px; }
            .msg { margin-bottom: 24px; padding: 16px; border-radius: 8px; }
            .user-msg { background: #eff6ff; border-left: 4px solid #2563eb; }
            .ai-msg { background: #f8fafc; border-left: 4px solid #0d9488; }
            .role { font-weight: bold; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; }
            .user-role { color: #2563eb; }
            .ai-role { color: #0d9488; }
            .sources { margin-top: 10px; font-size: 12px; color: #64748b; font-style: italic; }
            pre { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
            code { font-family: monospace; }
          </style>
        </head>
        <body>
          <h1>PatentAI Research Intelligence Report</h1>
          <div class="header-info">
            Generated: ${new Date().toLocaleString()}<br/>
            ${uploadedDocName ? `Attached Document: <strong>${uploadedDocName}</strong><br/>` : ''}
            Total Messages: ${messages.length}
          </div>
          ${messages
            .map(
              (m) => `
            <div class="msg ${m.role === 'user' ? 'user-msg' : 'ai-msg'}">
              <div class="role ${m.role === 'user' ? 'user-role' : 'ai-role'}">
                ${m.role === 'user' ? 'Researcher' : 'PatentAI Assistant'}
              </div>
              <div>${m.content.replace(/\n/g, '<br/>')}</div>
              ${
                m.sources && m.sources.length > 0
                  ? `<div class="sources">Grounded Sources: ${m.sources.join(', ')}</div>`
                  : ''
              }
            </div>`
            )
            .join('')}
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Filtered & grouped sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    return groupSessionsByDate(filteredSessions);
  }, [filteredSessions]);

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-text relative">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 top-16 bg-black/75 z-40 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ── 1. COLLAPSIBLE FIXED SIDEBAR (320px) ────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full md:w-0'
        } md:translate-x-0 md:static fixed top-16 left-0 bottom-0 max-w-[85vw] md:max-w-none shrink-0 h-full bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-300 z-40 shadow-2xl md:shadow-none`}
      >
        {/* Top: New Chat + Collapse */}
        <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0 bg-slate-950/80">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20 group"
          >
            <Plus size={16} className="text-white group-hover:rotate-90 transition-transform" />
            <span>New Patent Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Search Chat History */}
        <div className="p-2.5 border-b border-slate-800/60 shrink-0 bg-slate-950/60">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat history..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List (Date-Grouped, Independently Scrollable) */}
        <div className="flex-1 overflow-y-auto min-h-0 px-2 py-3 space-y-4">
          {sessionsLoading ? (
            <div className="p-4 text-center text-xs text-slate-500 space-y-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading history...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 space-y-2">
              <MessageSquare className="w-7 h-7 text-slate-700 mx-auto" />
              <p>{searchQuery ? 'No matching chats found' : 'No previous conversations'}</p>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([groupTitle, groupItems]) => {
              if (groupItems.length === 0) return null;
              return (
                <div key={groupTitle} className="space-y-1">
                  <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
                    {groupTitle}
                  </div>
                  {groupItems.map((s) => {
                    const isSelected = activeSessionId === s.id;
                    const isRenaming = renamingId === s.id;

                    if (isRenaming) {
                      return (
                        <form
                          key={s.id}
                          onSubmit={(e) => saveRename(s.id, e)}
                          className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-900 rounded-xl border border-blue-500/60 shadow-sm"
                        >
                          <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            autoFocus
                            className="w-full bg-transparent text-xs text-white focus:outline-none px-1"
                          />
                          <button
                            type="submit"
                            className="p-1 text-blue-400 hover:text-blue-300"
                            title="Save"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            className="p-1 text-slate-400 hover:text-white"
                            title="Cancel"
                          >
                            <X size={13} />
                          </button>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s.id)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-blue-400 font-semibold border border-blue-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-12">
                          <MessageSquare
                            size={14}
                            className={isSelected ? 'text-blue-400 shrink-0' : 'text-slate-500 shrink-0'}
                          />
                          <span className="truncate">{s.title || 'Patent Inquiry'}</span>
                        </div>

                        {/* Three-dot Action Menu (Rename & Delete) */}
                        <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-slate-900 pl-2">
                          <button
                            type="button"
                            onClick={(e) => startRenaming(s, e)}
                            className="p-1 text-slate-400 hover:text-blue-300 rounded hover:bg-slate-800"
                            title="Rename chat"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(s);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                            title="Delete chat"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* User Account Capsule at Bottom */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 text-xs text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm shadow-blue-500/20">
              {user?.email?.slice(0, 1).toUpperCase() || 'P'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-slate-200 text-xs font-medium">{user?.email || 'Patent Researcher'}</p>
              <p className="text-[10px] text-blue-400 font-mono">FAISS RAG Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── 2. MAIN CHAT WORKSPACE (MIDNIGHT OBSIDIAN WITH AMBIENT GLOW) ── */}
      <div className="flex-1 h-full flex flex-col overflow-hidden bg-slate-950 relative">
        {/* Ambient Subtle Blue/Indigo Glow (Matches Homepage Hero Exactly) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/20 to-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

        {/* Top Header Bar */}
        <header className="h-14 px-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between glass-panel shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors mr-1"
                title="Open sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}

            {/* Title & Status */}
            <div className="flex items-center gap-2.5">
              <AssistantAvatar size={24} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white font-heading">PatentAI Assistant</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                    Grounded 4.0
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {uploadedDocName
                    ? `Context: ${uploadedDocName}`
                    : 'FAISS Semantic Index • Prior-Art Grounded'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {messages.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={exportConversation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors shadow-sm"
                  title="Export conversation as PDF / Print"
                >
                  <Download size={13} className="text-blue-400" />
                  <span>Export</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearChat}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
                  title="Clear view"
                >
                  <RotateCcw size={13} />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Hidden File Input for PDF */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf"
          className="hidden"
        />

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-3 max-w-[900px] w-full self-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:text-white">
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── 3. CHAT SCROLL AREA (ISOLATED VERTICAL SCROLL, AMPLE BOTTOM BUFFER) ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 sm:px-6 flex flex-col items-center">
          {messages.length === 0 ? (
            /* ══════════════════════════════════════════════════════════════
               WELCOME SCREEN (THEME HARMONY WITH HOMEPAGE HERO)
               ══════════════════════════════════════════════════════════════ */
            <div className="flex-1 flex flex-col items-center justify-center max-w-[900px] w-full py-8 my-auto z-10">
              {/* Center Robot Avatar with Radial Glow */}
              <div className="mb-4 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-violet-500/25 blur-xl rounded-full" />
                <div className="relative">
                  <AssistantAvatar size={68} animate={true} />
                </div>
              </div>

              {/* Homepage-style Pill Badge with Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B1020] border border-cyan-500/30 text-xs font-mono font-semibold text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-3"
              >
                <Sparkles size={14} className="text-cyan-400 animate-spin [animation-duration:8s]" />
                <span>AI Patent Research Companion</span>
              </motion.div>

              {/* Title with Word-by-Word Reveal & Animated Gradient */}
              <HeroWordReveal
                prefixText="Welcome to"
                gradientText="PatentAI Assistant"
                className="text-3xl sm:text-4xl font-extrabold font-heading text-slate-100 tracking-tight mb-2 text-center"
              />

              {/* Description Animation */}
              <motion.p
                initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="text-xs sm:text-sm text-slate-400 text-center max-w-lg mb-8 leading-relaxed"
              >
                Your AI-powered patent research companion. Ask deep technical questions about patent claims, novelty, and prior art, or upload an invention PDF.
              </motion.p>

              {/* 4 Interactive Suggestion Cards (Matches Homepage Glass Cards) */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                {WELCOME_CARDS.map((card, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(card.query)}
                    className="flex items-start gap-3.5 p-4 rounded-2xl glass-panel hover:bg-slate-900/90 border border-slate-800/80 hover:border-blue-500/50 text-left transition-all hover:scale-[1.01] group shadow-lg hover:shadow-blue-500/10 backdrop-blur-xl"
                  >
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 group-hover:border-blue-500/40 shrink-0 transition-colors shadow-sm">
                      {card.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
                        {card.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{card.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Upload Document Card */}
              <div className="w-full p-4.5 rounded-2xl glass-panel border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-2xl relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/30 shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-white">Have a patent specification PDF?</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Upload your PDF to extract claims, technical methodology, and prior-art grounding.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPdf}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>{uploadingPdf ? 'Uploading...' : 'Upload PDF'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════
               ACTIVE CHAT MESSAGES (HOMEPAGE COLOR HARMONY + PB-32 BUFFER)
               ══════════════════════════════════════════════════════════════ */
            <div className="max-w-[900px] w-full py-6 space-y-6 flex-1 pb-32">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isLastAssistant =
                  !isUser &&
                  index === messages.length - 1;

                return (
                  <div
                    key={index}
                    className={`flex gap-3 sm:gap-4 ${
                      isUser ? 'ml-auto flex-row-reverse max-w-[85%]' : 'mr-auto max-w-full'
                    }`}
                  >
                    {/* Avatar */}
                    {isUser ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                        {user?.email?.slice(0, 1).toUpperCase() || 'U'}
                      </div>
                    ) : (
                      <AssistantAvatar size={32} />
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`relative group rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-blue-500/20'
                          : 'bg-slate-900/60 border border-slate-800/80 backdrop-blur-md text-slate-200 rounded-tl-none p-5 sm:p-6 shadow-lg space-y-3 w-full'
                      }`}
                    >
                      {/* Markdown Formatted Content */}
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}

                      {/* Grounded Source Tag */}
                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                          <span className="font-semibold text-cyan-400">Grounded Sources:</span>
                          {msg.sources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-cyan-300 font-mono text-[11px]"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Follow-up question suggestion pills (Latest AI response) */}
                      {!isUser && isLastAssistant && !loading && (
                        <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                            Suggested Follow-Ups:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {FOLLOW_UP_TEMPLATES.map((pill, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => handleSendMessage(pill)}
                                className="px-2.5 py-1 rounded-full bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-[11px] text-slate-300 hover:text-white transition-all text-left shadow-sm"
                              >
                                {pill}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Toolbar */}
                      {!isUser && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/50">
                          {isLastAssistant && (
                            <button
                              type="button"
                              onClick={handleRegenerate}
                              disabled={loading}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
                              title="Regenerate response"
                            >
                              <RotateCcw size={12} />
                              <span>Regenerate</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.content, index)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
                            title="Copy response"
                          >
                            {copiedIdx === index ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing / Thinking Indicator */}
              {loading && (
                <div className="flex gap-3 sm:gap-4 mr-auto max-w-full">
                  <AssistantAvatar size={32} className="animate-pulse" />
                  <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl rounded-tl-none p-4 flex items-center gap-2 shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-150" />
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-300" />
                    <span className="text-xs text-slate-400 ml-2">
                      PatentAI is analyzing claims and prior-art disclosures...
                    </span>
                  </div>
                </div>
              )}

              {/* Clearance spacer prevents any message overlap with bottom composer */}
              <div className="h-10 shrink-0" aria-hidden="true" />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── 4. FIXED MESSAGE COMPOSER (MATCHING GLASS PANEL & OBSIDIAN GRADIENT) ── */}
        <div className="shrink-0 w-full px-4 sm:px-6 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent z-10 flex justify-center">
          <div className="max-w-[900px] w-full">
            <div className="relative rounded-3xl bg-slate-900/90 border border-slate-700/80 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-2xl p-3 backdrop-blur-xl transition-all">
              {/* PDF Filename Preview Capsule */}
              {uploadedDocName && (
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-950/50 border border-blue-700/40 text-blue-300 text-xs">
                  <FileText size={13} className="text-blue-400 shrink-0" />
                  <span className="truncate max-w-xs font-mono text-[11px]">{uploadedDocName}</span>
                  <button
                    type="button"
                    onClick={removeUploadedDoc}
                    className="p-0.5 hover:text-white rounded"
                    title="Remove attached PDF"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Upload Progress Indicator */}
              {uploadingPdf && (
                <div className="mb-2 flex items-center gap-2 text-xs text-blue-400">
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Extracting text and indexing patent PDF...</span>
                </div>
              )}

              {/* Text Input */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  uploadedDocName
                    ? `Ask anything about ${uploadedDocName}...`
                    : 'Message PatentAI Assistant (Enter to send, Shift+Enter for newline)...'
                }
                className="w-full resize-none bg-transparent border-0 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0 px-2 py-1 min-h-[44px] max-h-44"
              />

              {/* Actions row inside Composer */}
              <div className="flex items-center justify-between pt-1 px-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-blue-300 hover:bg-slate-800 border border-slate-800 transition-colors"
                  title="Upload patent document PDF"
                >
                  <Paperclip size={14} className="text-blue-400" />
                  <span>{uploadingPdf ? 'Extracting...' : 'Attach PDF'}</span>
                </button>

                {/* Send OR Stop Generation Button */}
                {loading ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 transition-all shadow-md"
                    title="Stop generation"
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      inputMessage.trim()
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/30 scale-105'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                    title="Send message"
                  >
                    <ArrowUp size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center mt-2 font-sans">
              PatentAI Assistant uses RAG semantic retrieval over real patent disclosures. Verify critical claims.
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. DELETE CONVERSATION CONFIRMATION DIALOG (MODAL) ─────────── */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10">
                <Trash2 size={20} />
              </div>
              <h3 className="text-sm font-bold text-white font-heading">Delete Conversation?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-white">"{sessionToDelete.title || 'Untitled Chat'}"</strong>? This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assistant;
