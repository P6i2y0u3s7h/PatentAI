import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  X,
  Send,
  Paperclip,
  Maximize2,
  RotateCcw,
  Copy,
  Check,
  FileText,
  User,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { assistantApi } from '../api/assistantApi';
import { ChatMessage } from '../types/patent';
import { AssistantAvatar } from './AssistantAvatar';

const QUICK_PROMPTS = [
  'Explain this patent in simple English.',
  'What problem does this invention solve?',
  'What are the key patent claims?',
  'What makes this invention unique?',
];

export const FloatingAssistant: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document context (PDF)
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [uploadedDocContext, setUploadedDocContext] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // UI helpers
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Hide the floating widget when user is already on the dedicated /assistant page
  const isDedicatedAssistantPage = location.pathname === '/assistant';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    setError(null);
    setInputMessage('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await assistantApi.sendMessage({
        message: text,
        doc_context: uploadedDocContext || undefined,
        doc_name: uploadedDocName || undefined,
      });

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to get answer.');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF patent document.');
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
        content: `Loaded context from **${res.filename}** (${res.word_count.toLocaleString()} words). You can now ask questions about this patent's claims, methodology, and novelty.`,
        sources: [res.filename],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, noticeMsg]);
    } catch (err: any) {
      setError('Failed to extract text from the PDF document.');
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (isDedicatedAssistantPage) {
    return null;
  }

  return (
    <>
      {/* ── FLOATING TRIGGER BUTTON (BOTTOM RIGHT) ───────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open AI Patent Assistant"
          className="relative group p-1 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 transition-transform duration-300 active:scale-90"
        >
          {/* Outer Radiant Glowing Halo with Cyan to Violet Neural Theme */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/40 via-blue-500/35 to-violet-500/40 blur-xl group-hover:scale-125 group-hover:from-cyan-400/60 group-hover:to-violet-400/60 transition-all duration-300" />

          {/* Glowing themed robot avatar button with floating animation */}
          <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.6)] group-hover:shadow-[0_0_36px_rgba(6,182,212,0.9)] group-hover:scale-110 transition-all duration-300 hover:-translate-y-1">
            <AssistantAvatar size={54} animate={true} />
          </div>

          {/* Tooltip on hover when closed */}
          {!isOpen && (
            <div className="absolute right-full mr-3.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-xl bg-[#0B1020]/95 border border-cyan-500/30 text-xs text-slate-200 whitespace-nowrap shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 backdrop-blur-xl shadow-cyan-500/10">
              <span className="font-semibold text-cyan-300">Ask PatentAI</span>
            </div>
          )}
        </button>
      </div>

      {/* ── EXPANDABLE FLOATING CHAT WINDOW ───────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] rounded-3xl bg-[#0B1020]/95 border border-white/[0.1] shadow-2xl shadow-black/95 flex flex-col overflow-hidden backdrop-blur-2xl animate-fadeIn">
          {/* Header */}
          <div className="h-14 px-4 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <AssistantAvatar size={30} />
              <div>
                <h3 className="text-xs font-bold font-heading text-slate-100 flex items-center gap-2">
                  AI Patent Assistant
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30">
                    RAG Live
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Prior-art & claim intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Clear chat"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <Link
                to="/assistant"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Open fullscreen page"
              >
                <Maximize2 size={14} />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Uploaded PDF Notice */}
          {uploadedDocName && (
            <div className="px-3.5 py-1.5 bg-cyan-950/40 border-b border-cyan-800/30 flex items-center justify-between text-[11px] text-cyan-300">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText size={13} className="text-cyan-400 shrink-0" />
                <span className="truncate font-mono">{uploadedDocName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadedDocName(null);
                  setUploadedDocContext(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="m-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="hover:text-white">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              /* Empty state inside floating assistant */
              <div className="h-full flex flex-col justify-center items-center text-center space-y-4 py-4">
                <AssistantAvatar size={52} animate={true} />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-200">How can I help with your patent?</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Ask questions about claims, methodology, or upload an invention document PDF.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="w-full space-y-1.5 pt-2">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-white transition-all group flex items-center justify-between"
                    >
                      <span className="truncate pr-2">{prompt}</span>
                      <Send size={11} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex gap-2.5 ${isUser ? 'ml-auto flex-row-reverse max-w-[85%]' : 'mr-auto max-w-[90%]'}`}
                  >
                    {isUser ? (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                        <User size={13} />
                      </div>
                    ) : (
                      <AssistantAvatar size={28} />
                    )}

                    <div
                      className={`rounded-2xl p-3 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none space-y-2'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-800 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                          <span className="text-slate-500 font-medium">Source:</span>
                          {msg.sources.map((s, si) => (
                            <span key={si} className="px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {!isUser && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.content, idx)}
                            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex gap-2.5 mr-auto max-w-[90%]">
                <AssistantAvatar size={28} className="animate-pulse" />
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-none p-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-150" />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-300" />
                  <span className="text-[11px] text-slate-400 ml-1">Analyzing patent disclosures...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/80 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex items-center gap-2 bg-slate-950 rounded-2xl border border-slate-800 px-3 py-2 focus-within:border-cyan-500/50">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPdf}
                title="Attach patent PDF"
                className="text-slate-400 hover:text-cyan-400 p-1 rounded-lg hover:bg-slate-900 transition-colors shrink-0"
              >
                <Paperclip size={16} />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uploadingPdf ? 'Uploading PDF...' : 'Ask about claims, novelty, specs...'}
                className="flex-1 bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 outline-none resize-none max-h-24"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || loading}
                className="p-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-cyan-500/20 shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
            <div className="text-[10px] text-slate-500 text-center mt-1.5">
              Powered by PatentAI RAG • Groq & Gemini
            </div>
          </div>
        </div>
      )}
    </>
  );
};
