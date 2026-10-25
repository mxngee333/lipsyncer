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

describe('LipSyncer AI Multi-Model Catalog Tests', () => {
  it('should verify catalog has 13 specialized AI lip-sync models including Fal.ai cloud engines', () => {
    expect(LIPSYNC_MODELS.length).toBe(13);
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
