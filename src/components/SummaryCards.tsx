import React from 'react';
import type { FindingStatus, ReviewMetrics } from '../types';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  UserCheck,
} from 'lucide-react';

interface SummaryCardsProps {
  metrics: ReviewMetrics;
  selectedFilter: FindingStatus | 'ALL';
  onSelectFilter: (filter: FindingStatus | 'ALL') => void;
  totalFindings: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  metrics,
  selectedFilter,
  onSelectFilter,
  totalFindings,
}) => {
  if (totalFindings === 0) {
    return null;
  }

  const filters: {
    key: FindingStatus | 'ALL';
    label: string;
    count: number;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
  }[] = [
    {
      key: 'ALL',
      label: 'All Findings',
      count: totalFindings,
    },
    {
      key: 'SUPPORTED',
      label: 'Supported',
      count: metrics.supported,
      icon: CheckCircle2,
      color: 'text-emerald-700',
    },
    {
      key: 'CONTRADICTED',
      label: 'Contradicted',
      count: metrics.contradicted,
      icon: XCircle,
      color: 'text-rose-700',
    },
    {
      key: 'NEEDS_HUMAN_REVIEW',
      label: 'Needs Review',
      count: metrics.needsHumanReview,
      icon: UserCheck,
      color: 'text-stone-700',
    },
    {
      key: 'INSUFFICIENT_EVIDENCE',
      label: 'Insufficient Evidence',
      count: metrics.insufficientEvidence,
      icon: HelpCircle,
      color: 'text-amber-800',
    },
    {
      key: 'CONFLICTING_SOURCES',
      label: 'Conflicting',
      count: metrics.conflictingSources,
      icon: AlertTriangle,
      color: 'text-stone-700',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 m-0">
            Audit Findings Summary
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter findings by verification status against approved guidelines
          </p>
        </div>

        {/* Decisions Progress */}
        <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start sm:self-auto font-medium">
          <span>Decisions:</span>
          <span className="font-semibold text-slate-800">
            {metrics.decisions.accepted + metrics.decisions.rejected + metrics.decisions.needsReview} / {totalFindings} reviewed
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
        {filters.map((f) => {
          const isActive = selectedFilter === f.key;
          const Icon = f.icon;

          return (
            <button
              key={f.key}
              onClick={() => onSelectFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : f.color}`} />}
              <span>{f.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-600'
                }`}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
