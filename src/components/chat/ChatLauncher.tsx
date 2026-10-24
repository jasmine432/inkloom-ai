import React from 'react';
import { Feather, Sparkles, X } from 'lucide-react';

interface ChatLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  hasActiveAudit?: boolean;
}

export const ChatLauncher: React.FC<ChatLauncherProps> = ({
  isOpen,
  onToggle,
  hasActiveAudit = false,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isOpen ? 'Close Inkloom AI Assistant' : 'Open Inkloom AI Assistant'}
      className={`fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 px-4 py-3 rounded-full shadow-xl transition-all duration-200 cursor-pointer ${
        isOpen
          ? 'bg-stone-800 hover:bg-stone-900 text-white ring-2 ring-stone-900/10'
          : 'bg-stone-900 hover:bg-black text-white hover:scale-105 active:scale-95'
      }`}
    >
      <div className="relative">
        {isOpen ? (
          <X className="w-4 h-4" />
        ) : (
          <Feather className="w-4 h-4" />
        )}
        {!isOpen && hasActiveAudit && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-stone-900 animate-pulse" />
        )}
      </div>

      <span className="text-xs font-bold tracking-tight">
        {isOpen ? 'Close Assistant' : 'Inkloom Assistant'}
      </span>

      {!isOpen && (
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold text-stone-200">
          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
          <span>AI</span>
        </span>
      )}
    </button>
  );
};
