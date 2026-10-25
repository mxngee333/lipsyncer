import { GeneratedLipSyncClip } from '../types';

const DB_NAME = 'lipsyncer_media_vault';
const DB_VERSION = 1;
const STORE_MEDIA_BLOBS = 'media_blobs';
const STORE_GENERATIONS_META = 'generations_meta';
const FALLBACK_META_STORAGE_KEY = 'lipsyncer_generations_fallback_v1';

const memoryBlobsFallback = new Map<string, Blob>();
const memoryGenerationsFallback = new Map<string, GeneratedLipSyncClip>();
const hydratedObjectUrls = new Map<string, { blobSize: number; objectUrl: string }>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openVaultDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA_BLOBS)) {
          db.createObjectStore(STORE_MEDIA_BLOBS);
        }
        if (!db.objectStoreNames.contains(STORE_GENERATIONS_META)) {
          db.createObjectStore(STORE_GENERATIONS_META, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.warn('[MediaVaultDB] IndexedDB open failed, falling back to memory store:', request.error);
        dbPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn('[MediaVaultDB] IndexedDB unavailable:', err);
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

function syncFallbackMetaToLocalStorage(records: GeneratedLipSyncClip[]): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    const compact = records.slice(0, 60).map((item) => ({
      ...item,
      videoUrl: item.videoUrl.startsWith('blob:') && item.r2Url ? item.r2Url : item.videoUrl,
      thumbnailUrl:
        item.thumbnailUrl && item.thumbnailUrl.length > 65_000 ? undefined : item.thumbnailUrl
    }));
    window.localStorage.setItem(FALLBACK_META_STORAGE_KEY, JSON.stringify(compact));
  } catch {
    // Ignore localStorage quota limits
  }
}

function readFallbackMetaFromLocalStorage(): GeneratedLipSyncClip[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_META_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (v): v is GeneratedLipSyncClip =>
          Boolean(v && typeof v === 'object' && typeof (v as GeneratedLipSyncClip).id === 'string')
      );
    }
  } catch {
    // Ignore malformed JSON
  }
  return [];
}

/**
 * Stores a binary `Blob` inside IndexedDB (`media_blobs`).
 */
export async function saveBlobToVault(key: string, blob: Blob): Promise<void> {
  if (!key) return;
  memoryBlobsFallback.set(key, blob);

  const db = await openVaultDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_MEDIA_BLOBS);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieves a binary `Blob` from IndexedDB (`media_blobs`) by key.
 */
export async function getBlobFromVault(key: string): Promise<Blob | null> {
  if (!key) return null;

  const db = await openVaultDatabase();
  if (!db) {
    return memoryBlobsFallback.get(key) ?? null;
  }

  return new Promise<Blob | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_MEDIA_BLOBS);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (result instanceof Blob && result.size > 0) {
          resolve(result);
        } else {
          resolve(memoryBlobsFallback.get(key) ?? null);
        }
      };
      req.onerror = () => resolve(memoryBlobsFallback.get(key) ?? null);
    } catch {
      resolve(memoryBlobsFallback.get(key) ?? null);
    }
  });
}

/**
 * Saves a `GeneratedLipSyncClip` metadata record and its optional binary `videoBlob`
 * atomically into IndexedDB (`generations_meta` + `media_blobs`).
 */
export async function saveGenerationRecord(
  clip: GeneratedLipSyncClip,
  videoBlob?: Blob
): Promise<void> {
  let resolvedBlob = videoBlob;

  if (!resolvedBlob && clip.videoUrl.startsWith('blob:')) {
    try {
      const res = await fetch(clip.videoUrl);
      if (res.ok) {
        const fetched = await res.blob();
        if (fetched.size > 0) {
          resolvedBlob = fetched;
        }
      }
    } catch {
      // Ignore if blob URL cannot be re-fetched
    }
  }

  const blobKey = `video_${clip.id}`;
  if (resolvedBlob && resolvedBlob.size > 0) {
    await saveBlobToVault(blobKey, resolvedBlob);
  }

  memoryGenerationsFallback.set(clip.id, { ...clip });

  const db = await openVaultDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_GENERATIONS_META, 'readwrite');
        const store = tx.objectStore(STORE_GENERATIONS_META);
        store.put({ ...clip });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  const existingFallback = readFallbackMetaFromLocalStorage().filter((c) => c.id !== clip.id);
  syncFallbackMetaToLocalStorage([clip, ...existingFallback]);
}

/**
 * Loads all persisted `GeneratedLipSyncClip` items from IndexedDB,
 * hydrating fresh `URL.createObjectURL` handles from stored binary `Blob`s
 * so video playback NEVER breaks across browser refreshes.
 */
export async function loadAllGenerations(): Promise<GeneratedLipSyncClip[]> {
  const db = await openVaultDatabase();
  let rawRecords: GeneratedLipSyncClip[] = [];

  if (db) {
    rawRecords = await new Promise<GeneratedLipSyncClip[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_GENERATIONS_META, 'readonly');
        const store = tx.objectStore(STORE_GENERATIONS_META);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = Array.isArray(req.result) ? (req.result as GeneratedLipSyncClip[]) : [];
          resolve(items);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  if (rawRecords.length === 0) {
    const memList = Array.from(memoryGenerationsFallback.values());
    rawRecords = memList.length > 0 ? memList : readFallbackMetaFromLocalStorage();
  }

  const hydrated: GeneratedLipSyncClip[] = [];

  for (const record of rawRecords) {
    const blob =
      (await getBlobFromVault(`video_${record.id}`)) ?? (await getBlobFromVault(record.id));

    let activeVideoUrl = record.videoUrl;

    if (blob && blob.size > 0 && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const existingHydrated = hydratedObjectUrls.get(record.id);
      if (existingHydrated && existingHydrated.blobSize === blob.size) {
        activeVideoUrl = existingHydrated.objectUrl;
      } else {
        if (existingHydrated) {
          try {
            URL.revokeObjectURL(existingHydrated.objectUrl);
          } catch {
            // Ignore revoke error
          }
        }
        const freshUrl = URL.createObjectURL(blob);
        hydratedObjectUrls.set(record.id, { blobSize: blob.size, objectUrl: freshUrl });
        activeVideoUrl = freshUrl;
      }
    } else if (activeVideoUrl.startsWith('blob:') && record.r2Url) {
      activeVideoUrl = record.r2Url;
    }

    hydrated.push({
      ...record,
      videoUrl: activeVideoUrl
    });
  }

  hydrated.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return hydrated;
}

/**
 * Deletes a generation record and its underlying binary media blob from IndexedDB.
 */
export async function deleteGenerationRecord(id: string): Promise<void> {
  if (!id) return;

  memoryGenerationsFallback.delete(id);
  memoryBlobsFallback.delete(`video_${id}`);
  memoryBlobsFallback.delete(id);

  const cachedUrl = hydratedObjectUrls.get(id);
  if (cachedUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(cachedUrl.objectUrl);
    } catch {
      // Ignore revoke error
    }
    hydratedObjectUrls.delete(id);
  }

  const db = await openVaultDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_GENERATIONS_META, STORE_MEDIA_BLOBS], 'readwrite');
        tx.objectStore(STORE_GENERATIONS_META).delete(id);
        tx.objectStore(STORE_MEDIA_BLOBS).delete(`video_${id}`);
        tx.objectStore(STORE_MEDIA_BLOBS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  const remainingFallback = readFallbackMetaFromLocalStorage().filter((c) => c.id !== id);
  syncFallbackMetaToLocalStorage(remainingFallback);
}
