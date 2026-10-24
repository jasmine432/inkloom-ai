import type { Finding, ReviewMetrics } from '../types';

export interface HistoryItem {
  id: string;
  title: string;
  content: string;
  channel?: string;
  timestamp: string;
  findings: Finding[];
  metrics: ReviewMetrics;
  isDemo: boolean;
  executionMode: string;
}

const STORAGE_KEY = 'inkloom_review_history_v1';

export function getReviewHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultHistory();
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultHistory();
  } catch {
    return getDefaultHistory();
  }
}

export function saveReviewToHistory(item: Omit<HistoryItem, 'id' | 'timestamp'> & { id?: string }): HistoryItem {
  const history = getReviewHistory();
  const newItem: HistoryItem = {
    ...item,
    id: item.id || `hist-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  // Prepend new item and keep up to 25 items
  const updated = [newItem, ...history.filter(h => h.id !== newItem.id)].slice(0, 25);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return newItem;
}

export function clearReviewHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function getDefaultHistory(): HistoryItem[] {
  return [
    {
      id: 'hist-q4-launch',
      title: 'Enterprise Q4 Platform Release: Autonomous Content Governance',
      content: 'Inkloom AI is proud to unveil our next-generation Enterprise Content Review Workspace...',
      channel: 'Product Announcement',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      findings: [],
      metrics: {
        totalFindings: 7,
        supported: 3,
        contradicted: 2,
        insufficientEvidence: 1,
        conflictingSources: 0,
        needsHumanReview: 1,
        decisions: { accepted: 2, rejected: 1, needsReview: 1, pending: 3 },
        overallTrustScore: 71,
      },
      isDemo: false,
      executionMode: 'live_gemini_structured',
    },
    {
      id: 'hist-fintech-green',
      title: 'Fintech Green Bond Initiative: Carbon Neutral Treasury',
      content: 'Announcing our 100% certified carbon neutral treasury management product for enterprise banks...',
      channel: 'ESG Annual Report',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      findings: [],
      metrics: {
        totalFindings: 4,
        supported: 2,
        contradicted: 1,
        insufficientEvidence: 1,
        conflictingSources: 0,
        needsHumanReview: 0,
        decisions: { accepted: 2, rejected: 1, needsReview: 0, pending: 1 },
        overallTrustScore: 65,
      },
      isDemo: true,
      executionMode: 'deterministic_rule_evaluation',
    },
  ];
}
