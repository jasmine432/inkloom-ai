import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Lightbulb,
  Compass,
  ChevronDown,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { SAMPLE_DRAFTS } from '../../data/sampleDrafts';
import { TopographicCurves } from '../TopographicCurves';

interface ReviewContentViewProps {
  draftTitle: string;
  onDraftTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  contentType: string;
  onContentTypeChange: (type: string) => void;
  selectedDraftId: string;
  onSelectSampleDraft: (draftId: string) => void;
  onRunReview: () => void;
  isReviewing: boolean;
  reviewStep: string;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const ReviewContentView: React.FC<ReviewContentViewProps> = ({
  draftTitle,
  onDraftTitleChange,
  content,
  onContentChange,
  contentType,
  onContentTypeChange,
  selectedDraftId,
  onSelectSampleDraft,
  onRunReview,
  isReviewing,
  reviewStep,
  errorMessage,
  onClearError,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);

  const charCount = content.length;
  const maxChars = 50000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearError) onClearError();

    if (!content.trim()) {
      setValidationError('Please paste or type your draft content before submitting.');
      return;
    }

    setValidationError(null);
    onRunReview();
  };

  const handleClear = () => {
    if (window.confirm('Clear all draft content from the editor?')) {
      onContentChange('');
      onDraftTitleChange('');
      setValidationError(null);
      if (onClearError) onClearError();
    }
  };

  return (
    <div className="relative min-h-full pb-16">
      {/* Topographic line-art in top-right */}
      <TopographicCurves />

      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-8 relative z-10">
        {/* Header Section */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium shadow-2xs">
            <span>Create better content</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-sans">
            Review your content
          </h1>

          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
            Paste or type your content below. We&apos;ll check it against your trusted sources and suggest improvements.
          </p>
        </div>

        {/* Validation or Backend Error Alert */}
        {(validationError || errorMessage) && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError || errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setValidationError(null);
                if (onClearError) onClearError();
              }}
              className="text-rose-700 hover:text-rose-900 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Review Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Title Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-700">
                Title (optional)
              </label>
              {/* Quick sample loader link */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-400">Load sample:</span>
                <select
                  value={selectedDraftId}
                  onChange={(e) => onSelectSampleDraft(e.target.value)}
                  disabled={isReviewing}
                  className="text-xs bg-white border border-stone-200 rounded-lg px-2 py-1 text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-900"
                >
                  <option value="" disabled>Choose sample draft...</option>
                  {SAMPLE_DRAFTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => onDraftTitleChange(e.target.value)}
              placeholder="e.g. Product announcement"
              disabled={isReviewing}
              className="w-full bg-white border border-stone-200/90 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all shadow-xs"
            />
          </div>

          {/* 2. Content Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-700">
                Content
              </label>
              {content && !isReviewing && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-stone-400 hover:text-rose-600 inline-flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear text</span>
                </button>
              )}
            </div>

            <div className="relative bg-white rounded-2xl border border-stone-200/90 shadow-xs focus-within:border-stone-900 focus-within:ring-2 focus-within:ring-stone-900/10 transition-all">
              <textarea
                value={content}
                onChange={(e) => {
                  onContentChange(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isReviewing}
                placeholder="Paste or type your content here..."
                rows={10}
                className="w-full p-4 sm:p-5 text-sm sm:text-base text-stone-900 placeholder:text-stone-400 focus:outline-none resize-none bg-transparent leading-relaxed"
              />
              <div className="p-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                <span>{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
                <span>
                  {charCount.toLocaleString()}/{maxChars.toLocaleString()} characters
                </span>
              </div>
            </div>
          </div>

          {/* 3. Content Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700">
              Content type (optional)
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                <Compass className="w-4 h-4" />
              </div>
              <select
                value={contentType}
                onChange={(e) => onContentTypeChange(e.target.value)}
                disabled={isReviewing}
                className="w-full appearance-none bg-white border border-stone-200/90 rounded-xl pl-10 pr-10 py-3 text-sm text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 shadow-xs transition-all"
              >
                <option value="General content">General content</option>
                <option value="Product launch announcement">Product launch announcement</option>
                <option value="Press release">Press release</option>
                <option value="Social media post">Social media post</option>
                <option value="Email campaign">Email campaign</option>
                <option value="Blog article">Blog article</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Helps provide more relevant suggestions.
            </p>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={isReviewing || !content.trim()}
              className="w-full sm:w-auto min-w-[240px] inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-sm shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
            >
              {isReviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{reviewStep || 'Reviewing content...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Review content</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* 4. Tips Card matching reference */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-stone-900">
            <Lightbulb className="w-4 h-4 text-stone-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 m-0">
              Tips
            </h3>
          </div>
          <ul className="space-y-1.5 text-xs text-stone-600 pl-5 list-disc leading-relaxed">
            <li>Include key details for better suggestions</li>
            <li>Use your actual draft or existing content</li>
            <li>You can review blog posts, emails, social media, and more</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
