export type StudioTab =
  | 'lipsync_studio'
  | 'full_song_video'
  | 'model_arena'
  | 'storyboard_director'
  | 'creations_vault'
  | 'models_hub';

export type InputMediaMode = 'image_audio' | 'video_audio' | 'full_song_video';

export type AspectRatioOption = '16:9' | '9:16' | '1:1';

export type ModelProvider =
  | 'Lightricks'
  | 'ByteDance'
  | 'Kling AI'
  | 'PixVerse'
  | 'HappyHorse'
  | 'Alibaba Wan'
  | 'Google DeepMind'
  | 'LipSyncer DSP'
  | 'Creatify'
  | 'OpenArt'
  | 'Hedra';

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
  isOpenArtOfficial?: boolean;
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
  /** Audio file name / phrase that drove the lip-sync (used in download filenames). */
  audioName?: string;
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
  activePromptEdition?: OmniPromptEdition;
  geniusRecommendedEdition?: OmniPromptEdition;
  geniusSettingCategory?: GeniusSceneSettingCategory;
  geniusReason?: string;
  barByBarLyrics?: string;
  preLyricWindow?: string;
  lipSyncWindow?: string;
  postLyricWindow?: string;
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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FULL SONG VIDEO MODE TYPES (Audio Chunking + Vocal DSP Lyric Sync +
 * On-The-Fly Commensurate Scene Frame Synthesis + Exact Master Video Merge)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type FullSongChunkMode =
  | 'smart_vocal_dsp'
  | 'fixed_interval'
  | 'target_scene_count';

export type FullSongSceneFrameSource =
  | 'uploaded'
  | 'commensurate_synthesized'
  | 'ai_cloud_generated';

export type OmniPromptEdition = 'PRIMARY_LIPSYNC' | 'ACTION_ONLY_ANIMATE';

export type GeniusSceneSettingCategory =
  | 'Instrumental Intro'
  | 'Market & Commerce'
  | 'Office & Workplace'
  | 'Family & Domestic'
  | 'Transit & Commute'
  | 'Community Outreach'
  | 'Silent Prayer Circle'
  | 'Neighborhood Walk Serenade'
  | 'Sanctuary & Worship'
  | 'Rooftop & Porch Testimony'
  | 'Communal Celebration';

export interface OmniHtmlGuideSceneData {
  sceneNumber: number; // 1..20
  sceneCode: string; // "01".."20"
  imageFileName: string; // e.g. "05_Golden_Hour_Market_Handshake.png"
  sceneTitle: string; // e.g. "Golden Hour Market Handshake"
  songEditWindow: string; // e.g. "00:31.8 - 00:37.1"
  startTimeSec: number; // e.g. 31.8
  endTimeSec: number; // e.g. 37.1
  omniDurationSec: number; // e.g. 10.0
  guideDefaultMode: 'LIP-SYNC' | 'NO LIP-SYNC';
  barByBarLyrics: string;
  cleanSungLyrics: string;
  preLyricWindow?: string; // e.g. "0.0s - 2.4s"
  lipSyncWindow?: string; // e.g. "2.4s - 4.3s"
  postLyricWindow?: string; // e.g. "4.3s - 10.0s"
  preLyricStartSec?: number;
  lipSyncStartSec?: number;
  lipSyncEndSec?: number;
  primaryOmniPrompt: string;
  actionOnlyOmniPrompt: string;
  actionOnlySummary: string;
  geniusRecommendedEdition: OmniPromptEdition;
  geniusSettingCategory: GeniusSceneSettingCategory;
  geniusReason: string;
  geniusConfidence: number;
}

export interface OmniHtmlGuideParsedProject {
  songTitle: string;
  audioDurationSec: number;
  audioDurationFormatted: string;
  primaryGrooveBpm: number;
  doubleTimeBpm: number;
  meter: string;
  genreStyle: string;
  musicalStyleLock: string;
  scenes: OmniHtmlGuideSceneData[];
}

export interface FullSongVideoChunk {
  chunkIndex: number; // 1..N
  chunkCode: string; // "01".."20"
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  timeWindowFormatted: string; // "00:00.0 - 00:08.5"
  audioChunkBlob?: Blob;
  audioChunkUrl?: string;
  audioChunkFileName: string;
  vocalEnergyScore: number; // 0.0 .. 1.0 (from Vocal Formant DSP)
  syncMode: 'LIP-SYNC' | 'CINEMATIC-MOTION';
  syncedLyrics: string;
  lyricSyncConfidence: number; // 0.94 .. 0.99
  imageSourceUrl: string;
  frameSourceType: FullSongSceneFrameSource;
  commensurateSceneLabel: string;
  cameraMovement: CameraMotionPreset;
  prompt: string;
  primaryOmniPrompt?: string;
  actionOnlyOmniPrompt?: string;
  actionOnlySummary?: string;
  activePromptEdition?: OmniPromptEdition;
  geniusRecommendedEdition?: OmniPromptEdition;
  geniusSettingCategory?: GeniusSceneSettingCategory;
  geniusReason?: string;
  barByBarLyrics?: string;
  preLyricWindow?: string;
  lipSyncWindow?: string;
  postLyricWindow?: string;
  lipSyncStartRelSec?: number;
  lipSyncEndRelSec?: number;
  selectedModelId: string;
  generatedVideoUrl?: string;
  generatedVideoBlob?: Blob;
  status: 'ready' | 'synthesizing_frame' | 'rendering_lipsync' | 'completed' | 'error';
  progressPercent?: number;
  errorMessage?: string;
}

export interface FullSongLyricSyncResult {
  alignedChunks: Array<{
    chunkIndex: number;
    startTimeSec: number;
    endTimeSec: number;
    syncedLyrics: string;
    syncMode: 'LIP-SYNC' | 'CINEMATIC-MOTION';
    vocalEnergyScore: number;
    confidence: number;
  }>;
  detectedBpm: number;
  feltGrooveBpm: number;
  vocalIslandsCount: number;
  lrcFormattedText: string;
  overallSyncConfidence: number;
}

/**
 * Represents a single storyboard image frame unraveled from ChatGPT Folder A (01–10) ZIP,
 * Folder B (11–20) ZIP, or loose image uploads, normalized into canonical 01..20 numbering.
 */
export interface UnraveledStoryboardFrame {
  sceneNumber: number; // Canonical 1..20+ slot
  sceneCode: string; // "01".."20"
  folderBatch: 'A' | 'B' | 'EXTRA';
  sceneTitle: string; // e.g. "Golden Hour Bedroom Serenade"
  originalFileName: string; // e.g. "01_Golden_Hour_Bedroom_Serenade.png"
  sourceArchiveName?: string; // e.g. "Lord_I_Am_Grateful_Folder_A_Images_01_10.zip"
  dataUrl: string;
  parsedStartSec?: number;
  parsedEndSec?: number;
  manifestLyrics?: string;
  manifestPrompt?: string;
  omniSceneGuide?: OmniHtmlGuideSceneData;
}

export interface UnraveledStoryboardSetResult {
  orderedFrames: UnraveledStoryboardFrame[];
  folderACount: number; // Count of frames in slots 1..10
  folderBCount: number; // Count of frames in slots 11..20
  missingSceneNumbers: number[]; // Any unfilled slots in 1..20
  detectedSongTitle?: string;
  detectedManifestLyrics?: string;
  parsedOmniGuide?: OmniHtmlGuideParsedProject;
  extractedWavChunks?: Array<{ index: number; fileName: string; blob: Blob }>;
}


