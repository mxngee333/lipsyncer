import { LipSyncModelSpec } from '../types';

export const LIPSYNC_MODELS: LipSyncModelSpec[] = [
  {
    id: 'ltx-2-5-audio',
    name: 'LTX 2.5 Audio-to-Video',
    provider: 'Lightricks',
    badges: [{ label: 'New', variant: 'new' }],
    description: 'Generate video from audio with LTX 2.5',
    features: ['Start/End', 'Audio', 'Image Lip-Sync'],
    resolutionLabel: '720p-4K',
    durationLabel: '2-20s',
    minDurationSec: 2,
    maxDurationSec: 12,
    defaultDurationSec: 6,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: true,
    supportsReference: false,
    creditCost: 15,
    arenaElo: 1294,
    arenaRank: 2,
    accentColor: '#38bdf8',
    backendEngine: 'ltx2_audio_video',
    hfSpaceId: 'multimodalart/ltx2-audio-to-video'
  },
  {
    id: 'seedance-2-mini',
    name: 'Seedance 2.0 Mini',
    provider: 'ByteDance',
    badges: [
      { label: 'Arena Top 5', variant: 'arena_top' },
      { label: 'New', variant: 'new' }
    ],
    description: 'Cinematic videos with audio & multi-shots',
    features: ['Reference', 'Start/End', 'Audio', 'Image Lip-Sync'],
    resolutionLabel: '480-720p',
    durationLabel: '4-15s',
    minDurationSec: 4,
    maxDurationSec: 12,
    defaultDurationSec: 6,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: true,
    supportsReference: true,
    creditCost: 12,
    arenaElo: 1286,
    arenaRank: 3,
    accentColor: '#2dd4bf',
    backendEngine: 'minimax_h3_audio',
    hfSpaceId: 'multimodalart/minimax-h3-audio-to-video'
  },
  {
    id: 'latentsync-1-5',
    name: 'ByteDance LatentSync 1.5',
    provider: 'ByteDance',
    badges: [
      { label: 'Arena Top 5', variant: 'arena_top' },
      { label: 'Video Sync', variant: 'video_sync' }
    ],
    description: 'True Video + Audio neural diffusion mouth, teeth & jaw re-synchronization',
    features: ['Video Lip-Sync', 'Audio', 'Reference'],
    resolutionLabel: '720p-1080p',
    durationLabel: '2-15s',
    minDurationSec: 2,
    maxDurationSec: 12,
    defaultDurationSec: 5,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: true,
    creditCost: 20,
    arenaElo: 1318,
    arenaRank: 1,
    accentColor: '#c084fc',
    backendEngine: 'latentsync_video_audio',
    hfSpaceId: 'fffiloni/LatentSync'
  },
  {
    id: 'kling-3-omni',
    name: 'Kling 3.0 Omni',
    provider: 'Kling AI',
    badges: [],
    description: 'Enhanced multimodal references',
    features: ['Reference', 'Multi-shots', 'Audio', 'Video Lip-Sync'],
    resolutionLabel: '720p-4K',
    durationLabel: '3-15s',
    minDurationSec: 3,
    maxDurationSec: 12,
    defaultDurationSec: 6,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: true,
    creditCost: 25,
    arenaElo: 1279,
    arenaRank: 4,
    accentColor: '#34d399',
    backendEngine: 'kling_liveportrait_mux',
    hfSpaceId: 'KlingTeam/LivePortrait'
  },
  {
    id: 'pixverse-c1',
    name: 'PixVerse C1',
    provider: 'PixVerse',
    badges: [{ label: 'New', variant: 'new' }],
    description: 'Great for short videos',
    features: ['Start/End', 'Reference', 'Audio'],
    resolutionLabel: '360-1080p',
    durationLabel: '1-15s',
    minDurationSec: 2,
    maxDurationSec: 10,
    defaultDurationSec: 4,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: true,
    supportsReference: true,
    creditCost: 10,
    arenaElo: 1245,
    arenaRank: 7,
    accentColor: '#f472b6',
    backendEngine: 'wan_faster_mux',
    hfSpaceId: 'zerogpu-aoti/wan2-2-fp8da-aoti-faster'
  },
  {
    id: 'pixverse-v6',
    name: 'PixVerse V6',
    provider: 'PixVerse',
    badges: [{ label: 'New', variant: 'new' }],
    description: 'Great for short videos',
    features: ['Start/End', 'Reference', 'Audio', 'Image Lip-Sync'],
    resolutionLabel: '360-1080p',
    durationLabel: '1-15s',
    minDurationSec: 2,
    maxDurationSec: 12,
    defaultDurationSec: 5,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: true,
    supportsReference: true,
    creditCost: 12,
    arenaElo: 1258,
    arenaRank: 6,
    accentColor: '#fb7185',
    backendEngine: 'ltx2_audio_video',
    hfSpaceId: 'multimodalart/ltx2-audio-to-video'
  },
  {
    id: 'happyhorse-1-1',
    name: 'HappyHorse 1.1',
    provider: 'HappyHorse',
    badges: [{ label: 'New', variant: 'new' }],
    description: 'Cinematic videos with multi-shot narrative & native audio',
    features: ['Start Frame', 'Audio', 'Multi-shots'],
    resolutionLabel: '720-1080p',
    durationLabel: '3-15s',
    minDurationSec: 3,
    maxDurationSec: 12,
    defaultDurationSec: 6,
    supportsVideoInput: false,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: false,
    creditCost: 18,
    arenaElo: 1264,
    arenaRank: 5,
    accentColor: '#e2e8f0',
    backendEngine: 'minimax_h3_audio',
    hfSpaceId: 'multimodalart/minimax-h3-audio-to-video'
  },
  {
    id: 'happyhorse-1-0',
    name: 'HappyHorse',
    provider: 'HappyHorse',
    badges: [],
    description: 'Cinematic videos with multi-shot narrative & native audio',
    features: ['Start Frame', 'Audio'],
    resolutionLabel: '720-1080p',
    durationLabel: '3-15s',
    minDurationSec: 3,
    maxDurationSec: 10,
    defaultDurationSec: 5,
    supportsVideoInput: false,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: false,
    creditCost: 14,
    arenaElo: 1232,
    arenaRank: 9,
    accentColor: '#94a3b8',
    backendEngine: 'minimax_h3_audio',
    hfSpaceId: 'multimodalart/minimax-h3-audio-to-video'
  },
  {
    id: 'wan-2-7',
    name: 'Wan 2.7',
    provider: 'Alibaba Wan',
    badges: [],
    description: 'Cinematic videos with audio & start/end frame control',
    features: ['Start/End', 'Audio'],
    resolutionLabel: '720-1080p',
    durationLabel: '2-15s',
    minDurationSec: 2,
    maxDurationSec: 8,
    defaultDurationSec: 4,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: true,
    supportsReference: false,
    creditCost: 16,
    arenaElo: 1252,
    arenaRank: 8,
    accentColor: '#818cf8',
    backendEngine: 'wan_dualframe_mux',
    hfSpaceId: 'r3gm/wan2-2-fp8da-aoti-preview2'
  },
  {
    id: 'veo-3-1',
    name: 'Veo 3.1',
    provider: 'Google DeepMind',
    badges: [],
    description: 'High fidelity videos with audio & 4K',
    features: ['Reference', 'Start/End', 'Audio', '4K', 'Image Lip-Sync'],
    resolutionLabel: '4K',
    durationLabel: '4-8s',
    minDurationSec: 4,
    maxDurationSec: 8,
    defaultDurationSec: 6,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: true,
    supportsReference: true,
    creditCost: 30,
    arenaElo: 1272,
    arenaRank: 5,
    accentColor: '#60a5fa',
    backendEngine: 'codeformer_ltx_4k',
    hfSpaceId: 'multimodalart/ltx2-audio-to-video'
  },
  {
    id: 'latentsync-fal',
    name: 'ByteDance LatentSync (Fal.ai Cloud)',
    provider: 'ByteDance',
    badges: [
      { label: 'Fal.ai Cloud', variant: 'new' },
      { label: 'Ultra-Fast', variant: 'video_sync' }
    ],
    description: 'High-speed cloud-accelerated neural mouth, teeth & jaw re-synchronization via Fal.ai',
    features: ['Video Lip-Sync', 'Image Lip-Sync', 'Audio', '4K'],
    resolutionLabel: '1080p',
    durationLabel: '2-15s',
    minDurationSec: 2,
    maxDurationSec: 15,
    defaultDurationSec: 6,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: true,
    creditCost: 10,
    arenaElo: 1330,
    arenaRank: 1,
    accentColor: '#ec4899',
    backendEngine: 'fal_latentsync'
  },
  {
    id: 'wan-2-1-fal',
    name: 'Wan 2.1 Video (Fal.ai Cloud)',
    provider: 'Alibaba Wan',
    badges: [
      { label: 'Fal.ai Cloud', variant: 'new' },
      { label: 'Cinematic', variant: 'arena_top' }
    ],
    description: 'Ultra-photorealistic cinematic video generation via Fal.ai Wan 2.1 cluster',
    features: ['Image Lip-Sync', 'Audio', 'Reference', '4K'],
    resolutionLabel: '1080p',
    durationLabel: '5-10s',
    minDurationSec: 4,
    maxDurationSec: 10,
    defaultDurationSec: 5,
    supportsVideoInput: false,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: true,
    creditCost: 14,
    arenaElo: 1320,
    arenaRank: 2,
    accentColor: '#f97316',
    backendEngine: 'fal_wan_video'
  },
  {
    id: 'lipsyncer-dsp-60fps',
    name: 'LipSyncer 60fps DSP Instant',
    provider: 'LipSyncer DSP',
    badges: [{ label: 'Instant 0-Quota', variant: 'instant' }],
    description: 'Zero-wait browser WebAudio vocal formant viseme & 60fps H.264 MP4 sync engine',
    features: ['Video Lip-Sync', 'Image Lip-Sync', 'Audio'],
    resolutionLabel: '1080p 60fps',
    durationLabel: '1-60s',
    minDurationSec: 1,
    maxDurationSec: 30,
    defaultDurationSec: 6,
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsEndFrame: false,
    supportsReference: false,
    creditCost: 0,
    arenaElo: 1210,
    arenaRank: 10,
    accentColor: '#10b981',
    backendEngine: 'dsp_viseme_60fps'
  }
];

export const LIPSYNC_PROMPT_PRESETS = [
  {
    id: 'vocal_singer',
    label: 'Lead Vocalist Singing',
    prompt:
      'Authentic 4K cinema close-up of the vocalist singing passionately, lips and jaw articulating every syllable in exact sync with the vocal audio, natural eye blinks, warm stage spotlight rim lighting, ARRI Alexa 85mm shallow depth of field, zero visible text.'
  },
  {
    id: 'podcast_speaker',
    label: 'Podcast / Studio Host',
    prompt:
      'Photorealistic studio host speaking naturally into a broadcast microphone, precise lip-sync articulation matching spoken words, authentic facial micro-expressions, subtle head nod, soft key light, zero on-screen text.'
  },
  {
    id: 'cinematic_monologue',
    label: 'Cinematic Film Dialogue',
    prompt:
      'Dramatic 35mm cinema portrait delivering emotional dialogue, exact mouth and lip phoneme synchronization with source audio, subtle chest breathing, natural skin texture, moody anamorphic bokeh, zero subtitles.'
  },
  {
    id: 'gospel_worship',
    label: 'Soulful Worship Performance',
    prompt:
      'Heartfelt soulful live vocal performance in warm golden stage lighting, expressive singing mouth sync matching vocal phrasing, dignified stage attire, gentle rhythmic sway, photorealistic cinema camera capture, zero text.'
  }
];

export const MODEL_PROVIDERS_LIST = [
  'All providers',
  'Lightricks',
  'ByteDance',
  'Kling AI',
  'PixVerse',
  'HappyHorse',
  'Alibaba Wan',
  'Google DeepMind',
  'LipSyncer DSP'
] as const;

export const MODEL_FEATURES_LIST = [
  'All features',
  'Audio',
  'Video Lip-Sync',
  'Image Lip-Sync',
  'Start/End',
  'Start Frame',
  'Reference',
  'Multi-shots',
  '4K'
] as const;

export function getRecommendedModelForMediaMode(mode: 'image_audio' | 'video_audio'): LipSyncModelSpec {
  if (mode === 'video_audio') {
    return (
      LIPSYNC_MODELS.find((m) => m.supportsVideoInput && m.id === 'latentsync_1_5') ??
      LIPSYNC_MODELS.find((m) => m.supportsVideoInput) ??
      LIPSYNC_MODELS[0]
    );
  }
  return (
    LIPSYNC_MODELS.find((m) => m.supportsImageInput && m.id === 'seedance_2_0_mini') ??
    LIPSYNC_MODELS.find((m) => m.supportsImageInput) ??
    LIPSYNC_MODELS[0]
  );
}

