import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Copy,
  Check,
  MoreHorizontal,
  FileText,
  Sparkles,
} from 'lucide-react';
import type { Finding, ReviewerDecision } from '../../types';
import { TopographicCurves } from '../TopographicCurves';

interface ReviewResultsViewProps {
  findings: Finding[];
  onDecisionChange: (findingId: string, decision: ReviewerDecision, notes?: string) => void;
  onEditDraft: () => void;
  onOpenAssistant?: () => void;
  isLiveMode?: boolean;
  providerName?: string;
  sourcesCount?: number;
}

export const ReviewResultsView: React.FC<ReviewResultsViewProps> = ({
  findings,
  onDecisionChange,
  onEditDraft,
  onOpenAssistant,
  isLiveMode = false,
  providerName = 'Gemini',
  sourcesCount = 4,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Map backend status to user-friendly severity matching the reference design
  const getSeverity = (f: Finding): 'HIGH' | 'MEDIUM' | 'LOW' => {
    if (f.status === 'CONTRADICTED') return 'HIGH';
    if (f.status === 'NEEDS_HUMAN_REVIEW' || f.status === 'CONFLICTING_SOURCES') return 'MEDIUM';
    if (f.status === 'INSUFFICIENT_EVIDENCE') return 'MEDIUM';
    return 'LOW'; // SUPPORTED
  };

  // Human-friendly title matching reference Screen 3
  const getIssueTitle = (f: Finding): string => {
    if (f.status === 'CONTRADICTED') return 'Unsupported claim';
    if (f.status === 'NEEDS_HUMAN_REVIEW') return 'Needs clarification';
    if (f.status === 'CONFLICTING_SOURCES') return 'Conflicting sources';
    if (f.status === 'INSUFFICIENT_EVIDENCE') return 'Check for accuracy';
    return 'Verified statement';
  };

  const highCount = findings.filter((f) => getSeverity(f) === 'HIGH').length;
  const mediumCount = findings.filter((f) => getSeverity(f) === 'MEDIUM').length;
  const lowCount = findings.filter((f) => getSeverity(f) === 'LOW').length;

  const filteredFindings = findings.filter((f) => {
    if (severityFilter === 'ALL') return true;
    return getSeverity(f) === severityFilter;
  });

  const handleCopySuggestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSource = (id: string) => {
    setExpandedSourceId(expandedSourceId === id ? null : id);
  };

  return (
    <div className="relative min-h-full pb-16">
      {/* Topographic line-art in top-right */}
      <TopographicCurves />

      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-8 relative z-10">
        {/* Top Bar with Tag, Back Button, and Live AI Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onEditDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Edit draft</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium shadow-2xs">
              <span>Review results</span>
            </div>
            {onOpenAssistant && (
              <button
                type="button"
                onClick={onOpenAssistant}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 hover:border-stone-400 shadow-2xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-stone-600" />
                <span>Ask Assistant</span>
              </button>
            )}
          </div>

          {/* Live Review Status Badge matching reference */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isLiveMode
                  ? 'bg-stone-900 text-white'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveMode ? 'bg-emerald-400' : 'bg-amber-500'
                }`}
              />
              <span>
                {isLiveMode
                  ? `Live review (${providerName})`
                  : 'Demo evaluation'}
              </span>
            </span>
            <span className="text-xs text-stone-400 font-mono hidden md:inline">
              Model: gemini-3.5-flash-lite
            </span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-sans">
            {findings.length === 0
              ? 'No issues detected'
              : `We found ${findings.length} ${findings.length === 1 ? 'issue' : 'issues'}`}
          </h1>
          <p className="text-sm text-stone-600">
            Review the suggestions below. Checked against {sourcesCount} trusted sources.
          </p>
        </div>

        {/* Severity Filter Pills matching reference Screen 3 */}
        {findings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* All */}
            <button
              onClick={() => setSeverityFilter('ALL')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                severityFilter === 'ALL'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              All ({findings.length})
            </button>

            {/* High */}
            <button
              onClick={() => setSeverityFilter('HIGH')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                severityFilter === 'HIGH'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>High ({highCount})</span>
            </button>

            {/* Medium */}
            <button
              onClick={() => setSeverityFilter('MEDIUM')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                severityFilter === 'MEDIUM'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Medium ({mediumCount})</span>
            </button>

            {/* Low */}
            <button
              onClick={() => setSeverityFilter('LOW')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                severityFilter === 'LOW'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Low ({lowCount})</span>
            </button>
          </div>
        )}

        {/* Issue Cards List */}
        {filteredFindings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              No findings in this category
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Your draft passed all verified checks for this filter criteria.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setSeverityFilter('ALL')}
                className="text-xs font-semibold text-stone-900 underline"
              >
                Show all findings
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFindings.map((finding) => {
              const severity = getSeverity(finding);
              const issueTitle = getIssueTitle(finding);
              const isExpanded = expandedSourceId === finding.id;
              const isAccepted = finding.reviewerDecision === 'ACCEPTED';
              const isRejected = finding.reviewerDecision === 'REJECTED';

              return (
                <div
                  key={finding.id}
                  className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs hover:border-stone-300 transition-all space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    {/* Left: Issue Details */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Severity Circle Icon matching reference */}
                      <div className="pt-0.5 shrink-0">
                        {severity === 'HIGH' && (
                          <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center ring-4 ring-rose-50/50">
                            <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        )}
                        {severity === 'MEDIUM' && (
                          <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center ring-4 ring-amber-50/50">
                            <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        )}
                        {severity === 'LOW' && (
                          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center ring-4 ring-emerald-50/50">
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        {/* Severity tag */}
                        <span
                          className={`text-xs font-semibold ${
                            severity === 'HIGH'
                              ? 'text-rose-600'
                              : severity === 'MEDIUM'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {severity === 'HIGH'
                            ? 'High severity'
                            : severity === 'MEDIUM'
                            ? 'Medium severity'
                            : 'Low severity'}
                        </span>

                        <h3 className="text-base font-bold text-stone-900 leading-snug">
                          {issueTitle}
                        </h3>

                        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                          {finding.explanation}
                        </p>

                        {/* Extracted Claim Quote */}
                        <div className="pt-1">
                          <blockquote className="text-xs text-stone-800 italic bg-stone-50 border-l-2 border-stone-400 pl-2.5 py-1 rounded-r">
                            &ldquo;{finding.claim}&rdquo;
                          </blockquote>
                        </div>

                        {/* Show source expandable link matching reference */}
                        {finding.evidence && finding.evidence.length > 0 && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => toggleSource(finding.id)}
                              className="text-xs font-semibold text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 transition-colors"
                            >
                              <span>{isExpanded ? 'Hide source' : 'Show source'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Suggested Fix & Action Buttons matching reference */}
                    <div className="w-full md:w-72 shrink-0 space-y-3 bg-stone-50/70 p-4 rounded-xl border border-stone-200/60">
                      <div>
                        <span className="text-xs font-semibold text-stone-500 block mb-1">
                          Suggested fix
                        </span>
                        <p className="text-xs text-stone-800 leading-relaxed line-clamp-3">
                          {finding.suggestedAction || 'Review claim against approved source guidelines.'}
                        </p>
                      </div>

                      {/* Apply Fix & Dismiss Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onDecisionChange(finding.id, 'ACCEPTED')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                            isAccepted
                              ? 'bg-emerald-700 text-white'
                              : 'bg-stone-900 hover:bg-black text-white'
                          }`}
                        >
                          {isAccepted ? 'Applied ✓' : 'Apply fix'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDecisionChange(finding.id, 'REJECTED')}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          Dismiss
                        </button>

                        {/* More menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(activeMenuId === finding.id ? null : finding.id)
                            }
                            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
                            title="More options"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {activeMenuId === finding.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-lg border border-stone-200 py-1 text-xs z-30">
                              <button
                                type="button"
                                onClick={() => {
                                  onDecisionChange(finding.id, 'NEEDS_REVIEW');
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-stone-700 font-medium"
                              >
                                Mark Needs Review
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopySuggestion(finding.id, finding.suggestedAction);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-stone-700 font-medium inline-flex items-center justify-between"
                              >
                                <span>Copy fix text</span>
                                {copiedId === finding.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-stone-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Evidence Details */}
                  {isExpanded && finding.evidence && finding.evidence.length > 0 && (
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block font-mono">
                        Verified Source Passage:
                      </span>
                      {finding.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-stone-50/80 rounded-xl p-3.5 border border-stone-200 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-stone-500" />
                              <span className="font-semibold text-stone-900">{ev.sourceTitle}</span>
                              {ev.documentVersion && (
                                <span className="text-[11px] text-stone-400 font-mono">
                                  ({ev.documentVersion})
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-600">
                              {ev.confidenceScore}% confidence match
                            </span>
                          </div>

                          <div className="text-[11px] text-stone-500">
                            {ev.section} • Audited: {ev.lastUpdated}
                          </div>

                          <blockquote className="border-l-2 border-stone-900 pl-3 py-0.5 italic text-stone-800 bg-white rounded-r">
                            &ldquo;{ev.quote}&rdquo;
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
