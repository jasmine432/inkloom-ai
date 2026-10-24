from enum import Enum


class FindingStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    CONFLICTING_SOURCES = "CONFLICTING_SOURCES"
    NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"


class ReviewerDecision(str, Enum):
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    PENDING = "PENDING"


class EvidenceSourceType(str, Enum):
    BRAND_GUIDELINE = "Brand Guideline"
    LEGAL_SPECIFICATION = "Legal Specification"
    LEGAL_AND_COMPLIANCE = "Legal & Compliance"
    PRODUCT_BENCHMARK = "Product Benchmark"
    FINANCIAL_REPORT = "Financial Report"
    SECURITY_CERTIFICATION = "Security Certification"
    MARKET_RESEARCH = "Market Research"


class FindingCategory(str, Enum):
    FACTUAL_ACCURACY = "Factual Accuracy"
    BRAND_VOICE_MESSAGING = "Brand Voice & Messaging"
    LEGAL_REGULATORY = "Legal & Regulatory"
    PRODUCT_CAPABILITY = "Product Capability"
    MARKET_RESEARCH = "Market Research"
