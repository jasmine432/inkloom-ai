import React from 'react';
import {
  Home,
  FileCheck,
  BookOpen,
  History,
  Settings,
  X,
  Feather,
} from 'lucide-react';
import type { BackendHealth } from '../services/api';

export type NavTab = 'dashboard' | 'reviews' | 'results' | 'sources' | 'history' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  backendHealth?: BackendHealth | null;
  isLiveMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  backendHealth,
  isLiveMode = false,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'reviews' as NavTab,
      label: 'Review Content',
      icon: FileCheck,
    },
    {
      id: 'sources' as NavTab,
      label: 'Sources',
      icon: BookOpen,
    },
    {
      id: 'history' as NavTab,
      label: 'History',
      icon: History,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#faf9f5] border-r border-stone-200/80 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Top Logo */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-stone-200/40">
            <button
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-xs">
                <Feather className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-base font-bold text-stone-900 tracking-tight font-sans">
                Inkloom AI
              </span>
            </button>

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              // If currentTab is 'results', consider 'reviews' active
              const isActive =
                currentTab === item.id ||
                (currentTab === 'results' && item.id === 'reviews');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-stone-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom AI Provider Card matching reference Screen 1 */}
        <div className="p-4 m-4 rounded-xl bg-white border border-stone-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-stone-400 block">
            AI Provider
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-900">
              {backendHealth?.llmProvider ? backendHealth.llmProvider.charAt(0).toUpperCase() + backendHealth.llmProvider.slice(1) : 'Gemini'}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isLiveMode
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLiveMode ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {isLiveMode ? 'Connected' : 'Demo mode'}
            </span>
          </div>
          <span className="text-[10px] text-stone-400 font-mono block truncate">
            gemini-3.5-flash-lite
          </span>
        </div>
      </aside>
    </>
  );
};
