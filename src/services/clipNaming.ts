/**
 * Clip Naming Service
 * -------------------
 * Builds human-readable download filenames for every generated video so the
 * file always carries (1) the audio phrase / audio file name used to drive the
 * lip-sync and (2) the model that generated it.
 *
 * Format:  <audio_phrase>__<model_name>__<short_id>.mp4
 * Example: Surely_Goodness_And_Mercy__Sync_Lipsync_2_Pro__a1b2c3.mp4
 */

const MAX_SEGMENT_LEN = 60;

/** Strips the extension, replaces unsafe characters and collapses separators. */
export const sanitizeFileSegment = (raw: string | undefined | null, fallback: string): string => {
  const base = String(raw ?? '')
    .replace(/\.[a-z0-9]{2,5}$/i, '') // drop file extension (.wav, .mp3, .m4a ...)
    .replace(/[\\/:*?"<>|]+/g, ' ') // Windows-forbidden characters
    .replace(/[^\p{L}\p{N}]+/gu, '_') // anything non letter/number -> underscore
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SEGMENT_LEN)
    .replace(/_+$/g, '');
  return base || fallback;
};

export interface ClipNameParts {
  audioName?: string | null;
  modelName?: string | null;
  modelId?: string | null;
  id?: string | null;
  extension?: string;
}

/** Builds `<audio>__<model>__<shortId>.<ext>` */
export const buildVideoFileName = ({
  audioName,
  modelName,
  modelId,
  id,
  extension = 'mp4'
}: ClipNameParts): string => {
  const audioPart = sanitizeFileSegment(audioName, 'audio_phrase');
  const modelPart = sanitizeFileSegment(modelName || modelId, 'lipsyncer_model');
  const shortId = sanitizeFileSegment(id, '').replace(/_/g, '').slice(-6);
  return [audioPart, modelPart, shortId].filter(Boolean).join('__') + `.${extension}`;
};

/** Triggers a browser download. Fetches cross-origin URLs as blobs so the
 *  `download` filename is honoured; falls back to opening the URL directly. */
export const downloadVideoWithName = async (url: string, fileName: string): Promise<void> => {
  const clickAnchor = (href: string, name?: string) => {
    const a = document.createElement('a');
    a.href = href;
    if (name) a.download = name;
    a.rel = 'noopener';
    if (!name) a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
  };

  // Same-origin, blob: and data: URLs honour the download attribute directly.
  const isLocal =
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    (typeof window !== 'undefined' && url.startsWith(window.location.origin));
  if (isLocal) {
    clickAnchor(url, fileName);
    return;
  }

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    clickAnchor(objectUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  } catch (err) {
    console.warn('Named download fell back to direct link:', err);
    clickAnchor(url);
  }
};
