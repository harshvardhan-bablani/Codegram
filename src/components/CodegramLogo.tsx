import React from 'react';

interface CodegramLogoProps {
  variant?: 'inline' | 'stacked';
  showTagline?: boolean;
  className?: string;
}

export const CodegramMark: React.FC<{ className?: string }> = ({ className = 'w-11 h-10' }) => (
  <svg
    viewBox="0 0 120 104"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    {/* Tricolor vertical bars in the top bracket opening */}
    <rect x="42" y="16" width="9" height="22" rx="3" fill="#FACC15" />
    <rect x="55.5" y="6" width="9" height="32" rx="3" className="fill-[#0047CC] dark:fill-blue-500" />
    <rect x="69" y="13" width="9" height="25" rx="3" fill="#DC2626" />

    {/* Left bracket [ */}
    <path
      d="M34 26H22C15.3726 26 10 31.3726 10 38V80C10 86.6274 15.3726 92 22 92H34"
      stroke="currentColor"
      strokeWidth="8.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Right bracket ] */}
    <path
      d="M86 26H98C104.627 26 110 31.3726 110 38V80C110 86.6274 104.627 92 98 92H86"
      stroke="currentColor"
      strokeWidth="8.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Center </> code glyphs */}
    <path
      d="M44 49L31 59L44 69"
      stroke="currentColor"
      strokeWidth="7.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M76 49L89 59L76 69"
      stroke="currentColor"
      strokeWidth="7.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M65 44L55 74"
      stroke="currentColor"
      strokeWidth="7.5"
      strokeLinecap="round"
    />
  </svg>
);

export const CodegramLogo: React.FC<CodegramLogoProps> = ({
  variant = 'inline',
  showTagline = false,
  className = '',
}) => {
  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        <CodegramMark className="w-24 h-20 sm:w-28 sm:h-24 text-slate-900 dark:text-slate-50 transition-colors" />
        <div className="mt-2 font-display text-4xl sm:text-[42px] font-extrabold tracking-tight leading-none">
          <span className="text-slate-900 dark:text-slate-50">Code</span>
          <span className="text-[#0047CC] dark:text-blue-400">gram</span>
        </div>
        {showTagline && (
          <div className="mt-3 flex items-center gap-3 text-xs font-medium tracking-wider text-slate-500 dark:text-slate-400">
            <span className="h-px w-8 bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
            <span>Competitive Programming</span>
            <span className="h-px w-8 bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
      <CodegramMark className="w-9 h-8 sm:w-11 sm:h-10 text-slate-900 dark:text-slate-50 shrink-0 transition-colors" />
      <span className="font-display text-[21px] sm:text-[25px] font-extrabold tracking-tight leading-none">
        <span className="text-slate-900 dark:text-slate-50">Code</span>
        <span className="text-[#0047CC] dark:text-blue-400">gram</span>
      </span>
    </span>
  );
};
