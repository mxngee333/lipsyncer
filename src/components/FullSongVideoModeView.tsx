import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Music2,
  Sparkles,
  Upload,
  Scissors,
  Play,
  Pause,
  Download,
  Film,
  Image as ImageIcon,
  Video,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wand2,
  Layers,
  FolderArchive,
  FileText,
  RefreshCw,
  Trash2,
  Volume2,
  Activity,
  Zap,
  Sliders,
  Plus
} from 'lucide-react';
import {
  AspectRatioOption,
  CameraMotionPreset,
  FullSongChunkMode,
  FullSongLyricSyncResult,
  FullSongVideoChunk,
  GeneratedLipSyncClip,
  UnraveledStoryboardFrame
} from '../types';
import { LIPSYNC_MODELS } from '../data/modelCatalog';
import {
  analyzeVocalFormantsAndBpm,
  generateDemoPortraitDataUrl,
  generateDemoVocalWavBlob,
  VocalFormantBpmAnalysis
} from '../services/audioDspService';
import {
  buildFullSongVideoChunks,
  buildOrderedStoryboardSetSummary,
  mergeFullSongVideoMaster,
  packageAudioChunksZip,
  packageFullSongProductionZip,
  renderSingleFullSongChunkLipSync,
  syncLyricsWithAudioSignal,
  synthesizeCommensurateSceneFrame,
  unravelStoryboardFilesAndZips,
  upgradeChunkFrameWithAi
} from '../services/fullSongVideoService';
import {
  loadStoryboardProject,
  transcribeAudioWithBrowserWhisper
} from '../services/storyboardDirectorService';
import { buildVideoFileName, downloadVideoWithName } from '../services/clipNaming';

export interface FullSongVideoModeViewProps {
  onClipCreated?: (clip: GeneratedLipSyncClip) => void;
}

const DEFAULT_FULL_SONG_LYRICS = `Every word comes alive in studio cinema light
Walking through the golden haze of midnight rain
Rising higher through the stage symphony tonight
Your voice echoes across the silver screen
Even when the frames fall short the vision carries on
Every heartbeat locked in rhythm and grace
Shining brighter than the neon horizon
Standing strong in the center of the spotlight
From the first breath to the final chorus crescendo
Every syllable moves in perfect harmony
Through the quiet instrumental bridge we breathe
Now lift the anthem higher into the stars
Unbroken melody flowing across twenty scenes
Until the final note fades into golden peace`;

export const FullSongVideoModeView: React.FC<FullSongVideoModeViewProps> = ({
  onClipCreated
}) => {
  // Song & Audio State
  const [songTitle, setSongTitle] = useState<string>('Golden Horizon Symphony');
  const [audioFile, setAudioFile] = useState<Blob | File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>('');
  const [analysis, setAnalysis] = useState<VocalFormantBpmAnalysis | null>(null);

  // Chunking Controls (Audiospliter.com + Smart Vocal DSP)
  const [chunkMode, setChunkMode] = useState<FullSongChunkMode>('target_scene_count');
  const [targetSceneCount, setTargetSceneCount] = useState<number>(20);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(0);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(8);

  // Storyboard Images & Commensurate Frame State
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [orderedStoryboardFrames, setOrderedStoryboardFrames] = useState<
    UnraveledStoryboardFrame[]
  >([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('16:9');
  const [selectedModelId, setSelectedModelId] = useState<string>('lipsyncer-dsp-60fps');

  // Lyrics & Vocal DSP Sync State
  const [rawLyrics, setRawLyrics] = useState<string>(DEFAULT_FULL_SONG_LYRICS);
  const [lyricSyncResult, setLyricSyncResult] = useState<FullSongLyricSyncResult | null>(null);
  const [isSyncingLyrics, setIsSyncingLyrics] = useState<boolean>(false);
  const [isTranscribingWhisper, setIsTranscribingWhisper] = useState<boolean>(false);

  // Built Chunks & Execution State
  const [chunks, setChunks] = useState<FullSongVideoChunk[]>([]);
  const [shortfallFilledCount, setShortfallFilledCount] = useState<number>(0);
  const [isBuildingChunks, setIsBuildingChunks] = useState<boolean>(false);
  const [isProducingFullVideo, setIsProducingFullVideo] = useState<boolean>(false);
  const [isMergingMaster, setIsMergingMaster] = useState<boolean>(false);
  const [isPackagingZip, setIsPackagingZip] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    message: string;
    percent: number;
    variant: 'info' | 'success' | 'warning';
  } | null>(null);

  // Final Merged Master Video Output
  const [mergedMasterClip, setMergedMasterClip] = useState<GeneratedLipSyncClip | null>(null);

  // Audio Slice Mini-Player State
  const [playingChunkIdx, setPlayingChunkIdx] = useState<number | null>(null);
  const chunkAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Live Interactive 60fps Master Preview Canvas State
  const [isPlayingLivePreview, setIsPlayingLivePreview] = useState<boolean>(false);
  const [livePreviewTimeSec, setLivePreviewTimeSec] = useState<number>(0);
  const masterAudioElRef = useRef<HTMLAudioElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const cachedImageElsRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
    };
  }, [audioPreviewUrl]);

  // Cache HTMLImageElements for live 60fps preview canvas
  useEffect(() => {
    chunks.forEach((c) => {
      if (c.imageSourceUrl) {
        const existing = cachedImageElsRef.current.get(c.chunkIndex);
        if (!existing || existing.src !== c.imageSourceUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = c.imageSourceUrl;
          img.onload = () => {
            cachedImageElsRef.current.set(c.chunkIndex, img);
          };
        }
      }
    });
  }, [chunks]);

  // Rebuild chunks helper
  const executeChunkAndFramePipeline = useCallback(
    async (opts?: {
      audioOverride?: Blob | File;
      imagesOverride?: string[];
      framesOverride?: UnraveledStoryboardFrame[];
      lyricsOverride?: string;
      songTitleOverride?: string;
      modeOverride?: FullSongChunkMode;
      sceneCountOverride?: number;
    }) => {
      const activeAudio = opts?.audioOverride ?? audioFile;
      if (!activeAudio) return;

      const activeFrames = opts?.framesOverride ?? orderedStoryboardFrames;
      const activeImages =
        opts?.imagesOverride ??
        (activeFrames.length > 0 ? activeFrames.map((f) => f.dataUrl) : uploadedImageUrls);
      const activeLyrics = opts?.lyricsOverride ?? rawLyrics;
      const activeSongTitle = opts?.songTitleOverride ?? songTitle;
      const activeMode = opts?.modeOverride ?? chunkMode;
      const activeSceneCount = opts?.sceneCountOverride ?? targetSceneCount;
      const fixedSec = Math.max(2, intervalMinutes * 60 + intervalSeconds);

      setIsBuildingChunks(true);
      try {
        const built = await buildFullSongVideoChunks({
          audioSource: activeAudio,
          songTitle: activeSongTitle,
          rawLyrics: activeLyrics,
          uploadedImageUrls: activeImages,
          orderedStoryboardFrames: activeFrames.length > 0 ? activeFrames : undefined,
          chunkMode: activeMode,
          fixedIntervalSec: fixedSec,
          targetSceneCount: activeSceneCount,
          aspectRatio,
          selectedModelId,
          onProgress: (msg, pct) => {
            setStatusBanner({
              message: msg,
              percent: pct,
              variant: 'info'
            });
          }
        });

        setChunks(built.chunks);
        setAnalysis(built.analysis);
        setLyricSyncResult(built.lyricSync);
        setShortfallFilledCount(built.shortfallFilledCount);

        const shortfallNote =
          built.shortfallFilledCount > 0
            ? ` (${built.shortfallFilledCount} missing storyboard frames synthesized on-the-fly to commensurate all ${built.chunks.length} chunks!)`
            : ` (All ${built.chunks.length} chunks paired in exact 01→${built.chunks.length} order!)`;

        setStatusBanner({
          message: `Synced ${built.chunks.length} audio chunks at ${built.analysis.feltGrooveBpm} BPM${shortfallNote}`,
          percent: 100,
          variant: 'success'
        });
      } catch (err: unknown) {
        setStatusBanner({
          message:
            err instanceof Error
              ? err.message
              : 'Could not chunk audio file. Please try another MP3/WAV.',
          percent: 0,
          variant: 'warning'
        });
      } finally {
        setIsBuildingChunks(false);
      }
    },
    [
      aspectRatio,
      audioFile,
      chunkMode,
      intervalMinutes,
      intervalSeconds,
      orderedStoryboardFrames,
      rawLyrics,
      selectedModelId,
      songTitle,
      targetSceneCount,
      uploadedImageUrls
    ]
  );

  // Auto-load a 1-click ready demo state on initial mount so the studio is immediately interactive
  useEffect(() => {
    let mounted = true;
    const initDemo = async () => {
      try {
        const demoSongBlob = await generateDemoVocalWavBlob(
          'Every word comes alive in studio cinema light rising higher tonight',
          40
        );
        if (!mounted) return;
        const url = URL.createObjectURL(demoSongBlob);
        setAudioFile(demoSongBlob);
        setAudioFileName('Golden_Horizon_Full_Song_Master.wav');
        setAudioPreviewUrl(url);

        // Create 14 uploaded storyboard images for a 20-scene song so the user immediately sees
        // the 6 missing scenes auto-created on-the-fly to commensurate the 20 chunks!
        const p1 = generateDemoPortraitDataUrl('singer_female');
        const p2 = generateDemoPortraitDataUrl('host_male');
        const p3 = generateDemoPortraitDataUrl('cyber_diva');
        const initial14Images = Array.from({ length: 14 }, (_, idx) =>
          idx % 3 === 0 ? p1 : idx % 3 === 1 ? p2 : p3
        );
        setUploadedImageUrls(initial14Images);

        await executeChunkAndFramePipeline({
          audioOverride: demoSongBlob,
          imagesOverride: initial14Images,
          lyricsOverride: DEFAULT_FULL_SONG_LYRICS,
          modeOverride: 'target_scene_count',
          sceneCountOverride: 20
        });
      } catch {
        // Ignore initial demo setup error
      }
    };
    void initDemo();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle Full Song Audio Upload
  const handleSongFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMergedMasterClip(null);
    setAudioFile(file);
    setAudioFileName(file.name);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
    if (cleanName) setSongTitle(cleanName);

    if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setAudioPreviewUrl(nextUrl);

    await executeChunkAndFramePipeline({ audioOverride: file });
  };

  // Handle ChatGPT 2-ZIP (Folder A 01–10 + Folder B 11–20) or Multi-Image Storyboard Upload
  const processStoryboardFiles = async (
    fileArray: File[],
    forcedBatch: 'A' | 'B' | 'AUTO' = 'AUTO'
  ) => {
    if (fileArray.length === 0) return;
    setMergedMasterClip(null);

    setStatusBanner({
      message: `Unravelling & ordering storyboard files (${fileArray.map((f) => f.name).join(', ')})...`,
      percent: 30,
      variant: 'info'
    });

    try {
      const unraveled = await unravelStoryboardFilesAndZips({
        files: fileArray,
        existingFrames: orderedStoryboardFrames,
        forcedBatch,
        targetTotal: targetSceneCount,
        onProgress: (msg) => {
          setStatusBanner({ message: msg, percent: 50, variant: 'info' });
        }
      });

      const nextFrames = unraveled.orderedFrames;
      const nextUrls = nextFrames.map((f) => f.dataUrl);
      setOrderedStoryboardFrames(nextFrames);
      setUploadedImageUrls(nextUrls);

      let nextSongTitle = songTitle;
      if (unraveled.detectedSongTitle) {
        nextSongTitle = unraveled.detectedSongTitle;
        setSongTitle(unraveled.detectedSongTitle);
      }

      let nextLyrics = rawLyrics;
      if (unraveled.detectedManifestLyrics) {
        nextLyrics = unraveled.detectedManifestLyrics;
        setRawLyrics(unraveled.detectedManifestLyrics);
      }

      await executeChunkAndFramePipeline({
        imagesOverride: nextUrls,
        framesOverride: nextFrames,
        songTitleOverride: nextSongTitle,
        lyricsOverride: nextLyrics
      });

      setStatusBanner({
        message: `Unraveled & sorted ${nextFrames.length} storyboard frames in canonical 01→20 order (Set A 01–10: ${unraveled.folderACount}/10 • Set B 11–20: ${unraveled.folderBCount}/10)!`,
        percent: 100,
        variant: 'success'
      });
    } catch (err: unknown) {
      setStatusBanner({
        message:
          err instanceof Error
            ? `ZIP/Image Unravel note: ${err.message}`
            : 'Could not read storyboard archive.',
        percent: 0,
        variant: 'warning'
      });
    }
  };

  const handleStoryboardImagesUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    forcedBatch: 'A' | 'B' | 'AUTO' = 'AUTO'
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const arr = Array.from(fileList);
    e.target.value = '';
    await processStoryboardFiles(arr, forcedBatch);
  };

  const handleSwapStoryboardSlots = async (idxA: number, idxB: number) => {
    if (
      idxA < 0 ||
      idxB < 0 ||
      idxA >= orderedStoryboardFrames.length ||
      idxB >= orderedStoryboardFrames.length
    ) {
      return;
    }
    const copy = [...orderedStoryboardFrames];
    const numA = copy[idxA].sceneNumber;
    const numB = copy[idxB].sceneNumber;
    copy[idxA] = { ...copy[idxA], sceneNumber: numB };
    copy[idxB] = { ...copy[idxB], sceneNumber: numA };
    const summary = buildOrderedStoryboardSetSummary(copy, targetSceneCount);
    const nextUrls = summary.orderedFrames.map((f) => f.dataUrl);
    setOrderedStoryboardFrames(summary.orderedFrames);
    setUploadedImageUrls(nextUrls);
    await executeChunkAndFramePipeline({
      imagesOverride: nextUrls,
      framesOverride: summary.orderedFrames
    });
  };

  // Import existing frames from 20-Scene Storyboard Director if available
  const handleImportFromDirector = async () => {
    const sbProject = loadStoryboardProject();
    if (!sbProject || sbProject.scenes.length === 0) {
      setStatusBanner({
        message: 'No saved 20-Scene Director project found yet — generating 14 studio frames + 6 commensurate frames!',
        percent: 100,
        variant: 'info'
      });
      return;
    }

    const dirImages = sbProject.scenes
      .map((s) => s.generatedImageUrl || '')
      .filter((u) => Boolean(u));

    if (sbProject.rawLyrics) {
      setRawLyrics(sbProject.rawLyrics);
    }
    if (sbProject.songTitle) {
      setSongTitle(sbProject.songTitle);
    }

    setUploadedImageUrls(dirImages);
    await executeChunkAndFramePipeline({
      imagesOverride: dirImages,
      lyricsOverride: sbProject.rawLyrics || rawLyrics
    });
  };

  // 🧠 Sync Lyrics with Audio Signal (AI + Vocal DSP)
  const handleSyncLyricsWithVocalDsp = async () => {
    if (!audioFile) return;
    setIsSyncingLyrics(true);
    setMergedMasterClip(null);
    setStatusBanner({
      message: '🧠 Running Vocal Formant DSP (280Hz–3.6kHz) & AI Syllable Alignment across all audio chunks...',
      percent: 35,
      variant: 'info'
    });

    try {
      const currentAnalysis =
        analysis || (await analyzeVocalFormantsAndBpm(audioFile));
      setAnalysis(currentAnalysis);

      const currentWindows =
        chunks.length > 0
          ? chunks.map((c) => ({ startSec: c.startTimeSec, endSec: c.endTimeSec }))
          : [{ startSec: 0, endSec: currentAnalysis.durationSec }];

      const syncRes = syncLyricsWithAudioSignal({
        chunks: currentWindows,
        rawLyrics,
        analysis: currentAnalysis,
        songTitle
      });

      setLyricSyncResult(syncRes);

      // Update chunks with newly aligned lyrics, vocal energy scores & sync modes
      const updatedChunks = chunks.map((c, idx) => {
        const aligned = syncRes.alignedChunks[idx];
        if (!aligned) return c;
        return {
          ...c,
          syncedLyrics: aligned.syncedLyrics,
          syncMode: aligned.syncMode,
          vocalEnergyScore: aligned.vocalEnergyScore,
          lyricSyncConfidence: aligned.confidence,
          prompt:
            aligned.syncMode === 'LIP-SYNC'
              ? `Scene ${c.chunkCode}: Lead vocalist passionately singing "${aligned.syncedLyrics}" in studio stage lighting, exact phoneme lip-sync articulation, ${c.cameraMovement.replace('_', ' ')} camera motion. Zero visible text.`
              : `Scene ${c.chunkCode}: Cinematic atmospheric performance B-roll, mouth naturally relaxed and closed, NO SINGING, NO LIP-SYNC, majestic ${c.cameraMovement.replace('_', ' ')} camera motion. Zero visible text.`
        };
      });

      setChunks(updatedChunks);
      setStatusBanner({
        message: `🧠 Sync Lyrics with Audio Signal Complete! Locked ${updatedChunks.length} chunks at ${(syncRes.overallSyncConfidence * 100).toFixed(1)}% Vocal DSP confidence (${syncRes.feltGrooveBpm} BPM).`,
        percent: 100,
        variant: 'success'
      });
    } catch (err: unknown) {
      setStatusBanner({
        message: err instanceof Error ? err.message : 'Error syncing lyrics with audio signal.',
        percent: 0,
        variant: 'warning'
      });
    } finally {
      setIsSyncingLyrics(false);
    }
  };

  // Whisper WebAssembly AI Auto-Transcribe + Vocal DSP Sync
  const handleWhisperTranscribeAndSync = async () => {
    if (!audioFile) return;
    setIsTranscribingWhisper(true);
    setStatusBanner({
      message: 'Initializing in-browser Whisper WebAssembly AI to transcribe vocal track...',
      percent: 25,
      variant: 'info'
    });

    try {
      const transcribedLrc = await transcribeAudioWithBrowserWhisper(audioFile, (msg) => {
        setStatusBanner({ message: msg, percent: 55, variant: 'info' });
      });
      const nextLyrics = transcribedLrc.trim() ? transcribedLrc : rawLyrics;
      if (transcribedLrc.trim()) {
        setRawLyrics(transcribedLrc);
      }
      await executeChunkAndFramePipeline({ lyricsOverride: nextLyrics });
    } catch {
      await handleSyncLyricsWithVocalDsp();
    } finally {
      setIsTranscribingWhisper(false);
    }
  };

  // Re-synthesize all commensurate frames on the fly
  const handleResynthesizeCommensurateFrames = async () => {
    if (chunks.length === 0) return;
    setMergedMasterClip(null);
    setStatusBanner({
      message: '✨ Synthesizing commensurate scene frames on the fly for all missing storyboard slots...',
      percent: 30,
      variant: 'info'
    });

    const nextChunks = [...chunks];
    let filled = 0;

    for (let i = 0; i < nextChunks.length; i++) {
      const c = nextChunks[i];
      if (!uploadedImageUrls[i]) {
        filled++;
        const synth = await synthesizeCommensurateSceneFrame({
          chunkIndex: c.chunkIndex,
          totalChunks: nextChunks.length,
          syncMode: c.syncMode,
          aspectRatio,
          referenceImageUrls: uploadedImageUrls,
          vocalEnergyScore: c.vocalEnergyScore
        });
        nextChunks[i] = {
          ...c,
          imageSourceUrl: synth.dataUrl,
          frameSourceType: 'commensurate_synthesized',
          commensurateSceneLabel: `On-The-Fly Commensurate · ${synth.label}`
        };
      }
    }

    setChunks(nextChunks);
    setShortfallFilledCount(filled);
    setStatusBanner({
      message: `✨ Created ${filled} commensurate scene frames on-the-fly! All ${nextChunks.length} scenes have complete visual coverage.`,
      percent: 100,
      variant: 'success'
    });
  };

  // Regenerate or upgrade a single chunk's scene frame
  const handleRegenerateSingleChunkFrame = async (
    chunkIndex: number,
    useCloudAi: boolean
  ) => {
    const target = chunks.find((c) => c.chunkIndex === chunkIndex);
    if (!target) return;
    setMergedMasterClip(null);

    setChunks((prev) =>
      prev.map((c) =>
        c.chunkIndex === chunkIndex ? { ...c, status: 'synthesizing_frame' } : c
      )
    );

    try {
      if (useCloudAi) {
        const res = await upgradeChunkFrameWithAi(
          target,
          chunks.length,
          aspectRatio,
          uploadedImageUrls
        );
        setChunks((prev) =>
          prev.map((c) =>
            c.chunkIndex === chunkIndex
              ? {
                  ...c,
                  imageSourceUrl: res.imageSourceUrl,
                  frameSourceType: res.frameSourceType,
                  commensurateSceneLabel: res.label,
                  status: 'ready'
                }
              : c
          )
        );
      } else {
        const synth = await synthesizeCommensurateSceneFrame({
          chunkIndex,
          totalChunks: chunks.length,
          syncMode: target.syncMode,
          aspectRatio,
          referenceImageUrls: uploadedImageUrls,
          vocalEnergyScore: target.vocalEnergyScore + Math.random() * 0.15
        });
        setChunks((prev) =>
          prev.map((c) =>
            c.chunkIndex === chunkIndex
              ? {
                  ...c,
                  imageSourceUrl: synth.dataUrl,
                  frameSourceType: 'commensurate_synthesized',
                  commensurateSceneLabel: `On-The-Fly Commensurate · ${synth.label}`,
                  status: 'ready'
                }
              : c
          )
        );
      }
    } catch {
      setChunks((prev) =>
        prev.map((c) => (c.chunkIndex === chunkIndex ? { ...c, status: 'ready' } : c))
      );
    }
  };

  // Replace single chunk image from file input
  const handleReplaceSingleChunkImage = (
    chunkIndex: number,
    file: File | undefined
  ) => {
    if (!file) return;
    setMergedMasterClip(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setChunks((prev) =>
        prev.map((c) =>
          c.chunkIndex === chunkIndex
            ? {
                ...c,
                imageSourceUrl: dataUrl,
                frameSourceType: 'uploaded',
                commensurateSceneLabel: `Uploaded Storyboard Frame #${c.chunkCode}`
              }
            : c
        )
      );
    };
    reader.readAsDataURL(file);
  };

  // Render Lip-Sync for a single chunk
  const handleRenderSingleChunkVideo = async (chunkIndex: number) => {
    if (!audioFile) return;
    const target = chunks.find((c) => c.chunkIndex === chunkIndex);
    if (!target) return;
    setMergedMasterClip(null);

    setChunks((prev) =>
      prev.map((c) =>
        c.chunkIndex === chunkIndex
          ? { ...c, status: 'rendering_lipsync', progressPercent: 10 }
          : c
      )
    );

    try {
      const clip = await renderSingleFullSongChunkLipSync({
        chunk: target,
        masterAudioSource: audioFile,
        aspectRatio,
        modelIdOverride: selectedModelId,
        onChunkProgress: (pct) => {
          setChunks((prev) =>
            prev.map((c) =>
              c.chunkIndex === chunkIndex ? { ...c, progressPercent: pct } : c
            )
          );
        }
      });

      setChunks((prev) =>
        prev.map((c) =>
          c.chunkIndex === chunkIndex
            ? {
                ...c,
                generatedVideoUrl: clip.videoUrl,
                status: 'completed',
                progressPercent: 100
              }
            : c
        )
      );
      onClipCreated?.(clip);
    } catch (err: unknown) {
      setChunks((prev) =>
        prev.map((c) =>
          c.chunkIndex === chunkIndex
            ? {
                ...c,
                status: 'error',
                errorMessage: err instanceof Error ? err.message : 'Render error'
              }
            : c
        )
      );
    }
  };

  // Full Song Pipeline: Ensure all frames exist -> Render chunks -> Merge Exact Master MP4
  const handleProduceAndMergeFullSongMaster = async (fastDirectMergeOnly = false) => {
    if (!audioFile || chunks.length === 0) return;

    setIsProducingFullVideo(true);
    setIsMergingMaster(true);

    try {
      const workingChunks = [...chunks];

      // 1. Guarantee every chunk has a valid image frame (synthesize commensurate on-the-fly if any missing)
      for (let i = 0; i < workingChunks.length; i++) {
        if (!workingChunks[i].imageSourceUrl) {
          const synth = await synthesizeCommensurateSceneFrame({
            chunkIndex: workingChunks[i].chunkIndex,
            totalChunks: workingChunks.length,
            syncMode: workingChunks[i].syncMode,
            aspectRatio,
            referenceImageUrls: uploadedImageUrls,
            vocalEnergyScore: workingChunks[i].vocalEnergyScore
          });
          workingChunks[i] = {
            ...workingChunks[i],
            imageSourceUrl: synth.dataUrl,
            frameSourceType: 'commensurate_synthesized',
            commensurateSceneLabel: `On-The-Fly Commensurate · ${synth.label}`
          };
        }
      }
      setChunks([...workingChunks]);

      // 2. If user selected a specific cloud model and requested per-chunk pre-render before merge
      if (!fastDirectMergeOnly && selectedModelId !== 'lipsyncer-dsp-60fps') {
        for (let i = 0; i < workingChunks.length; i++) {
          const ch = workingChunks[i];
          if (!ch.generatedVideoUrl) {
            setStatusBanner({
              message: `Rendering Scene #${ch.chunkCode}/${workingChunks.length} (${ch.timeWindowFormatted}) with ${selectedModelId}...`,
              percent: Math.round((i / workingChunks.length) * 50),
              variant: 'info'
            });

            const clip = await renderSingleFullSongChunkLipSync({
              chunk: ch,
              masterAudioSource: audioFile,
              aspectRatio,
              modelIdOverride: selectedModelId
            });

            workingChunks[i] = {
              ...ch,
              generatedVideoUrl: clip.videoUrl,
              status: 'completed',
              progressPercent: 100
            };
            setChunks([...workingChunks]);
          }
        }
      }

      // 3. Execute Exact & Clean Master Video Merge locked to uncut master song audio
      const masterClip = await mergeFullSongVideoMaster({
        chunks: workingChunks,
        masterAudioSource: audioFile,
        songTitle,
        aspectRatio,
        analysis,
        onProgress: (pct, msg) => {
          setStatusBanner({
            message: msg,
            percent: pct,
            variant: 'info'
          });
        }
      });

      setMergedMasterClip(masterClip);
      onClipCreated?.(masterClip);

      // Mark all chunks completed
      setChunks((prev) =>
        prev.map((c) => ({ ...c, status: 'completed', progressPercent: 100 }))
      );

      setStatusBanner({
        message: `🎬 Exact Full-Song Master Video Merged (${masterClip.durationSec}s, ${workingChunks.length} scenes, 1080p MP4)! Ready to play & download below.`,
        percent: 100,
        variant: 'success'
      });
    } catch (err: unknown) {
      setStatusBanner({
        message:
          err instanceof Error
            ? err.message
            : 'Error merging full-song master video.',
        percent: 0,
        variant: 'warning'
      });
    } finally {
      setIsProducingFullVideo(false);
      setIsMergingMaster(false);
    }
  };

  // Play/Stop individual chunk audio preview
  const togglePlayChunkAudio = (chunk: FullSongVideoChunk) => {
    if (!chunk.audioChunkUrl) return;
    if (!chunkAudioPlayerRef.current) {
      chunkAudioPlayerRef.current = new Audio();
    }
    const player = chunkAudioPlayerRef.current;

    if (playingChunkIdx === chunk.chunkIndex) {
      player.pause();
      setPlayingChunkIdx(null);
      return;
    }

    player.src = chunk.audioChunkUrl;
    player.currentTime = 0;
    setPlayingChunkIdx(chunk.chunkIndex);
    player.onended = () => setPlayingChunkIdx(null);
    void player.play().catch(() => setPlayingChunkIdx(null));
  };

  // Live 60fps Interactive Preview Canvas Loop (zero wait preview before MP4 export!)
  const renderLivePreviewFrame = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const audioEl = masterAudioElRef.current;
    if (!canvas || !audioEl || chunks.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const curTime = audioEl.currentTime;
    setLivePreviewTimeSec(curTime);

    const activeChunk =
      chunks.find((c) => curTime >= c.startTimeSec && curTime < c.endTimeSec) ||
      chunks[chunks.length - 1];

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = cachedImageElsRef.current.get(activeChunk.chunkIndex);
    const env = analysis?.vocalEnvelope;
    const vocalEnergy =
      env && env.length > 0
        ? env[Math.min(env.length - 1, Math.max(0, Math.floor(curTime * 50)))]
        : 0.5;

    if (img && img.complete && img.naturalWidth > 0) {
      const elapsed = Math.max(0, curTime - activeChunk.startTimeSec);
      const progress = Math.min(1, elapsed / Math.max(0.2, activeChunk.durationSec));
      const ease = 0.5 * (1 - Math.cos(Math.PI * progress));
      const scale = 1.03 + 0.09 * ease + (activeChunk.syncMode === 'LIP-SYNC' ? vocalEnergy * 0.018 : 0);
      const nodY = activeChunk.syncMode === 'LIP-SYNC' ? -vocalEnergy * (h * 0.005) : 0;

      ctx.save();
      ctx.translate(w * 0.5, h * 0.5 + nodY);
      ctx.scale(scale, scale);
      ctx.translate(-w * 0.5, -h * 0.5);

      const srcAspect = img.naturalWidth / img.naturalHeight;
      const destAspect = w / h;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (srcAspect > destAspect) {
        sw = img.naturalHeight * destAspect;
        sx = (img.naturalWidth - sw) * 0.5;
      } else {
        sh = img.naturalWidth / destAspect;
        sy = (img.naturalHeight - sh) * 0.35;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0c0c16';
      ctx.fillRect(0, 0, w, h);
    }

    if (!audioEl.paused) {
      previewRafRef.current = requestAnimationFrame(renderLivePreviewFrame);
    }
  }, [analysis?.vocalEnvelope, chunks]);

  const toggleLivePreviewPlay = () => {
    const audioEl = masterAudioElRef.current;
    if (!audioEl) return;
    if (isPlayingLivePreview) {
      audioEl.pause();
      setIsPlayingLivePreview(false);
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    } else {
      audioEl
        .play()
        .then(() => {
          setIsPlayingLivePreview(true);
          previewRafRef.current = requestAnimationFrame(renderLivePreviewFrame);
        })
        .catch(() => setIsPlayingLivePreview(false));
    }
  };

  // Download Helpers
  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleDownloadAudioChunksZip = async () => {
    if (chunks.length === 0) return;
    setIsPackagingZip(true);
    try {
      const zipBlob = await packageAudioChunksZip({
        songTitle,
        chunks,
        lrcText: lyricSyncResult?.lrcFormattedText || ''
      });
      const slug = songTitle.replace(/[^a-z0-9]+/gi, '_') || 'Full_Song';
      triggerBlobDownload(zipBlob, `${slug}_Audio_Chunks_WAV.zip`);
    } finally {
      setIsPackagingZip(false);
    }
  };

  const handleDownloadFullProductionZip = async () => {
    if (chunks.length === 0) return;
    setIsPackagingZip(true);
    try {
      const zipBlob = await packageFullSongProductionZip({
        songTitle,
        chunks,
        lrcText: lyricSyncResult?.lrcFormattedText || ''
      });
      const slug = songTitle.replace(/[^a-z0-9]+/gi, '_') || 'Full_Song';
      triggerBlobDownload(zipBlob, `${slug}_Full_Song_Production_Pack.zip`);
    } finally {
      setIsPackagingZip(false);
    }
  };

  const handleDownloadLrcFile = () => {
    if (!lyricSyncResult?.lrcFormattedText) return;
    const blob = new Blob([lyricSyncResult.lrcFormattedText], {
      type: 'text/plain;charset=utf-8'
    });
    const slug = songTitle.replace(/[^a-z0-9]+/gi, '_') || 'Full_Song';
    triggerBlobDownload(blob, `${slug}_Vocal_DSP_Synced.lrc`);
  };

  const activeLiveChunk =
    chunks.find(
      (c) => livePreviewTimeSec >= c.startTimeSec && livePreviewTimeSec < c.endTimeSec
    ) || chunks[0];

  const uploadedCount =
    orderedStoryboardFrames.length > 0
      ? orderedStoryboardFrames.length
      : uploadedImageUrls.length;
  const setACount = orderedStoryboardFrames.filter(
    (f) => f.sceneNumber >= 1 && f.sceneNumber <= 10
  ).length;
  const setBCount = orderedStoryboardFrames.filter(
    (f) => f.sceneNumber >= 11 && f.sceneNumber <= 20
  ).length;
  const totalChunksCount = chunks.length;

  return (
    <div className="space-y-6">
      {/* Hidden Master Audio Element for Live 60fps Preview */}
      <audio
        ref={masterAudioElRef}
        src={audioPreviewUrl}
        onTimeUpdate={() => {
          if (masterAudioElRef.current) {
            setLivePreviewTimeSec(masterAudioElRef.current.currentTime);
          }
        }}
        onEnded={() => setIsPlayingLivePreview(false)}
      />

      {/* ===================================================================== */}
      {/* HERO HEADER & QUICK EXPORT TOOLBAR                                     */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-950/50 via-[#12121e] to-[#0b0b12] border border-violet-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300">
              <Music2 className="w-3.5 h-3.5" />
              <span>FULL SONG VIDEO MODE • INTELLIGENT CHUNKER + ON-THE-FLY COMMENSURATE FRAMES</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Full Song Lip-Sync &amp; Storyboard Auto-Commensurate Merger
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl leading-relaxed">
              Upload your full song track and storyboard images. If your storyboard images fall short of covering all audio chunks (e.g., 14 or 20 images vs song chunks), LipSyncer automatically synthesizes <strong>commensurate scene frames on the fly</strong>, aligns lyrics via <strong>🧠 Sync Lyrics with Audio Signal (AI + Vocal DSP)</strong>, and merges an exact, clean 1080p MP4 master.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleDownloadAudioChunksZip}
              disabled={chunks.length === 0 || isPackagingZip}
              className="px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              title="Download all sliced WAV audio chunks (Audiospliter.com Engine)"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Audio Chunks ZIP ({chunks.length})</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadLrcFile}
              disabled={!lyricSyncResult}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Synced .LRC</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFullProductionZip}
              disabled={chunks.length === 0 || isPackagingZip}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Full Production Pack ZIP</span>
            </button>
          </div>
        </div>

        {/* Status Progress Banner */}
        {statusBanner && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex flex-col gap-2 ${
              statusBanner.variant === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : statusBanner.variant === 'warning'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-violet-950/40 border-violet-500/40 text-violet-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {isBuildingChunks || isProducingFullVideo || isSyncingLyrics ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{statusBanner.message}</span>
              </span>
              {statusBanner.percent > 0 && statusBanner.percent < 100 && (
                <span className="font-mono font-bold">{statusBanner.percent}%</span>
              )}
            </div>
            {statusBanner.percent > 0 && statusBanner.percent < 100 && (
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${statusBanner.percent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* STEP 1 & STEP 2: FULL SONG CHUNKER + MULTI-IMAGE STORYBOARD UPLOADER   */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Full Song Upload & Audiospliter Smart Chunking (6 Cols) */}
        <div className="lg:col-span-6 p-5 rounded-3xl bg-[#12121a] border border-white/8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Scissors className="w-4 h-4 text-cyan-400" />
              <span>1. Full Song Upload &amp; Intelligent Audio Chunker</span>
            </h2>
            {analysis && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-mono font-semibold text-cyan-300">
                {analysis.feltGrooveBpm} BPM • {analysis.durationSec.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Song Title & Upload Dropzone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Song Title
              </label>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="w-full bg-[#171722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                placeholder="Enter song title..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Master Song File (MP3 / WAV / M4A)
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/12 hover:bg-cyan-500/20 border border-dashed border-cyan-500/40 text-xs font-semibold text-cyan-200 cursor-pointer transition truncate">
                <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {audioFileName || 'Upload Full Song Track'}
                </span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac"
                  onChange={handleSongFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Chunking Strategy Tabs */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-400">
              Audio Chunking Strategy (Audiospliter.com + Vocal Formant DSP)
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0b0b12] border border-white/6">
              {(
                [
                  { id: 'target_scene_count', label: 'Target Scene Count' },
                  { id: 'smart_vocal_dsp', label: 'Smart Vocal DSP' },
                  { id: 'fixed_interval', label: 'Min : Sec Interval' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChunkMode(tab.id)}
                  className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    chunkMode === tab.id
                      ? 'bg-cyan-500 text-black font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Chunking Parameters */}
          {chunkMode === 'fixed_interval' ? (
            <div className="p-3.5 rounded-2xl bg-[#161622] border border-white/8 flex items-center justify-between gap-4">
              <div className="text-xs text-zinc-300">
                <span className="font-bold text-white block">
                  Split Every (Minutes : Seconds)
                </span>
                <span className="text-[11px] text-zinc-400">
                  Exact sample-accurate WAV splitter (Audiospliter.com engine)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={intervalMinutes}
                  onChange={(e) =>
                    setIntervalMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-14 bg-[#0d0d15] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-center text-white font-mono"
                />
                <span className="text-zinc-400 font-bold">:</span>
                <input
                  type="number"
                  min={2}
                  max={59}
                  value={intervalSeconds}
                  onChange={(e) =>
                    setIntervalSeconds(
                      Math.min(59, Math.max(2, parseInt(e.target.value, 10) || 8))
                    )
                  }
                  className="w-14 bg-[#0d0d15] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-center text-white font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#161622] border border-white/8 flex items-center justify-between gap-4">
              <div className="text-xs text-zinc-300">
                <span className="font-bold text-white block">
                  Target Storyboard Chunks / Scenes
                </span>
                <span className="text-[11px] text-zinc-400">
                  Snaps cuts to vocal breath valleys so words are never cut in half
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={targetSceneCount}
                  onChange={(e) =>
                    setTargetSceneCount(
                      Math.min(60, Math.max(2, parseInt(e.target.value, 10) || 20))
                    )
                  }
                  className="w-16 bg-[#0d0d15] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-center text-white font-mono font-bold"
                />
                <span className="text-xs text-zinc-400">scenes</span>
              </div>
            </div>
          )}

          {/* Model & Aspect Ratio Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Lip-Sync Model Engine
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full bg-[#171722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {LIPSYNC_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Master Video Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['16:9', '9:16', '1:1'] as AspectRatioOption[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(ar)}
                    className={`py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      aspectRatio === ar
                        ? 'bg-violet-600/30 border-violet-500 text-white'
                        : 'bg-white/4 border-white/8 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isBuildingChunks || !audioFile}
            onClick={() => void executeChunkAndFramePipeline()}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isBuildingChunks ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scissors className="w-4 h-4" />
            )}
            <span>Re-Chunk Song &amp; Pair Storyboard Frames</span>
          </button>
        </div>

        {/* Step 2: Multi-Image Storyboard Uploader & Commensurate Frame Synthesizer (6 Cols) */}
        <div className="lg:col-span-6 p-5 rounded-3xl bg-[#12121a] border border-white/8 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>2. ChatGPT 2-ZIP (01–10 &amp; 11–20) &amp; Storyboard Unraveller</span>
              </h2>
              <button
                type="button"
                onClick={handleImportFromDirector}
                className="px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/10 text-[11px] font-semibold text-amber-300 border border-amber-500/30 transition cursor-pointer"
              >
                Import from 20-Scene Director
              </button>
            </div>

            {/* Unified Multi-ZIP + Multi-Image Dropzone */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  void processStoryboardFiles(Array.from(e.dataTransfer.files), 'AUTO');
                }
              }}
              className="block p-4 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-center transition cursor-pointer"
            >
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed,image/*,.txt"
                multiple
                onChange={(e) => void handleStoryboardImagesUpload(e, 'AUTO')}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-1.5">
                <FolderArchive className="w-6 h-6 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  Drop or Select ChatGPT ZIPs (`Folder_A_01_10.zip` + `Folder_B_11_20.zip`) or Images 01–20
                </span>
                <span className="text-[11px] text-zinc-400">
                  Select both ZIPs at once (in any order!) or upload one after the other — automatically unzips &amp; sorts #01 → #20!
                </span>
              </div>
            </label>

            {/* Dedicated Folder A (01–10) & Folder B (11–20) Quick Slot Uploaders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="p-2.5 rounded-xl bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-between gap-2 cursor-pointer transition">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderArchive className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold text-cyan-200 block">
                      Set A: Scenes 01–10
                    </span>
                    <span className="text-[10px] text-zinc-400 block truncate">
                      Upload `Folder_A_Images_01_10.zip`
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 shrink-0">
                  {setACount}/10
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed,image/*"
                  multiple
                  onChange={(e) => void handleStoryboardImagesUpload(e, 'A')}
                  className="hidden"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-fuchsia-950/30 hover:bg-fuchsia-950/50 border border-fuchsia-500/30 flex items-center justify-between gap-2 cursor-pointer transition">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderArchive className="w-4 h-4 text-fuchsia-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold text-fuchsia-200 block">
                      Set B: Scenes 11–20
                    </span>
                    <span className="text-[10px] text-zinc-400 block truncate">
                      Upload `Folder_B_Images_11_20.zip`
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/30 text-[10px] font-mono font-bold text-fuchsia-300 shrink-0">
                  {setBCount}/10
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed,image/*"
                  multiple
                  onChange={(e) => void handleStoryboardImagesUpload(e, 'B')}
                  className="hidden"
                />
              </label>
            </div>

            {/* Commensurate Shortfall Telemetry Banner */}
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                shortfallFilledCount > 0
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    Uploaded Frames: {uploadedCount} | Audio Chunks: {totalChunksCount}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-black/40 text-[10px] font-mono">
                  {shortfallFilledCount > 0
                    ? `+${shortfallFilledCount} Commensurate Frames Auto-Created`
                    : 'Sorted #01 → #20 Lock'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {shortfallFilledCount > 0
                  ? `Your upload had ${uploadedCount} images for ${totalChunksCount} audio chunks (${shortfallFilledCount} short). LipSyncer automatically synthesized ${shortfallFilledCount} commensurate scene frames on the fly so every audio chunk has a high-definition visual scene!`
                  : `All ${totalChunksCount} audio chunks are paired in exact #01 → #${totalChunksCount} chronological scene order.`}
              </p>
            </div>

            {/* Canonical #01 -> #20 Unraveled Thumbnails Strip */}
            {(orderedStoryboardFrames.length > 0 || uploadedImageUrls.length > 0) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    Ordered Storyboard Sequence (
                    {orderedStoryboardFrames.length > 0
                      ? `${orderedStoryboardFrames.length} frames sorted #01 → #${orderedStoryboardFrames[orderedStoryboardFrames.length - 1]?.sceneCode}`
                      : `${uploadedImageUrls.length} demo frames`}
                    ):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderedStoryboardFrames([]);
                      setUploadedImageUrls([]);
                      void executeChunkAndFramePipeline({
                        imagesOverride: [],
                        framesOverride: []
                      });
                    }}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                </div>

                {orderedStoryboardFrames.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                    {orderedStoryboardFrames.map((frame, idx) => (
                      <div
                        key={`${frame.sceneNumber}-${frame.originalFileName}`}
                        title={`#${frame.sceneCode} (Set ${frame.folderBatch}): ${frame.sceneTitle}\nFile: ${frame.originalFileName}`}
                        className="relative w-24 h-16 rounded-xl overflow-hidden border border-white/15 shrink-0 group bg-black"
                      >
                        <img
                          src={frame.dataUrl}
                          alt={frame.sceneTitle}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-0.5 left-0.5 right-0.5 flex items-center justify-between px-1">
                          <span
                            className={`px-1 rounded text-[9px] font-mono font-bold ${
                              frame.folderBatch === 'A'
                                ? 'bg-cyan-500/90 text-black'
                                : 'bg-fuchsia-500/90 text-white'
                            }`}
                          >
                            #{frame.sceneCode} {frame.folderBatch}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-black/80 rounded px-0.5 transition">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => void handleSwapStoryboardSlots(idx, idx - 1)}
                              className="text-[9px] text-white hover:text-amber-300 px-0.5 disabled:opacity-30 cursor-pointer"
                              title="Swap left"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedStoryboardFrames.length - 1}
                              onClick={() => void handleSwapStoryboardSlots(idx, idx + 1)}
                              className="text-[9px] text-white hover:text-amber-300 px-0.5 disabled:opacity-30 cursor-pointer"
                              title="Swap right"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1 py-0.5 text-[9px] text-zinc-200 truncate">
                          {frame.sceneTitle}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                    {uploadedImageUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative w-16 h-11 rounded-lg overflow-hidden border border-white/15 shrink-0 group bg-black"
                      >
                        <img
                          src={url}
                          alt={`Uploaded ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/80 text-[9px] font-mono text-white">
                          #{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleResynthesizeCommensurateFrames}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Wand2 className="w-4 h-4 text-amber-400" />
            <span>✨ Re-Synthesize Commensurate Frames On-The-Fly</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* STEP 3: 🧠 SYNC LYRICS WITH AUDIO SIGNAL (AI + VOCAL DSP)              */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-3xl bg-[#12121a] border border-violet-500/30 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[11px] font-bold mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>ACOUSTIC-PHONETIC FORMANTS (280Hz–3.6kHz) + WHISPER AI</span>
            </div>
            <h2 className="text-lg font-extrabold text-white">
              🧠 Sync Lyrics with Audio Signal (AI + Vocal DSP)
            </h2>
            <p className="text-xs text-zinc-400">
              Automatically maps lyric phrases to vocal formant islands and marks low-energy breath/instrumental chunks as Cinematic Motion so performers only move their lips when vocals are present.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isTranscribingWhisper || !audioFile}
              onClick={handleWhisperTranscribeAndSync}
              className="px-3.5 py-2.5 rounded-xl bg-white/6 hover:bg-white/12 text-zinc-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isTranscribingWhisper ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>Auto-Transcribe (Whisper AI)</span>
            </button>

            <button
              type="button"
              disabled={isSyncingLyrics || !audioFile}
              onClick={handleSyncLyricsWithVocalDsp}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-violet-600/25 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isSyncingLyrics ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Activity className="w-4 h-4" />
              )}
              <span>🧠 Sync Lyrics with Audio Signal (AI + Vocal DSP)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Lyrics Input Box (5 Cols) */}
          <div className="lg:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">
                Song Lyrics or [mm:ss.xx] LRC (Zero on-screen text lock enforced)
              </span>
              {lyricSyncResult && (
                <span className="text-emerald-400 font-mono font-bold">
                  {(lyricSyncResult.overallSyncConfidence * 100).toFixed(1)}% DSP Lock
                </span>
              )}
            </div>
            <textarea
              rows={5}
              value={rawLyrics}
              onChange={(e) => setRawLyrics(e.target.value)}
              placeholder="Paste song lyrics or [00:08.50] LRC lines here..."
              className="w-full bg-[#0d0d15] border border-white/10 rounded-2xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-violet-500 leading-relaxed"
            />
          </div>

          {/* Vocal Formant Signal & Chunk Map Visualizer (7 Cols) */}
          <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c0c14] border border-white/8 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Vocal Formant Envelope &amp; Intelligent Chunk Boundaries</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Click any chunk bar below to audition audio slice
              </span>
            </div>

            {/* Interactive Chunk Signal Bar */}
            <div className="h-20 rounded-xl bg-[#07070c] border border-white/8 p-2 flex items-end gap-1 overflow-x-auto">
              {chunks.map((c) => {
                const isPlayingThis = playingChunkIdx === c.chunkIndex;
                const heightPct = Math.max(22, Math.round(c.vocalEnergyScore * 95));
                return (
                  <button
                    key={c.chunkIndex}
                    type="button"
                    onClick={() => togglePlayChunkAudio(c)}
                    title={`Chunk #${c.chunkCode} (${c.timeWindowFormatted}): "${c.syncedLyrics}"`}
                    className={`flex-1 min-w-[24px] h-full flex flex-col justify-end items-center gap-1 group cursor-pointer rounded-lg p-1 transition ${
                      isPlayingThis
                        ? 'bg-cyan-500/25 ring-1 ring-cyan-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-sm transition-all ${
                        c.syncMode === 'LIP-SYNC'
                          ? 'bg-gradient-to-t from-violet-600 to-cyan-400 group-hover:from-violet-500 group-hover:to-emerald-300'
                          : 'bg-amber-500/50'
                      }`}
                    />
                    <span className="text-[9px] font-mono text-zinc-400 group-hover:text-white">
                      {c.chunkCode}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" />
                  <span>LIP-SYNC (Vocal Active)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 inline-block" />
                  <span>CINEMATIC MOTION (Instrumental)</span>
                </span>
              </div>
              {analysis && (
                <span className="font-mono text-zinc-300">
                  Vocal Islands: {analysis.vocalIslands.length} • Groove: {analysis.feltGrooveBpm} BPM
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* STEP 4: 60FPS MASTER MERGE THEATER & 1-CLICK FULL VIDEO EXPORT         */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-3xl bg-[#101018] border border-emerald-500/30 space-y-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-bold mb-1">
              <Film className="w-3.5 h-3.5" />
              <span>SUB-MILLISECOND ADAPTIVE CLOCK SYNC • ZERO AUDIO SPLICE DRIFT</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">
              Final Full-Song Master Video Merger &amp; 60fps Cinema Stage
            </h2>
            <p className="text-xs text-zinc-400">
              Merges all {chunks.length} scenes (uploaded storyboard images + on-the-fly commensurate frames + lip-sync motion) against the single uncut master song audio track.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={toggleLivePreviewPlay}
              disabled={chunks.length === 0}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 border border-white/15 transition cursor-pointer"
            >
              {isPlayingLivePreview ? (
                <Pause className="w-4 h-4 text-amber-400" />
              ) : (
                <Play className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {isPlayingLivePreview ? 'Pause Live Preview' : 'Preview Full Song Canvas (60fps)'}
              </span>
            </button>

            <button
              type="button"
              disabled={isProducingFullVideo || isMergingMaster || chunks.length === 0}
              onClick={() => void handleProduceAndMergeFullSongMaster(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isMergingMaster ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>
                {isMergingMaster
                  ? 'Merging Exact Master MP4...'
                  : '⚡ Produce & Merge Exact Full-Song Master (.MP4)'}
              </span>
            </button>
          </div>
        </div>

        {/* Cinema Stage Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8">
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/15 shadow-2xl flex items-center justify-center">
              {mergedMasterClip && !isPlayingLivePreview ? (
                <video
                  src={mergedMasterClip.videoUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <canvas
                  ref={previewCanvasRef}
                  width={1280}
                  height={720}
                  className="w-full h-full object-contain"
                />
              )}

              {/* HUD Overlay on Live Preview */}
              {(!mergedMasterClip || isPlayingLivePreview) && activeLiveChunk && (
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-xs pointer-events-none">
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-2 py-0.5 rounded bg-violet-600 text-white font-mono font-bold text-[10px]">
                      Scene #{activeLiveChunk.chunkCode}/{chunks.length}
                    </span>
                    <span className="text-zinc-200 font-medium truncate">
                      {activeLiveChunk.syncMode === 'LIP-SYNC'
                        ? `"${activeLiveChunk.syncedLyrics}"`
                        : activeLiveChunk.commensurateSceneLabel}
                    </span>
                  </div>
                  <span className="font-mono text-cyan-300 shrink-0">
                    {livePreviewTimeSec.toFixed(1)}s /{' '}
                    {(analysis?.durationSec || 0).toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary & Download Box (4 Cols) */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-[#151522] border border-white/10 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Master Merge Telemetry
              </span>
              <h3 className="text-base font-bold text-white">{songTitle}</h3>
              <p className="text-xs text-zinc-400">
                Uncut Master Audio + {chunks.length} Synchronized Storyboard &amp; Commensurate Scenes
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/6">
                <span className="text-zinc-500 block text-[10px]">Total Scenes</span>
                <span className="text-white font-bold">{chunks.length} Scenes</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/6">
                <span className="text-zinc-500 block text-[10px]">Commensurate Auto-Fill</span>
                <span className="text-amber-300 font-bold">
                  {shortfallFilledCount} On-The-Fly
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/6">
                <span className="text-zinc-500 block text-[10px]">Lyric Sync Lock</span>
                <span className="text-cyan-300 font-bold">
                  {lyricSyncResult
                    ? `${(lyricSyncResult.overallSyncConfidence * 100).toFixed(1)}% DSP`
                    : 'Ready'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/6">
                <span className="text-zinc-500 block text-[10px]">Master Output</span>
                <span className="text-emerald-300 font-bold">1080p H.264 MP4</span>
              </div>
            </div>

            {mergedMasterClip ? (
              <button
                type="button"
                onClick={() =>
                  void downloadVideoWithName(
                    mergedMasterClip.videoUrl,
                    buildVideoFileName(mergedMasterClip)
                  )
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-500 hover:to-amber-400 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Final Merged Master (.MP4)</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-white/4 border border-white/8 text-[11px] text-zinc-400 leading-relaxed">
                Click <strong>⚡ Produce &amp; Merge Exact Full-Song Master (.MP4)</strong> above to encode the complete {chunks.length}-scene music video into a downloadable MP4 file.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* STEP 5: CHUNK-BY-CHUNK STORYBOARD & COMMENSURATE FRAME TIMELINE GRID   */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              <span>
                Synchronized Audio Chunks &amp; Storyboard Frame Rack ({chunks.length} Chunks)
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Inspect every chunk&apos;s audio slice, synced lyrics, and visual frame. Swap any image or synthesize a new commensurate frame on the fly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chunks.map((chunk) => {
            const isPlayingAudio = playingChunkIdx === chunk.chunkIndex;
            const isCommensurate = chunk.frameSourceType === 'commensurate_synthesized';

            return (
              <div
                key={chunk.chunkIndex}
                className={`p-4 rounded-2xl bg-[#13131d] border transition space-y-3 flex flex-col justify-between ${
                  isCommensurate
                    ? 'border-amber-500/30 hover:border-amber-500/50'
                    : 'border-white/8 hover:border-white/20'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Chunk Code, Time Window, Sync Mode */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono font-bold text-xs">
                        #{chunk.chunkCode}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {chunk.timeWindowFormatted} ({chunk.durationSec}s)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setChunks((prev) =>
                          prev.map((c) =>
                            c.chunkIndex === chunk.chunkIndex
                              ? {
                                  ...c,
                                  syncMode:
                                    c.syncMode === 'LIP-SYNC'
                                      ? 'CINEMATIC-MOTION'
                                      : 'LIP-SYNC'
                                }
                              : c
                          )
                        );
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer ${
                        chunk.syncMode === 'LIP-SYNC'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                      title="Click to toggle between LIP-SYNC and CINEMATIC MOTION"
                    >
                      {chunk.syncMode}
                    </button>
                  </div>

                  {/* Visual Frame / Rendered Chunk Video Viewport */}
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 group">
                    {chunk.generatedVideoUrl ? (
                      <video
                        src={chunk.generatedVideoUrl}
                        controls
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : chunk.imageSourceUrl ? (
                      <img
                        src={chunk.imageSourceUrl}
                        alt={chunk.commensurateSceneLabel}
                        className="w-full h-full object-cover"
                      />
                    ) : null}

                    {/* Frame Source Badge */}
                    <div
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md border ${
                        chunk.frameSourceType === 'uploaded'
                          ? 'bg-emerald-950/85 text-emerald-300 border-emerald-500/40'
                          : chunk.frameSourceType === 'ai_cloud_generated'
                            ? 'bg-cyan-950/85 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-950/85 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {chunk.frameSourceType === 'uploaded'
                        ? '📸 Uploaded Storyboard'
                        : chunk.frameSourceType === 'ai_cloud_generated'
                          ? '🎨 AI Cloud Frame'
                          : '✨ On-The-Fly Commensurate Frame'}
                    </div>

                    {/* Play Audio Chunk Slice Button */}
                    <button
                      type="button"
                      onClick={() => togglePlayChunkAudio(chunk)}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-semibold border border-white/15 flex items-center gap-1 cursor-pointer"
                    >
                      {isPlayingAudio ? (
                        <Pause className="w-3 h-3 text-cyan-400" />
                      ) : (
                        <Play className="w-3 h-3 text-cyan-400" />
                      )}
                      <span>{isPlayingAudio ? 'Stop Slice' : 'Play Audio Slice'}</span>
                    </button>
                  </div>

                  {/* Synced Lyric Line Editor & Vocal DSP Meter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Synced Lyric / Vocal Cue:</span>
                      <span className="font-mono text-cyan-300">
                        Vocal Energy: {Math.round(chunk.vocalEnergyScore * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={chunk.syncedLyrics}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChunks((prev) =>
                          prev.map((c) =>
                            c.chunkIndex === chunk.chunkIndex
                              ? { ...c, syncedLyrics: val }
                              : c
                          )
                        );
                      }}
                      className="w-full bg-[#0b0b12] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Bottom Controls: Camera Motion + Frame Actions + Single Chunk Render */}
                <div className="pt-2 border-t border-white/6 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={chunk.cameraMovement}
                      onChange={(e) => {
                        const cam = e.target.value as CameraMotionPreset;
                        setChunks((prev) =>
                          prev.map((c) =>
                            c.chunkIndex === chunk.chunkIndex
                              ? { ...c, cameraMovement: cam }
                              : c
                          )
                        );
                      }}
                      className="bg-[#0b0b12] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                    >
                      <option value="push_in">Push-In</option>
                      <option value="slow_pan">Slow Pan</option>
                      <option value="handheld_cinema">Handheld</option>
                      <option value="drone_pull_back">Pull-Back</option>
                      <option value="orbital_spin">Orbital</option>
                      <option value="macro_dof">Macro DOF</option>
                    </select>

                    <div className="flex items-center gap-1">
                      <label
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-zinc-300 border border-white/10 cursor-pointer"
                        title="Upload custom image for this chunk"
                      >
                        Swap Img
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleReplaceSingleChunkImage(
                              chunk.chunkIndex,
                              e.target.files?.[0]
                            )
                          }
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={chunk.status === 'synthesizing_frame'}
                        onClick={() =>
                          void handleRegenerateSingleChunkFrame(chunk.chunkIndex, false)
                        }
                        className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[10px] font-semibold text-amber-300 border border-amber-500/30 cursor-pointer disabled:opacity-40"
                        title="Synthesize a new commensurate frame on the fly"
                      >
                        ✨ On-Fly Frame
                      </button>

                      <button
                        type="button"
                        disabled={chunk.status === 'synthesizing_frame'}
                        onClick={() =>
                          void handleRegenerateSingleChunkFrame(chunk.chunkIndex, true)
                        }
                        className="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-[10px] font-semibold text-violet-300 border border-violet-500/30 cursor-pointer disabled:opacity-40"
                        title="Generate frame with Cloud AI (FLUX / CogView)"
                      >
                        🎨 AI
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={chunk.status === 'rendering_lipsync'}
                    onClick={() => void handleRenderSingleChunkVideo(chunk.chunkIndex)}
                    className="w-full py-1.5 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {chunk.status === 'rendering_lipsync' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Syncing Chunk ({chunk.progressPercent || 15}%)...</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-3 h-3" />
                        <span>
                          {chunk.generatedVideoUrl
                            ? 'Re-Render Chunk Lip-Sync'
                            : 'Render Chunk Lip-Sync Video'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
