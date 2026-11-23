import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'Something went wrong.';
    try {
      const parsed = JSON.parse(message) as { error?: string };
      if (parsed && typeof parsed.error === 'string') {
        message = parsed.error;
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0F17] p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4">
            <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Display Error
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] text-white hover:bg-[#0039A6]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
