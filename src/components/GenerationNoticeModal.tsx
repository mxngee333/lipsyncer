import React, { useEffect } from 'react';
import { X, AlertTriangle, ShieldAlert, Zap, ArrowRight, RefreshCw, Wand2 } from 'lucide-react';

export interface NoticeModalState {
  isOpen: boolean;
  type: 'content_filter' | 'missing_input' | 'general_error' | 'info';
  title: string;
  message: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export interface GenerationNoticeModalProps {
  notice: NoticeModalState | null;
  onClose: () => void;
}

export const GenerationNoticeModal: React.FC<GenerationNoticeModalProps> = ({ notice, onClose }) => {
  const visible = Boolean(notice?.isOpen);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  if (!visible || !notice) return null;

  const isContentFilter = notice.type === 'content_filter';
  const isMissingInput = notice.type === 'missing_input';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#12121a] border border-white/12 shadow-[0_32px_90px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Accent Strip */}
        <div
          className={`h-1.5 w-full ${
            isContentFilter
              ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-violet-500'
              : isMissingInput
              ? 'bg-gradient-to-r from-amber-400 to-orange-500'
              : 'bg-gradient-to-r from-red-500 via-pink-500 to-indigo-500'
          }`}
        />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isContentFilter
                    ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                    : isMissingInput
                    ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                    : 'bg-red-500/15 border-red-500/35 text-red-300'
                }`}
              >
                {isContentFilter ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : isMissingInput ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  {notice.title}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isContentFilter
                    ? 'The model’s upstream safety filter flagged the prompt.'
                    : 'Action required before generating.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Diagnostic Message Box */}
          <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <span>Diagnostic Details</span>
              <span className="text-[10px] text-zinc-500">Auto-Detected</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed break-words font-mono">
              {notice.message}
            </p>
          </div>

          {/* Action Recommendations if Content Filter */}
          {isContentFilter && (
            <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/25 space-y-2 text-xs text-violet-200">
              <div className="flex items-center gap-2 font-semibold text-violet-300">
                <Wand2 className="w-4 h-4 text-violet-400" />
                <span>Recommended Solution:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-300 list-disc list-inside">
                <li>HappyHorse runs an automated NCII safety guard that flags certain anatomical keywords.</li>
                <li>We automatically sanitize prompts to verified-safe phrasing.</li>
                <li>You can also switch to <strong>Wan 2.7</strong> or <strong>LTX 2.5</strong> for unrestricted cinematic facial motion.</li>
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            {notice.secondaryActionLabel && notice.onSecondaryAction && (
              <button
                type="button"
                onClick={() => {
                  notice.onSecondaryAction?.();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 text-zinc-300 hover:text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{notice.secondaryActionLabel}</span>
              </button>
            )}

            {notice.primaryActionLabel && notice.onPrimaryAction ? (
              <button
                type="button"
                onClick={() => {
                  notice.onPrimaryAction?.();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{notice.primaryActionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 text-white font-bold text-xs transition cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
