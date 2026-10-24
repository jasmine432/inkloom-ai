import type { ApprovedSource } from '../types';

export const APPROVED_SOURCES: ApprovedSource[] = [
  {
    id: 'src-bg-01',
    title: 'Inkloom Global Brand Voice & Style Guide',
    category: 'Brand Identity',
    version: 'v4.2 (Q3 2026 Release)',
    lastAudited: 'Oct 14, 2026',
    owner: 'Brand Strategy & Editorial Office',
    ruleCount: 38,
    description: 'Defines vocabulary, capitalization of proprietary terms, tone principles, and mandatory disclaimer language for external marketing.',
    verifiedClaims: [
      'Proprietary product name is styled "Inkloom AI", never "InkLoom" or "Inkloom.ai"',
      'Do not describe the platform as "completely automated zero-risk publishing"',
      'Always emphasize human editorial control and verified enterprise provenance'
    ]
  },
  {
    id: 'src-prod-02',
    title: 'Enterprise Architecture & Latency Benchmark 2026',
    category: 'Product Specs',
    version: 'v2.8 - Verified Eng Specs',
    lastAudited: 'Sep 28, 2026',
    owner: 'Principal Systems Architect',
    ruleCount: 24,
    description: 'Certified infrastructure performance metrics, query latency limits, and model inference SLAs measured across AWS and GCP multi-region clusters.',
    verifiedClaims: [
      'Average verification latency for standard 1,500-word draft is 4.2 seconds under p95',
      'Supports ingestion of up to 500 simultaneous brand guideline PDFs and Markdown sources',
      'Zero customer training retention: customer drafts are never stored in third-party model weights'
    ]
  },
  {
    id: 'src-leg-03',
    title: 'Q3 Enterprise SLA & Compliance Warranty',
    category: 'Legal & Compliance',
    version: 'v1.9 - Legal Counsel Approved',
    lastAudited: 'Oct 02, 2026',
    owner: 'General Counsel & Risk Compliance',
    ruleCount: 19,
    description: 'Binding legal guarantees, standard uptime covenants, regulatory privacy disclosures, and EU AI Act conformity attestations.',
    verifiedClaims: [
      'Uptime SLA is 99.9% availability for Enterprise tier, 99.5% for Business tier',
      'SOC 2 Type II and ISO 27001 audited annually',
      'Marketing claims claiming "100% legal indemnity against all defamation" are explicitly forbidden'
    ]
  },
  {
    id: 'src-mkt-04',
    title: 'Gartner & Forrester Market Share Summary',
    category: 'Market Research',
    version: '2026 Vendor Landscape',
    lastAudited: 'Aug 15, 2026',
    owner: 'Product Marketing Intelligence',
    ruleCount: 12,
    description: 'Independent analyst coverage and verified market position data for content governance software category.',
    verifiedClaims: [
      'Named "Strong Performer" in Content Integrity Platforms (Q2 2026)',
      'Over 280 enterprise brands actively utilize our review workflow'
    ]
  }
];
