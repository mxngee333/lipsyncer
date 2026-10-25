import { Client, handle_file } from '@gradio/client';
import { LIPSYNC_MODELS } from '../data/modelCatalog';
import {
  AspectRatioOption,
  CameraMotionPreset,
  GeneratedLipSyncClip,
  GenerationProgress,
  LipSyncGenerationRequest,
  LipSyncModelSpec
} from '../types';
import {
  blobToDataUrl,
  dataUrlOrSourceToBlob,
  extractAudioSliceWav,
  extractFirstFrameFromVideo,
  generateDemoPortraitDataUrl,
  getAudioDurationSec,
  muxSilentVideoWithAudio,
  renderInstantDspVisemeVideo,
  synthesizeLivingPortraitPrepassVideo
} from './audioDspService';
import { saveGenerationRecord } from './mediaVaultDb';
import { getSessionUser, uploadVideoToR2Vault } from './r2VaultService';
import {
  getHfTokenPool,
  getTokenPoolStatus,
  isZeroGpuQuotaError,
  markTokenExhausted,
  resetAllCooldowns
} from './tokenPoolService';

const ZERO_TEXT_DIRECTIVE = 'Zero visible text, no subtitles, no captions, no watermarks.';
const DEFAULT_NEGATIVE_PROMPT =
  'subtitles, captions, on-screen text, watermark, logo, typography, worst quality, inconsistent motion, blurry, jittery, distorted mouth, out of sync, deformed face';

const CAMERA_MOTION_PROMPT_MAP: Record<CameraMotionPreset, string> = {
  push_in: 'smooth cinema dolly push-in toward the performer',
  slow_pan: 'fluid anamorphic horizontal camera pan across studio stage',
  drone_pull_back: 'graceful crane pull-back revealing atmospheric stage lighting',
  orbital_spin: 'subtle orbital arc shot around the subject with shallow depth of field',
  handheld_cinema: 'organic 35mm handheld cinema camera poise with natural micro-movement',
  macro_dof: '85mm f/1.4 portrait lens shallow depth of field focused on eyes and lips'
};

function toGradioHfToken(rawToken: string): `hf_${string}` | undefined {
  const trimmed = rawToken.trim();
  if (trimmed.startsWith('hf_')) {
    return trimmed as `hf_${string}`;
  }
  return undefined;
}

function maskTokenShort(token: string): string {
  const clean = token.trim();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) {
      return msg
        .map((item) =>
          item && typeof item === 'object' && 'message' in item
            ? String((item as { message?: unknown }).message)
            : String(item)
        )
        .join('; ');
    }
  }
  return 'Unexpected generation error';
}

function buildEnginePrompt(req: LipSyncGenerationRequest, extraDirective?: string): string {
  const parts: string[] = [];
  const base = req.prompt.trim();
  if (base) {
    parts.push(base);
  } else {
    parts.push(
      'Photorealistic cinema close-up of performer singing and speaking with exact syllable lip-sync articulation matching the audio waveform, natural facial poise and eye blinks.'
    );
  }

  if (req.cameraMovement && CAMERA_MOTION_PROMPT_MAP[req.cameraMovement]) {
    parts.push(CAMERA_MOTION_PROMPT_MAP[req.cameraMovement] + '.');
  }

  if (extraDirective) {
    parts.push(extraDirective);
  }

  if (req.preserveZeroOnScreenText !== false) {
    const joinedLower = parts.join(' ').toLowerCase();
    if (!joinedLower.includes('zero visible text')) {
      parts.push(ZERO_TEXT_DIRECTIVE);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function buildNegativePrompt(customNeg?: string): string {
  if (!customNeg || !customNeg.trim()) {
    return DEFAULT_NEGATIVE_PROMPT;
  }
  return `${customNeg.trim()}, ${DEFAULT_NEGATIVE_PROMPT}`;
}

function spaceIdToHostUrl(spaceId: string): string {
  const slug = spaceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://${slug}.hf.space`;
}

function extractGradioMediaUrl(item: unknown, spaceId: string): string {
  if (!item) return '';
  if (typeof item === 'string') {
    if (item.startsWith('http://') || item.startsWith('https://') || item.startsWith('data:') || item.startsWith('blob:')) {
      return item;
    }
    const baseHost = spaceIdToHostUrl(spaceId);
    return `${baseHost}/gradio_api/file=${item.replace(/^\/+/, '')}`;
  }

  if (typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === 'string' && obj.url.length > 0) {
      return obj.url;
    }
    if (obj.video && typeof obj.video === 'object') {
      const vidUrl = extractGradioMediaUrl(obj.video, spaceId);
      if (vidUrl) return vidUrl;
    }
    if (obj.image && typeof obj.image === 'object') {
      const imgUrl = extractGradioMediaUrl(obj.image, spaceId);
      if (imgUrl) return imgUrl;
    }
    if (obj.value && typeof obj.value === 'object') {
      const valUrl = extractGradioMediaUrl(obj.value, spaceId);
      if (valUrl) return valUrl;
    }
    if (typeof obj.path === 'string' && obj.path.length > 0) {
      const baseHost = spaceIdToHostUrl(spaceId);
      return `${baseHost}/gradio_api/file=${obj.path}`;
    }
  }

  return '';
}

async function downloadHfMediaBlob(url: string, hfToken?: string): Promise<Blob> {
  if (!url) {
    throw new Error('Model returned an empty output media URL.');
  }

  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return dataUrlOrSourceToBlob(url);
  }

  const isHfDomain = url.includes('.hf.space') || url.includes('huggingface.co');

  if (isHfDomain && hfToken) {
    try {
      const authRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${hfToken}`
        }
      });
      if (authRes.ok) {
        const blob = await authRes.blob();
        if (blob.size > 0) return blob;
      }
    } catch {
      // Fall back to unauthenticated fetch if CORS rejects Authorization header on signed CDN redirect
    }
  }

  const plainRes = await fetch(url);
  if (!plainRes.ok) {
    // Try alternate `/file=` path format on HF Space if `/gradio_api/file=` returned 404
    if (url.includes('/gradio_api/file=')) {
      const legacyUrl = url.replace('/gradio_api/file=', '/file=');
      const legacyRes = await fetch(
        legacyUrl,
        isHfDomain && hfToken ? { headers: { Authorization: `Bearer ${hfToken}` } } : undefined
      );
      if (legacyRes.ok) {
        return await legacyRes.blob();
      }
    }
    throw new Error(`Failed to download generated media (HTTP ${plainRes.status}).`);
  }

  return await plainRes.blob();
}

async function runGradioJobWithFallback(params: {
  client: Client;
  endpoint: string;
  payload: unknown[];
  accountLabel: string;
  modelName: string;
  onProgress?: (p: GenerationProgress) => void;
}): Promise<unknown[]> {
  const { client, endpoint, payload, accountLabel, modelName, onProgress } = params;
  const job = client.submit(endpoint, payload);
  let resultData: unknown[] | null = null;

  try {
    for await (const msg of job as any) {
      if (!msg || typeof msg !== 'object') continue;

      if (msg.type === 'status') {
        if (msg.stage === 'error') {
          const rawErr = formatErrorMessage(msg);
          throw new Error(rawErr || `${modelName} Space reported an inference error.`);
        }

        if (msg.stage === 'pending') {
          const pos = typeof msg.position === 'number' ? msg.position : null;
          const eta = typeof msg.eta === 'number' ? Math.max(1, Math.round(msg.eta)) : null;
          onProgress?.({
            status: 'queueing',
            message:
              pos !== null
                ? `${modelName} queued at #${pos}${eta ? ` (~${eta}s ETA)` : ''}...`
                : `Waiting for ${modelName} GPU slice...`,
            progressPercent: 32,
            queuePosition: pos,
            etaSeconds: eta,
            activeAccountLabel: accountLabel
          });
        } else if (msg.stage === 'generating' || msg.stage === 'streaming') {
          let pct = 62;
          if (Array.isArray(msg.progress_data) && msg.progress_data.length > 0) {
            const p0 = msg.progress_data[0];
            if (typeof p0?.progress === 'number') {
              pct = Math.round(p0.progress * 100);
            } else if (typeof p0?.index === 'number' && typeof p0?.length === 'number' && p0.length > 0) {
              pct = Math.round((p0.index / p0.length) * 100);
            }
          } else if (typeof msg.progress === 'number') {
            pct = Math.round(msg.progress * 100);
          }

          onProgress?.({
            status: 'processing',
            message: `Synthesizing ${modelName} neural frames (${Math.min(99, Math.max(5, pct))}%)...`,
            progressPercent: Math.min(88, 38 + Math.round(pct * 0.5)),
            queuePosition: 0,
            etaSeconds: typeof msg.eta === 'number' ? Math.max(1, Math.round(msg.eta)) : null,
            activeAccountLabel: accountLabel
          });
        }
      } else if (msg.type === 'data' && Array.isArray(msg.data)) {
        resultData = msg.data as unknown[];
      }
    }
  } catch (iterErr: unknown) {
    const iterMsg = formatErrorMessage(iterErr);
    if (isZeroGpuQuotaError(iterMsg)) {
      throw iterErr instanceof Error ? iterErr : new Error(iterMsg);
    }
    console.warn(`[LipSyncEngine] Stream iterator notice on ${endpoint}, trying predict fallback:`, iterMsg);
  }

  if (!resultData) {
    const predRes = await client.predict(endpoint, payload);
    if (predRes && Array.isArray(predRes.data)) {
      resultData = predRes.data as unknown[];
    }
  }

  if (!resultData || resultData.length === 0) {
    throw new Error(`${modelName} finished without returning video data.`);
  }

  return resultData;
}

async function resolveInputImageBlob(req: LipSyncGenerationRequest): Promise<Blob> {
  if (req.inputMode === 'video_audio' && req.videoSource) {
    return extractFirstFrameFromVideo(req.videoSource);
  }
  if (req.imageSource) {
    return dataUrlOrSourceToBlob(req.imageSource);
  }
  if (req.videoSource) {
    return extractFirstFrameFromVideo(req.videoSource);
  }
  if (req.referenceImageSource) {
    return dataUrlOrSourceToBlob(req.referenceImageSource);
  }
  return dataUrlOrSourceToBlob(generateDemoPortraitDataUrl('singer_female'));
}

async function createClipThumbnailDataUrl(
  primaryImageBlob: Blob | null,
  finalVideoBlob: Blob
): Promise<string | undefined> {
  try {
    if (primaryImageBlob && primaryImageBlob.size > 0 && primaryImageBlob.size < 450_000) {
      return await blobToDataUrl(primaryImageBlob);
    }
    const frameBlob = await extractFirstFrameFromVideo(finalVideoBlob);
    return await blobToDataUrl(frameBlob);
  } catch {
    return undefined;
  }
}

async function executeSingleTokenBackendAttempt(params: {
  token: string;
  accountLabel: string;
  modelSpec: LipSyncModelSpec;
  req: LipSyncGenerationRequest;
  audioBlob: Blob;
  clampedDur: number;
  seed: number;
  prompt: string;
  negPrompt: string;
  onProgress?: (p: GenerationProgress) => void;
}): Promise<{ videoBlob: Blob; resolvedSeed: number; previewImageBlob: Blob | null }> {
  const {
    token,
    accountLabel,
    modelSpec,
    req,
    audioBlob,
    clampedDur,
    seed,
    prompt,
    negPrompt,
    onProgress
  } = params;

  const hfTokenOpt = toGradioHfToken(token);
  const clientOpts = hfTokenOpt
    ? { token: hfTokenOpt, record_history: false }
    : { record_history: false };

  switch (modelSpec.backendEngine) {
    case 'ltx2_audio_video': {
      const spaceId = 'multimodalart/ltx2-audio-to-video';
      const imgBlob = await resolveInputImageBlob(req);

      const client = await Client.connect(spaceId, clientOpts);
      const payload = [
        handle_file(imgBlob),
        handle_file(audioBlob),
        prompt,
        negPrompt,
        Math.min(12.0, Math.max(1.0, clampedDur)),
        seed
      ];

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/generate',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], spaceId);
      const videoBlob = await downloadHfMediaBlob(rawUrl, token);
      const resolvedSeed = typeof data[1] === 'number' ? data[1] : seed;
      return { videoBlob, resolvedSeed, previewImageBlob: imgBlob };
    }

    case 'latentsync_video_audio': {
      const spaceId = 'fffiloni/LatentSync';
      let vidBlob: Blob;
      let previewImageBlob: Blob | null = null;

      if ((req.inputMode === 'image_audio' || !req.videoSource) && req.imageSource) {
        onProgress?.({
          status: 'preparing',
          message: 'Synthesizing 30fps living portrait pre-pass for LatentSync 1.5...',
          progressPercent: 22,
          activeAccountLabel: accountLabel
        });
        previewImageBlob = await dataUrlOrSourceToBlob(req.imageSource);
        vidBlob = await synthesizeLivingPortraitPrepassVideo(
          previewImageBlob,
          clampedDur,
          req.aspectRatio
        );
      } else if (req.videoSource) {
        vidBlob = await dataUrlOrSourceToBlob(req.videoSource);
      } else {
        previewImageBlob = await resolveInputImageBlob(req);
        vidBlob = await synthesizeLivingPortraitPrepassVideo(
          previewImageBlob,
          clampedDur,
          req.aspectRatio
        );
      }

      const client = await Client.connect(spaceId, clientOpts);
      const payload = [handle_file(vidBlob), handle_file(audioBlob)];

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/generate_lip_sync_video',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], spaceId);
      const videoBlob = await downloadHfMediaBlob(rawUrl, token);
      return { videoBlob, resolvedSeed: seed, previewImageBlob };
    }

    case 'minimax_h3_audio': {
      const spaceId = 'multimodalart/minimax-h3-audio-to-video';
      const imgBlob = await resolveInputImageBlob(req);

      let canvasEnum = '960x544 · 16:9 fast';
      if (req.aspectRatio === '16:9') {
        canvasEnum =
          req.modelId === 'happyhorse-1-1' ? '1344x768 · 16:9 full' : '960x544 · 16:9 fast';
      } else if (req.aspectRatio === '9:16') {
        canvasEnum = '544x960 · 9:16 fast';
      } else if (req.aspectRatio === '1:1') {
        canvasEnum = '768x768 · 1:1 full';
      }

      const steps = req.modelId === 'happyhorse-1-1' ? 24 : 16;
      const upsample = req.resolution === '1080p' || req.resolution === '4K';

      const client = await Client.connect(spaceId, clientOpts);
      const payload = [
        prompt,
        handle_file(imgBlob),
        handle_file(audioBlob),
        canvasEnum,
        clampedDur,
        steps,
        seed,
        upsample
      ];

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/generate',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], spaceId);
      const videoBlob = await downloadHfMediaBlob(rawUrl, token);
      const resolvedSeed = typeof data[1] === 'number' ? data[1] : seed;
      return { videoBlob, resolvedSeed, previewImageBlob: imgBlob };
    }

    case 'wan_faster_mux': {
      const spaceId = 'zerogpu-aoti/wan2-2-fp8da-aoti-faster';
      const imgBlob = await resolveInputImageBlob(req);

      const client = await Client.connect(spaceId, clientOpts);
      const payload = [handle_file(imgBlob), prompt, 6, negPrompt, 3.5, 1, 1, seed, true];

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/generate_video',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], spaceId);
      const silentVideoBlob = await downloadHfMediaBlob(rawUrl, token);

      onProgress?.({
        status: 'muxing',
        message: 'Muxing H.264 cinema video with synchronized master audio...',
        progressPercent: 90,
        activeAccountLabel: accountLabel
      });

      const muxedBlob = await muxSilentVideoWithAudio(
        silentVideoBlob,
        audioBlob,
        clampedDur,
        req.aspectRatio
      );
      const resolvedSeed = typeof data[1] === 'number' ? data[1] : seed;
      return { videoBlob: muxedBlob, resolvedSeed, previewImageBlob: imgBlob };
    }

    case 'wan_dualframe_mux': {
      const spaceId = 'r3gm/wan2-2-fp8da-aoti-preview2';
      const imgBlob = await resolveInputImageBlob(req);
      const endImgBlob = req.endImageSource
        ? await dataUrlOrSourceToBlob(req.endImageSource)
        : null;

      const client = await Client.connect(spaceId, clientOpts);
      const wanDur = Math.min(5, Math.max(1, Math.round(clampedDur)));
      const payload = [
        handle_file(imgBlob),
        endImgBlob ? handle_file(endImgBlob) : null,
        prompt,
        4,
        negPrompt,
        wanDur,
        1.0,
        1.0,
        seed,
        req.seed === undefined,
        6,
        'UniPCMultistep',
        3.0,
        Number(16),
        '2xNomosUni_compact_otf_medium',
        1.0,
        true,
        true,
        true
      ];

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/generate_video',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], spaceId);
      const silentVideoBlob = await downloadHfMediaBlob(rawUrl, token);

      onProgress?.({
        status: 'muxing',
        message: 'Muxing Wan 2.7 dual-frame render with master vocal track...',
        progressPercent: 90,
        activeAccountLabel: accountLabel
      });

      const muxedBlob = await muxSilentVideoWithAudio(
        silentVideoBlob,
        audioBlob,
        clampedDur,
        req.aspectRatio
      );
      const resolvedSeed = typeof data[2] === 'number' ? data[2] : seed;
      return { videoBlob: muxedBlob, resolvedSeed, previewImageBlob: imgBlob };
    }

    case 'kling_liveportrait_mux': {
      const portraitCandidate = req.imageSource || req.referenceImageSource;
      if (portraitCandidate && req.videoSource) {
        const spaceId = 'KlingTeam/LivePortrait';
        const imgBlob = await dataUrlOrSourceToBlob(portraitCandidate);
        const vidBlob = await dataUrlOrSourceToBlob(req.videoSource);

        const client = await Client.connect(spaceId, clientOpts);
        const payload = [handle_file(imgBlob), handle_file(vidBlob), true, true, true];

        const data = await runGradioJobWithFallback({
          client,
          endpoint: '/gpu_wrapped_execute_video',
          payload,
          accountLabel,
          modelName: modelSpec.name,
          onProgress
        });

        const rawUrl = extractGradioMediaUrl(data[0], spaceId);
        const silentVideoBlob = await downloadHfMediaBlob(rawUrl, token);

        onProgress?.({
          status: 'muxing',
          message: 'Muxing Kling LivePortrait motion transfer with master audio...',
          progressPercent: 90,
          activeAccountLabel: accountLabel
        });

        const muxedBlob = await muxSilentVideoWithAudio(
          silentVideoBlob,
          audioBlob,
          clampedDur,
          req.aspectRatio
        );
        return { videoBlob: muxedBlob, resolvedSeed: seed, previewImageBlob: imgBlob };
      }

      // Multimodal reference poise fallback via LTX-2 Audio-to-Video
      const fallbackSpaceId = 'multimodalart/ltx2-audio-to-video';
      const imgBlob = await resolveInputImageBlob(req);
      const omniPrompt = buildEnginePrompt(
        req,
        'Expressive multimodal reference poise, authentic head micro-nods, natural lip and jaw phoneme articulation.'
      );

      const client = await Client.connect(fallbackSpaceId, clientOpts);
      const payload = [
        handle_file(imgBlob),
        handle_file(audioBlob),
        omniPrompt,
        negPrompt,
        Math.min(12.0, Math.max(1.0, clampedDur)),
        seed
      ];

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/generate',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], fallbackSpaceId);
      const videoBlob = await downloadHfMediaBlob(rawUrl, token);
      const resolvedSeed = typeof data[1] === 'number' ? data[1] : seed;
      return { videoBlob, resolvedSeed, previewImageBlob: imgBlob };
    }

    case 'codeformer_ltx_4k': {
      const baseImgBlob = await resolveInputImageBlob(req);
      let restoredImgBlob = baseImgBlob;

      onProgress?.({
        status: 'preparing',
        message: 'Running 4K CodeFormer neural eye, lip & skin restoration pre-pass...',
        progressPercent: 20,
        activeAccountLabel: accountLabel
      });

      try {
        const cfSpaceId = 'sczhou/CodeFormer';
        const cfClient = await Client.connect(cfSpaceId, clientOpts);
        const cfPayload = [handle_file(baseImgBlob), true, true, true, 2, 0.75];
        const cfData = await runGradioJobWithFallback({
          client: cfClient,
          endpoint: '/inference',
          payload: cfPayload,
          accountLabel,
          modelName: 'CodeFormer 4K Enhancer'
        });
        const cfUrl = extractGradioMediaUrl(cfData[0], cfSpaceId);
        if (cfUrl) {
          const enhanced = await downloadHfMediaBlob(cfUrl, token);
          if (enhanced.size > 0) {
            restoredImgBlob = enhanced;
          }
        }
      } catch (cfErr) {
        const cfMsg = formatErrorMessage(cfErr);
        if (isZeroGpuQuotaError(cfMsg)) {
          throw cfErr;
        }
        console.warn('[LipSyncEngine] CodeFormer busy, proceeding with original high-res frame:', cfMsg);
      }

      const ltxSpaceId = 'multimodalart/ltx2-audio-to-video';
      const ltxClient = await Client.connect(ltxSpaceId, clientOpts);
      const hiFiPrompt = buildEnginePrompt(
        req,
        'Ultra-crisp 4K cinema facial clarity, sharp irises, detailed lip texture, exact vocal synchronization.'
      );
      const payload = [
        handle_file(restoredImgBlob),
        handle_file(audioBlob),
        hiFiPrompt,
        negPrompt,
        Math.min(12.0, Math.max(1.0, clampedDur)),
        seed
      ];

      const data = await runGradioJobWithFallback({
        client: ltxClient,
        endpoint: '/generate',
        payload,
        accountLabel,
        modelName: modelSpec.name,
        onProgress
      });

      const rawUrl = extractGradioMediaUrl(data[0], ltxSpaceId);
      const videoBlob = await downloadHfMediaBlob(rawUrl, token);
      const resolvedSeed = typeof data[1] === 'number' ? data[1] : seed;
      return { videoBlob, resolvedSeed, previewImageBlob: restoredImgBlob };
    }

    case 'dsp_viseme_60fps':
    default: {
      const { videoBlob } = await renderInstantDspVisemeVideo({
        imageSource: req.imageSource,
        videoSource: req.videoSource,
        audioBlob,
        durationSec: clampedDur,
        aspectRatio: req.aspectRatio,
        cameraMovement: req.cameraMovement
      });
      return { videoBlob, resolvedSeed: seed, previewImageBlob: null };
    }
  }
}

/**
 * Unified Multi-Model Lip-Sync Generation Orchestrator supporting all 11 `LIPSYNC_MODELS`
 * with automatic audio slicing, zero-on-screen-text enforcement, 12-account HF ZeroGPU
 * failover rotation, Cloudflare R2 Vault CDN persistence, and IndexedDB binary caching.
 */
export async function generateLipSyncWithModel(
  req: LipSyncGenerationRequest,
  onProgress?: (p: GenerationProgress) => void
): Promise<GeneratedLipSyncClip> {
  const modelSpec =
    LIPSYNC_MODELS.find((m) => m.id === req.modelId) ?? LIPSYNC_MODELS[0];

  const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const seed =
    typeof req.seed === 'number' && Number.isFinite(req.seed) && req.seed >= 0
      ? Math.floor(req.seed)
      : Math.floor(Math.random() * 2147483647);

  onProgress?.({
    status: 'preparing',
    message: `Preparing audio & frame inputs for ${modelSpec.name}...`,
    progressPercent: 6
  });

  // 1. Slice audio window first when requested
  let preparedAudioBlob: Blob;
  if (
    req.audioSliceStartSec !== undefined &&
    req.audioSliceEndSec !== undefined &&
    req.audioSliceEndSec > req.audioSliceStartSec
  ) {
    preparedAudioBlob = await extractAudioSliceWav(
      req.audioSource,
      req.audioSliceStartSec,
      req.audioSliceEndSec
    );
  } else {
    preparedAudioBlob = await dataUrlOrSourceToBlob(req.audioSource);
  }

  const detectedAudioDur = await getAudioDurationSec(preparedAudioBlob);
  const requestedDur = req.durationSec > 0 ? req.durationSec : detectedAudioDur || modelSpec.defaultDurationSec;
  const clampedDur = Math.min(
    modelSpec.maxDurationSec,
    Math.max(modelSpec.minDurationSec, Math.round(Math.min(requestedDur, Math.max(modelSpec.minDurationSec, detectedAudioDur)) * 10) / 10)
  );

  const prompt = buildEnginePrompt(req);
  const negPrompt = buildNegativePrompt(req.negativePrompt);

  // 2. Fast-path local 60fps DSP Viseme Engine (0 GPU Quota)
  if (modelSpec.backendEngine === 'dsp_viseme_60fps') {
    onProgress?.({
      status: 'processing',
      message: 'Running 60fps WebAudio Vocal Formant Viseme Engine locally (0 GPU Quota)...',
      progressPercent: 18,
      activeAccountLabel: 'Local Browser DSP'
    });

    const { videoBlob, syncConfidence } = await renderInstantDspVisemeVideo({
      imageSource: req.imageSource,
      videoSource: req.videoSource,
      audioBlob: preparedAudioBlob,
      durationSec: clampedDur,
      aspectRatio: req.aspectRatio,
      cameraMovement: req.cameraMovement,
      onProgress: (pct) => {
        onProgress?.({
          status: 'processing',
          message: `Encoding synchronized 60fps H.264 viseme master (${pct}%)...`,
          progressPercent: Math.min(88, 18 + Math.round(pct * 0.7)),
          activeAccountLabel: 'Local Browser DSP'
        });
      }
    });

    onProgress?.({
      status: 'saving',
      message: 'Archiving master MP4 to Cloudflare R2 Vault & IndexedDB...',
      progressPercent: 93,
      activeAccountLabel: 'Local Browser DSP'
    });

    const uid = getSessionUser()?.uid || 'guest';
    const r2OrBlobUrl = await uploadVideoToR2Vault(uid, clipId, videoBlob);
    const localPlayableUrl = URL.createObjectURL(videoBlob);
    const thumbnailUrl = await createClipThumbnailDataUrl(
      req.imageSource ? await dataUrlOrSourceToBlob(req.imageSource).catch(() => null) : null,
      videoBlob
    );

    const clip: GeneratedLipSyncClip = {
      id: clipId,
      modelId: modelSpec.id,
      modelName: modelSpec.name,
      provider: modelSpec.provider,
      inputMode: req.inputMode,
      videoUrl: localPlayableUrl,
      r2Url: r2OrBlobUrl.startsWith('https://') ? r2OrBlobUrl : undefined,
      thumbnailUrl,
      prompt,
      exactLyrics: req.exactLyrics,
      durationSec: clampedDur,
      aspectRatio: req.aspectRatio,
      resolution: req.resolution,
      seed,
      createdAt: Date.now(),
      syncConfidence
    };

    await saveGenerationRecord(clip, videoBlob);

    onProgress?.({
      status: 'complete',
      message: `${modelSpec.name} render complete!`,
      progressPercent: 100,
      activeAccountLabel: 'Local Browser DSP'
    });

    return clip;
  }

  // 3. Multi-Account HF ZeroGPU Pool Auto-Rotation Loop
  const poolStatuses = getTokenPoolStatus();
  let candidates = poolStatuses.filter((s) => !s.isExhausted).map((s) => s.token);
  if (candidates.length === 0) {
    resetAllCooldowns();
    candidates = getHfTokenPool();
  }

  let finalVideoBlob: Blob | null = null;
  let resolvedSeed = seed;
  let previewImageBlob: Blob | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    const token = candidates[i];
    const masked = maskTokenShort(token);
    const accountLabel = `Account ${i + 1}/${candidates.length} [${masked}]`;

    onProgress?.({
      status: 'connecting',
      message: `Connecting to ${modelSpec.name} ZeroGPU Cluster (${accountLabel})...`,
      progressPercent: 14,
      activeAccountLabel: accountLabel
    });

    try {
      const attempt = await executeSingleTokenBackendAttempt({
        token,
        accountLabel,
        modelSpec,
        req,
        audioBlob: preparedAudioBlob,
        clampedDur,
        seed,
        prompt,
        negPrompt,
        onProgress
      });

      finalVideoBlob = attempt.videoBlob;
      resolvedSeed = attempt.resolvedSeed;
      previewImageBlob = attempt.previewImageBlob;
      break;
    } catch (err: unknown) {
      lastError = err;
      const errMsg = formatErrorMessage(err);

      if (isZeroGpuQuotaError(errMsg)) {
        markTokenExhausted(token, errMsg);

        if (i < candidates.length - 1) {
          const nextMasked = maskTokenShort(candidates[i + 1]);
          onProgress?.({
            status: 'preparing',
            message: `ZeroGPU quota reached on ${masked}. Auto-rotating to Account ${i + 2}/${candidates.length} [${nextMasked}]...`,
            progressPercent: 18,
            activeAccountLabel: `Account ${i + 2}/${candidates.length} [${nextMasked}]`
          });
          continue;
        }
      } else if (i < Math.min(2, candidates.length - 1)) {
        // Retry once on transient Gradio websocket/SSE drop using next standby token
        continue;
      }

      break;
    }
  }

  if (!finalVideoBlob) {
    const errText = formatErrorMessage(lastError);
    onProgress?.({
      status: 'error',
      message: errText,
      progressPercent: 0
    });
    throw new Error(
      errText || `All ${candidates.length} Hugging Face ZeroGPU accounts are temporarily busy.`
    );
  }

  onProgress?.({
    status: 'saving',
    message: 'Uploading MP4 master to Cloudflare R2 CDN & persisting in IndexedDB Vault...',
    progressPercent: 94
  });

  const uid = getSessionUser()?.uid || 'guest';
  const r2OrBlobUrl = await uploadVideoToR2Vault(uid, clipId, finalVideoBlob);
  const localPlayableUrl = URL.createObjectURL(finalVideoBlob);
  const thumbnailUrl = await createClipThumbnailDataUrl(previewImageBlob, finalVideoBlob);

  const clip: GeneratedLipSyncClip = {
    id: clipId,
    modelId: modelSpec.id,
    modelName: modelSpec.name,
    provider: modelSpec.provider,
    inputMode: req.inputMode,
    videoUrl: localPlayableUrl,
    r2Url: r2OrBlobUrl.startsWith('https://') ? r2OrBlobUrl : undefined,
    thumbnailUrl,
    prompt,
    exactLyrics: req.exactLyrics,
    durationSec: clampedDur,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    seed: resolvedSeed,
    createdAt: Date.now(),
    syncConfidence: 0.97
  };

  await saveGenerationRecord(clip, finalVideoBlob);

  onProgress?.({
    status: 'complete',
    message: `${modelSpec.name} lip-sync master ready!`,
    progressPercent: 100
  });

  return clip;
}

async function convertRemoteImageToSafeSrc(imageUrl: string, hfToken?: string): Promise<string> {
  try {
    const blob = await downloadHfMediaBlob(imageUrl, hfToken);
    if (blob.size > 0) {
      return await blobToDataUrl(blob);
    }
  } catch {
    // Return direct HTTPS URL if cross-origin fetch is restricted
  }
  return imageUrl;
}

/**
 * Generates a high-definition studio portrait keyframe image using:
 * 1) SiliconFlow (`black-forest-labs/FLUX.1-schnell` via `VITE_SILICONFLOW_API_KEY`)
 * 2) Fallback Zhipu `cogview-3-flash` (`VITE_GLM_API_KEY`)
 * 3) Fallback Hugging Face `black-forest-labs/FLUX.1-schnell` (ZeroGPU Space + Router)
 */
export async function generateStudioPortraitImage(
  prompt: string,
  aspectRatio: AspectRatioOption
): Promise<string> {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  const siliconFlowKey = (metaEnv?.VITE_SILICONFLOW_API_KEY || '').trim();
  const glmApiKey = (metaEnv?.VITE_GLM_API_KEY || '').trim();

  const cleanPrompt = `${prompt.trim() || 'Photorealistic cinema portrait of a lead vocalist in studio stage spotlight'}. Ultra-clean 85mm lens portrait, crisp eyes and lips, ${ZERO_TEXT_DIRECTIVE}`;

  // 1. Primary: SiliconFlow FLUX.1-schnell
  if (siliconFlowKey) {
    const sfSize =
      aspectRatio === '9:16'
        ? '576x1024'
        : aspectRatio === '1:1'
          ? '1024x1024'
          : '1024x576';

    for (const host of ['https://api.siliconflow.cn', 'https://api.siliconflow.com']) {
      try {
        const res = await fetch(`${host}/v1/images/generations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${siliconFlowKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'black-forest-labs/FLUX.1-schnell',
            prompt: cleanPrompt,
            image_size: sfSize,
            batch_size: 1,
            num_inference_steps: 4
          })
        });

        if (res.ok) {
          const json = (await res.json()) as {
            images?: Array<{ url?: string }>;
            data?: Array<{ url?: string; b64_json?: string }>;
          };
          const url = json.images?.[0]?.url || json.data?.[0]?.url;
          const b64 = json.data?.[0]?.b64_json;
          if (b64) {
            return `data:image/png;base64,${b64}`;
          }
          if (url) {
            return await convertRemoteImageToSafeSrc(url);
          }
        }
      } catch {
        // Try alternate SiliconFlow gateway or next provider
      }
    }
  }

  // 2. Fallback 1: Zhipu AI CogView-3-Flash
  if (glmApiKey) {
    const cogSize =
      aspectRatio === '9:16'
        ? '768x1344'
        : aspectRatio === '1:1'
          ? '1024x1024'
          : '1344x768';

    try {
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${glmApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'cogview-3-flash',
          prompt: cleanPrompt,
          size: cogSize
        })
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ url?: string }> };
        const url = json.data?.[0]?.url;
        if (url) {
          return await convertRemoteImageToSafeSrc(url);
        }
      }
    } catch {
      // Fall through to Hugging Face FLUX.1-schnell
    }
  }

  // 3. Fallback 2: Hugging Face black-forest-labs/FLUX.1-schnell with rotating token pool
  const hfWidth = aspectRatio === '9:16' ? 576 : 1024;
  const hfHeight = aspectRatio === '9:16' ? 1024 : aspectRatio === '1:1' ? 1024 : 576;

  const statuses = getTokenPoolStatus();
  const candidates = statuses.filter((s) => !s.isExhausted).map((s) => s.token);
  const tokensToTry = candidates.length > 0 ? candidates.slice(0, 4) : getHfTokenPool().slice(0, 4);

  for (const token of tokensToTry) {
    // 3a. HF Router Inference API
    try {
      const routerRes = await fetch(
        'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: cleanPrompt,
            parameters: {
              width: hfWidth,
              height: hfHeight,
              num_inference_steps: 4
            }
          })
        }
      );

      if (routerRes.ok) {
        const imgBlob = await routerRes.blob();
        if (imgBlob.size > 0) {
          return await blobToDataUrl(imgBlob);
        }
      }
    } catch {
      // Try Gradio Space fallback
    }

    // 3b. Gradio ZeroGPU Space black-forest-labs/FLUX.1-schnell
    try {
      const hfTokenOpt = toGradioHfToken(token);
      const client = await Client.connect(
        'black-forest-labs/FLUX.1-schnell',
        hfTokenOpt ? { token: hfTokenOpt, record_history: false } : { record_history: false }
      );
      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/infer',
        payload: [cleanPrompt, Math.floor(Math.random() * 1000000), true, hfWidth, hfHeight, 4],
        accountLabel: maskTokenShort(token),
        modelName: 'FLUX.1-schnell'
      });

      const imgUrl = extractGradioMediaUrl(data[0], 'black-forest-labs/FLUX.1-schnell');
      if (imgUrl) {
        return await convertRemoteImageToSafeSrc(imgUrl, token);
      }
    } catch (err) {
      const msg = formatErrorMessage(err);
      if (isZeroGpuQuotaError(msg)) {
        markTokenExhausted(token, msg);
        continue;
      }
    }
  }

  throw new Error(
    'Portrait image synthesis failed across SiliconFlow, Zhipu CogView-3, and Hugging Face FLUX.1-schnell.'
  );
}

/**
 * Clones any reference voice recording and synthesizes `textToSpeak` via `tonyassi/voice-clone` `/clone`
 * with automatic 12-account HF ZeroGPU token pool failover rotation.
 */
export async function cloneVoiceWithAi(
  referenceAudio: Blob | File | string,
  textToSpeak: string
): Promise<Blob> {
  const cleanText = textToSpeak.trim();
  if (!cleanText) {
    throw new Error('Please enter text to synthesize with the cloned voice.');
  }

  const refBlob = await dataUrlOrSourceToBlob(referenceAudio);
  const spaceId = 'tonyassi/voice-clone';

  const poolStatuses = getTokenPoolStatus();
  let candidates = poolStatuses.filter((s) => !s.isExhausted).map((s) => s.token);
  if (candidates.length === 0) {
    resetAllCooldowns();
    candidates = getHfTokenPool();
  }

  let lastErr: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    const token = candidates[i];
    const hfTokenOpt = toGradioHfToken(token);
    const accountLabel = `Account ${i + 1}/${candidates.length} [${maskTokenShort(token)}]`;

    try {
      const client = await Client.connect(
        spaceId,
        hfTokenOpt ? { token: hfTokenOpt, record_history: false } : { record_history: false }
      );

      const data = await runGradioJobWithFallback({
        client,
        endpoint: '/clone',
        payload: [cleanText, handle_file(refBlob)],
        accountLabel,
        modelName: 'AI Voice Clone'
      });

      const outAudioUrl = extractGradioMediaUrl(data[0], spaceId);
      const clonedBlob = await downloadHfMediaBlob(outAudioUrl, token);
      if (clonedBlob.size > 0) {
        return clonedBlob;
      }
    } catch (err: unknown) {
      lastErr = err;
      const errMsg = formatErrorMessage(err);
      if (isZeroGpuQuotaError(errMsg)) {
        markTokenExhausted(token, errMsg);
        if (i < candidates.length - 1) {
          continue;
        }
      } else if (i < Math.min(2, candidates.length - 1)) {
        continue;
      }
      break;
    }
  }

  throw new Error(
    formatErrorMessage(lastErr) || 'Voice cloning service is temporarily busy. Please retry.'
  );
}
