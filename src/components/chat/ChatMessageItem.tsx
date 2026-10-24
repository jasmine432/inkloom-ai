import React from 'react';
import { Feather, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../../types/chat';
import { SafeMarkdown } from './SafeMarkdown';
import { ChatEvidenceCard } from './ChatEvidenceCard';
import { ChatRelatedFindingPill } from './ChatRelatedFindingPill';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectPrompt?: (prompt: string) => void;
  onRetry?: () => void;
  userInitials?: string;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onSelectPrompt,
  onRetry,
  userInitials = 'U',
}) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2.5 my-3">
        <div className="max-w-[85%] bg-stone-900 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs">
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
          <div className="mt-1 text-[10px] text-stone-400 text-right">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="w-7 h-7 rounded-xl bg-stone-800 text-stone-200 flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs">
          {userInitials}
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="flex items-start gap-2.5 my-3.5">
      <div className="w-7 h-7 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
        <Feather className="w-3.5 h-3.5" />
      </div>

      <div className="max-w-[92%] space-y-3 min-w-0">
        <div
          className={`rounded-2xl rounded-tl-xs p-4 shadow-xs text-xs space-y-3 ${
            message.isError
              ? 'bg-rose-50 border border-rose-200 text-rose-900'
              : 'bg-[#FAF9F5] border border-stone-200/90 text-stone-900'
          }`}
        >
          {message.isError ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{message.content}</span>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry request</span>
                </button>
              )}
            </div>
          ) : (
            <SafeMarkdown content={message.content} />
          )}

          {/* Evidence Citations */}
          {message.evidence && message.evidence.length > 0 && (
            <div className="pt-2 border-t border-stone-200/80 space-y-2">
              <div className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-stone-500" />
                <span>Verified Source Citations</span>
              </div>
              <div className="space-y-1.5">
                {message.evidence.map((ev, idx) => (
                  <ChatEvidenceCard key={`${ev.sourceId}-${idx}`} evidence={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Related Findings */}
          {message.relatedFindings && message.relatedFindings.length > 0 && (
            <div className="pt-2 border-t border-stone-200/80 space-y-2">
              <div className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                <span>Associated Audit Findings</span>
              </div>
              <div className="space-y-1.5">
                {message.relatedFindings.map((f, idx) => (
                  <ChatRelatedFindingPill key={`${f.findingId}-${idx}`} finding={f} />
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-stone-400">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Suggested Prompts */}
        {message.suggestedPrompts && message.suggestedPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {message.suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt?.(prompt)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-[11px] font-medium transition-colors shadow-2xs hover:border-stone-400 cursor-pointer text-left"
              >
                <span>{prompt}</span>
                <span className="text-stone-400">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
