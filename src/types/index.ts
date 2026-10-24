export type FindingStatus =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_SOURCES'
  | 'NEEDS_HUMAN_REVIEW';

export type ReviewerDecision = 'ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW' | 'PENDING';

export type EvidenceSourceType =
  | 'Brand Guideline'
  | 'Legal Specification'
  | 'Legal & Compliance'
  | 'Product Benchmark'
  | 'Financial Report'
  | 'Security Certification'
  | 'Market Research';

export interface EvidenceItem {
  id: string;
  sourceId?: string;
  sourceTitle: string;
  sourceType: EvidenceSourceType;
  documentVersion?: string;
  lastUpdated: string;
  quote: string;
  section: string;
  confidenceScore: number; // 0 - 100
  url?: string;
}

export type FindingCategory =
  | 'Factual Accuracy'
  | 'Brand Voice & Messaging'
  | 'Legal & Regulatory'
  | 'Product Capability'
  | 'Market Research';

export interface Finding {
  id: string;
  claim: string;
  status: FindingStatus;
  explanation: string;
  evidence: EvidenceItem[];
  suggestedAction: string;
  paragraphIndex?: number;
  reviewerDecision: ReviewerDecision;
  reviewerNotes?: string;
  category: FindingCategory;
}

export interface SampleDraft {
  id: string;
  title: string;
  targetAudience: string;
  channel: string;
  content: string;
  findings: Finding[];
}

export interface ApprovedSource {
  id: string;
  title: string;
  category: 'Brand Identity' | 'Product Specs' | 'Legal & Compliance' | 'Market Research';
  version: string;
  lastAudited: string;
  owner: string;
  ruleCount: number;
  description: string;
  verifiedClaims: string[];
}

export interface ReviewMetrics {
  totalFindings: number;
  supported: number;
  contradicted: number;
  insufficientEvidence: number;
  conflictingSources: number;
  needsHumanReview: number;
  decisions: {
    accepted: number;
    rejected: number;
    needsReview: number;
    pending: number;
  };
  overallTrustScore: number;
}

export interface ReviewDraftRequest {
  title: string;
  content: string;
  channel?: string;
  targetAudience?: string;
}

export interface ReviewDraftResponse {
  id?: string;
  draftTitle: string;
  draftContent?: string;
  channel?: string;
  targetAudience?: string;
  isDemo: boolean;
  executionMode: string;
  findings: Finding[];
  metrics: ReviewMetrics;
  analyzedAt: string;
}

export interface ReviewSummary {
  id: string;
  title: string;
  channel?: string | null;
  targetAudience?: string | null;
  overallTrustScore: number;
  totalFindings: number;
  supportedCount: number;
  contradictedCount: number;
  needsReviewCount: number;
  executionMode: string;
  createdAt: string;
}
