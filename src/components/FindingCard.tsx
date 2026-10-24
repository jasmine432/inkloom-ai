import React, { useState } from 'react';
import type { Finding, ReviewerDecision } from '../types';
import { StatusBadge, DecisionBadge } from './StatusBadge';
import {
  Quote,
  FileText,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';

interface FindingCardProps {
  finding: Finding;
  onDecisionChange: (findingId: string, decision: ReviewerDecision, notes?: string) => void;
  isHighlighted?: boolean;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  onDecisionChange,
  isHighlighted = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [noteText, setNoteText] = useState(finding.reviewerNotes || '');
  // Default expanded for contradictory or needs review claims so user immediately sees why
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(
    finding.status === 'CONTRADICTED' || finding.status === 'NEEDS_HUMAN_REVIEW'
  );

  const handleCopySuggestion = () => {
    navigator.clipboard.writeText(finding.suggestedAction);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveNotes = () => {
    onDecisionChange(finding.id, finding.reviewerDecision, noteText);
    setShowNotesInput(false);
  };

  // Subtle border accent
  const getBorderColor = () => {
    switch (finding.status) {
      case 'SUPPORTED':
        return 'border-l-emerald-500';
      case 'CONTRADICTED':
        return 'border-l-rose-500';
      case 'INSUFFICIENT_EVIDENCE':
        return 'border-l-amber-500';
      case 'CONFLICTING_SOURCES':
        return 'border-l-stone-500';
      case 'NEEDS_HUMAN_REVIEW':
        return 'border-l-stone-500';
      default:
        return 'border-l-slate-400';
    }
  };

  return (
    <div
      id={`finding-${finding.id}`}
      className={`bg-white rounded-xl border border-slate-200 border-l-4 ${getBorderColor()} shadow-xs transition-all overflow-hidden ${
        isHighlighted ? 'ring-2 ring-stone-900/20 bg-stone-100/40' : ''
      }`}
    >
      {/* 1. Card Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={finding.status} />
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {finding.category}
          </span>
        </div>

        <DecisionBadge decision={finding.reviewerDecision} />
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* 2. Extracted Claim */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            <Quote className="w-3.5 h-3.5 text-slate-400" />
            <span>Extracted Claim from Draft</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
            <blockquote className="text-sm font-medium text-slate-900 italic leading-relaxed m-0">
              &ldquo;{finding.claim}&rdquo;
            </blockquote>
          </div>
        </div>

        {/* 3. Plain Language Explanation */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Verification Assessment
          </div>
          <p className="text-sm text-slate-700 leading-relaxed m-0">
            {finding.explanation}
          </p>
        </div>

        {/* 4. Suggested Action (if available) */}
        {finding.suggestedAction && (
          <div className="rounded-lg bg-amber-50/70 border border-amber-200/90 p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Suggested Editorial Action
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopySuggestion}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 hover:text-amber-950 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors"
                  title="Copy suggested action"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-amber-950 leading-relaxed m-0">
              {finding.suggestedAction}
            </p>
          </div>
        )}

        {/* 5. Progressive Disclosure: Supporting Evidence */}
        {finding.evidence && finding.evidence.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1"
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-700" />
                <span>
                  Supporting Sources & Quotes ({finding.evidence.length})
                </span>
              </div>
              {isEvidenceExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {isEvidenceExpanded && (
              <div className="mt-2.5 space-y-2">
                {finding.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="font-semibold text-slate-800">
                        {ev.sourceTitle}
                        {ev.documentVersion && (
                          <span className="ml-1.5 text-[11px] font-normal text-slate-500 font-mono">
                            ({ev.documentVersion})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                        {ev.confidenceScore}% Match
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {ev.section} • Last updated: {ev.lastUpdated}
                    </div>

                    <blockquote className="border-l-2 border-stone-400 pl-2.5 py-0.5 text-xs text-slate-800 italic bg-white rounded-r m-0">
                      &ldquo;{ev.quote}&rdquo;
                    </blockquote>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reviewer Note Display */}
        {finding.reviewerNotes && !showNotesInput && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700 flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-stone-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-slate-900 mr-1.5">Note:</span>
              <span>{finding.reviewerNotes}</span>
            </div>
            <button
              onClick={() => setShowNotesInput(true)}
              className="text-xs text-stone-900 hover:underline shrink-0 font-medium"
            >
              Edit
            </button>
          </div>
        )}

        {/* Reviewer Note Input Form */}
        {showNotesInput && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Add Editorial Note / Justification:
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Verified with Compliance Counsel on 10/23..."
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNotesInput(false)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1 text-xs font-semibold text-white bg-stone-900 hover:bg-black rounded shadow-xs"
              >
                Save Note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Human Review Actions (Accept, Reject, Needs Review) */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Editorial Decision:
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {/* Accept Button */}
          <button
            onClick={() => onDecisionChange(finding.id, 'ACCEPTED', noteText)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              finding.reviewerDecision === 'ACCEPTED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300'
            }`}
            title="Approve this claim"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Accept</span>
          </button>

          {/* Reject Button */}
          <button
            onClick={() => onDecisionChange(finding.id, 'REJECTED', noteText)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              finding.reviewerDecision === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 hover:border-rose-300'
            }`}
            title="Reject claim or mark for removal"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Reject</span>
          </button>

          {/* Needs Review Button */}
          <button
            onClick={() => onDecisionChange(finding.id, 'NEEDS_REVIEW', noteText)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              finding.reviewerDecision === 'NEEDS_REVIEW'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300'
            }`}
            title="Escalate claim for SME review"
          >
            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Needs Review</span>
          </button>

          {/* Note Toggle */}
          {!showNotesInput && (
            <button
              onClick={() => setShowNotesInput(true)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-200/50"
              title="Add reviewer note"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
