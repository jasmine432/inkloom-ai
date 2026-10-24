import React, { useState } from 'react';
import { Info, Sparkles, X } from 'lucide-react';

interface DemoDisclaimerProps {
  isLiveMode?: boolean;
  provider?: string;
}

export const DemoDisclaimer: React.FC<DemoDisclaimerProps> = ({
  isLiveMode = false,
  provider = 'gemini',
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  if (isLiveMode) {
    return (
      <aside
        aria-label="Live AI status notice"
        className="bg-emerald-50/90 border-b border-emerald-200/80 text-emerald-950 px-4 py-2 text-xs"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-emerald-900 m-0">
              <span className="font-semibold text-emerald-950">
                Live {provider.toUpperCase()} Integration:
              </span>{' '}
              Marketing claims are audited in real time against approved guidelines with verified source citations.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-emerald-700 hover:text-emerald-950 p-1 rounded hover:bg-emerald-100 shrink-0 transition-colors"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Demonstration mode notice"
      className="bg-slate-100 border-b border-slate-200 text-slate-800 px-4 py-2 text-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-slate-700 m-0">
            <span className="font-semibold text-slate-900">Demo Mode:</span> Claim evaluation is running deterministically against indexed brand guidelines. Configure your API key in <code className="px-1 py-0.5 rounded bg-slate-200 text-[11px] font-mono">backend/.env</code> for live Gemini auditing.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 shrink-0 transition-colors"
          aria-label="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
