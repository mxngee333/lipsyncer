import React, { useEffect } from 'react';
import { X, AlertTriangle, Zap, KeyRound, ShieldCheck } from 'lucide-react';
import { getTokenPoolStatus } from '../services/tokenPoolService';

export interface QuotaInterceptorModalProps {
  isOpen?: boolean;
  errorMessage: string | null;
  modelName?: string;
  onClose: () => void;
  onRunInstantDsp: () => void;
  onOpenTokenPool: () => void;
}

export const QuotaInterceptorModal: React.FC<QuotaInterceptorModalProps> = ({
  isOpen,
  errorMessage,
  modelName,
  onClose,
  onRunInstantDsp,
  onOpenTokenPool
}) => {
  const visible = isOpen !== undefined ? isOpen : Boolean(errorMessage);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const poolStatuses = getTokenPoolStatus();
  const readyAccounts = poolStatuses.filter((t) => !t.isExhausted).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#13131b] border border-amber-500/30 shadow-[0_32px_90px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Warning Gradient Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400" />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Upstream ZeroGPU Compute Wall Intercepted
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {modelName
                    ? `${modelName} hit a temporary Hugging Face ZeroGPU rate limit.`
                    : 'Hugging Face ZeroGPU returned a temporary compute quota pause.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close quota interceptor"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Intercepted Upstream Error Box */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              <span>Intercepted Upstream Diagnostic</span>
              <span className="text-zinc-400">
                Pool: {readyAccounts}/{poolStatuses.length} Ready
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-300 break-words leading-relaxed">
              {errorMessage ||
                'ZeroGPU daily compute duration temporarily saturated on upstream Hugging Face Space.'}
            </p>
          </div>

          {/* Explanation Pill */}
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Your portrait, video, lyrics, and audio slice are 100% preserved. Choose an instant
              zero-wait path below:
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-1">
            {/* Primary 1-Click Fix Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onRunInstantDsp();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-extrabold text-xs sm:text-sm shadow-[0_12px_32px_rgba(16,185,129,0.28)] transition flex items-center justify-center gap-2 text-center cursor-pointer"
            >
              <Zap className="w-4 h-4 shrink-0 fill-current" />
              <span>
                ⚡ Instant 1-Click Fix: Render Now with LipSyncer 60fps DSP Engine (0 Quota)
              </span>
            </button>

            {/* Secondary Token Pool Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTokenPool();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-[#1d1d28] hover:bg-[#252534] border border-white/12 text-zinc-100 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 text-center cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                🔑 Manage {poolStatuses.length}-Account Hugging Face Token Pool / Reset Cooldowns
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaInterceptorModal;
