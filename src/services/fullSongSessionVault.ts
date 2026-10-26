/**
 * Full Song Video Mode Session Vault
 * 
 * Implements native IndexedDB binary Blob storage for full song lip-sync sessions,
 * matching the Modelissa DJ workstation persistence architecture.
 * 
 * Guarantees that when a creator uploads a master song (MP3/WAV), drops ChatGPT 2-ZIP
 * storyboard frames, unrolls the Omni HTML guide, and sets lyrics, an accidental page
 * refresh or browser restart NEVER loses their work.
 */

import {
  FullSongVideoChunk,
  UnraveledStoryboardFrame,
  OmniHtmlGuideParsedProject,
  AspectRatioOption,
  GeneratedLipSyncClip,
  FullSongChunkMode,
  FullSongLyricSyncResult
} from '../types';
import { VocalFormantBpmAnalysis } from './audioDspService';

const DB_NAME = 'lipsyncer_fullsong_session_vault';
const DB_VERSION = 1;
const STORE_NAME = 'active_rack_session';
const SESSION_KEY = 'current_full_song_rack';

export interface FullSongRackSession {
  savedAt: number;
  songTitle: string;
  audioBlob: Blob | null;
  audioFileName: string;
  audioPreviewUrl?: string;
  analysis?: VocalFormantBpmAnalysis | null;
  chunkMode: FullSongChunkMode;
  targetSceneCount: number;
  intervalMinutes: number;
  intervalSeconds: number;
  uploadedImageUrls: string[];
  orderedStoryboardFrames: UnraveledStoryboardFrame[];
  omniGuide: OmniHtmlGuideParsedProject | null;
  aspectRatio: AspectRatioOption;
  selectedModelId: string;
  rawLyrics: string;
  lyricSyncResult: FullSongLyricSyncResult | null;
  chunks: FullSongVideoChunk[];
  shortfallFilledCount: number;
  mergedMasterClip: GeneratedLipSyncClip | null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openSessionDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      req.onerror = () => {
        console.warn('[FullSongSessionVault] IndexedDB open failed:', req.error);
        dbPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn('[FullSongSessionVault] IndexedDB unavailable:', err);
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

// In-memory fallback if IndexedDB is disabled
let memoryFallbackSession: FullSongRackSession | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Saves the active Full Song Rack Session to IndexedDB with debouncing.
 */
export function saveFullSongRackSessionDebounced(
  session: Omit<FullSongRackSession, 'savedAt'>,
  delayMs = 500
): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    void saveFullSongRackSessionDirect({
      ...session,
      savedAt: Date.now()
    });
  }, delayMs);
}

/**
 * Saves session directly to IndexedDB.
 */
export async function saveFullSongRackSessionDirect(
  session: FullSongRackSession
): Promise<boolean> {
  const db = await openSessionDB();
  if (!db) {
    memoryFallbackSession = session;
    return true;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(session, SESSION_KEY);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('[FullSongSessionVault] Save session failed:', req.error);
        memoryFallbackSession = session;
        resolve(false);
      };
    } catch (err) {
      console.warn('[FullSongSessionVault] Transaction error during save:', err);
      memoryFallbackSession = session;
      resolve(false);
    }
  });
}

/**
 * Loads the active Full Song Rack Session from IndexedDB.
 */
export async function loadFullSongRackSession(): Promise<FullSongRackSession | null> {
  const db = await openSessionDB();
  if (!db) {
    return memoryFallbackSession;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SESSION_KEY);

      req.onsuccess = () => {
        const val = req.result as FullSongRackSession | undefined;
        if (val && (val.audioBlob || (val.uploadedImageUrls && val.uploadedImageUrls.length > 0))) {
          resolve(val);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        console.warn('[FullSongSessionVault] Load session failed:', req.error);
        resolve(memoryFallbackSession);
      };
    } catch (err) {
      console.warn('[FullSongSessionVault] Load transaction error:', err);
      resolve(memoryFallbackSession);
    }
  });
}

/**
 * Clears the active Full Song Rack Session so the user can start a fresh song.
 */
export async function clearFullSongRackSession(): Promise<boolean> {
  memoryFallbackSession = null;
  const db = await openSessionDB();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(SESSION_KEY);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('[FullSongSessionVault] Clear session failed:', req.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[FullSongSessionVault] Clear transaction error:', err);
      resolve(false);
    }
  });
}
