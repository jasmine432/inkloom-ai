import React from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { ChatRelatedFinding } from '../../types/chat';

interface ChatRelatedFindingPillProps {
  finding: ChatRelatedFinding;
}

export const ChatRelatedFindingPill: React.FC<ChatRelatedFindingPillProps> = ({ finding }) => {
  const isSupported = finding.status === 'SUPPORTED';
  const isContradicted = finding.status === 'CONTRADICTED';
  const isNeedsReview = finding.status === 'NEEDS_HUMAN_REVIEW' || finding.status === 'CONFLICTING_SOURCES';

  return (
    <div className="p-2.5 rounded-xl bg-white border border-stone-200/90 shadow-2xs text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
            isSupported
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : isContradicted
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : isNeedsReview
              ? 'bg-purple-50 text-purple-800 border border-purple-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {isSupported && <CheckCircle2 className="w-2.5 h-2.5" />}
          {isContradicted && <AlertCircle className="w-2.5 h-2.5" />}
          {isNeedsReview && <Clock className="w-2.5 h-2.5" />}
          <span>{finding.status.replace(/_/g, ' ')}</span>
        </span>
        {finding.category && (
          <span className="text-[10px] text-stone-400 truncate font-medium">
            {finding.category}
          </span>
        )}
      </div>

      <p className="text-stone-900 font-medium text-[11px] leading-snug">
        &ldquo;{finding.claim}&rdquo;
      </p>

      {finding.explanation && (
        <p className="text-stone-500 text-[10px] leading-normal line-clamp-2">
          {finding.explanation}
        </p>
      )}
    </div>
  );
};
