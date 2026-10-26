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
  buildFullSongVideoChunks,
  unravelStoryboardFilesAndZips,
  parseStoryboardFileNameMeta
} from '../fullSongVideoService';
import JSZip from 'jszip';
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

  it('should unravel 2 ChatGPT ZIPs (Folder_B_11_20.zip + Folder_A_01_10.zip) even when uploaded in reverse order and internally scrambled into exact 01->20 order', async () => {
    const dummyPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    // Build Folder B ZIP with scrambled internal entry order (just like Python zipfile)
    const zipB = new JSZip();
    const scrambledB = [
      '18_Family_Prayer_By_Candlelight.png',
      '16_Courtyard_Clapping_Circle.png',
      '12_Bus_Window_Reflection.png',
      '14_Doorstep_Grocery_Greeting.png',
      '11_Porch_Gratitude.png',
      '15_Community_Meal_Distribution.png',
      '20_Grateful_Heart_Above_The_City.png',
      '13_Office_Mentorship.png',
      '17_Worship_Rehearsal.png',
      '19_Community_Celebration.png'
    ];
    for (const name of scrambledB) {
      zipB.file(`Lord_I_Am_Grateful_Folder_B_Images_11_20/${name}`, dummyPngBytes);
    }
    const blobB = await zipB.generateAsync({ type: 'blob' });
    const fileB = new File([blobB], 'Lord_I_Am_Grateful_Folder_B_Images_11_20.zip', {
      type: 'application/zip'
    });

    // Build Folder A ZIP with scrambled internal entry order
    const zipA = new JSZip();
    const scrambledA = [
      '04_Camaraderie_In_The_Office_Break_Area.png',
      '07_Father_Adjusting_Son_School_Backpack.png',
      '08_Joyful_Family_Dinner_Gathering.png',
      '10_Golden_Hour_Rooftop_Reflection.png',
      '05_Golden_Hour_Market_Handshake.png',
      '03_Gratitude_In_The_Conference_Room.png',
      '06_Joyful_Family_Grocery_Unpacking.png',
      '09_Heartfelt_Worship_In_Golden_Light.png',
      '02_Golden_Walk_Through_The_Neighborhood.png',
      '01_Golden_Hour_Bedroom_Serenade.png'
    ];
    for (const name of scrambledA) {
      zipA.file(`Lord_I_Am_Grateful_Folder_A_Images_01_10/${name}`, dummyPngBytes);
    }
    const blobA = await zipA.generateAsync({ type: 'blob' });
    const fileA = new File([blobA], 'Lord_I_Am_Grateful_Folder_A_Images_01_10.zip', {
      type: 'application/zip'
    });

    // Upload Folder B FIRST, then Folder A SECOND (matching Windows Explorer screenshot)
    const unraveled = await unravelStoryboardFilesAndZips({
      files: [fileB, fileA],
      targetTotal: 20
    });

    expect(unraveled.orderedFrames.length).toBe(20);
    expect(unraveled.folderACount).toBe(10);
    expect(unraveled.folderBCount).toBe(10);
    expect(unraveled.missingSceneNumbers.length).toBe(0);
    expect(unraveled.detectedSongTitle).toBe('Lord I Am Grateful');

    // Verify exact 1..20 sequential ordering
    for (let i = 0; i < 20; i++) {
      expect(unraveled.orderedFrames[i].sceneNumber).toBe(i + 1);
    }
    expect(unraveled.orderedFrames[0].sceneTitle).toBe('Golden Hour Bedroom Serenade');
    expect(unraveled.orderedFrames[10].sceneTitle).toBe('Porch Gratitude');
    expect(unraveled.orderedFrames[19].sceneTitle).toBe('Grateful Heart Above The City');

    // Verify Folder B offset guard when ChatGPT numbers Folder B files 01..10
    const offsetCheck = parseStoryboardFileNameMeta({
      fileName: 'Lord_I_Am_Grateful_Folder_B_Images_11_20/03_Gratitude_Scene.png',
      parentArchiveOrFolder: 'Lord_I_Am_Grateful_Folder_B_Images_11_20.zip'
    });
    expect(offsetCheck.sceneNumber).toBe(13);
    expect(offsetCheck.folderBatch).toBe('B');
  });
});
