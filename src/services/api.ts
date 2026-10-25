import type {
  ApprovedSource,
  Finding,
  ReviewDraftRequest,
  ReviewDraftResponse,
  ReviewSummary,
  ReviewerDecision,
} from '../types';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').trim().replace(/\/+$/, '');
const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

export interface BackendHealth {
  status: string;
  version: string;
  llmProvider: string;
  isLlmConfigured: boolean;
  sourcesCount: number;
  isAuthConfigured?: boolean;
  isDbConfigured?: boolean;
  dbStatus?: string;
  dbDialect?: string;
  dbName?: string;
  dbError?: string;
}

export interface VerifiedUserProfile {
  uid: string;
  email?: string | null;
  name?: string | null;
  email_verified: boolean;
  auth_time?: number | null;
}

/**
 * Checks connectivity to the local FastAPI backend.
 */
export async function checkBackendHealth(): Promise<BackendHealth | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as BackendHealth;
  } catch {
    return null;
  }
}

/**
 * Fetches indexed approved guidelines from the backend.
 */
export async function fetchBackendSources(): Promise<ApprovedSource[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/sources`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ApprovedSource[];
  } catch {
    return null;
  }
}

/**
 * Submits marketing copy to the backend for retrieval, LLM auditing, and citation validation.
 * Attaches the authenticated Firebase ID token if provided.
 */
export async function submitDraftReview(
  payload: ReviewDraftRequest,
  token?: string | null
): Promise<ReviewDraftResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorMessage = `Review request failed (HTTP ${res.status})`;
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

  return (await res.json()) as ReviewDraftResponse;
}

/**
 * Calls protected GET /api/auth/me to verify user identity on backend.
 */
export async function fetchVerifiedProfile(
  token: string
): Promise<VerifiedUserProfile | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as VerifiedUserProfile;
  } catch {
    return null;
  }
}

/**
 * Fetches the list of reviews belonging to the authenticated user from PostgreSQL.
 */
export async function fetchUserReviews(
  token: string
): Promise<ReviewSummary[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as ReviewSummary[];
  } catch {
    return null;
  }
}

/**
 * Fetches full review details including findings and citations for an authorized user.
 */
export async function fetchReviewDetail(
  reviewId: string,
  token: string
): Promise<ReviewDraftResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as ReviewDraftResponse;
  } catch {
    return null;
  }
}

/**
 * Updates a reviewer's decision and notes on a finding in PostgreSQL.
 */
export async function updateFindingDecision(
  reviewId: string,
  findingId: string,
  decision: ReviewerDecision,
  notes?: string,
  token?: string | null
): Promise<Finding | null> {
  if (!token) return null;
  try {
    const res = await fetch(
      `${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}/findings/${encodeURIComponent(
        findingId
      )}/decision`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          decision,
          notes: notes ?? null,
        }),
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as Finding;
  } catch {
    return null;
  }
}

/**
 * Permanently deletes a user's review and its associated findings and citations.
 */
export async function deleteUserReview(
  reviewId: string,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}`, {
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
