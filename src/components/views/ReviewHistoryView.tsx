import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Trash2,
  ArrowRight,
  Database,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { getReviewHistory, clearReviewHistory } from '../../services/history';
import { TopographicCurves } from '../TopographicCurves';
import type { HistoryItem } from '../../services/history';
import { useAuth } from '../../contexts/useAuth';
import {
  fetchUserReviews,
  fetchReviewDetail,
  deleteUserReview,
} from '../../services/api';

interface ReviewHistoryViewProps {
  onLoadHistoryItem: (item: HistoryItem) => void;
  onGoToNewReview: () => void;
}

interface DisplayReviewItem extends HistoryItem {
  isPersisted?: boolean;
}

export const ReviewHistoryView: React.FC<ReviewHistoryViewProps> = ({
  onLoadHistoryItem,
  onGoToNewReview,
}) => {
  const { user, idToken } = useAuth();
  const [history, setHistory] = useState<DisplayReviewItem[]>(() => getReviewHistory());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'COMPLETED' | 'DEMO'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user || !idToken) {
      setHistory(getReviewHistory());
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const dbReviews = await fetchUserReviews(idToken);
      if (dbReviews && Array.isArray(dbReviews)) {
        if (dbReviews.length > 0) {
          const mapped: DisplayReviewItem[] = dbReviews.map((r) => ({
            id: r.id,
            title: r.title,
            content: '',
            channel: r.channel || undefined,
            timestamp: r.createdAt,
            findings: [],
            metrics: {
              totalFindings: r.totalFindings,
              supported: r.supportedCount,
              contradicted: r.contradictedCount,
              insufficientEvidence: 0,
              conflictingSources: 0,
              needsHumanReview: r.needsReviewCount,
              decisions: { accepted: 0, rejected: 0, needsReview: 0, pending: r.totalFindings },
              overallTrustScore: Math.round(r.overallTrustScore),
            },
            isDemo: r.executionMode === 'deterministic_rule_evaluation',
            executionMode: r.executionMode,
            isPersisted: true,
          }));
          setHistory(mapped);
        } else {
          setHistory([]);
        }
      } else {
        setHistory(getReviewHistory());
      }
    } catch {
      setErrorMessage('Could not load database reviews. Showing local session history.');
      setHistory(getReviewHistory());
    } finally {
      setIsLoading(false);
    }
  }, [user, idToken]);

  useEffect(() => {
    let ignore = false;
    if (!user || !idToken) {
      return;
    }

    fetchUserReviews(idToken)
      .then((dbReviews) => {
        if (ignore) return;
        if (dbReviews && Array.isArray(dbReviews)) {
          if (dbReviews.length > 0) {
            const mapped: DisplayReviewItem[] = dbReviews.map((r) => ({
              id: r.id,
              title: r.title,
              content: '',
              channel: r.channel || undefined,
              timestamp: r.createdAt,
              findings: [],
              metrics: {
                totalFindings: r.totalFindings,
                supported: r.supportedCount,
                contradicted: r.contradictedCount,
                insufficientEvidence: 0,
                conflictingSources: 0,
                needsHumanReview: r.needsReviewCount,
                decisions: { accepted: 0, rejected: 0, needsReview: 0, pending: r.totalFindings },
                overallTrustScore: Math.round(r.overallTrustScore),
              },
              isDemo: r.executionMode === 'deterministic_rule_evaluation',
              executionMode: r.executionMode,
              isPersisted: true,
            }));
            setHistory(mapped);
          } else {
            setHistory([]);
          }
        }
      })
      .catch(() => {
        // Silently preserve current history
      });

    return () => {
      ignore = true;
    };
  }, [user, idToken]);

  const handleSelectItem = async (item: DisplayReviewItem) => {
    if (item.isPersisted && idToken) {
      setLoadingReviewId(item.id);
      try {
        const detail = await fetchReviewDetail(item.id, idToken);
        if (detail) {
          const fullItem: HistoryItem = {
            id: detail.id || item.id,
            title: detail.draftTitle,
            content: detail.draftContent || item.content,
            channel: detail.channel || item.channel,
            timestamp: detail.analyzedAt || item.timestamp,
            findings: detail.findings || [],
            metrics: detail.metrics || item.metrics,
            isDemo: detail.isDemo,
            executionMode: detail.executionMode,
          };
          onLoadHistoryItem(fullItem);
          return;
        }
      } catch {
        // If fetch fails, load the summary item
      } finally {
        setLoadingReviewId(null);
      }
    }
    onLoadHistoryItem(item);
  };

  const handleDeleteItem = async (e: React.MouseEvent, item: DisplayReviewItem) => {
    e.stopPropagation();
    if (!window.confirm(`Delete review "${item.title}"?`)) return;

    if (item.isPersisted && idToken) {
      setIsDeletingId(item.id);
      try {
        const ok = await deleteUserReview(item.id, idToken);
        if (ok) {
          setHistory((prev) => prev.filter((h) => h.id !== item.id));
        } else {
          setErrorMessage('Failed to delete review from PostgreSQL database.');
        }
      } catch {
        setErrorMessage('Failed to delete review. Please check your connection.');
      } finally {
        setIsDeletingId(null);
      }
    } else {
      setHistory((prev) => prev.filter((h) => h.id !== item.id));
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear review history from your local session?')) {
      clearReviewHistory();
      setHistory([]);
    }
  };

  const filtered = history.filter((item) => {
    if (filterType === 'COMPLETED' && item.isDemo) return false;
    if (filterType === 'DEMO' && !item.isDemo) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.channel && item.channel.toLowerCase().includes(q)) ||
      (item.content && item.content.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative min-h-full pb-16">
      {/* Topographic line-art in top-right */}
      <TopographicCurves />

      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium shadow-2xs">
              {user ? (
                <>
                  <Database className="w-3.5 h-3.5 text-stone-700" />
                  <span>PostgreSQL Persistent History</span>
                </>
              ) : (
                <span>Past reviews</span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-sans">
              Review history
            </h1>

            <p className="text-sm text-stone-600">
              {user
                ? 'Your persistent audits stored securely in PostgreSQL with Firebase authorization.'
                : 'Your recent content reviews in this local session.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {user && (
              <button
                onClick={loadHistory}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 transition-colors shadow-2xs"
                title="Refresh history"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}

            {history.length > 0 && !user && (
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-rose-700 hover:bg-rose-50 border border-stone-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear history</span>
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-stone-200/90 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 shadow-xs transition-all"
            />
          </div>

          <div className="relative shrink-0 sm:w-40">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full appearance-none bg-white border border-stone-200/90 rounded-xl px-4 py-2.5 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 shadow-xs cursor-pointer"
            >
              <option value="ALL">All ({history.length})</option>
              <option value="COMPLETED">Completed</option>
              <option value="DEMO">Demo mode</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-stone-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading reviews from database...</span>
          </div>
        )}

        {/* Review History Items List */}
        {!isLoading && filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              {search ? 'No reviews match your search' : 'No review history yet'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {search
                ? 'Try different keywords or reset your filter.'
                : 'Audited drafts will appear here and persist in PostgreSQL so you can revisit them anytime.'}
            </p>
            <div className="pt-2">
              <button
                onClick={onGoToNewReview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Start a review</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          !isLoading && (
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs divide-y divide-stone-100 overflow-hidden">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="p-5 hover:bg-stone-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                      {loadingReviewId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-stone-900 truncate group-hover:text-black">
                        {item.title}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                        <span>
                          {new Date(item.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {item.channel && (
                          <>
                            <span>•</span>
                            <span className="truncate">{item.channel}</span>
                          </>
                        )}
                        {item.metrics?.overallTrustScore !== undefined && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-stone-700">
                              Trust: {item.metrics.overallTrustScore}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.isPersisted && (
                      <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                        <Database className="w-3 h-3 text-stone-400" />
                        <span>PostgreSQL</span>
                      </span>
                    )}

                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${
                        item.isDemo
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      }`}
                    >
                      {item.isDemo ? 'Demo mode' : 'Completed'}
                    </span>

                    {user && item.isPersisted && (
                      <button
                        onClick={(e) => handleDeleteItem(e, item)}
                        disabled={isDeletingId === item.id}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete review"
                      >
                        {isDeletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

