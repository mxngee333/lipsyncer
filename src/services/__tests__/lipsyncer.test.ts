import { describe, it, expect } from 'vitest';
import { LIPSYNC_MODELS, getRecommendedModelForMediaMode } from '../../data/modelCatalog';
import {
  buildSongDnaProfile,
  generateTwentyScenePlan
} from '../storyboardDirectorService';
import {
  getTokenPoolStatus,
  isZeroGpuQuotaError,
  markTokenExhausted,
  resetAllCooldowns
} from '../tokenPoolService';
import { sha256Hex } from '../r2VaultService';
import {
  getFalApiKey,
  isFalKeyConfigured,
  checkFalAccountStatus
} from '../falAiService';
import {
  computeSmartAudioChunkBoundaries,
  syncLyricsWithAudioSignal,
  synthesizeCommensurateSceneFrame,
  buildFullSongVideoChunks
} from '../fullSongVideoService';
import { generateDemoVocalWavBlob } from '../audioDspService';

describe('LipSyncer AI Multi-Model Catalog Tests', () => {
  it('should verify catalog has 19 specialized AI lip-sync models including OpenArt official fleet and Fal.ai cloud engines', () => {
    expect(LIPSYNC_MODELS.length).toBe(19);
  });

  it('should verify all models have valid providers and features', () => {
    for (const model of LIPSYNC_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(model.features.length).toBeGreaterThan(0);
      expect(model.maxDurationSec).toBeGreaterThan(0);
      expect(model.durationLabel).toBeTruthy();
      expect(model.resolutionLabel).toBeTruthy();
    }
  });

  it('should recommend correct model based on input modality', () => {
    const videoRec = getRecommendedModelForMediaMode('video_audio');
    expect(videoRec.supportsVideoInput).toBe(true);

    const imageRec = getRecommendedModelForMediaMode('image_audio');
    expect(imageRec.supportsImageInput).toBe(true);
  });
});

describe('Expert Song DNA & 20-Scene Storyboard Director Tests', () => {
  it('should correctly analyze BPM, felt tempo class and 10s Omni capacity', () => {
    const dna = buildSongDnaProfile({
      songTitle: 'Midnight Cinema',
      artistName: 'Astra & The Elders',
      durationSec: 210, // 3m 30s
      detectedBpm: 92,
      lyrics: `[Verse 1]\nNeon reflections on the wet asphalt\nEvery whisper echoes without a fault\n[Chorus]\nWe ride the sonic light tonight\nNo words on screen, just singing bright`
    });

    expect(dna.songTitle).toBe('Midnight Cinema');
    expect(dna.artistName).toBe('Astra & The Elders');
    expect(dna.feltTempoClass).toBe('MID-TEMPO');
    expect(dna.primaryGrooveBpm).toBe(92);
    expect(dna.beatLengthSec).toBeCloseTo(60 / 92, 2);
    expect(dna.barLength44Sec).toBeCloseTo((60 / 92) * 4, 2);
    expect(dna.tenSecondOmniBarCapacity).toBeGreaterThan(0);
    expect(dna.musicalStyleLockLine).toContain('MUSICAL STYLE LOCK');
  });

  it('should generate 20 chronological scenes split into Folder A and Folder B with ZERO-TEXT prompts', () => {
    const project = generateTwentyScenePlan({
      songTitle: 'Elders Anthem',
      artistName: 'Silicon 666',
      durationSec: 240,
      detectedBpm: 120,
      lyrics: 'Verse one vocal line\nChorus singing hook line'
    });

    expect(project.scenes.length).toBe(20);
    expect(project.scenes[0].folderBatch).toBe('A');
    expect(project.scenes[9].folderBatch).toBe('A');
    expect(project.scenes[10].folderBatch).toBe('B');
    expect(project.scenes[19].folderBatch).toBe('B');

    // Verify strict zero on-screen text directive is enforced in every scene
    for (const scene of project.scenes) {
      expect(scene.imagePrompt).toContain('ZERO visible text');
      expect(scene.actionOnlyOmniPrompt).toContain('NO SINGING. NO LIP-SYNC. NO DIALOGUE');
      expect(scene.primaryOmniPrompt).toContain('MUSICAL STYLE LOCK');
      expect(scene.primaryOmniPrompt).toContain('NO ON-SCREEN TEXT');
    }
  });
});

describe('ZeroGPU Token Pool & Quota Interceptor Tests', () => {
  it('should correctly identify ZeroGPU 429 quota exhaustion errors', () => {
    expect(isZeroGpuQuotaError('You have exceeded your GPU quota (429)')).toBe(true);
    expect(isZeroGpuQuotaError('ZeroGPU quota reached. Please try again in 54 minutes')).toBe(true);
    expect(isZeroGpuQuotaError('HTTP 429: Too Many Requests')).toBe(true);
    expect(isZeroGpuQuotaError('Network timeout error')).toBe(false);
  });

  it('should manage pool statuses and reset cooldowns', () => {
    resetAllCooldowns();
    const statusBefore = getTokenPoolStatus();
    expect(statusBefore.length).toBeGreaterThan(0);

    const testToken = statusBefore[0].token;
    markTokenExhausted(testToken, 60000);

    const statusAfter = getTokenPoolStatus();
    const exhaustedEntry = statusAfter.find((s) => s.token === testToken);
    expect(exhaustedEntry?.isExhausted).toBe(true);

    resetAllCooldowns();
    const statusReset = getTokenPoolStatus();
    const resetEntry = statusReset.find((s) => s.token === testToken);
    expect(resetEntry?.isExhausted).toBe(false);
  });
});

describe('R2 Vault Web Crypto Tests', () => {
  it('should compute deterministic SHA-256 hex string using Web Crypto', async () => {
    const hash = await sha256Hex('LipSyncer-OpenArt-2026');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });
});

describe('Fal.ai High-Speed Cloud Service Tests', () => {
  it('should detect configured Fal.ai API key with correct format', () => {
    expect(isFalKeyConfigured()).toBe(true);
    const key = getFalApiKey();
    expect(key.startsWith('fal_sk_')).toBe(true);
  });

  it('should verify Fal.ai account connectivity', async () => {
    const status = await checkFalAccountStatus();
    expect(status.authenticated).toBe(true);
    expect(status.nickname).toBe('mxngee333');
    expect(status.email).toBe('worldpraiseradio@gmail.com');
  });
});

describe('Full Song Video Mode: Audiospliter Chunking, Vocal DSP Lyric Sync & On-The-Fly Commensurate Frames', () => {
  it('should chunk audio using target_scene_count (e.g. 20 chunks) and fixed_interval (Audiospliter Min:Sec)', async () => {
    const twentyChunks = computeSmartAudioChunkBoundaries({
      durationSec: 40,
      chunkMode: 'target_scene_count',
      targetSceneCount: 20,
      uploadedImageCount: 14
    });
    expect(twentyChunks.length).toBe(20);
    expect(twentyChunks[0].startSec).toBe(0);
    expect(twentyChunks[19].endSec).toBeCloseTo(40, 0);

    const intervalChunks = computeSmartAudioChunkBoundaries({
      durationSec: 40,
      chunkMode: 'fixed_interval',
      fixedIntervalSec: 10
    });
    expect(intervalChunks.length).toBe(4);
    expect(intervalChunks[0].endSec - intervalChunks[0].startSec).toBeCloseTo(10, 1);
  });

  it('should sync lyrics with audio signal (AI + Vocal DSP) and generate LRC output', () => {
    const boundaries = computeSmartAudioChunkBoundaries({
      durationSec: 20,
      chunkMode: 'target_scene_count',
      targetSceneCount: 4
    });

    const lyrics = `[00:00.50] First vocal phrase in the spotlight\n[00:05.50] Second vocal phrase rising higher\n[00:10.50] Third chorus harmony in motion\n[00:15.50] Final cadence under warm stage glow`;
    const syncRes = syncLyricsWithAudioSignal({
      chunks: boundaries,
      rawLyrics: lyrics,
      songTitle: 'Spotlight Test'
    });

    expect(syncRes.alignedChunks.length).toBe(4);
    expect(syncRes.lrcFormattedText).toContain('[00:');
    expect(syncRes.alignedChunks[0].syncedLyrics).toContain('First vocal phrase');
  });

  it('should automatically synthesize commensurate scene frames on-the-fly when uploaded storyboard images fall short of total chunks', async () => {
    const demoWav = await generateDemoVocalWavBlob('Commensurate frame shortfall test', 24);
    // Upload 3 images for 6 chunks -> 3 uploaded + 3 commensurate_synthesized on-the-fly
    const uploadedImages = [
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600'
    ];

    const result = await buildFullSongVideoChunks({
      audioSource: demoWav,
      songTitle: 'Shortfall Test Song',
      rawLyrics: 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six',
      uploadedImageUrls: uploadedImages,
      chunkMode: 'target_scene_count',
      targetSceneCount: 6,
      aspectRatio: '16:9',
      selectedModelId: 'lipsyncer-dsp-60fps'
    });

    expect(result.chunks.length).toBe(6);
    expect(result.shortfallFilledCount).toBe(3);

    // First 3 chunks use uploaded storyboard frames
    expect(result.chunks[0].frameSourceType).toBe('uploaded');
    expect(result.chunks[1].frameSourceType).toBe('uploaded');
    expect(result.chunks[2].frameSourceType).toBe('uploaded');

    // Remaining 3 shortfall chunks are synthesized on-the-fly
    expect(result.chunks[3].frameSourceType).toBe('commensurate_synthesized');
    expect(result.chunks[4].frameSourceType).toBe('commensurate_synthesized');
    expect(result.chunks[5].frameSourceType).toBe('commensurate_synthesized');

    for (const chunk of result.chunks) {
      expect(chunk.imageSourceUrl).toBeTruthy();
      expect(chunk.prompt.toLowerCase()).toContain('zero visible text');
      expect(chunk.audioChunkBlob).toBeInstanceOf(Blob);
    }

    // Direct call to synthesizeCommensurateSceneFrame
    const directFrame = await synthesizeCommensurateSceneFrame({
      chunkIndex: 4,
      totalChunks: 6,
      syncMode: 'LIP-SYNC',
      aspectRatio: '16:9',
      referenceImageUrls: uploadedImages,
      vocalEnergyScore: 0.8
    });
    expect(directFrame.dataUrl.startsWith('data:image/')).toBe(true);
    expect(directFrame.promptUsed).toContain('ZERO visible text');
  });
});
