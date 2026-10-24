export interface ChatEvidenceItem {
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  section: string;
  quote: string;
  confidenceScore: number;
  url?: string;
}

export interface ChatRelatedFinding {
  findingId: string;
  claim: string;
  status: string;
  explanation?: string;
  category?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  evidence?: ChatEvidenceItem[];
  relatedFindings?: ChatRelatedFinding[];
  suggestedPrompts?: string[];
  createdAt: string;
  isError?: boolean;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  auditId?: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatHistoryResponse {
  conversationId: string;
  title: string;
  auditId?: string | null;
  messages: ChatMessage[];
}
