export type StudioTab =
  | 'lipsync_studio'
  | 'model_arena'
  | 'storyboard_director'
  | 'creations_vault'
  | 'models_hub';

export type InputMediaMode = 'image_audio' | 'video_audio';

export type AspectRatioOption = '16:9' | '9:16' | '1:1';

export type ModelProvider =
  | 'Lightricks'
  | 'ByteDance'
  | 'Kling AI'
  | 'PixVerse'
  | 'HappyHorse'
  | 'Alibaba Wan'
  | 'Google DeepMind'
  | 'LipSyncer DSP';

export type ModelFeatureTag =
  | 'Audio'
  | 'Video Lip-Sync'
  | 'Image Lip-Sync'
  | 'Start/End'
  | 'Start Frame'
  | 'Reference'
  | 'Multi-shots'
  | '4K';

export interface LipSyncModelSpec {
  id: string;
  name: string;
  provider: ModelProvider;
  badges: Array<{
    label: string;
    variant: 'new' | 'arena_top' | 'instant' | 'video_sync';
  }>;
  description: string;
  features: ModelFeatureTag[];
  resolutionLabel: string;
  durationLabel: string;
  minDurationSec: number;
  maxDurationSec: number;
  defaultDurationSec: number;
  supportsVideoInput: boolean;
  supportsImageInput: boolean;
  supportsEndFrame: boolean;
  supportsReference: boolean;
  creditCost: number;
  arenaElo: number;
  arenaRank: number;
  accentColor: string;
  backendEngine:
    | 'ltx2_audio_video'
    | 'latentsync_video_audio'
    | 'minimax_h3_audio'
    | 'kling_liveportrait_mux'
    | 'wan_faster_mux'
    | 'wan_dualframe_mux'
    | 'codeformer_ltx_4k'
    | 'dsp_viseme_60fps'
    | 'fal_latentsync'
    | 'fal_wan_video';
  hfSpaceId?: string;
}

export interface GenerationProgress {
  status:
    | 'idle'
    | 'preparing'
    | 'connecting'
    | 'queueing'
    | 'processing'
    | 'muxing'
    | 'saving'
    | 'complete'
    | 'error';
  message: string;
  progressPercent: number;
  queuePosition?: number | null;
  etaSeconds?: number | null;
  activeAccountLabel?: string;
}

export interface LipSyncGenerationRequest {
  modelId: string;
  inputMode: InputMediaMode;
  imageSource?: string | Blob | File | null;
  endImageSource?: string | Blob | File | null;
  videoSource?: string | Blob | File | null;
  referenceImageSource?: string | Blob | File | null;
  audioSource: string | Blob | File;
  audioSliceStartSec?: number;
  audioSliceEndSec?: number;
  prompt: string;
  negativePrompt?: string;
  exactLyrics?: string;
  aspectRatio: AspectRatioOption;
  resolution: '480p' | '720p' | '1080p' | '4K';
  durationSec: number;
  seed?: number;
  cameraMovement?: CameraMotionPreset;
  preserveZeroOnScreenText?: boolean;
}

export interface GeneratedLipSyncClip {
  id: string;
  modelId: string;
  modelName: string;
  provider: ModelProvider;
  inputMode: InputMediaMode;
  videoUrl: string;
  r2Url?: string;
  thumbnailUrl?: string;
  prompt: string;
  exactLyrics?: string;
  durationSec: number;
  aspectRatio: AspectRatioOption;
  resolution: string;
  seed: number;
  createdAt: number;
  syncConfidence?: number;
}

export type CameraMotionPreset =
  | 'push_in'
  | 'slow_pan'
  | 'drone_pull_back'
  | 'orbital_spin'
  | 'handheld_cinema'
  | 'macro_dof';

export interface LipSyncerUser {
  uid: string;
  email: string;
  firstName: string;
  dob?: string;
  photoURL?: string;
  authProvider: 'email' | 'google';
  createdAt: number;
}

export interface TokenPoolEntryStatus {
  token: string;
  masked: string;
  isExhausted: boolean;
  cooldownUntil?: number;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC VIDEO STORYBOARD & OMNI DIRECTOR TYPES (20-Scene Canonical Pipeline)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type FeltTempoClass =
  | 'SLOW'
  | 'SLOW-TO-MID'
  | 'MID-TEMPO'
  | 'UP-TEMPO'
  | 'HIGH/FAST';

export interface SongDnaProfile {
  songTitle: string;
  artistName: string;
  audioDurationSec: number;
  audioDurationFormatted: string;
  genreStyle: string;
  songCharacter: string;
  feltTempoClass: FeltTempoClass;
  primaryGrooveBpm: number;
  alternateGridBpm: number | null;
  alternateGridType: 'DOUBLE-TIME' | 'HALF-TIME' | 'NONE';
  meter: string;
  beatLengthSec: number;
  barLength44Sec: number;
  tenSecondOmniBarCapacity: number;
  energyArc: string;
  performanceFeel: string;
  cameraFeel: string;
  expertTempoInterpretation: string;
  musicalStyleLockLine: string;
}

export type StoryboardSceneType =
  | 'LIP-SYNC'
  | 'NARRATIVE'
  | 'B-ROLL'
  | 'TRANSITION'
  | 'NO LIP-SYNC';

export interface StoryboardDirectorScene {
  sceneNumber: number; // 1..20
  sceneCode: string;   // "01".."20"
  folderBatch: 'A' | 'B';
  shortName: string;
  imageFilename: string;
  narrativeArcRole: string;
  timeStartSec: number;
  timeEndSec: number;
  songWindowFormatted: string;
  syncMode: 'LIP-SYNC' | 'NO LIP-SYNC';
  sceneType: StoryboardSceneType;
  exactLyrics: string;
  repetitionCount: number;
  shotType: string;
  cameraMovement: CameraMotionPreset;
  cameraDirectionText: string;
  subjectActionText: string;
  environmentMotionText: string;
  emotionalTone: string;
  transitionNote: string;
  imagePrompt: string;
  primaryOmniPrompt: string;
  actionOnlyOmniPrompt: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  selectedModelId?: string;
  isGeneratingImage?: boolean;
  isGeneratingVideo?: boolean;
  done?: boolean;
  notes?: string;
}

export interface StoryboardDirectorProject {
  id: string;
  songTitle: string;
  artistName: string;
  artistReferenceImageUrl?: string;
  artistDescription: string;
  genderLock: 'auto' | 'female' | 'male' | 'duo_group';
  modestyPreset: 'sacred_gospel' | 'contemporary_stage' | 'casual_studio';
  rawLyrics: string;
  songDna: SongDnaProfile;
  scenes: StoryboardDirectorScene[];
  updatedAt: number;
}
