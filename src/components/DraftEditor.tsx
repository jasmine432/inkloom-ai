import React, { useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Type,
  Clock,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { SAMPLE_DRAFTS } from '../data/sampleDrafts';

interface DraftEditorProps {
  draftTitle: string;
  onDraftTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  channel: string;
  onChannelChange: (channel: string) => void;
  onSelectSampleDraft: (draftId: string) => void;
  selectedDraftId: string;
  onRunReview: () => void;
  isReviewing: boolean;
  reviewStep: string;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const DraftEditor: React.FC<DraftEditorProps> = ({
  draftTitle,
  onDraftTitleChange,
  content,
  onContentChange,
  channel,
  onChannelChange,
  onSelectSampleDraft,
  selectedDraftId,
  onRunReview,
  isReviewing,
  reviewStep,
  errorMessage,
  onClearError,
}) => {
  const [copied, setCopied] = useState(false);
  const [showChannelSelect, setShowChannelSelect] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Compute metrics
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 225));

  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Clear current draft content and start fresh?')) {
      onContentChange('');
      onDraftTitleChange('');
      setValidationError(null);
      if (onClearError) onClearError();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearError) onClearError();

    if (!draftTitle.trim()) {
      setValidationError('Please enter a document title before reviewing.');
      return;
    }
    if (!content.trim()) {
      setValidationError('Please enter or paste your marketing copy before reviewing.');
      return;
    }

    setValidationError(null);
    onRunReview();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden"
    >
      {/* Editor Top Bar: Title & Sample Draft Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Document Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => {
                onDraftTitleChange(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Q4 Cloud Platform Announcement"
              disabled={isReviewing}
              className="w-full text-base sm:text-lg font-bold text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all"
            />
          </div>

          {/* Quick Sample Selector */}
          <div className="flex items-center gap-2 self-start sm:self-end shrink-0">
            <span className="text-xs text-slate-400 hidden sm:inline">Sample:</span>
            <select
              value={selectedDraftId}
              onChange={(e) => onSelectSampleDraft(e.target.value)}
              disabled={isReviewing}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              title="Load a sample draft to test"
            >
              <option value="" disabled>Load Sample Draft...</option>
              {SAMPLE_DRAFTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title.length > 28 ? d.title.slice(0, 28) + '...' : d.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional Channel Row (collapsible/expandable for simplicity) */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowChannelSelect(!showChannelSelect)}
              className="text-stone-900 hover:text-black font-medium inline-flex items-center gap-1"
            >
              <span>Channel: {channel || 'General Marketing'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showChannelSelect ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyContent}
              disabled={!content}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded text-xs transition-colors disabled:opacity-40"
              title="Copy text to clipboard"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!content || isReviewing}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded text-xs transition-colors disabled:opacity-40"
              title="Clear editor"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded Channel Selection */}
        {showChannelSelect && (
          <div className="pt-2 flex flex-wrap gap-1.5">
            {[
              'General Marketing',
              'Product Announcement',
              'Press Release',
              'Landing Page Copy',
              'Social Media Ad',
              'Executive Whitepaper',
            ].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  onChannelChange(ch);
                  setShowChannelSelect(false);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  channel === ch
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline Validation / Backend Error Alert */}
      {(validationError || errorMessage) && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{validationError || errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setValidationError(null);
              if (onClearError) onClearError();
            }}
            className="text-rose-600 hover:text-rose-800 font-semibold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Text Editor Area */}
      <div className="flex-1 relative flex flex-col p-4 sm:p-5 min-h-[380px] lg:min-h-[460px]">
        <textarea
          value={content}
          onChange={(e) => {
            onContentChange(e.target.value);
            if (validationError) setValidationError(null);
          }}
          disabled={isReviewing}
          placeholder="Paste or type your draft here (marketing copy, website text, product announcements, or blog articles)...&#10;&#10;Inkloom AI will extract factual claims, numerical figures, and guarantees, comparing each statement against your certified brand guidelines and legal covenants."
          className="w-full flex-1 resize-none text-slate-800 text-base leading-relaxed placeholder:text-slate-400 focus:outline-none bg-transparent"
          style={{ lineHeight: '1.75' }}
        />

        {/* Loading Overlay */}
        {isReviewing && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-20">
            <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-300 text-stone-900 flex items-center justify-center mb-3 shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-stone-900" />
            </div>
            <h4 className="text-base font-bold text-slate-900 tracking-tight">
              Verifying Draft Claims...
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              {reviewStep || 'Auditing claims against approved brand guidelines...'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Bar: Metrics & Main Submit Action */}
      <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Word / Char counts */}
        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono-code">
          <div className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-slate-400" />
            <span>
              <strong className="text-slate-800">{wordCount}</strong> words
            </span>
          </div>
          <span>•</span>
          <div>
            <strong className="text-slate-800">{charCount}</strong> chars
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>~{readingTimeMinutes} min read</span>
          </div>
        </div>

        {/* Primary Review Button */}
        <button
          type="submit"
          disabled={isReviewing || !content.trim()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-stone-900 hover:bg-black shadow-sm active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
        >
          {isReviewing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Claims...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Review Content</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
