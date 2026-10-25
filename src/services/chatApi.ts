import type {
  ChatMessage,
  ChatConversationSummary,
  ChatHistoryResponse,
} from '../types/chat';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').trim().replace(/\/+$/, '');
const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

/**
 * Submits a message to the Inkloom AI Assistant.
 * Attaches the authenticated Firebase ID token.
 */
export async function sendChatMessage(
  message: string,
  conversationId?: string | null,
  auditId?: string | null,
  token?: string | null
): Promise<ChatMessage> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  const payload = {
    message: message.trim(),
    conversation_id: conversationId || null,
    audit_id: auditId || null,
  };

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorMessage = `Assistant request failed (HTTP ${res.status})`;
    try {
      const errorJson = await res.json();
      if (errorJson && errorJson.detail) {
        errorMessage =
          typeof errorJson.detail === 'string'
            ? errorJson.detail
            : JSON.stringify(errorJson.detail);
      }
    } catch {
      if (res.statusText) {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
    }
    throw new Error(errorMessage);
  }

  return (await res.json()) as ChatMessage;
}

/**
 * Fetches the list of past assistant conversations for the authenticated user.
 */
export async function fetchConversations(
  token: string
): Promise<ChatConversationSummary[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    return (await res.json()) as ChatConversationSummary[];
  } catch {
    return null;
  }
}

/**
 * Retrieves the full message history for a specific conversation.
 */
export async function fetchConversationHistory(
  conversationId: string,
  token: string
): Promise<ChatHistoryResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    return (await res.json()) as ChatHistoryResponse;
  } catch {
    return null;
  }
}

/**
 * Deletes a conversation from the server.
 */
export async function deleteConversation(
  conversationId: string,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    return res.ok;
  } catch {
    return false;
  }
}
