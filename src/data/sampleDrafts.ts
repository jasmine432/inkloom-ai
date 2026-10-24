import type { SampleDraft } from '../types';

export const SAMPLE_DRAFTS: SampleDraft[] = [
  {
    id: 'draft-q4-launch',
    title: 'Enterprise Q4 Platform Release: Autonomous Content Governance',
    targetAudience: 'Enterprise CMOs & Brand Directors',
    channel: 'Product Announcement & Press Release',
    content: `Inkloom AI is proud to unveil our next-generation Enterprise Content Review Workspace. Powered by proprietary hybrid-retrieval architectures, our engine guarantees 99.999% uptime for all global corporate teams.

Marketing teams can now ingest up to 500 brand guideline manuals simultaneously. Our benchmarks prove that a 1,500-word product marketing draft is thoroughly fact-checked and verified in under 5 seconds with zero customer data retained for third-party model training.

With Inkloom AI, marketing teams eliminate 100% of legal liability for copy errors, making manual brand compliance review completely obsolete. Independent analyst firm Gartner officially ranked Inkloom AI as the #1 undisputed global leader in Content Governance in their latest 2026 Magic Quadrant.

Furthermore, our revolutionary AI agent autonomously rewrites non-compliant statements and directly publishes approved copy to your corporate CMS without requiring any human sign-off.`,
    findings: [
      {
        id: 'f-01',
        claim: 'guarantees 99.999% uptime for all global corporate teams',
        status: 'CONTRADICTED',
        explanation: 'The marketing draft promises "five nines" (99.999%) uptime, but approved legal contracts covenant a 99.9% uptime SLA for Enterprise tiers.',
        evidence: [
          {
            id: 'ev-01',
            sourceTitle: 'Q3 Enterprise SLA & Compliance Warranty',
            sourceType: 'Legal & Compliance',
            documentVersion: 'v1.9',
            lastUpdated: 'Oct 02, 2026',
            quote: 'Inkloom guarantees 99.9% monthly service availability for Enterprise subscriptions, and 99.5% for standard Business tiers.',
            section: 'Section 4.1: Availability Commitments',
            confidenceScore: 98
          }
        ],
        suggestedAction: 'Revise claim to "guarantees 99.9% uptime for enterprise teams" to match binding SLA warranty terms.',
        reviewerDecision: 'PENDING',
        category: 'Legal & Regulatory'
      },
      {
        id: 'f-02',
        claim: 'ingest up to 500 brand guideline manuals simultaneously',
        status: 'SUPPORTED',
        explanation: 'Infrastructure benchmarks confirm the multi-tenant guideline vector index officially supports 500 active guideline documents per workspace.',
        evidence: [
          {
            id: 'ev-02',
            sourceTitle: 'Enterprise Architecture & Latency Benchmark 2026',
            sourceType: 'Product Benchmark',
            documentVersion: 'v2.8',
            lastUpdated: 'Sep 28, 2026',
            quote: 'Verified cluster capacity supports ingestion of up to 500 simultaneous brand guideline PDFs and Markdown sources per tenant.',
            section: 'Infrastructure Throughput §3.2',
            confidenceScore: 96
          }
        ],
        suggestedAction: 'Claim is fully backed by engineering verification. No editorial alteration needed.',
        reviewerDecision: 'PENDING',
        category: 'Product Capability'
      },
      {
        id: 'f-03',
        claim: 'thoroughly fact-checked and verified in under 5 seconds with zero customer data retained for third-party model training',
        status: 'SUPPORTED',
        explanation: 'Audited benchmark logs confirm p95 latency of 4.2s for 1,500 words, and customer privacy clauses mandate zero third-party training data retention.',
        evidence: [
          {
            id: 'ev-03',
            sourceTitle: 'Enterprise Architecture & Latency Benchmark 2026',
            sourceType: 'Product Benchmark',
            documentVersion: 'v2.8',
            lastUpdated: 'Sep 28, 2026',
            quote: 'Average verification latency for standard 1,500-word draft is 4.2 seconds under p95. Zero customer training retention: customer drafts are never stored in third-party model weights.',
            section: 'Latency & Privacy SLA §1.4',
            confidenceScore: 99
          }
        ],
        suggestedAction: 'Claim matches verified benchmarks. Approved for promotional release.',
        reviewerDecision: 'PENDING',
        category: 'Product Capability'
      },
      {
        id: 'f-04',
        claim: 'eliminate 100% of legal liability for copy errors, making manual brand compliance review completely obsolete',
        status: 'CONTRADICTED',
        explanation: 'Both legal guidelines and brand style rules explicitly prohibit guaranteeing complete liability immunity or claiming that human oversight is obsolete.',
        evidence: [
          {
            id: 'ev-04a',
            sourceTitle: 'Q3 Enterprise SLA & Compliance Warranty',
            sourceType: 'Legal & Compliance',
            documentVersion: 'v1.9',
            lastUpdated: 'Oct 02, 2026',
            quote: 'Marketing claims claiming "100% legal indemnity against all defamation" or total liability elimination are explicitly forbidden by general counsel.',
            section: 'Section 9.3: Prohibited Marketing Claims',
            confidenceScore: 97
          },
          {
            id: 'ev-04b',
            sourceTitle: 'Inkloom Global Brand Voice & Style Guide',
            sourceType: 'Brand Guideline',
            documentVersion: 'v4.2',
            lastUpdated: 'Oct 14, 2026',
            quote: 'Do not describe the platform as "completely automated zero-risk publishing". Always emphasize human editorial control and verified enterprise provenance.',
            section: 'Core Brand Pillars §2.1',
            confidenceScore: 95
          }
        ],
        suggestedAction: 'Delete absolute immunity language. Reframe as: "Significantly reduces compliance risk while empowering editorial teams with automated verification."',
        reviewerDecision: 'PENDING',
        category: 'Brand Voice & Messaging'
      },
      {
        id: 'f-05',
        claim: 'Gartner officially ranked Inkloom AI as the #1 undisputed global leader in Content Governance in their latest 2026 Magic Quadrant',
        status: 'CONFLICTING_SOURCES',
        explanation: 'Analyst relations documentation notes Inkloom was recognized as a "Strong Performer", whereas sales collateral and press drafts cite differing positioning tiers.',
        evidence: [
          {
            id: 'ev-05a',
            sourceTitle: 'Gartner & Forrester Market Share Summary',
            sourceType: 'Market Research',
            documentVersion: '2026 Landscape',
            lastUpdated: 'Aug 15, 2026',
            quote: 'Inkloom AI was recognized as a "Strong Performer" in Content Integrity Platforms (Q2 2026 report). Category has not issued an "undisputed #1" designation.',
            section: 'Analyst Classifications §1.2',
            confidenceScore: 91
          },
          {
            id: 'ev-05b',
            sourceTitle: 'Enterprise Architecture & Latency Benchmark 2026',
            sourceType: 'Product Benchmark',
            documentVersion: 'Internal Draft',
            lastUpdated: 'Sep 10, 2026',
            quote: 'Ranked in the top quartile of brand safety automation vendors across velocity and accuracy criteria.',
            section: 'Executive Summary',
            confidenceScore: 78
          }
        ],
        suggestedAction: 'Adjust copy to: "Recognized as a Strong Performer in Content Integrity Platforms by leading market analysts." Avoid claiming #1 Magic Quadrant ranking without formal licensing agreement.',
        reviewerDecision: 'PENDING',
        category: 'Market Research'
      },
      {
        id: 'f-06',
        claim: 'autonomously rewrites non-compliant statements and directly publishes approved copy to your corporate CMS without requiring any human sign-off',
        status: 'NEEDS_HUMAN_REVIEW',
        explanation: 'Bypassing human sign-off triggers high-risk classification under EU AI Act transparency rules. Editorial leadership and Risk officer sign-off required before promoting autonomous publish workflows.',
        evidence: [
          {
            id: 'ev-06',
            sourceTitle: 'Inkloom Global Brand Voice & Style Guide',
            sourceType: 'Brand Guideline',
            documentVersion: 'v4.2',
            lastUpdated: 'Oct 14, 2026',
            quote: 'Any automated publishing integration must highlight mandatory "Human-in-the-Loop Approval Gates" to satisfy enterprise risk frameworks.',
            section: 'AI Ethics & Governance §6.4',
            confidenceScore: 89
          }
        ],
        suggestedAction: 'Flag for Compliance Officer and VP of Product review. Recommend adding: "with one-click human verification gates before publishing."',
        reviewerDecision: 'PENDING',
        category: 'Legal & Regulatory'
      },
      {
        id: 'f-07',
        claim: 'proprietary hybrid-retrieval architectures',
        status: 'INSUFFICIENT_EVIDENCE',
        explanation: 'Patent filing and technical whitepaper on hybrid retrieval have not yet cleared patent disclosure review. No verified public documentation exists in approved repository.',
        evidence: [
          {
            id: 'ev-07',
            sourceTitle: 'Enterprise Architecture & Latency Benchmark 2026',
            sourceType: 'Product Benchmark',
            documentVersion: 'v2.8',
            lastUpdated: 'Sep 28, 2026',
            quote: 'Pending patent disclosure for vector retrieval pipeline scheduled for Q1 2027 filing.',
            section: 'IP Disclosure Note',
            confidenceScore: 64
          }
        ],
        suggestedAction: 'Verify with Intellectual Property counsel before publishing references to proprietary patents, or use general term "advanced retrieval architectures".',
        reviewerDecision: 'PENDING',
        category: 'Product Capability'
      }
    ]
  },
  {
    id: 'draft-fintech-sustainability',
    title: 'Fintech Green Bond Initiative: Carbon Neutral Treasury',
    targetAudience: 'Institutional Investors & ESG Regulators',
    channel: 'Annual Impact Disclosure',
    content: `Inkloom AI is proud to partner with global financial leaders to certify zero-emission digital infrastructure. Our cloud operations produce net-zero carbon footprints across all tier-1 server farms.

Independent auditors at EcoCert have verified that our algorithmic pruning saves 42 million kilowatt hours annually compared to legacy LLM pipelines. Every enterprise review performed on our network generates certified carbon offset credits automatically deposited into our customers' treasury reserves.

Furthermore, we are fully certified under the SEC's Climate Disclosure Framework Stage 3 guidelines, guaranteeing complete exemption from federal environmental penalties.`,
    findings: [
      {
        id: 'f-fin-01',
        claim: 'cloud operations produce net-zero carbon footprints across all tier-1 server farms',
        status: 'INSUFFICIENT_EVIDENCE',
        explanation: 'While AWS and GCP hosting regions utilize renewable energy matching, our internal carbon audit report for 2026 has not completed third-party verification.',
        evidence: [
          {
            id: 'ev-fin-01',
            sourceTitle: 'Q3 Enterprise SLA & Compliance Warranty',
            sourceType: 'Legal & Compliance',
            documentVersion: 'v1.9',
            lastUpdated: 'Oct 02, 2026',
            quote: 'Environmental impact audits are currently in progress with accredited assessors; formal disclosure certification is scheduled for end of fiscal year.',
            section: 'ESG Disclosure §8.1',
            confidenceScore: 61
          }
        ],
        suggestedAction: 'Soft-state claim: "Host operations run on hyperscale cloud regions committed to 100% renewable energy matching."',
        reviewerDecision: 'PENDING',
        category: 'Legal & Regulatory'
      },
      {
        id: 'f-fin-02',
        claim: 'saves 42 million kilowatt hours annually compared to legacy LLM pipelines',
        status: 'CONFLICTING_SOURCES',
        explanation: 'The internal engineering whitepaper estimates 18 to 22 million kWh savings, while the marketing briefing deck cited 42 million kWh without methodology notes.',
        evidence: [
          {
            id: 'ev-fin-02',
            sourceTitle: 'Enterprise Architecture & Latency Benchmark 2026',
            sourceType: 'Product Benchmark',
            documentVersion: 'v2.8',
            lastUpdated: 'Sep 28, 2026',
            quote: 'Pruning optimization saves an estimated 19.4M kWh across annualized cluster load compared to unoptimized dense transformer baselines.',
            section: 'Efficiency Benchmarks §4.7',
            confidenceScore: 88
          }
        ],
        suggestedAction: 'Align with engineering benchmark data: "Saves up to 20 million kilowatt hours annually based on internal cluster efficiency measurements."',
        reviewerDecision: 'PENDING',
        category: 'Product Capability'
      },
      {
        id: 'f-fin-03',
        claim: 'guaranteeing complete exemption from federal environmental penalties',
        status: 'CONTRADICTED',
        explanation: 'Legal counsel explicitly forbids stating that software or certifications confer exemption from statutory or administrative regulatory penalties.',
        evidence: [
          {
            id: 'ev-fin-03',
            sourceTitle: 'Q3 Enterprise SLA & Compliance Warranty',
            sourceType: 'Legal & Compliance',
            documentVersion: 'v1.9',
            lastUpdated: 'Oct 02, 2026',
            quote: 'No marketing material may assert statutory exemption, immunity, or indemnification from governmental inquiries or environmental penalties.',
            section: 'Compliance Covenants §11.2',
            confidenceScore: 99
          }
        ],
        suggestedAction: 'Remove sentence completely. Software solutions cannot legally grant regulatory penalty exemptions.',
        reviewerDecision: 'PENDING',
        category: 'Legal & Regulatory'
      },
      {
        id: 'f-fin-04',
        claim: 'certified carbon offset credits automatically deposited into our customers treasury reserves',
        status: 'NEEDS_HUMAN_REVIEW',
        explanation: 'Automatic issuance of financial instruments or registered carbon offset tokens requires banking regulatory review before commercial launch.',
        evidence: [
          {
            id: 'ev-fin-04',
            sourceTitle: 'Q3 Enterprise SLA & Compliance Warranty',
            sourceType: 'Legal & Compliance',
            documentVersion: 'v1.9',
            lastUpdated: 'Oct 02, 2026',
            quote: 'Any planned credit-generation features remain exploratory and require Fintech compliance review prior to public advertisement.',
            section: 'Special Product Features §14',
            confidenceScore: 92
          }
        ],
        suggestedAction: 'Refer to Chief Legal Officer. Revise to note that carbon tracking reports are provided for customer accounting.',
        reviewerDecision: 'PENDING',
        category: 'Legal & Regulatory'
      }
    ]
  }
];
