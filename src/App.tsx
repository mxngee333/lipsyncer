import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Film,
  Mic,
  Image as ImageIcon,
  Video,
  Sliders,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  HelpCircle,
  User,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Zap,
  Trophy,
  Compass,
  ScanFace,
  Wand2,
  Flame,
  Music2,
  Clock,
  Radio
} from 'lucide-react';

import {
  LipSyncModelSpec,
  InputMediaMode,
  AspectRatioOption,
  CameraMotionPreset,
  GenerationProgress,
  GeneratedLipSyncClip,
  LipSyncerUser
} from './types';

import {
  LIPSYNC_MODELS,
  getRecommendedModelForMediaMode
} from './data/modelCatalog';

import {
  generateLipSyncWithModel,
  generateStudioPortraitImage
} from './services/lipSyncEngineService';

import {
  saveGenerationRecord,
  loadAllGenerations,
  deleteGenerationRecord
} from './services/mediaVaultDb';

import {
  getTokenPoolStatus,
  isZeroGpuQuotaError
} from './services/tokenPoolService';

import {
  getSessionUser,
  signOutUserAccount
} from './services/r2VaultService';

import { ModelBrandIcon } from './components/ModelBrandIcon';
import { OpenArtModelSelectorModal } from './components/OpenArtModelSelectorModal';
import { AuthModal } from './components/AuthModal';
import { HfTokenPoolModal } from './components/HfTokenPoolModal';
import { QuotaInterceptorModal } from './components/QuotaInterceptorModal';
import { GenerationNoticeModal, NoticeModalState } from './components/GenerationNoticeModal';
import { WaveformTrimmer, AudioSelectionMeta } from './components/WaveformTrimmer';
import { StoryboardDirectorView } from './components/StoryboardDirectorView';
import { ModelArenaView } from './components/ModelArenaView';
import { CreationsVaultView } from './components/CreationsVaultView';
import { LegalPagesModal, LegalDocKey } from './components/LegalPagesModal';
import { buildVideoFileName, downloadVideoWithName } from './services/clipNaming';

type MainNavTab = 'studio' | 'director' | 'arena' | 'models' | 'vault';

// High quality cinematic demo portrait presets for zero-friction 1-click testing
const DEMO_FACE_PRESETS = [
  {
    id: 'studio_vocalist',
    label: 'Studio Pop Vocalist',
    sub: 'Dramatic studio spotlight, warm rim backlight',
    imageUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    prompt:
      'Ultra-photorealistic close-up portrait of a singer performing passionately in front of a vintage Neumann microphone, warm cinematic rim lighting, 8k resolution, raw emotion'
  },
  {
    id: 'cinematic_actor',
    label: 'Cinematic Monologue Actor',
    sub: 'Anamorphic lens flare, moody film noir',
    imageUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    prompt:
      'Master shot of a charismatic actor speaking with heartfelt nuance, soft anamorphic teal and amber grading, natural skin texture, subtle expressive brow movement'
  },
  {
    id: 'synthwave_cyber',
    label: 'Cyberpunk Vocalist',
    sub: 'Neon magenta backlight, rainy neon reflection',
    imageUrl:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    prompt:
      'Futuristic electronic music vocalist in cyberpunk studio with neon reflections in eyes, holographic stage haze, singing with crisp mouth articulation'
  }
];

export const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<MainNavTab>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.includes('/storyboard-director')) return 'director';
      if (p.includes('/arena')) return 'arena';
      if (p.includes('/models')) return 'models';
      if (p.includes('/vault')) return 'vault';
    }
    return 'studio';
  });

  // Modals State
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHfPoolModalOpen, setIsHfPoolModalOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [quotaErrorMessage, setQuotaErrorMessage] = useState<string | null>(null);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(null);
  const [noticeModal, setNoticeModal] = useState<NoticeModalState | null>(null);

  // User State
  const [currentUser, setCurrentUser] = useState<LipSyncerUser | null>(() => getSessionUser());

  // Generation & Model State
  const [selectedModel, setSelectedModel] = useState<LipSyncModelSpec>(() => {
    return LIPSYNC_MODELS.find((m) => m.id === 'openart-lip-sync') ?? LIPSYNC_MODELS[0];
  });
  const [inputMode, setInputMode] = useState<InputMediaMode>('image_audio');

  // Media Inputs
  const [imageSource, setImageSource] = useState<string | File | null>(
    DEMO_FACE_PRESETS[0].imageUrl
  );
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
    DEMO_FACE_PRESETS[0].imageUrl
  );
  const [videoSource, setVideoSource] = useState<string | File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Audio Ingest
  const [audioSource, setAudioSource] = useState<Blob | File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('lead_vocal_phrase.wav');
  const [sliceStartSec, setSliceStartSec] = useState<number>(0);
  const [sliceEndSec, setSliceEndSec] = useState<number>(5.5);
  const [audioDurationSec, setAudioDurationSec] = useState<number>(5.5);

  // Prompt & Options
  const [prompt, setPrompt] = useState<string>(
    'Ultra-photorealistic close-up portrait of a singer vocalizing each syllable with natural lip movement and expressive eyes, cinematic lighting, 8k raw quality'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('16:9');
  const [cameraMovement, setCameraMovement] = useState<CameraMotionPreset>('push_in');

  // AI Portrait Generator Sub-state
  const [isPortraitGenOpen, setIsPortraitGenOpen] = useState(false);
  const [portraitGenPrompt, setPortraitGenPrompt] = useState('');
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);

  // Execution & Progress State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    status: 'idle',
    message: '',
    progressPercent: 0
  });
  const [activeGeneratedClip, setActiveGeneratedClip] = useState<GeneratedLipSyncClip | null>(null);
  const [recentClips, setRecentClips] = useState<GeneratedLipSyncClip[]>([]);

  // Video Player Controls
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);

  // Sync Token Pool Status
  const [poolStatus, setPoolStatus] = useState(() => getTokenPoolStatus());
  useEffect(() => {
    const timer = setInterval(() => {
      setPoolStatus(getTokenPoolStatus());
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const readyAccountsCount = poolStatus.filter((s) => !s.isExhausted).length;
  const totalAccountsCount = poolStatus.length;

  // Load creations from IndexedDB on start
  useEffect(() => {
    let mounted = true;
    loadAllGenerations()
      .then((records) => {
        if (!mounted) return;
        setRecentClips(records);
        if (records.length > 0 && !activeGeneratedClip) {
          setActiveGeneratedClip(records[0]);
        }
      })
      .catch((err) => {
        console.warn('Could not load cached creations:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Update URL history when tab changes
  const handleTabChange = (tab: MainNavTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const routeMap: Record<MainNavTab, string> = {
        studio: '/',
        director: '/storyboard-director/',
        arena: '/arena/',
        models: '/models/',
        vault: '/vault/'
      };
      const path = routeMap[tab];
      if (window.location.pathname !== path) {
        window.history.pushState({}, '', path);
      }
    }
  };

  // Sync Input Mode changes to Recommended Model if needed
  const handleInputModeChange = (mode: InputMediaMode) => {
    setInputMode(mode);
    if (mode === 'video_audio' && !selectedModel.supportsVideoInput) {
      const rec = getRecommendedModelForMediaMode('video_audio');
      setSelectedModel(rec);
    } else if (mode === 'image_audio' && !selectedModel.supportsImageInput) {
      const rec = getRecommendedModelForMediaMode('image_audio');
      setSelectedModel(rec);
    }
  };

  // Handle Model Selection
  const handleSelectModel = (_modelId: string, model: LipSyncModelSpec) => {
    setSelectedModel(model);
    setIsModelSelectorOpen(false);
    if (model.supportsVideoInput && !model.supportsImageInput && inputMode !== 'video_audio') {
      setInputMode('video_audio');
    } else if (model.supportsImageInput && !model.supportsVideoInput && inputMode !== 'image_audio') {
      setInputMode('image_audio');
    }
  };

  // Handle File Ingest
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageSource(file);
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSource(file);
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    }
  };

  // Handle Audio Ingest from WaveformTrimmer
  const handleAudioChange = useCallback(
    (audioBlob: Blob | File, meta: AudioSelectionMeta) => {
      setAudioSource(audioBlob);
      if (meta.fileName) setAudioFileName(meta.fileName);
      setSliceStartSec(meta.sliceStartSec);
      setSliceEndSec(meta.sliceEndSec);
      setAudioDurationSec(meta.durationSec);
    },
    []
  );

  const handleSliceChange = useCallback((startSec: number, endSec: number) => {
    setSliceStartSec(startSec);
    setSliceEndSec(endSec);
  }, []);

  // AI Portrait Generator Action
  const handleGenerateAiPortrait = async () => {
    if (!portraitGenPrompt.trim()) return;
    setIsGeneratingPortrait(true);
    try {
      const dataUrl = await generateStudioPortraitImage(portraitGenPrompt, aspectRatio);
      setImageSource(dataUrl);
      setImagePreviewUrl(dataUrl);
      setIsPortraitGenOpen(false);
    } catch (err: any) {
      setNoticeModal({
        isOpen: true,
        type: 'general_error',
        title: 'Studio Portrait Generation Note',
        message: err?.message || 'Using fallback high-definition studio portrait.',
        primaryActionLabel: 'Use Pop Singer Preset',
        onPrimaryAction: () => {
          setImageSource(DEMO_FACE_PRESETS[0].imageUrl);
          setImagePreviewUrl(DEMO_FACE_PRESETS[0].imageUrl);
        }
      });
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  // Main LipSync Generation Trigger
  const handleStartGeneration = async () => {
    if (isGenerating) return;

    // Check media
    if (inputMode === 'image_audio' && !imageSource) {
      setNoticeModal({
        isOpen: true,
        type: 'missing_input',
        title: 'Portrait Image Required',
        message: 'Please upload or select a face portrait image to generate talking or singing lip-sync.',
        primaryActionLabel: 'Load Demo Pop Singer',
        onPrimaryAction: () => {
          setImageSource(DEMO_FACE_PRESETS[0].imageUrl);
          setImagePreviewUrl(DEMO_FACE_PRESETS[0].imageUrl);
        }
      });
      return;
    }
    if (inputMode === 'video_audio' && !videoSource) {
      setNoticeModal({
        isOpen: true,
        type: 'missing_input',
        title: 'Video Input Required',
        message: 'Please upload an existing MP4/WebM video of a speaking or singing subject to re-synchronize mouth and jaw articulation.',
        primaryActionLabel: 'Switch to Portrait Mode',
        onPrimaryAction: () => {
          setInputMode('image_audio');
          setImageSource(DEMO_FACE_PRESETS[0].imageUrl);
          setImagePreviewUrl(DEMO_FACE_PRESETS[0].imageUrl);
        }
      });
      return;
    }

    setIsGenerating(true);
    setProgress({
      status: 'preparing',
      message: `Spinning up ${selectedModel.name}...`,
      progressPercent: 5
    });

    try {
      // Default to demo audio if user has not yet recorded or uploaded one
      let effectiveAudio: Blob | File | string = audioSource as any;
      if (!effectiveAudio) {
        effectiveAudio = 'DEMO_SYNTHETIC_VOCAL_PHRASE';
      }

      const generatedClip = await generateLipSyncWithModel(
        {
          modelId: selectedModel.id,
          inputMode,
          imageSource: inputMode === 'image_audio' ? imageSource : null,
          videoSource: inputMode === 'video_audio' ? videoSource : null,
          audioSource: effectiveAudio,
          audioSliceStartSec: sliceStartSec,
          audioSliceEndSec: sliceEndSec,
          prompt,
          aspectRatio,
          resolution: '1080p',
          durationSec: Math.max(2, sliceEndSec - sliceStartSec),
          cameraMovement,
          preserveZeroOnScreenText: true
        },
        (p) => {
          setProgress(p);
        }
      );
      const clip: GeneratedLipSyncClip = {
        ...generatedClip,
        audioName: audioSource ? audioFileName : 'demo_vocal_phrase'
      };

      // Save to media vault
      await saveGenerationRecord(clip);
      setActiveGeneratedClip(clip);
      setRecentClips((prev) => [clip, ...prev.filter((c) => c.id !== clip.id)]);

      setProgress({
        status: 'complete',
        message: 'Generation completed with high-fidelity sync!',
        progressPercent: 100
      });
    } catch (err: any) {
      console.error('LipSync generation error:', err);
      const errMsg = err?.message || 'Generation failed. Please try again or switch model.';

      if (isZeroGpuQuotaError(errMsg)) {
        setQuotaErrorMessage(errMsg);
        setIsQuotaModalOpen(true);
      } else if (errMsg.toLowerCase().includes('content filter') || errMsg.toLowerCase().includes('flagged')) {
        setNoticeModal({
          isOpen: true,
          type: 'content_filter',
          title: 'Upstream Model Safety Filter Intercepted Prompt',
          message: errMsg,
          primaryActionLabel: 'Switch to Wan 2.7 & Retry',
          onPrimaryAction: () => {
            const wanModel = LIPSYNC_MODELS.find((m) => m.id === 'wan-2-7');
            if (wanModel) setSelectedModel(wanModel);
          },
          secondaryActionLabel: 'Run 60fps Instant DSP',
          onSecondaryAction: () => handleRunInstantDsp()
        });
      } else {
        setNoticeModal({
          isOpen: true,
          type: 'general_error',
          title: 'Generation Notice',
          message: errMsg,
          primaryActionLabel: 'Run Instant 60fps DSP (0 Quota)',
          onPrimaryAction: () => handleRunInstantDsp()
        });
      }

      setProgress({
        status: 'error',
        message: errMsg,
        progressPercent: 0
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Quota Interceptor Fallback -> Run Instant 60fps DSP Viseme Engine
  const handleRunInstantDsp = async () => {
    setIsQuotaModalOpen(false);
    const dspModel =
      LIPSYNC_MODELS.find((m) => m.id === 'lipsyncer-dsp-60fps') ?? LIPSYNC_MODELS[0];
    setSelectedModel(dspModel);

    setIsGenerating(true);
    setProgress({
      status: 'preparing',
      message: 'Routing to instant 60fps Formant Viseme DSP Engine...',
      progressPercent: 10
    });

    try {
      const dspClip = await generateLipSyncWithModel(
        {
          modelId: 'lipsyncer-dsp-60fps',
          inputMode,
          imageSource: inputMode === 'image_audio' ? imageSource : null,
          videoSource: inputMode === 'video_audio' ? videoSource : null,
          audioSource: audioSource || 'DEMO_SYNTHETIC_VOCAL_PHRASE',
          audioSliceStartSec: sliceStartSec,
          audioSliceEndSec: sliceEndSec,
          prompt,
          aspectRatio,
          resolution: '1080p',
          durationSec: Math.max(2, sliceEndSec - sliceStartSec),
          cameraMovement,
          preserveZeroOnScreenText: true
        },
        (p) => setProgress(p)
      );
      const clip: GeneratedLipSyncClip = {
        ...dspClip,
        audioName: audioSource ? audioFileName : 'demo_vocal_phrase'
      };

      await saveGenerationRecord(clip);
      setActiveGeneratedClip(clip);
      setRecentClips((prev) => [clip, ...prev.filter((c) => c.id !== clip.id)]);
      setProgress({
        status: 'complete',
        message: 'Instant DSP render complete with zero cloud latency!',
        progressPercent: 100
      });
    } catch (dspErr: any) {
      setNoticeModal({
        isOpen: true,
        type: 'general_error',
        title: 'Instant DSP Engine Diagnostic',
        message: dspErr?.message || 'Error executing DSP viseme sync.',
        primaryActionLabel: 'Try Cloud Model (Wan 2.7)',
        onPrimaryAction: () => {
          const wanModel = LIPSYNC_MODELS.find((m) => m.id === 'wan-2-7');
          if (wanModel) setSelectedModel(wanModel);
        }
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Video Player Controls
  const togglePlayPause = () => {
    if (!videoPlayerRef.current) return;
    if (videoPlayerRef.current.paused) {
      videoPlayerRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoPlayerRef.current) return;
    videoPlayerRef.current.muted = !videoPlayerRef.current.muted;
    setIsMuted(videoPlayerRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (videoPlayerRef.current) {
      setPlaybackTime(videoPlayerRef.current.currentTime);
      setClipDuration(videoPlayerRef.current.duration || 0);
    }
  };

  const handleReplay = () => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = 0;
      videoPlayerRef.current.play().then(() => setIsPlaying(true));
    }
  };

  // Chain output video as next input video (multi-generation pipeline)
  const handleChainAsVideoInput = (clip: GeneratedLipSyncClip) => {
    setVideoSource(clip.videoUrl);
    setVideoPreviewUrl(clip.videoUrl);
    setInputMode('video_audio');
    setActiveTab('studio');
  };

  // Delete clip from creations
  const handleDeleteClip = async (id: string) => {
    await deleteGenerationRecord(id);
    setRecentClips((prev) => prev.filter((c) => c.id !== id));
    if (activeGeneratedClip?.id === id) {
      setActiveGeneratedClip(recentClips.find((c) => c.id !== id) || null);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-zinc-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-white">
      {/* ========================================================================= */}
      {/* TOP HEADER / APP BAR                                                      */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#0c0c12]/90 backdrop-blur-xl border-b border-white/6 px-4 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo & Tag */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabChange('studio')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 p-0.5 shadow-lg shadow-violet-600/25 group-hover:shadow-violet-600/40 transition-shadow">
                <div className="w-full h-full bg-[#0d0d15] rounded-[10px] flex items-center justify-center">
                  <Flame className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                    LipSyncer
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    OpenArt Ultra
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 hidden sm:block">
                  Multi-Model Lip-Sync &amp; 20-Scene Omni Director
                </p>
              </div>
            </button>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-white/4 border border-white/8 rounded-2xl">
            <button
              onClick={() => handleTabChange('studio')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'studio'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Studio
            </button>

            <button
              onClick={() => handleTabChange('director')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'director'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Music2 className="w-3.5 h-3.5 text-amber-400" />
              20-Scene Director
              <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO
              </span>
            </button>

            <button
              onClick={() => handleTabChange('arena')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'arena'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              Model Arena
            </button>

            <button
              onClick={() => handleTabChange('models')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'models'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              11 Models
            </button>

            <button
              onClick={() => handleTabChange('vault')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'vault'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Creations ({recentClips.length})
            </button>
          </nav>

          {/* Right Utilities (GPU Status, Help, Auth) */}
          <div className="flex items-center gap-2.5">
            {/* ZeroGPU Pool Pill */}
            <button
              onClick={() => setIsHfPoolModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-xs font-medium transition-all group"
              title="Click to manage 12-Account HF ZeroGPU Token Pool"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300 group-hover:text-white hidden sm:inline">
                HF Pool:
              </span>
              <span className="font-semibold text-emerald-400">
                {readyAccountsCount}/{totalAccountsCount}
              </span>
              <KeyRound className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 ml-0.5" />
            </button>

            {/* How to Use / Help */}
            <button
              onClick={() => setActiveLegalDoc('how-to-use')}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/6 transition-colors"
              title="Documentation & How-To Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Account / Auth */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-white/8">
                <div
                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/5 border border-white/8 text-xs cursor-pointer hover:bg-white/10"
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.firstName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-violet-600 text-[10px] font-bold text-white flex items-center justify-center">
                      {currentUser.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-zinc-200 font-medium hidden sm:inline max-w-[100px] truncate">
                    {currentUser.firstName}
                  </span>
                </div>
                <button
                  onClick={() => {
                    signOutUserAccount();
                    setCurrentUser(null);
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-600/25 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="flex md:hidden items-center justify-around mt-3 pt-2 border-t border-white/6 text-xs">
          <button
            onClick={() => handleTabChange('studio')}
            className={`py-1 px-2.5 rounded-lg font-medium flex items-center gap-1 ${
              activeTab === 'studio' ? 'text-violet-300 bg-violet-500/15' : 'text-zinc-400'
            }`}
          >
            <Film className="w-3.5 h-3.5" /> Studio
          </button>
          <button
            onClick={() => handleTabChange('director')}
            className={`py-1 px-2.5 rounded-lg font-medium flex items-center gap-1 ${
              activeTab === 'director' ? 'text-amber-300 bg-amber-500/15' : 'text-zinc-400'
            }`}
          >
            <Music2 className="w-3.5 h-3.5 text-amber-400" /> Director
          </button>
          <button
            onClick={() => handleTabChange('arena')}
            className={`py-1 px-2.5 rounded-lg font-medium flex items-center gap-1 ${
              activeTab === 'arena' ? 'text-yellow-300 bg-yellow-500/15' : 'text-zinc-400'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Arena
          </button>
          <button
            onClick={() => handleTabChange('models')}
            className={`py-1 px-2.5 rounded-lg font-medium flex items-center gap-1 ${
              activeTab === 'models' ? 'text-violet-300 bg-violet-500/15' : 'text-zinc-400'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Models
          </button>
          <button
            onClick={() => handleTabChange('vault')}
            className={`py-1 px-2.5 rounded-lg font-medium flex items-center gap-1 ${
              activeTab === 'vault' ? 'text-violet-300 bg-violet-500/15' : 'text-zinc-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Vault
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT BODY                                                        */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* TAB 1: STUDIO (Default LipSync Creation Engine) */}
        {activeTab === 'studio' && (
          <div className="space-y-6">
            {/* OpenArt Promo Banner Carousel (matching user screenshot) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Banner 1: Model Comparison */}
              <div
                onClick={() => handleTabChange('arena')}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900/40 via-[#141422] to-[#0c0c16] border border-violet-500/20 hover:border-violet-500/40 p-4 transition-all hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      Model Face-off
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors">
                      Which model performs best?
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      Compare LTX 2.5, Seedance 2.0, LatentSync 1.5, Kling 3.0 &amp; Wan 2.7
                      side-by-side with synchronized audio playback.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-violet-400 group-hover:translate-x-1 transition-transform shrink-0 mt-1" />
                </div>
              </div>

              {/* Banner 2: Seedance 2.5 & LatentSync */}
              <div
                onClick={() => {
                  setSelectedModel(
                    LIPSYNC_MODELS.find((m) => m.id === 'seedance_2_0_mini') ?? LIPSYNC_MODELS[0]
                  );
                }}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900/40 via-[#121422] to-[#0c0c16] border border-indigo-500/20 hover:border-indigo-500/40 p-4 transition-all hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Featured Model
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                      Seedance 2.5 &amp; LatentSync 1.5
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      Zero-text neural phoneme syncing with sub-280Hz vocal formant alignment and
                      subtle emotional head gestures.
                    </p>
                  </div>
                  <Sparkles className="w-4 h-4 text-indigo-400 group-hover:rotate-12 transition-transform shrink-0 mt-1" />
                </div>
              </div>

              {/* Banner 3: 20-Scene Storyboard Director */}
              <div
                onClick={() => handleTabChange('director')}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-amber-900/30 via-[#1f1614] to-[#0c0c16] border border-amber-500/20 hover:border-amber-500/40 p-4 transition-all hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Music Video Studio
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors">
                      20-Scene Storyboard &amp; Omni Packs
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      Expert Song DNA BPM analysis, Folder A/B ZIP packaging, and dual offline
                      HTML production consoles.
                    </p>
                  </div>
                  <Music2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0 mt-1" />
                </div>
              </div>
            </div>

            {/* Professional 2-Column Studio Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* =============================================================== */}
              {/* LEFT COLUMN: Controls & Input Studio (Cols 1-7)                 */}
              {/* =============================================================== */}
              <div className="lg:col-span-7 space-y-5">
                {/* 1. Active Model Card (OpenArt Style) */}
                <div className="p-4 rounded-2xl bg-[#12121a] border border-white/8 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                      Active AI Model
                    </span>
                    <button
                      onClick={() => setIsModelSelectorOpen(true)}
                      className="text-xs font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                    >
                      Change Model ({LIPSYNC_MODELS.length})
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div
                    onClick={() => setIsModelSelectorOpen(true)}
                    className="p-3 rounded-xl bg-white/4 hover:bg-white/7 border border-white/6 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                        <ModelBrandIcon provider={selectedModel.provider} modelId={selectedModel.id} size="md" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {selectedModel.name}
                          </span>
                          <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            {selectedModel.provider}
                          </span>
                          {selectedModel.badges.map((b) => (
                            <span
                              key={b.label}
                              className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            >
                              {b.label}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                          {selectedModel.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-medium text-zinc-400 block">
                        Max: {selectedModel.maxDurationSec}s
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        {selectedModel.resolutionLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Media Modality Switcher (Image+Audio vs Video+Audio) */}
                <div className="p-4 rounded-2xl bg-[#12121a] border border-white/8 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-violet-400" />
                      Media Mode
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {inputMode === 'image_audio'
                        ? 'Singing & Talking Portrait'
                        : 'Neural Mouth Re-Sync'}
                    </span>
                  </div>

                  {/* Dual Mode Tabs */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-white/4 rounded-xl border border-white/6">
                    <button
                      onClick={() => handleInputModeChange('image_audio')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        inputMode === 'image_audio'
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Image + Audio
                    </button>
                    <button
                      onClick={() => handleInputModeChange('video_audio')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        inputMode === 'video_audio'
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      Video + Audio
                    </button>
                  </div>

                  {/* Visual Dropzone */}
                  {inputMode === 'image_audio' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-300">
                          Subject Portrait (Clear Face)
                        </span>
                        <button
                          onClick={() => setIsPortraitGenOpen(!isPortraitGenOpen)}
                          className="text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Portrait Generator
                        </button>
                      </div>

                      {/* Dropzone Card */}
                      <div className="relative group border-2 border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl p-4 bg-white/2 transition-colors flex flex-col items-center justify-center min-h-[160px]">
                        {imagePreviewUrl ? (
                          <div className="relative w-full max-h-[220px] rounded-xl overflow-hidden flex items-center justify-center bg-black/40">
                            <img
                              src={imagePreviewUrl}
                              alt="Subject preview"
                              className="max-h-[200px] w-auto object-contain rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold cursor-pointer hover:bg-violet-500 shadow-md">
                                Change Image
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleImageFileChange}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="w-full flex flex-col items-center justify-center cursor-pointer py-4">
                            <ScanFace className="w-9 h-9 text-zinc-500 mb-2 group-hover:text-violet-400 transition-colors" />
                            <span className="text-xs font-semibold text-zinc-200">
                              Drag &amp; drop portrait or browse
                            </span>
                            <span className="text-[11px] text-zinc-500 mt-0.5">
                              JPEG, PNG, WebP with front-facing eyes &amp; mouth
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageFileChange}
                            />
                          </label>
                        )}
                      </div>

                      {/* AI Portrait Generator Drawer */}
                      {isPortraitGenOpen && (
                        <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-violet-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                              Generate Bespoke Portrait (FLUX / GLM)
                            </span>
                            <button
                              onClick={() => setIsPortraitGenOpen(false)}
                              className="text-zinc-500 hover:text-zinc-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={portraitGenPrompt}
                            onChange={(e) => setPortraitGenPrompt(e.target.value)}
                            placeholder="e.g. Cinematic soul singer with golden backlight and vintage microphone..."
                            className="w-full px-3 py-2 rounded-lg bg-[#0d0d15] border border-violet-500/30 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                          />
                          <button
                            onClick={handleGenerateAiPortrait}
                            disabled={isGeneratingPortrait || !portraitGenPrompt.trim()}
                            className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/30"
                          >
                            {isGeneratingPortrait ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating Portrait...
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3.5 h-3.5" />
                                Render Portrait
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Quick 1-Click Demo Faces */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-zinc-400">
                          Or try 1-click studio portraits:
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {DEMO_FACE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                setImageSource(preset.imageUrl);
                                setImagePreviewUrl(preset.imageUrl);
                                setPrompt(preset.prompt);
                              }}
                              className={`p-1.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                                imagePreviewUrl === preset.imageUrl
                                  ? 'bg-violet-600/20 border-violet-500/60'
                                  : 'bg-white/3 border-white/6 hover:bg-white/6'
                              }`}
                            >
                              <img
                                src={preset.imageUrl}
                                alt={preset.label}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="overflow-hidden">
                                <span className="text-[11px] font-semibold text-zinc-200 block truncate">
                                  {preset.label}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Video Ingest Dropzone */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-300">
                          Source Video (Neural Mouth Re-Sync)
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Target faces automatically detected
                        </span>
                      </div>

                      <div className="relative group border-2 border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl p-4 bg-white/2 transition-colors flex flex-col items-center justify-center min-h-[160px]">
                        {videoPreviewUrl ? (
                          <div className="relative w-full max-h-[220px] rounded-xl overflow-hidden flex items-center justify-center bg-black/40">
                            <video
                              src={videoPreviewUrl}
                              controls
                              className="max-h-[200px] w-auto rounded-lg"
                            />
                            <div className="absolute top-2 right-2">
                              <label className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold cursor-pointer border border-white/10">
                                Change Video
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={handleVideoFileChange}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="w-full flex flex-col items-center justify-center cursor-pointer py-4">
                            <Video className="w-9 h-9 text-zinc-500 mb-2 group-hover:text-violet-400 transition-colors" />
                            <span className="text-xs font-semibold text-zinc-200">
                              Upload MP4 / WebM / QuickTime video
                            </span>
                            <span className="text-[11px] text-zinc-500 mt-0.5">
                              LatentSync 1.5 will re-sync facial phonemes to new audio
                            </span>
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={handleVideoFileChange}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Audio Ingest & Waveform Section (Interactive WaveformTrimmer) */}
                <div className="p-4 rounded-2xl bg-[#12121a] border border-white/8 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5 text-violet-400" />
                      Vocal Audio Track &amp; Timing
                    </span>
                    <span className="text-xs text-zinc-400">
                      Duration: {(sliceEndSec - sliceStartSec).toFixed(1)}s (Max:{' '}
                      {selectedModel.maxDurationSec}s)
                    </span>
                  </div>

                  <WaveformTrimmer
                    audioSource={audioSource}
                    audioFileName={audioFileName}
                    sliceStartSec={sliceStartSec}
                    sliceEndSec={sliceEndSec}
                    maxSliceDurationSec={selectedModel.maxDurationSec}
                    onAudioChange={handleAudioChange}
                    onSliceChange={handleSliceChange}
                  />
                </div>

                {/* 4. Prompt, Aspect Ratio & Camera Controls */}
                <div className="p-4 rounded-2xl bg-[#12121a] border border-white/8 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                      Cinematic Prompt &amp; Zero-Text Lock
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      STRICT ZERO ON-SCREEN TEXT
                    </span>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the cinematic scene, lighting, mood, and character performance..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d0d15] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors leading-relaxed"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        'Cinematic rim lighting',
                        'Photorealistic 8K',
                        'Slow camera push-in',
                        'Emotional intensity',
                        'Subtle head sway'
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setPrompt((prev) => (prev.includes(tag) ? prev : `${prev}, ${tag}`))
                          }
                          className="px-2 py-0.5 rounded-md bg-white/4 hover:bg-white/8 border border-white/6 text-[10px] text-zinc-300 transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio & Camera Movement */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">
                        Aspect Ratio
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['16:9', '9:16', '1:1'] as AspectRatioOption[]).map((ar) => (
                          <button
                            key={ar}
                            type="button"
                            onClick={() => setAspectRatio(ar)}
                            className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              aspectRatio === ar
                                ? 'bg-violet-600/30 border-violet-500 text-white font-semibold'
                                : 'bg-white/3 border-white/6 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {ar}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">
                        Camera Motion
                      </label>
                      <select
                        value={cameraMovement}
                        onChange={(e) => setCameraMovement(e.target.value as CameraMotionPreset)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d0d15] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value="push_in">Slow Push-In</option>
                        <option value="slow_pan">Slow Pan</option>
                        <option value="drone_pull_back">Drone Pull-Back</option>
                        <option value="orbital_spin">Subtle Orbital Spin</option>
                        <option value="handheld_cinema">Handheld Cinema</option>
                        <option value="macro_dof">Macro Depth-of-Field</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Main LipSync Generation CTA Button */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleStartGeneration}
                    disabled={isGenerating}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-amber-500 hover:from-violet-500 hover:via-indigo-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-xl shadow-violet-600/30 hover:shadow-violet-600/50 transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Rendering Lip-Sync ({progress.progressPercent}%)...</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-5 h-5 text-amber-300 group-hover:scale-110 transition-transform" />
                        <span>
                          Generate Lip-Sync with {selectedModel.name}
                        </span>
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Progress Bar when Generating */}
                  {isGenerating && (
                    <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                          {progress.message || 'Processing frames & audio phonemes...'}
                        </span>
                        <span className="text-violet-300 font-bold">
                          {progress.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-amber-400 transition-all duration-300"
                          style={{ width: `${progress.progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>ZeroGPU Pool: {readyAccountsCount} accounts standby</span>
                        <span>Auto-failover protected</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* =============================================================== */}
              {/* RIGHT COLUMN: Video Stage & Player (Cols 8-12)                   */}
              {/* =============================================================== */}
              <div className="lg:col-span-5 space-y-4">
                {/* Cinema Video Stage */}
                <div className="rounded-2xl bg-[#12121a] border border-white/8 overflow-hidden shadow-2xl">
                  {/* Stage Top Bar */}
                  <div className="px-4 py-3 bg-[#0d0d15] border-b border-white/6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold text-white">
                        {activeGeneratedClip ? activeGeneratedClip.modelName : 'Cinema Studio Output'}
                      </span>
                    </div>

                    {activeGeneratedClip && (
                      <a
                        href={activeGeneratedClip.videoUrl}
                        download={buildVideoFileName(activeGeneratedClip)}
                        onClick={(e) => {
                          e.preventDefault();
                          void downloadVideoWithName(
                            activeGeneratedClip.videoUrl,
                            buildVideoFileName(activeGeneratedClip)
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-semibold flex items-center gap-1 border border-violet-500/30 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        MP4 Download
                      </a>
                    )}
                  </div>

                  {/* Video Viewport */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {activeGeneratedClip ? (
                      <video
                        ref={videoPlayerRef}
                        src={activeGeneratedClip.videoUrl}
                        playsInline
                        loop
                        onTimeUpdate={handleTimeUpdate}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      /* Standby Canvas */
                      <div className="text-center p-6 space-y-3">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                          <Film className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-zinc-200">
                            Ready for Lip-Sync Production
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                            Select an image or video, adjust vocal timing handles, and hit Generate.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-zinc-400">
                          <span className="px-2 py-0.5 rounded-full bg-white/4 border border-white/8">
                            1080p Master
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white/4 border border-white/8">
                            60fps DSP Visemes
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white/4 border border-white/8">
                            Zero Lyrics On-Screen
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Overlay Play/Pause Button on Hover */}
                    {activeGeneratedClip && (
                      <button
                        onClick={togglePlayPause}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-full bg-violet-600/80 text-white flex items-center justify-center shadow-lg">
                          {isPlaying ? (
                            <Pause className="w-6 h-6" />
                          ) : (
                            <Play className="w-6 h-6 ml-0.5" />
                          )}
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Player Controls Bar */}
                  {activeGeneratedClip && (
                    <div className="px-4 py-3 bg-[#0d0d15] border-t border-white/6 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={togglePlayPause}
                          className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/6 transition-colors"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={handleReplay}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/6 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={toggleMute}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/6 transition-colors"
                        >
                          {isMuted ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {playbackTime.toFixed(1)}s / {clipDuration.toFixed(1)}s
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleChainAsVideoInput(activeGeneratedClip)}
                          className="px-2.5 py-1 rounded-lg bg-white/4 hover:bg-white/8 text-zinc-300 text-[11px] font-medium border border-white/8 transition-colors flex items-center gap-1"
                          title="Feed this clip into Video+Audio mode for multi-pass re-syncing"
                        >
                          <Video className="w-3 h-3 text-violet-400" />
                          Chain as Input
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Takes Strip */}
                {recentClips.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#12121a] border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-violet-400" />
                        Recent Takes ({recentClips.length})
                      </span>
                      <button
                        onClick={() => handleTabChange('vault')}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300"
                      >
                        View All
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {recentClips.slice(0, 3).map((clip) => (
                        <div
                          key={clip.id}
                          onClick={() => setActiveGeneratedClip(clip)}
                          className={`group relative rounded-xl overflow-hidden border cursor-pointer aspect-video bg-black transition-all ${
                            activeGeneratedClip?.id === clip.id
                              ? 'border-violet-500 shadow-md shadow-violet-500/20'
                              : 'border-white/8 hover:border-white/20'
                          }`}
                        >
                          <video
                            src={clip.videoUrl}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-end p-1.5">
                            <span className="text-[10px] font-semibold text-white truncate drop-shadow">
                              {clip.modelName}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 20-SCENE STORYBOARD & OMNI DIRECTOR */}
        {activeTab === 'director' && <StoryboardDirectorView />}

        {/* TAB 3: MODEL ARENA */}
        {activeTab === 'arena' && <ModelArenaView />}

        {/* TAB 4: 11 MODELS CATALOG */}
        {activeTab === 'models' && (
          <OpenArtModelSelectorModal
            isOpen={true}
            embedded={true}
            selectedModelId={selectedModel.id}
            onSelectModel={handleSelectModel}
            onOpenArena={() => handleTabChange('arena')}
            onOpenDirector={() => handleTabChange('director')}
          />
        )}

        {/* TAB 5: CREATIONS VAULT */}
        {activeTab === 'vault' && (
          <CreationsVaultView
            clips={recentClips}
            onDeleteClip={handleDeleteClip}
            onReuseInStudio={(clip) => {
              setActiveGeneratedClip(clip);
              handleTabChange('studio');
            }}
            onChainAsVideoInput={handleChainAsVideoInput}
          />
        )}
      </main>

      {/* ========================================================================= */}
      {/* FOOTER & COMPLIANCE LINKS                                                 */}
      {/* ========================================================================= */}
      <footer className="mt-auto border-t border-white/6 bg-[#0c0c12] px-4 lg:px-8 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">LipSyncer AI</span>
            <span>&copy; {new Date().getFullYear()} Modelissa. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <button
              onClick={() => setActiveLegalDoc('how-to-use')}
              className="hover:text-zinc-200 transition-colors"
            >
              How to Use
            </button>
            <button
              onClick={() => setActiveLegalDoc('about')}
              className="hover:text-zinc-200 transition-colors"
            >
              About
            </button>
            <button
              onClick={() => setActiveLegalDoc('privacy')}
              className="hover:text-zinc-200 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveLegalDoc('terms')}
              className="hover:text-zinc-200 transition-colors"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* SYSTEM MODALS                                                             */}
      {/* ========================================================================= */}
      {/* 1. OpenArt Model Selector Modal */}
      <OpenArtModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        selectedModelId={selectedModel.id}
        onSelectModel={handleSelectModel}
        onOpenArena={() => {
          setIsModelSelectorOpen(false);
          handleTabChange('arena');
        }}
        onOpenDirector={() => {
          setIsModelSelectorOpen(false);
          handleTabChange('director');
        }}
      />

      {/* 2. Streamlined Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
      />

      {/* 3. 12-Account HF ZeroGPU Token Pool Modal */}
      <HfTokenPoolModal
        isOpen={isHfPoolModalOpen}
        onClose={() => setIsHfPoolModalOpen(false)}
        onPoolUpdated={() => setPoolStatus(getTokenPoolStatus())}
      />

      {/* 4. Quota Interceptor Modal (with 1-Click Fallback to Local 60fps DSP) */}
      <QuotaInterceptorModal
        isOpen={isQuotaModalOpen}
        errorMessage={quotaErrorMessage}
        modelName={selectedModel.name}
        onClose={() => setIsQuotaModalOpen(false)}
        onRunInstantDsp={handleRunInstantDsp}
        onOpenTokenPool={() => {
          setIsQuotaModalOpen(false);
          setIsHfPoolModalOpen(true);
        }}
      />

      {/* 5. Full-content Legal Pages Modal */}
      {activeLegalDoc && (
        <LegalPagesModal
          activeDoc={activeLegalDoc}
          onSelectDoc={(doc) => setActiveLegalDoc(doc)}
          onClose={() => setActiveLegalDoc(null)}
        />
      )}

      {/* 6. High-Fidelity Generation Diagnostic & Safety Notice Modal */}
      <GenerationNoticeModal
        notice={noticeModal}
        onClose={() => setNoticeModal(null)}
      />
    </div>
  );
};

export default App;
