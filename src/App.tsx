import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import type { NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/views/DashboardView';
import { ReviewContentView } from './components/views/ReviewContentView';
import { ReviewResultsView } from './components/views/ReviewResultsView';
import { ReviewHistoryView } from './components/views/ReviewHistoryView';
import { ApprovedSourcesView } from './components/views/ApprovedSourcesView';
import { SettingsView } from './components/views/SettingsView';
import { LoginView } from './components/auth/LoginView';
import { RegisterView } from './components/auth/RegisterView';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView';
import { ResetPasswordView } from './components/auth/ResetPasswordView';
import { VerifyEmailView } from './components/auth/VerifyEmailView';
import { ProfileView } from './components/auth/ProfileView';
import { useAuth } from './contexts/useAuth';
import { SAMPLE_DRAFTS } from './data/sampleDrafts';
import type { Finding, ReviewerDecision } from './types';
import { checkBackendHealth, submitDraftReview, updateFindingDecision } from './services/api';
import type { BackendHealth } from './services/api';
import { saveReviewToHistory } from './services/history';
import type { HistoryItem } from './services/history';
import { Feather, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { ChatLauncher } from './components/chat/ChatLauncher';
import { ChatPanel } from './components/chat/ChatPanel';

export const App: React.FC = () => {
  const { user, loading: authLoading, getIdToken } = useAuth();

  // URL Path Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    if (mode === 'verifyEmail') {
      return '/verify-email';
    }
    if (mode === 'resetPassword') {
      return '/reset-password';
    }
    const path = window.location.pathname;
    return path && path !== '/' ? path : '/dashboard';
  });

  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    const raw = (window.location.pathname || '').replace(/^\//, '');
    const validTabs: NavTab[] = ['dashboard', 'reviews', 'results', 'sources', 'history', 'settings'];
    return validTabs.includes(raw as NavTab) ? (raw as NavTab) : 'dashboard';
  });

  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Active Draft & Findings State (pre-populated with default sample draft for immediate exploration)
  const [selectedDraftId, setSelectedDraftId] = useState<string>(SAMPLE_DRAFTS[0].id);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>(SAMPLE_DRAFTS[0].title);
  const [content, setContent] = useState<string>(SAMPLE_DRAFTS[0].content);
  const [contentType, setContentType] = useState<string>(SAMPLE_DRAFTS[0].channel || 'General content');
  const [findings, setFindings] = useState<Finding[]>(
    JSON.parse(JSON.stringify(SAMPLE_DRAFTS[0].findings))
  );

  const [isChatOpen, setIsChatOpen] = useState(false);

  // Review & Error States
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewStep, setReviewStep] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Synchronize browser history and internal router
  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    const clean = path.replace(/^\//, '');
    const validTabs: NavTab[] = ['dashboard', 'reviews', 'results', 'sources', 'history', 'settings'];
    if (validTabs.includes(clean as NavTab)) {
      setCurrentTab(clean as NavTab);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/dashboard';
      setCurrentPath(path);
      const clean = path.replace(/^\//, '');
      const validTabs: NavTab[] = ['dashboard', 'reviews', 'results', 'sources', 'history', 'settings'];
      if (validTabs.includes(clean as NavTab)) {
        setCurrentTab(clean as NavTab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check backend health on initial load
  useEffect(() => {
    checkBackendHealth().then((health) => {
      if (health && health.status === 'ok') {
        setBackendHealth(health);
        setIsLiveMode(Boolean(health.isLlmConfigured));
      }
    });
  }, []);

  // Handle sample draft selection
  const handleSelectSampleDraft = (draftId: string) => {
    const draft = SAMPLE_DRAFTS.find((d) => d.id === draftId);
    if (!draft) return;
    setSelectedDraftId(draft.id);
    setActiveReviewId(null);
    setDraftTitle(draft.title);
    setContent(draft.content);
    setContentType(draft.channel || 'General content');
    setFindings(JSON.parse(JSON.stringify(draft.findings)));
    setReviewError(null);
  };

  // Run review against FastAPI backend, passing verified auth token if authenticated
  const handleRunReview = async () => {
    setIsReviewing(true);
    setReviewError(null);
    setReviewStep('Extracting claims and cross-referencing approved guidelines...');

    try {
      const token = await getIdToken();
      const apiResult = await submitDraftReview(
        {
          title: draftTitle?.trim() || 'Untitled Draft',
          content: content.trim(),
          channel: contentType,
        },
        token
      );

      if (apiResult && apiResult.findings) {
        setFindings(apiResult.findings);
        setIsLiveMode(!apiResult.isDemo);
        if (apiResult.id) {
          setActiveReviewId(apiResult.id);
        }

        // Save review to local session history
        saveReviewToHistory({
          id: apiResult.id,
          title: draftTitle?.trim() || 'Untitled Draft',
          content: content.trim(),
          channel: contentType,
          findings: apiResult.findings,
          metrics: apiResult.metrics,
          isDemo: apiResult.isDemo,
          executionMode: apiResult.executionMode,
        });

        // Automatically navigate to Review Results view (Screen 3)
        setCurrentTab('results');
        navigate('/results');
      } else {
        setReviewError(
          'Could not complete review with backend server. Your draft has been preserved.'
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while reviewing. Your draft content is intact.';
      setReviewError(message);
    } finally {
      setIsReviewing(false);
      setReviewStep('');
    }
  };

  // Human Reviewer Controls: Accept, Reject, Needs Review
  const handleDecisionChange = (
    findingId: string,
    decision: ReviewerDecision,
    notes?: string
  ) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingId
          ? {
              ...f,
              reviewerDecision: decision,
              reviewerNotes: notes !== undefined ? notes : f.reviewerNotes,
            }
          : f
      )
    );

    // If review is persisted in PostgreSQL and user is authenticated, persist decision
    if (activeReviewId && user) {
      getIdToken().then((token) => {
        if (token) {
          updateFindingDecision(activeReviewId, findingId, decision, notes, token);
        }
      });
    }
  };

  // Load a past audit from Review History
  const handleLoadHistoryItem = (item: HistoryItem) => {
    setDraftTitle(item.title);
    setContent(item.content);
    if (item.channel) setContentType(item.channel);
    setActiveReviewId(
      item.id && !item.id.startsWith('sample-') && !item.id.startsWith('hist-')
        ? item.id
        : null
    );
    if (item.findings && item.findings.length > 0) {
      setFindings(JSON.parse(JSON.stringify(item.findings)));
      setCurrentTab('results');
      navigate('/results');
    } else {
      setCurrentTab('reviews');
      navigate('/reviews');
    }
    setReviewError(null);
  };

  // 1. Initial auth loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] font-sans text-stone-800 py-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center mx-auto shadow-xs">
            <Feather className="w-6 h-6 stroke-[2.2] animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-stone-900">Inkloom AI</p>
          <div className="flex items-center gap-2 text-xs text-stone-500 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Initializing session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Standalone Auth Pages
  if (currentPath === '/login') {
    return <LoginView onNavigate={navigate} />;
  }

  if (currentPath === '/register') {
    return <RegisterView onNavigate={navigate} />;
  }

  if (currentPath === '/forgot-password') {
    return <ForgotPasswordView onNavigate={navigate} />;
  }

  if (currentPath === '/reset-password') {
    return <ResetPasswordView onNavigate={navigate} />;
  }

  if (currentPath === '/verify-email') {
    return <VerifyEmailView onNavigate={navigate} />;
  }

  // Protected route guard: /profile requires authentication
  if (currentPath === '/profile' && !user) {
    return <LoginView onNavigate={navigate} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F5F0] font-sans text-[#211F1B]">
      {/* 1. Left Sidebar Navigation matching all 6 screens */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          navigate('/' + tab);
        }}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        backendHealth={backendHealth}
        isLiveMode={isLiveMode}
      />

      {/* 2. Main Content View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          backendHealth={backendHealth}
          isLiveMode={isLiveMode}
          onNavigate={navigate}
        />

        {/* Unverified Email Warning Banner */}
        {user && !user.emailVerified && currentPath !== '/profile' && (
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900 sticky top-16 z-10 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Email verification pending:</strong> Please verify your email address to unlock verified review access.
              </span>
            </div>
            <button
              onClick={() => navigate('/verify-email')}
              className="font-bold underline hover:text-amber-950 inline-flex items-center gap-1 shrink-0 ml-4"
            >
              <span>Verify now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Tab Views matching reference screens */}
        <main className="flex-1">
          {/* Account Profile Page (/profile) */}
          {currentPath === '/profile' && (
            <ProfileView onNavigate={navigate} />
          )}

          {/* Screen 1: Dashboard */}
          {currentPath !== '/profile' && currentTab === 'dashboard' && (
            <DashboardView
              onGoToReviews={(draftId) => {
                if (draftId) handleSelectSampleDraft(draftId);
                setCurrentTab('reviews');
                navigate('/reviews');
              }}
              onGoToHistory={() => {
                setCurrentTab('history');
                navigate('/history');
              }}
              onLoadHistoryItem={handleLoadHistoryItem}
            />
          )}

          {/* Screen 2: Review Content */}
          {currentPath !== '/profile' && currentTab === 'reviews' && (
            <ReviewContentView
              draftTitle={draftTitle}
              onDraftTitleChange={setDraftTitle}
              content={content}
              onContentChange={setContent}
              contentType={contentType}
              onContentTypeChange={setContentType}
              selectedDraftId={selectedDraftId}
              onSelectSampleDraft={handleSelectSampleDraft}
              onRunReview={handleRunReview}
              isReviewing={isReviewing}
              reviewStep={reviewStep}
              errorMessage={reviewError}
              onClearError={() => setReviewError(null)}
            />
          )}

          {/* Screen 3: Review Results */}
          {currentPath !== '/profile' && currentTab === 'results' && (
            <ReviewResultsView
              findings={findings}
              onDecisionChange={handleDecisionChange}
              onEditDraft={() => {
                setCurrentTab('reviews');
                navigate('/reviews');
              }}
              onOpenAssistant={() => setIsChatOpen(true)}
              isLiveMode={isLiveMode}
              providerName={
                backendHealth?.llmProvider
                  ? backendHealth.llmProvider.charAt(0).toUpperCase() +
                    backendHealth.llmProvider.slice(1)
                  : 'Gemini'
              }
              sourcesCount={backendHealth?.sourcesCount || 4}
            />
          )}

          {/* Screen 4: Trusted Sources */}
          {currentPath !== '/profile' && currentTab === 'sources' && <ApprovedSourcesView />}

          {/* Screen 5: Review History */}
          {currentPath !== '/profile' && currentTab === 'history' && (
            <ReviewHistoryView
              onLoadHistoryItem={handleLoadHistoryItem}
              onGoToNewReview={() => {
                setCurrentTab('reviews');
                navigate('/reviews');
              }}
            />
          )}

          {/* Screen 6: Settings */}
          {currentPath !== '/profile' && currentTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Floating Inkloom AI Assistant Launcher & Panel */}
      <ChatLauncher
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        hasActiveAudit={Boolean(activeReviewId)}
      />

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        auditId={activeReviewId}
        auditTitle={draftTitle}
        isLiveLlm={isLiveMode}
      />
    </div>
  );
};

export default App;
