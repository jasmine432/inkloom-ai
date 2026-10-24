import React from 'react';
import {
  ShieldCheck,
  Lightbulb,
  FileCheck,
  ArrowRight,
  FileText,
  Sparkles,
} from 'lucide-react';
import workspaceImg from '../../assets/dashboard_workspace.jpg';
import { TopographicCurves } from '../TopographicCurves';
import { getReviewHistory } from '../../services/history';
import type { HistoryItem } from '../../services/history';

interface DashboardViewProps {
  onGoToReviews: (draftId?: string) => void;
  onGoToHistory: () => void;
  onLoadHistoryItem?: (item: HistoryItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onGoToReviews,
  onGoToHistory,
  onLoadHistoryItem,
}) => {
  const history = getReviewHistory();

  return (
    <div className="relative min-h-full pb-16">
      {/* Topographic line-art in top-right */}
      <TopographicCurves />

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-6 sm:py-8 space-y-10 relative z-10">
        {/* 1. Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium shadow-2xs">
              <span>Welcome to Inkloom AI</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 tracking-tight leading-[1.15] font-sans">
              Better Content. <br />
              <span className="font-editorial italic font-normal text-stone-800">
                Trusted by Facts.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-stone-600 max-w-lg leading-relaxed">
              Review your content against trusted company sources and get clear, actionable suggestions.
            </p>

            <div className="pt-2">
              <button
                onClick={() => onGoToReviews()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-sm shadow-sm transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
              >
                <span>Review content</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Hero Visual with Speech Pill & Desk Still Life */}
          <div className="lg:col-span-5 relative flex flex-col items-center sm:items-end">
            {/* Speech bubble thought pill */}
            <div className="mb-3 px-4 py-2 rounded-2xl bg-white/95 border border-stone-200 shadow-sm text-xs font-editorial italic text-stone-800 self-start sm:self-center flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-stone-600" />
              <span>Turn ideas into accurate content</span>
            </div>

            {/* Aesthetic Plant & Workspace Photo */}
            <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-stone-200/90 shadow-sm bg-white aspect-4/3 relative">
              <img
                src={workspaceImg}
                alt="Minimalist workspace desk with potted plant and coffee mug"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 2. Three Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {/* Card 1: Check claims */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-3 transition-all hover:border-stone-300">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Check claims</h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Verify information against trusted sources
              </p>
            </div>
          </div>

          {/* Card 2: Get suggestions */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-3 transition-all hover:border-stone-300">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Get suggestions</h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Receive clear, actionable fixes
              </p>
            </div>
          </div>

          {/* Card 3: Publish with confidence */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-3 transition-all hover:border-stone-300">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center">
              <FileCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Publish with confidence</h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Ensure consistent and accurate content
              </p>
            </div>
          </div>
        </div>

        {/* 3. Recent Reviews Section */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900 m-0">Recent reviews</h2>
            <button
              onClick={onGoToHistory}
              className="text-xs font-semibold text-stone-600 hover:text-stone-950 inline-flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {history.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (onLoadHistoryItem) {
                    onLoadHistoryItem(item);
                  } else {
                    onGoToReviews();
                  }
                }}
                className="p-5 hover:bg-stone-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-stone-900 truncate">
                      {item.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-stone-400 hidden sm:inline">
                    {new Date(item.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${
                      item.isDemo
                        ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    }`}
                  >
                    {item.isDemo ? 'Demo mode' : 'Completed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
