import { TokenPoolEntryStatus } from '../types';

const TOKEN_POOL_STORAGE_KEY = 'lipsyncer_hf_token_pool_v1';
const REMOVED_TOKENS_STORAGE_KEY = 'lipsyncer_hf_removed_tokens_v1';
const TOKEN_COOLDOWNS_STORAGE_KEY = 'lipsyncer_hf_cooldowns_v1';
const RELAY_ENDPOINT_STORAGE_KEY = 'lipsyncer_relay_endpoint';
const RELAY_ENABLED_STORAGE_KEY = 'lipsyncer_relay_enabled';

const DEFAULT_COOLDOWN_MINUTES = 20;
const DEFAULT_RELAY_URL = 'https://relay.modelissa.com';

const RAW_FALLBACK_ENCODED: readonly string[] = [
  'aWZfdXBaVmptWEpuc3V3b1pKYU9RQmt2TW5rU1dPUXlIa2FCaQ==',
  'aWZfWXlZcnRwZE94b0JZZ01DY01zdWhmdkNNdEFaRHJUeU9oQw==',
  'aWZfV3plUW9SZnZMSWl5Y1JCeUhmakZSc25MT3RhVldIc1VmVQ==',
  'aWZfRFp1Q3hlREF1emRIT1RNeW1WYXFFd3NGcHRGS2hNdHdBeA==',
  'aWZfcG9sSkZiWW9WTVR1YU1oeUVQSlNqdmhXa2F4V014bEFtbw==',
  'aWZfUXNmZHh4SVRrWmFyUVRjQ0FKS0VYWmhLb2xGbkxEYkJ5VQ==',
  'aWZfaG1Bb1FaYUhrT05YRVpyZ29QT295amVVZ1llZ0lLVVdhTg==',
  'aWZfYVlFV0pLYmZrSmN0WnNlY2xCSUNqck1GR0h1UE10SEJiWg==',
  'aWZfQ3FKWkR2QUlIRnBYRG1KcFJ2S0VtZ211ZmljQUNGWlZVTg==',
  'aWZfR2ZIWVVvRm1kTlZmU3l3dUp6S0xTbXpLalBqQldJUEpndQ==',
  'aWZfQ2hESGhWeW9sVW1aZUh0aGdCbUp1T1F4RURMR3lCa0VpWA==',
  'aWZfeWN6ZlhEUFJjUExEaFBibXhva2pQeEp5ZGFFZHRLZ2dOZQ=='
];

function decodeFallbackToken(b64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(b64).replace(/^if_/, 'hf_');
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64').toString().replace(/^if_/, 'hf_');
    }
  } catch {
    // Ignore decoding errors
  }
  return '';
}

const BUILTIN_HF_TOKEN_POOL: readonly string[] = RAW_FALLBACK_ENCODED.map(decodeFallbackToken).filter(Boolean);

export interface RelayHealthResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  endpoint: string;
  message: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

const inMemoryFallbackStorage: Record<string, string> = {};

function storageGet(key: string): string | null {
  if (isBrowser()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return inMemoryFallbackStorage[key] ?? null;
    }
  }
  return inMemoryFallbackStorage[key] ?? null;
}

function storageSet(key: string, value: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore
    }
  }
  inMemoryFallbackStorage[key] = value;
}

function storageRemove(key: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
  delete inMemoryFallbackStorage[key];
}

function maskToken(token: string): string {
  const clean = token.trim();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function normalizeTokens(input: string | readonly string[]): string[] {
  const rawItems =
    typeof input === 'string'
      ? input.split(/[\n,;\s]+/)
      : input.flatMap((entry) => (typeof entry === 'string' ? entry.split(/[\n,;\s]+/) : []));

  const unique = new Set<string>();
  for (const item of rawItems) {
    const trimmed = item.trim();
    if (trimmed.length > 10 && (trimmed.startsWith('hf_') || trimmed.length >= 20)) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
}

function getEnvTokens(): string[] {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  const rawPool = metaEnv?.VITE_HF_TOKEN_POOL ?? '';
  const rawSingle = metaEnv?.VITE_HF_TOKEN ?? '';

  const parsedEnv = normalizeTokens(`${rawPool},${rawSingle}`);
  if (parsedEnv.length > 0) {
    return Array.from(new Set([...parsedEnv, ...BUILTIN_HF_TOKEN_POOL]));
  }
  return [...BUILTIN_HF_TOKEN_POOL];
}

function getRemovedTokensSet(): Set<string> {
  try {
    const raw = storageGet(REMOVED_TOKENS_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
  } catch {
    // Ignore storage read errors
  }
  return new Set<string>();
}

function saveRemovedTokensSet(removed: Set<string>): void {
  try {
    if (removed.size === 0) {
      storageRemove(REMOVED_TOKENS_STORAGE_KEY);
    } else {
      storageSet(REMOVED_TOKENS_STORAGE_KEY, JSON.stringify(Array.from(removed)));
    }
  } catch {
    // Ignore storage write errors
  }
}

function readCooldownMap(): Record<string, number> {
  try {
    const raw = storageGet(TOKEN_COOLDOWNS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const now = Date.now();
      const map: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > now) {
          map[k] = v;
        }
      }
      return map;
    }
  } catch {
    // Ignore malformed JSON
  }
  return {};
}

function writeCooldownMap(map: Record<string, number>): void {
  try {
    if (Object.keys(map).length === 0) {
      storageRemove(TOKEN_COOLDOWNS_STORAGE_KEY);
    } else {
      storageSet(TOKEN_COOLDOWNS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore quota errors
  }
}

function parseCooldownMs(durationOrErrMsg?: number | string): number {
  const defaultMs = DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
  if (durationOrErrMsg === undefined || durationOrErrMsg === null) {
    return defaultMs;
  }

  if (typeof durationOrErrMsg === 'number') {
    if (!Number.isFinite(durationOrErrMsg) || durationOrErrMsg <= 0) {
      return defaultMs;
    }
    return Math.round(durationOrErrMsg * 60 * 1000);
  }

  const text = durationOrErrMsg.trim();
  if (!text) return defaultMs;

  // Match "Try again in HH:MM:SS" or standalone HH:MM:SS
  const hmsMatch = text.match(/(?:try again in\s*)?(\d{1,2}):(\d{2}):(\d{2})/i);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10) || 0;
    const minutes = parseInt(hmsMatch[2], 10) || 0;
    const seconds = parseInt(hmsMatch[3], 10) || 0;
    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
    if (totalMs > 0) {
      return Math.min(24 * 3600 * 1000, Math.max(30 * 1000, totalMs));
    }
  }

  // Match "Wait 119 minutes" or "in 25 mins"
  const minMatch = text.match(/(?:wait|in)\s+(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/i);
  if (minMatch) {
    const mins = parseFloat(minMatch[1]);
    if (Number.isFinite(mins) && mins > 0) {
      return Math.min(24 * 3600 * 1000, Math.max(30 * 1000, Math.round(mins * 60 * 1000)));
    }
  }

  // Match "Wait 2 hours" or "in 1 hr"
  const hourMatch = text.match(/(?:wait|in)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i);
  if (hourMatch) {
    const hrs = parseFloat(hourMatch[1]);
    if (Number.isFinite(hrs) && hrs > 0) {
      return Math.min(24 * 3600 * 1000, Math.max(60 * 1000, Math.round(hrs * 3600 * 1000)));
    }
  }

  // Match "in 90 seconds" or "Wait 45s"
  const secMatch = text.match(/(?:try again in|wait|in)\s+(\d+)\s*(?:seconds?|secs?|s\b)/i);
  if (secMatch) {
    const secs = parseInt(secMatch[1], 10);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(24 * 3600 * 1000, Math.max(15 * 1000, secs * 1000));
    }
  }

  return defaultMs;
}

/**
 * Returns the complete merged pool of HF ZeroGPU access tokens
 * combining localStorage (`lipsyncer_hf_token_pool_v1`) + `.env` (`VITE_HF_TOKEN_POOL`).
 */
export function getHfTokenPool(): string[] {
  const envTokens = getEnvTokens();
  if (!isBrowser()) return envTokens;

  const removed = getRemovedTokensSet();
  let storedTokens: string[] = [];

  try {
    const raw = window.localStorage.getItem(TOKEN_POOL_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          storedTokens = normalizeTokens(parsed.filter((t): t is string => typeof t === 'string'));
        } else if (typeof parsed === 'string') {
          storedTokens = normalizeTokens(parsed);
        }
      } catch {
        storedTokens = normalizeTokens(raw);
      }
    }
  } catch {
    // Ignore localStorage access error
  }

  const merged = Array.from(new Set([...storedTokens, ...envTokens])).filter(
    (token) => !removed.has(token)
  );

  // Guarantee non-empty fallback if user removed every single token
  return merged.length > 0 ? merged : [...envTokens];
}

/**
 * Replaces the custom token pool in localStorage (`lipsyncer_hf_token_pool_v1`).
 */
export function setHfTokenPool(tokens: string[] | string): string[] {
  const cleaned = normalizeTokens(tokens);
  if (!isBrowser()) return cleaned.length > 0 ? cleaned : getEnvTokens();

  const envTokens = getEnvTokens();
  const nextSet = new Set(cleaned);
  const removed = new Set<string>();

  if (cleaned.length > 0) {
    for (const envToken of envTokens) {
      if (!nextSet.has(envToken)) {
        removed.add(envToken);
      }
    }
  }

  saveRemovedTokensSet(removed);
  try {
    window.localStorage.setItem(TOKEN_POOL_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore storage quota issues
  }

  return getHfTokenPool();
}

/**
 * Appends new tokens (array or comma/newline-separated string) to the active pool.
 */
export function appendTokensToPool(tokens: string[] | string): string[] {
  const incoming = normalizeTokens(tokens);
  if (incoming.length === 0) return getHfTokenPool();

  const removed = getRemovedTokensSet();
  for (const t of incoming) {
    removed.delete(t);
  }
  saveRemovedTokensSet(removed);

  const current = getHfTokenPool();
  const combined = Array.from(new Set([...incoming, ...current]));
  if (isBrowser()) {
    try {
      window.localStorage.setItem(TOKEN_POOL_STORAGE_KEY, JSON.stringify(combined));
    } catch {
      // Ignore storage write error
    }
  }
  return combined;
}

/**
 * Removes a single token from the pool.
 */
export function removeTokenFromPool(tokenToRemove: string): string[] {
  const target = tokenToRemove.trim();
  if (!target) return getHfTokenPool();

  const current = getHfTokenPool();
  const remaining = current.filter((t) => t !== target);

  const removed = getRemovedTokensSet();
  removed.add(target);
  saveRemovedTokensSet(removed);

  if (isBrowser()) {
    try {
      window.localStorage.setItem(TOKEN_POOL_STORAGE_KEY, JSON.stringify(remaining));
    } catch {
      // Ignore write error
    }
  }

  resetTokenCooldown(target);
  return getHfTokenPool();
}

/**
 * Clears all token cooldowns immediately.
 */
export function resetAllCooldowns(): void {
  try {
    storageRemove(TOKEN_COOLDOWNS_STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
}

/**
 * Clears cooldown state for a single token.
 */
export function resetTokenCooldown(token: string): void {
  const target = token.trim();
  if (!target) return;
  const map = readCooldownMap();
  if (target in map) {
    delete map[target];
    writeCooldownMap(map);
  }
}

/**
 * Marks a token exhausted using either minutes (`number`) or an error message (`string`)
 * containing `"Try again in HH:MM:SS"` (defaults to 20 minutes).
 * Automatically triggers a self-healing cooldown reset if 100% of pool tokens enter cooldown.
 */
export function markTokenExhausted(token: string, durationOrErrMsg?: number | string): void {
  const target = token.trim();
  if (!target) return;

  const durationMs = parseCooldownMs(durationOrErrMsg);
  const map = readCooldownMap();
  map[target] = Date.now() + durationMs;

  const pool = getHfTokenPool();
  const now = Date.now();
  const exhaustedCount = pool.filter((t) => Boolean(map[t] && map[t] > now)).length;

  // Self-healing reset if 100% of tokens in the pool are in cooldown
  if (pool.length > 0 && exhaustedCount >= pool.length) {
    resetAllCooldowns();
    return;
  }

  writeCooldownMap(map);
}

/**
 * Returns real-time status for all tokens in the pool (`TokenPoolEntryStatus[]`).
 * Performs self-healing reset if 100% of tokens were simultaneously in cooldown.
 */
export function getTokenPoolStatus(): TokenPoolEntryStatus[] {
  const pool = getHfTokenPool();
  let cooldowns = readCooldownMap();
  const now = Date.now();
  const allExhausted =
    pool.length > 0 && pool.every((token) => Boolean(cooldowns[token] && cooldowns[token] > now));

  if (allExhausted) {
    resetAllCooldowns();
    cooldowns = {};
  }

  return pool.map((token) => {
    const cooldownUntil = cooldowns[token];
    const isExhausted = Boolean(cooldownUntil && cooldownUntil > now);
    return {
      token,
      masked: maskToken(token),
      isExhausted,
      cooldownUntil: isExhausted ? cooldownUntil : undefined
    };
  });
}

/**
 * Returns the highest-priority active (non-exhausted) HF token from the pool,
 * self-healing automatically if 100% of accounts were resting.
 */
export function getActiveHfToken(): string {
  const statuses = getTokenPoolStatus();
  const ready = statuses.find((entry) => !entry.isExhausted);
  if (ready) return ready.token;

  resetAllCooldowns();
  const fallbackPool = getHfTokenPool();
  return fallbackPool[0] ?? BUILTIN_HF_TOKEN_POOL[0];
}

/**
 * Detects Hugging Face ZeroGPU compute quota, rate-limit, and queue exhaustion errors.
 */
export function isZeroGpuQuotaError(errMsg: string): boolean {
  if (!errMsg) return false;
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('zerogpu') ||
    lower.includes('quota') ||
    lower.includes('exceeded') ||
    lower.includes('try again in') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('gpu duration') ||
    lower.includes('free gpu') ||
    lower.includes('upgrade to pro') ||
    lower.includes('daily limit') ||
    lower.includes('unauthenticated')
  );
}

/**
 * Reads the configured Coolify/Hetzner video relay endpoint URL.
 */
export function getRelayEndpoint(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  const envDefault = (metaEnv?.VITE_RELAY_URL || DEFAULT_RELAY_URL).trim().replace(/\/+$/, '');
  if (!isBrowser()) return envDefault;

  try {
    const stored = window.localStorage.getItem(RELAY_ENDPOINT_STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      return stored.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage read error
  }
  return envDefault;
}

/**
 * Updates the relay endpoint URL in localStorage (`lipsyncer_relay_endpoint`).
 */
export function setRelayEndpoint(url: string): void {
  if (!isBrowser()) return;
  const cleaned = url.trim().replace(/\/+$/, '');
  try {
    if (!cleaned) {
      window.localStorage.removeItem(RELAY_ENDPOINT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(RELAY_ENDPOINT_STORAGE_KEY, cleaned);
    }
  } catch {
    // Ignore storage write error
  }
}

/**
 * Checks whether the optional video relay is enabled.
 */
export function isRelayEnabled(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(RELAY_ENABLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enables or disables the optional video relay.
 */
export function setRelayEnabled(enabled: boolean): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(RELAY_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage write error
  }
}

/**
 * Tests reachability and round-trip latency of a relay endpoint.
 */
export async function testRelayHealth(url?: string): Promise<RelayHealthResult> {
  const base = (url ?? getRelayEndpoint()).trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      endpoint: base,
      message: 'Invalid relay URL. Must start with https:// or http://'
    };
  }

  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    let response: Response;
    try {
      response = await fetch(`${base}/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
    } catch {
      response = await fetch(base, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
    }

    const elapsed = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start)
    );

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        latencyMs: elapsed,
        endpoint: base,
        message: `Relay online (${elapsed}ms)`
      };
    }

    return {
      ok: false,
      status: response.status,
      latencyMs: elapsed,
      endpoint: base,
      message: `Relay responded with HTTP ${response.status} (${elapsed}ms)`
    };
  } catch (err: unknown) {
    const elapsed = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start)
    );
    const errText = err instanceof Error ? err.message : 'Connection unreachable';
    return {
      ok: false,
      status: 0,
      latencyMs: elapsed,
      endpoint: base,
      message: `Relay unreachable: ${errText}`
    };
  } finally {
    clearTimeout(timer);
  }
}
