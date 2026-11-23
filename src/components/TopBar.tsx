import React from 'react';
import { Code2, Home, Moon, Sun, User, Users } from 'lucide-react';
import type { CodeGramTab } from '../types/codeforces';
import { WHATSAPP_COMMUNITY_URL } from '../services/communityService';
import { CodegramLogo } from './CodegramLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: CodeGramTab;
  isSignedIn: boolean;
  isDark: boolean;
  hasLinkedHandle?: boolean;
  onChangeTab: (tab: CodeGramTab) => void;
  onPrimaryAction: () => void;
  onToggleTheme: () => void;
}

const NAV_ITEMS: {
  key: CodeGramTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'community', label: 'Community', Icon: Users },
  { key: 'questions', label: 'Practice', Icon: Code2 },
  { key: 'stats', label: 'You', Icon: User },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  isSignedIn,
  isDark,
  hasLinkedHandle = true,
  onChangeTab,
  onPrimaryAction,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md">
      <div className="max-w-[1160px] mx-auto px-3.5 sm:px-6 h-13 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            if (hasLinkedHandle) onChangeTab('home');
          }}
          aria-label="Codegram Home"
          className="inline-flex items-center whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        >
          <CodegramLogo variant="inline" />
        </button>

        {/* Zone 2: High-Visibility Primary Navigation (Desktop) */}
        {hasLinkedHandle && (
          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800"
          >
            {NAV_ITEMS.map(({ key, label, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeTab(key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-[#0047CC] dark:bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Install, Theme Switch, WhatsApp Community & Sign In */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {hasLinkedHandle && (
            <a
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join WhatsApp Community"
              title="Join WhatsApp Community"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F17]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="w-3.5 h-3.5 shrink-0"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.78 14.08c-.24.68-1.42 1.3-1.95 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.93-4.37-.14-.19-1.18-1.57-1.18-3s.75-2.12 1.01-2.41c.26-.29.58-.36.77-.36h.55c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.58.17.29.75 1.23 1.6 1.99 1.1.98 2.02 1.29 2.31 1.43.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.17 1.37Z" />
              </svg>
              <span className="sm:hidden">WhatsApp</span>
              <span className="hidden sm:inline">Join WhatsApp</span>
            </a>
          )}

          {hasLinkedHandle && !isSignedIn && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F17]"
            >
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Clear 4-Tab Bar */}
      {hasLinkedHandle && (
        <nav
          aria-label="Mobile sections"
          className="md:hidden px-3 pb-2"
        >
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800">
            {NAV_ITEMS.map(({ key, label, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeTab(key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#0047CC] dark:bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};
