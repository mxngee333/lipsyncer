import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Plus,
  Replace,
  Search,
  Server,
  Activity,
  ShieldCheck,
  Clock,
  Zap,
  Loader2
} from 'lucide-react';
import { TokenPoolEntryStatus } from '../types';
import {
  getHfTokenPool,
  setHfTokenPool,
  appendTokensToPool,
  removeTokenFromPool,
  resetAllCooldowns,
  resetTokenCooldown,
  getTokenPoolStatus,
  getRelayEndpoint,
  setRelayEndpoint,
  isRelayEnabled,
  setRelayEnabled,
  testRelayHealth,
  RelayHealthResult
} from '../services/tokenPoolService';

export interface HfTokenPoolModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onPoolUpdated?: () => void;
}

type PoolFilterTab = 'all' | 'ready' | 'resting';

function formatRemainingTime(cooldownUntil?: number): string {
  if (!cooldownUntil) return 'Ready';
  const diffMs = Math.max(0, cooldownUntil - Date.now());
  if (diffMs <= 0) return 'Ready';
  const totalSec = Math.ceil(diffMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export const HfTokenPoolModal: React.FC<HfTokenPoolModalProps> = ({
  isOpen = true,
  onClose,
  onPoolUpdated
}) => {
  const [statuses, setStatuses] = useState<TokenPoolEntryStatus[]>(() => getTokenPoolStatus());
  const [batchInput, setBatchInput] = useState<string>('');
  const [filterTab, setFilterTab] = useState<PoolFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const [relayActive, setRelayActive] = useState<boolean>(() => isRelayEnabled());
  const [relayUrl, setRelayUrl] = useState<string>(() => getRelayEndpoint());
  const [isTestingRelay, setIsTestingRelay] = useState<boolean>(false);
  const [relayHealth, setRelayHealth] = useState<RelayHealthResult | null>(null);

  const refreshPoolState = () => {
    setStatuses(getTokenPoolStatus());
    onPoolUpdated?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    setStatuses(getTokenPoolStatus());
    setRelayActive(isRelayEnabled());
    setRelayUrl(getRelayEndpoint());

    const timer = window.setInterval(() => {
      setStatuses(getTokenPoolStatus());
    }, 1000);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  const metrics = useMemo(() => {
    const total = statuses.length;
    const resting = statuses.filter((s) => s.isExhausted).length;
    const ready = total - resting;
    const estimatedDailyClips = Math.max(ready, total) * 16;
    return { total, ready, resting, estimatedDailyClips };
  }, [statuses]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return statuses.filter((entry, idx) => {
      if (filterTab === 'ready' && entry.isExhausted) return false;
      if (filterTab === 'resting' && !entry.isExhausted) return false;
      if (q) {
        const accountLabel = `account #${idx + 1}`;
        if (
          !entry.masked.toLowerCase().includes(q) &&
          !entry.token.toLowerCase().includes(q) &&
          !accountLabel.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [statuses, filterTab, searchQuery]);

  if (!isOpen) return null;

  const showTempBanner = (msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleAppendBatch = () => {
    if (!batchInput.trim()) {
      showTempBanner('Paste one or more hf_... tokens first.');
      return;
    }
    const updated = appendTokensToPool(batchInput);
    setBatchInput('');
    refreshPoolState();
    showTempBanner(`Appended tokens. Active pool now has ${updated.length} accounts.`);
  };

  const handleReplaceBatch = () => {
    if (!batchInput.trim()) {
      showTempBanner('Paste replacement hf_... tokens first.');
      return;
    }
    const updated = setHfTokenPool(batchInput);
    setBatchInput('');
    refreshPoolState();
    showTempBanner(`Replaced pool with ${updated.length} ZeroGPU accounts.`);
  };

  const handleResetAll = () => {
    resetAllCooldowns();
    refreshPoolState();
    showTempBanner('All ZeroGPU account cooldowns cleared immediately.');
  };

  const handleCopyAll = async () => {
    const allTokens = getHfTokenPool();
    try {
      await navigator.clipboard.writeText(allTokens.join('\n'));
      setCopiedAll(true);
      showTempBanner(`Copied all ${allTokens.length} tokens to clipboard.`);
      window.setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      showTempBanner('Clipboard access blocked by browser permissions.');
    }
  };

  const handleRemoveSingle = (token: string) => {
    removeTokenFromPool(token);
    refreshPoolState();
    showTempBanner('Removed token from pool.');
  };

  const handleWakeSingle = (token: string) => {
    resetTokenCooldown(token);
    refreshPoolState();
    showTempBanner('Account cooldown cleared.');
  };

  const handleToggleRelay = (nextEnabled: boolean) => {
    setRelayActive(nextEnabled);
    setRelayEnabled(nextEnabled);
    onPoolUpdated?.();
  };

  const handleSaveRelayUrl = (nextUrl: string) => {
    setRelayUrl(nextUrl);
    setRelayEndpoint(nextUrl);
  };

  const handleTestRelay = async () => {
    setIsTestingRelay(true);
    setRelayHealth(null);
    setRelayEndpoint(relayUrl);
    try {
      const result = await testRelayHealth(relayUrl);
      setRelayHealth(result);
    } finally {
      setIsTestingRelay(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#121218] border border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.88)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#16161f] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                ZeroGPU Multi-Account Token Pool &amp; Relay Deck
              </h2>
              <p className="text-xs text-zinc-400">
                Automatic round-robin rotation across Hugging Face ZeroGPU Spaces + SOCKS5 Relay failover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close token pool manager"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Live Capacity Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#181822] border border-white/8">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                Total Accounts
              </div>
              <div className="text-2xl font-black text-white mt-1">{metrics.total}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Merged Env + Vault</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Ready Accounts
              </div>
              <div className="text-2xl font-black text-emerald-200 mt-1">{metrics.ready}</div>
              <div className="text-[11px] text-emerald-300/75 mt-0.5">Instant SSE dispatch</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Resting Accounts
              </div>
              <div className="text-2xl font-black text-amber-200 mt-1">{metrics.resting}</div>
              <div className="text-[11px] text-amber-300/75 mt-0.5">Auto-heals if 100% hit</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-cyan-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Est. Daily Clips
              </div>
              <div className="text-2xl font-black text-cyan-200 mt-1">
                ~{metrics.estimatedDailyClips}
              </div>
              <div className="text-[11px] text-cyan-300/75 mt-0.5">+ Unlimited 60fps DSP</div>
            </div>
          </div>

          {feedbackBanner && (
            <div className="px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-medium">
              {feedbackBanner}
            </div>
          )}

          {/* Batch Append / Replace Deck */}
          <div className="p-4 rounded-2xl bg-[#171720] border border-white/8 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label
                htmlFor="hf-batch-tokens"
                className="text-xs font-bold text-zinc-200 uppercase tracking-wider"
              >
                Batch Import Hugging Face Tokens (hf_...)
              </label>
              <span className="text-[11px] text-zinc-400">
                Comma, space, or newline separated • Deduplicated automatically
              </span>
            </div>

            <textarea
              id="hf-batch-tokens"
              rows={3}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder="hf_xxxx..., hf_yyyy..., hf_zzzz..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#111117] border border-white/10 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60 resize-y"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAppendBatch}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Append to Pool</span>
                </button>

                <button
                  type="button"
                  onClick={handleReplaceBatch}
                  className="px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Replace className="w-3.5 h-3.5" />
                  <span>Replace Pool</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset All Cooldowns</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedAll ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter & Search Toolbar + Token List */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#181822] border border-white/8">
                {(
                  [
                    { id: 'all', label: `All (${metrics.total})` },
                    { id: 'ready', label: `Ready (${metrics.ready})` },
                    { id: 'resting', label: `Resting (${metrics.resting})` }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filterTab === tab.id
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter token or account #..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#181822] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/50 w-52"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {filteredEntries.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#16161f] border border-white/6 text-center text-xs text-zinc-400">
                  No accounts match the selected filter.
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const poolIndex = statuses.findIndex((s) => s.token === entry.token);
                  return (
                    <div
                      key={entry.token}
                      className="px-3.5 py-2.5 rounded-xl bg-[#16161f] border border-white/6 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            entry.isExhausted
                              ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                              : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          }`}
                        />
                        <span className="text-xs font-bold text-zinc-200 shrink-0">
                          Account #{poolIndex + 1}
                        </span>
                        <code className="text-xs font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/6 truncate">
                          {entry.masked}
                        </code>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {entry.isExhausted ? (
                          <>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Resting • {formatRemainingTime(entry.cooldownUntil)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleWakeSingle(entry.token)}
                              className="px-2 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-[11px] font-semibold text-white transition cursor-pointer"
                            >
                              Wake
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Ready
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveSingle(entry.token)}
                          aria-label={`Remove Account #${poolIndex + 1}`}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coolify SOCKS5 Video Relay Section */}
          <div className="p-4 rounded-2xl bg-[#171721] border border-white/8 space-y-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-violet-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Coolify / Hetzner SOCKS5 Video Relay Failover
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Routes ZeroGPU synthesis through rotated proxy egress when upstream IP limits trigger
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={relayActive}
                onClick={() => handleToggleRelay(!relayActive)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  relayActive
                    ? 'bg-violet-500/25 border-violet-400/50 text-violet-200'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {relayActive ? 'Relay Enabled' : 'Relay Standby'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="url"
                value={relayUrl}
                onChange={(e) => handleSaveRelayUrl(e.target.value)}
                placeholder="https://relay.modelissa.com"
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#111117] border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400/60"
              />
              <button
                type="button"
                disabled={isTestingRelay}
                onClick={handleTestRelay}
                className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-60 cursor-pointer shrink-0"
              >
                {isTestingRelay ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5" />
                )}
                <span>Test Connection</span>
              </button>
            </div>

            {relayHealth && (
              <div
                className={`px-3.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                  relayHealth.ok
                    ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/12 border-rose-500/30 text-rose-200'
                }`}
              >
                <span>{relayHealth.message}</span>
                <span className="font-mono text-[11px] opacity-80">{relayHealth.endpoint}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HfTokenPoolModal;
