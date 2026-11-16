import React from 'react';
import { ArrowLeft, Moon, Sparkles, Sun } from 'lucide-react';
import type { CodeGramTab } from '../types/codeforces';

interface TopBarProps {
  activeTab: CodeGramTab;
  isSignedIn: boolean;
  isDark: boolean;
  hasLinkedHandle?: boolean;
  onChangeTab: (tab: CodeGramTab) => void;
  onPrimaryAction: () => void;
  onToggleTheme: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  isSignedIn,
  isDark,
  hasLinkedHandle = true,
  onChangeTab,
  onPrimaryAction,
  onToggleTheme,
}) => {
  const isHome = activeTab === 'home';

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 dark:border-stone-800 bg-white/90 dark:bg-[#1B1917]/90 backdrop-blur-md">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {hasLinkedHandle && !isHome && (
            <button
              type="button"
              onClick={() => onChangeTab('home')}
              aria-label="Back to Home"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (hasLinkedHandle) onChangeTab('home');
            }}
            className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-sm"
          >
            CodeGram
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="p-2 rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {(hasLinkedHandle || !isSignedIn) && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121110]"
            >
              {hasLinkedHandle && isSignedIn && <Sparkles className="w-3.5 h-3.5" />}
              <span>{isSignedIn ? 'Practice Next' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
