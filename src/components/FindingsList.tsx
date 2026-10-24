import React, { useState } from 'react';
import type { Finding, FindingStatus, ReviewerDecision } from '../types';
import { FindingCard } from './FindingCard';
import { Search, CheckCheck, Inbox, FileCheck } from 'lucide-react';

interface FindingsListProps {
  findings: Finding[];
  selectedFilter: FindingStatus | 'ALL';
  onSelectFilter: (filter: FindingStatus | 'ALL') => void;
  onDecisionChange: (findingId: string, decision: ReviewerDecision, notes?: string) => void;
  onBatchAcceptSupported: () => void;
  hasAudited?: boolean;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  selectedFilter,
  onSelectFilter,
  onDecisionChange,
  onBatchAcceptSupported,
  hasAudited = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'PENDING' | 'DECIDED'>('ALL');

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    // Status filter
    if (selectedFilter !== 'ALL' && f.status !== selectedFilter) {
      return false;
    }
    // Decision filter
    if (decisionFilter === 'PENDING' && f.reviewerDecision !== 'PENDING') {
      return false;
    }
    if (decisionFilter === 'DECIDED' && f.reviewerDecision === 'PENDING') {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchClaim = f.claim.toLowerCase().includes(q);
      const matchExpl = f.explanation.toLowerCase().includes(q);
      const matchAction = f.suggestedAction.toLowerCase().includes(q);
      const matchCategory = f.category.toLowerCase().includes(q);
      const matchSource = f.evidence.some(
        (e) =>
          e.sourceTitle.toLowerCase().includes(q) ||
          e.quote.toLowerCase().includes(q)
      );
      return matchClaim || matchExpl || matchAction || matchCategory || matchSource;
    }
    return true;
  });

  const supportedPendingCount = findings.filter(
    (f) => f.status === 'SUPPORTED' && f.reviewerDecision === 'PENDING'
  ).length;

  // Empty state if draft has not yet been audited
  if (!hasAudited || findings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mx-auto">
          <FileCheck className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 m-0">
          Ready for Content Review
        </h4>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          Enter your document title and copy in the editor on the left, then click{' '}
          <strong className="text-slate-700">&ldquo;Review Content&rdquo;</strong> to extract claims and verify citations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Decision Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search claims, explanations, or quotes..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Decision Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium shrink-0">
            <button
              onClick={() => setDecisionFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                decisionFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({findings.length})
            </button>
            <button
              onClick={() => setDecisionFilter('PENDING')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                decisionFilter === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({findings.filter((f) => f.reviewerDecision === 'PENDING').length})
            </button>
            <button
              onClick={() => setDecisionFilter('DECIDED')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                decisionFilter === 'DECIDED'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Decided ({findings.filter((f) => f.reviewerDecision !== 'PENDING').length})
            </button>
          </div>
        </div>

        {/* Quick Batch Actions Banner */}
        {supportedPendingCount > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              <strong className="text-emerald-700">{supportedPendingCount}</strong> supported claims ready for approval.
            </span>
            <button
              onClick={onBatchAcceptSupported}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold text-xs transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Approve All Supported</span>
            </button>
          </div>
        )}
      </div>

      {/* Filtered Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            No Findings Match Current Filters
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Adjust your search terms or reset the status filters to view all audited claims.
          </p>
          <div className="pt-1">
            <button
              onClick={() => {
                onSelectFilter('ALL');
                setSearchQuery('');
                setDecisionFilter('ALL');
              }}
              className="text-xs font-semibold text-stone-900 hover:text-black underline"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onDecisionChange={onDecisionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
