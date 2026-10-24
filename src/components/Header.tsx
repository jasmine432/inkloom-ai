import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User as UserIcon, ShieldCheck, ShieldAlert, LogIn } from 'lucide-react';
import type { NavTab } from './Sidebar';
import type { BackendHealth } from '../services/api';
import { useAuth } from '../contexts/useAuth';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileMenu: () => void;
  backendHealth?: BackendHealth | null;
  isLiveMode?: boolean;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  backendHealth,
  isLiveMode = false,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await logout();
    if (onNavigate) onNavigate('/login');
  };

  const initials = user
    ? user.displayName
      ? user.displayName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : user.email
      ? user.email.slice(0, 2).toUpperCase()
      : 'U'
    : null;

  return (
    <header className="h-16 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-20 bg-[#faf9f5]/90 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
          aria-label="Open sidebar navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* On Results tab, show live status if active */}
        {currentTab === 'results' && (
          <div className="hidden sm:flex items-center gap-2 text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isLiveMode
                  ? 'bg-stone-900 text-white'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveMode ? 'bg-emerald-400' : 'bg-amber-500'
                }`}
              />
              <span>
                {isLiveMode
                  ? `Live review (${
                      backendHealth?.llmProvider
                        ? backendHealth.llmProvider.charAt(0).toUpperCase() +
                          backendHealth.llmProvider.slice(1)
                        : 'Gemini'
                    })`
                  : 'Demo evaluation'}
              </span>
            </span>
          </div>
        )}

        {/* User Account / Auth Dropdown */}
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              aria-label="User account menu"
              aria-expanded={dropdownOpen}
            >
              <div
                className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shadow-xs"
                title={user.email || 'User Account'}
              >
                {initials}
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#FAF9F5] border border-stone-200/90 rounded-2xl shadow-lg py-2 z-50 text-xs">
                <div className="px-4 py-3 border-b border-stone-200/80">
                  <p className="font-bold text-stone-900 truncate">
                    {user.displayName || 'Inkloom AI User'}
                  </p>
                  <p className="text-stone-500 text-[11px] truncate mt-0.5">{user.email}</p>
                  <div className="mt-2">
                    {user.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified Account</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          if (onNavigate) onNavigate('/verify-email');
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 transition-colors"
                      >
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>Unverified — Verify now</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onNavigate) onNavigate('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-stone-700 hover:bg-stone-200/50 flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-stone-500" />
                    <span>Account Profile</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-stone-200/80">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onNavigate && onNavigate('/login')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
