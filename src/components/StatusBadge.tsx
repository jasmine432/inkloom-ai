import React from 'react';
import type { FindingStatus, ReviewerDecision } from '../types';
import {
  Check,
  X,
  Clock,
  AlertCircle
} from 'lucide-react';
import { STATUS_CONFIG } from '../data/statusConfig';

interface StatusBadgeProps {
  status: FindingStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NEEDS_HUMAN_REVIEW;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 tracking-wider font-semibold',
    md: 'text-xs px-2.5 py-1 tracking-wide font-semibold',
    lg: 'text-sm px-3.5 py-1.5 tracking-wide font-semibold'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono-code transition-colors ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}
      title={config.description}
    >
      {showIcon && <Icon className={`${iconSizes[size]} shrink-0`} />}
      <span>{config.label}</span>
    </span>
  );
};

export const DecisionBadge: React.FC<{ decision: ReviewerDecision }> = ({ decision }) => {
  switch (decision) {
    case 'ACCEPTED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <Check className="w-3 h-3" /> Accepted
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
          <X className="w-3 h-3" /> Rejected
        </span>
      );
    case 'NEEDS_REVIEW':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
          <AlertCircle className="w-3 h-3" /> Escalated
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <Clock className="w-3 h-3" /> Pending Review
        </span>
      );
  }
};
