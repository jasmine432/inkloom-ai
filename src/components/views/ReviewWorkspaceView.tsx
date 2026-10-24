import React from 'react';
import type { Finding, FindingStatus, ReviewerDecision, ReviewMetrics } from '../../types';
import { SummaryCards } from '../SummaryCards';
import { DraftEditor } from '../DraftEditor';
import { FindingsList } from '../FindingsList';

interface ReviewWorkspaceViewProps {
  draftTitle: string;
  onDraftTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  channel: string;
  onChannelChange: (channel: string) => void;
  selectedDraftId: string;
  onSelectSampleDraft: (draftId: string) => void;
  findings: Finding[];
  metrics: ReviewMetrics;
  selectedFilter: FindingStatus | 'ALL';
  onSelectFilter: (filter: FindingStatus | 'ALL') => void;
  onDecisionChange: (findingId: string, decision: ReviewerDecision, notes?: string) => void;
  onBatchAcceptSupported: () => void;
  onRunReview: () => void;
  isReviewing: boolean;
  reviewStep: string;
  executionMode?: string;
  errorMessage?: string | null;
  onClearError?: () => void;
  hasAudited?: boolean;
}

export const ReviewWorkspaceView: React.FC<ReviewWorkspaceViewProps> = ({
  draftTitle,
  onDraftTitleChange,
  content,
  onContentChange,
  channel,
  onChannelChange,
  selectedDraftId,
  onSelectSampleDraft,
  findings,
  metrics,
  selectedFilter,
  onSelectFilter,
  onDecisionChange,
  onBatchAcceptSupported,
  onRunReview,
  isReviewing,
  reviewStep,
  executionMode,
  errorMessage,
  onClearError,
  hasAudited = true,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Findings Summary Pills (shown only when findings exist) */}
      {findings.length > 0 && (
        <SummaryCards
          metrics={metrics}
          selectedFilter={selectedFilter}
          onSelectFilter={onSelectFilter}
          totalFindings={findings.length}
        />
      )}

      {/* Main Responsive 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Editor (Hero interaction) */}
        <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-20 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 m-0">
              Draft Editor
            </h2>
            <span className="text-xs text-slate-500">
              Paste or type your content
            </span>
          </div>

          <DraftEditor
            draftTitle={draftTitle}
            onDraftTitleChange={onDraftTitleChange}
            content={content}
            onContentChange={onContentChange}
            channel={channel}
            onChannelChange={onChannelChange}
            onSelectSampleDraft={onSelectSampleDraft}
            selectedDraftId={selectedDraftId}
            onRunReview={onRunReview}
            isReviewing={isReviewing}
            reviewStep={reviewStep}
            errorMessage={errorMessage}
            onClearError={onClearError}
          />
        </div>

        {/* Right Column: Findings Panel */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 m-0">
                Audited Findings
              </h2>
              {findings.length > 0 && (
                <span className="text-xs bg-stone-100 text-stone-800 font-semibold px-2 py-0.5 rounded-full font-mono">
                  {findings.length} claims
                </span>
              )}
            </div>

            {executionMode && findings.length > 0 && (
              <span className="text-[11px] text-slate-500 font-medium">
                Mode: {executionMode.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <FindingsList
            findings={findings}
            selectedFilter={selectedFilter}
            onSelectFilter={onSelectFilter}
            onDecisionChange={onDecisionChange}
            onBatchAcceptSupported={onBatchAcceptSupported}
            hasAudited={hasAudited}
          />
        </div>
      </div>
    </div>
  );
};
