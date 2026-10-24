import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { ChatEvidenceItem } from '../../types/chat';

interface ChatEvidenceCardProps {
  evidence: ChatEvidenceItem;
}

export const ChatEvidenceCard: React.FC<ChatEvidenceCardProps> = ({ evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-stone-200/90 rounded-xl overflow-hidden shadow-2xs text-xs transition-all">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-stone-50/80 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <div className="min-w-0 truncate">
            <span className="font-semibold text-stone-900 truncate block">
              {evidence.sourceTitle}
            </span>
            <span className="text-[11px] text-stone-500 truncate block">
              {evidence.section}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>{evidence.confidenceScore}% match</span>
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3.5 pb-3 pt-1 border-t border-stone-100 bg-[#FAF9F5] space-y-2">
          <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono">
            <span>Source ID: {evidence.sourceId}</span>
            <span>Type: {evidence.sourceType}</span>
          </div>
          <blockquote className="pl-3 border-l-2 border-stone-700 italic text-[11px] text-stone-800 leading-relaxed bg-white/70 p-2 rounded-r">
            &ldquo;{evidence.quote}&rdquo;
          </blockquote>
        </div>
      )}
    </div>
  );
};
