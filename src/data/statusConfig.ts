import React from 'react';
import type { FindingStatus } from '../types';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

export const STATUS_CONFIG: Record<
  FindingStatus,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    ring: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  SUPPORTED: {
    label: 'SUPPORTED',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    ring: 'ring-emerald-600/20',
    icon: CheckCircle2,
    description: 'Claim directly substantiated by approved brand or factual sources.'
  },
  CONTRADICTED: {
    label: 'CONTRADICTED',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-300',
    ring: 'ring-rose-600/20',
    icon: XCircle,
    description: 'Claim directly conflicts with approved sources or legal guidelines.'
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'INSUFFICIENT EVIDENCE',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-300',
    ring: 'ring-amber-600/20',
    icon: HelpCircle,
    description: 'No verified citations or benchmark data found in approved repositories.'
  },
  CONFLICTING_SOURCES: {
    label: 'CONFLICTING SOURCES',
    bg: 'bg-stone-100',
    text: 'text-stone-900',
    border: 'border-stone-300',
    ring: 'ring-stone-600/20',
    icon: AlertTriangle,
    description: 'Multiple approved documents state divergent or contradictory information.'
  },
  NEEDS_HUMAN_REVIEW: {
    label: 'NEEDS HUMAN REVIEW',
    bg: 'bg-stone-100',
    text: 'text-stone-900',
    border: 'border-stone-300',
    ring: 'ring-stone-600/20',
    icon: UserCheck,
    description: 'Requires legal, executive, or technical subject-matter sign-off.'
  }
};
