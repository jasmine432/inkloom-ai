import React, { useState, useEffect, useRef } from 'react';
import {
  Feather,
  X,
  Send,
  Loader2,
  PlusCircle,
  Sparkles,
  History,
  FileCheck,
} from 'lucide-react';
import type { ChatMessage, ChatConversationSummary } from '../../types/chat';
import {
  sendChatMessage,
  fetchConversations,
  fetchConversationHistory,
} from '../../services/chatApi';
import { useAuth } from '../../contexts/useAuth';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  auditId?: string | null;
  auditTitle?: string | null;
  isLiveLlm?: boolean;
}

const STARTER_PROMPTS = [
  'Explain how Inkloom AI works.',
  'Help me verify a marketing claim.',
  'Explain my latest audit results.',
  'Rewrite an unsupported claim safely.',
  'Show me how to interpret evidence citations.',
];

let localMsgCounter = 0;
const generateMessageId = (prefix: string) => {
  localMsgCounter += 1;
  return `${prefix}-${Date.now()}-${localMsgCounter}`;
};

const getIsoTimestamp = () => new Date().toISOString();

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  auditId,
  auditTitle,
  isLiveLlm = false,
}) => {
  const { user, getIdToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(auditId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Conversations history drawer
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [savedConversations, setSavedConversations] = useState<ChatConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  // Sync active audit ID when prop changes
  const [prevAuditId, setPrevAuditId] = useState(auditId);
  if (auditId !== prevAuditId) {
    setPrevAuditId(auditId);
    if (auditId) {
      setActiveAuditId(auditId);
    }
  }

  // Handle scroll detection so auto-scroll doesn't disrupt user reading history
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  };

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Load user conversations when drawer opens
  const handleOpenConversations = async () => {
    setShowHistoryDrawer(true);
    setLoadingHistory(true);
    try {
      const token = await getIdToken();
      if (token) {
        const list = await fetchConversations(token);
        if (list) setSavedConversations(list);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectPastConversation = async (convId: string) => {
    setLoadingHistory(true);
    try {
      const token = await getIdToken();
      if (token) {
        const hist = await fetchConversationHistory(convId, token);
        if (hist) {
          setConversationId(hist.conversationId);
          setActiveAuditId(hist.auditId || null);
          setMessages(hist.messages);
          setShowHistoryDrawer(false);
        }
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInputMessage('');
    setLastFailedMessage(null);
    setShowHistoryDrawer(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const raw = textToSend !== undefined ? textToSend : inputMessage;
    const clean = raw.trim();
    if (!clean || isLoading) return;

    setInputMessage('');
    setLastFailedMessage(null);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: generateMessageId('temp'),
      conversationId: conversationId || '',
      role: 'user',
      content: clean,
      createdAt: getIsoTimestamp(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const token = await getIdToken();
      const response = await sendChatMessage(clean, conversationId, activeAuditId, token);

      if (response) {
        if (!conversationId && response.conversationId) {
          setConversationId(response.conversationId);
        }
        setMessages((prev) => [...prev, response]);
      } else {
        throw new Error('Failed to reach assistant');
      }
    } catch {
      setLastFailedMessage(clean);
      const errorMsg: ChatMessage = {
        id: generateMessageId('err'),
        conversationId: conversationId || '',
        role: 'assistant',
        content: 'Could not connect to Inkloom AI Assistant. Please check your network and try again.',
        createdAt: getIsoTimestamp(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';

  return (
    <div
      role="dialog"
      aria-label="Inkloom AI Assistant Chat"
      className="fixed inset-x-3 bottom-3 sm:inset-auto sm:right-6 sm:bottom-20 z-50 sm:w-[460px] h-[640px] max-h-[88vh] bg-white rounded-2xl border border-stone-300/80 shadow-2xl flex flex-col overflow-hidden font-sans text-stone-900 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* 1. Header */}
      <div className="px-4 py-3 bg-[#FAF9F5] border-b border-stone-200/90 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Feather className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-stone-900 truncate">Inkloom AI Assistant</h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  isLiveLlm
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isLiveLlm ? 'Live Gemini' : 'Knowledge Engine'}</span>
              </span>
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              Content verification & editorial guidance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {user && (
            <button
              type="button"
              onClick={handleOpenConversations}
              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              title="Past conversations"
              aria-label="View past conversations"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleStartNewChat}
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            <PlusCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            title="Close assistant"
            aria-label="Close assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit Context Banner (if active) */}
      {activeAuditId && (
        <div className="px-3.5 py-1.5 bg-stone-100/90 border-b border-stone-200/80 flex items-center justify-between text-[11px] text-stone-700 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <FileCheck className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span className="truncate">
              <strong>Context:</strong> {auditTitle || 'Active Audit'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveAuditId(null)}
            className="text-[10px] text-stone-500 hover:text-stone-900 underline ml-2 shrink-0 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* 2. Messages Thread / Welcome Screen */}
      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#FDFCF7] relative"
      >
        {/* Past Conversations Drawer Overlay */}
        {showHistoryDrawer && (
          <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-xs p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Past Conversations
              </h3>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 text-stone-400 hover:text-stone-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-100 py-2">
              {loadingHistory ? (
                <div className="flex items-center justify-center gap-2 py-8 text-stone-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading chat history...</span>
                </div>
              ) : savedConversations.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  No past conversations recorded yet.
                </div>
              ) : (
                savedConversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectPastConversation(c.id)}
                    className="w-full text-left py-2.5 px-2 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <p className="text-xs font-semibold text-stone-900 truncate">{c.title}</p>
                    <span className="text-[10px] text-stone-400">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Welcome State when no messages */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col justify-center space-y-4 py-6">
            <div className="text-center space-y-2 px-2">
              <div className="w-10 h-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">
                Welcome to Inkloom AI Assistant
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed max-w-sm mx-auto">
                Hi! I&apos;m your Inkloom AI Assistant. I can help you understand audit results, verify claims against approved sources, and improve content before publication.
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block px-1">
                Suggested Starter Prompts
              </span>
              <div className="space-y-1.5">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-stone-100/80 border border-stone-200/90 text-stone-800 text-xs font-medium shadow-2xs transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <span className="text-stone-400 group-hover:text-stone-900 transition-colors">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map((m) => (
          <ChatMessageItem
            key={m.id}
            message={m}
            onSelectPrompt={(p) => handleSendMessage(p)}
            onRetry={m.isError && lastFailedMessage ? () => handleSendMessage(lastFailedMessage) : undefined}
            userInitials={initials}
          />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-stone-500 text-xs py-2 px-1">
            <div className="w-6 h-6 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
              <Feather className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1.5 bg-[#FAF9F5] border border-stone-200/90 px-3 py-2 rounded-2xl text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin text-stone-700" />
              <span>Verifying guidelines and synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Composer */}
      <div className="p-3 bg-white border-t border-stone-200/90 space-y-1 shrink-0">
        <div className="relative flex items-end gap-2 bg-[#FAF9F5] border border-stone-300/80 rounded-xl px-3 py-2 focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900/10 transition-all">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeAuditId ? 'Ask about this audit, verify a claim...' : 'Ask a question or verify a claim...'}
            disabled={isLoading}
            maxLength={4000}
            rows={2}
            className="w-full bg-transparent resize-none text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none leading-relaxed"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            className="p-2 rounded-lg bg-stone-900 hover:bg-black text-white disabled:opacity-30 disabled:hover:bg-stone-900 transition-colors shadow-2xs shrink-0 cursor-pointer"
            title="Send message (Enter)"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-stone-400">
          <span>Shift+Enter for new line</span>
          <span>{inputMessage.length}/4000</span>
        </div>
      </div>
    </div>
  );
};
