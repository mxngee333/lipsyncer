import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Mic,
  Square,
  Sparkles,
  Wand2,
  Play,
  Pause,
  Scissors,
  Music2,
  Activity,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  analyzeVocalFormantsAndBpm,
  extractAudioSliceWav,
  generateDemoVocalWavBlob,
  getAudioDurationSec,
  VocalFormantBpmAnalysis
} from '../services/audioDspService';
import { cloneVoiceWithAi } from '../services/lipSyncEngineService';

export interface AudioSelectionMeta {
  fileName: string;
  durationSec: number;
  detectedBpm: number;
  sliceStartSec: number;
  sliceEndSec: number;
  slicedWavBlob?: Blob;
}

export interface WaveformTrimmerProps {
  audioSource?: Blob | File | string | null;
  audioFileName?: string;
  sliceStartSec?: number;
  sliceEndSec?: number;
  maxSliceDurationSec?: number;
  minSliceDurationSec?: number;
  onAudioChange: (audioBlob: Blob | File, meta: AudioSelectionMeta) => void;
  onSliceChange?: (startSec: number, endSec: number, slicedWavBlob?: Blob) => void;
}

type AudioIngestTab = 'upload' | 'record' | 'clone' | 'demo';

const DEMO_VOCAL_PRESETS = [
  {
    id: 'cinema_lead',
    label: 'Lead Vocal Phrase (5.5s)',
    phrase: 'Every word comes alive in studio cinema light',
    durationSec: 5.5
  },
  {
    id: 'soul_chorus',
    label: 'Soulful Chorus Hook (6.5s)',
    phrase: 'Rising higher through golden stage symphony tonight',
    durationSec: 6.5
  },
  {
    id: 'podcast_host',
    label: 'Broadcast Host Intro (4.5s)',
    phrase: 'Welcome back to our live AI cinema studio session',
    durationSec: 4.5
  }
] as const;

export const WaveformTrimmer: React.FC<WaveformTrimmerProps> = ({
  audioSource,
  audioFileName,
  sliceStartSec: controlledStart,
  sliceEndSec: controlledEnd,
  maxSliceDurationSec = 15,
  minSliceDurationSec = 2,
  onAudioChange,
  onSliceChange
}) => {
  const [activeTab, setActiveTab] = useState<AudioIngestTab>('upload');
  const [localLabel, setLocalLabel] = useState<string>(audioFileName || '');
  const [analysis, setAnalysis] = useState<VocalFormantBpmAnalysis | null>(null);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [startSec, setStartSec] = useState<number>(controlledStart ?? 0);
  const [endSec, setEndSec] = useState<number>(controlledEnd ?? 6);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Mic Recorder state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  // AI Voice Clone state
  const [cloneScript, setCloneScript] = useState<string>(
    'Every syllable locks cleanly to the camera lens in vivid cinema clarity.'
  );
  const [cloneRefFile, setCloneRefFile] = useState<File | null>(null);
  const [isCloning, setIsCloning] = useState<boolean>(false);

  // Waveform interactive drag state
  const waveformTrackRef = useRef<HTMLDivElement | null>(null);
  const draggingHandleRef = useRef<'start' | 'end' | null>(null);
  const activeBlobRef = useRef<Blob | File | string | null>(audioSource ?? null);

  useEffect(() => {
    if (typeof controlledStart === 'number') setStartSec(controlledStart);
  }, [controlledStart]);

  useEffect(() => {
    if (typeof controlledEnd === 'number') setEndSec(controlledEnd);
  }, [controlledEnd]);

  useEffect(() => {
    if (audioFileName) setLocalLabel(audioFileName);
  }, [audioFileName]);

  const stopPreviewPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPreviewPlayback();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (recordTimerRef.current !== null) {
        window.clearInterval(recordTimerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stopPreviewPlayback]);

  const ingestNewAudioBlob = useCallback(
    async (blob: Blob | File, label: string) => {
      stopPreviewPlayback();
      setErrorMsg(null);
      setIsAnalyzing(true);
      activeBlobRef.current = blob;
      setLocalLabel(label);

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const nextPreviewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = nextPreviewUrl;

      try {
        let dur = 6;
        let detectedBpm = 108;
        try {
          const formantData = await analyzeVocalFormantsAndBpm(blob);
          setAnalysis(formantData);
          dur = formantData.durationSec;
          detectedBpm = formantData.feltGrooveBpm || formantData.detectedBpm;
        } catch {
          dur = await getAudioDurationSec(blob);
          setAnalysis(null);
        }

        const safeDur = Math.max(0.5, dur);
        const nextStart = 0;
        const nextEnd = Math.round(Math.min(safeDur, maxSliceDurationSec) * 100) / 100;

        setTotalDuration(safeDur);
        setStartSec(nextStart);
        setEndSec(nextEnd);
        setPlayheadSec(nextStart);

        let slicedWav: Blob | undefined;
        try {
          slicedWav = await extractAudioSliceWav(blob, nextStart, nextEnd);
        } catch {
          slicedWav = undefined;
        }

        onAudioChange(blob, {
          fileName: label,
          durationSec: safeDur,
          detectedBpm,
          sliceStartSec: nextStart,
          sliceEndSec: nextEnd,
          slicedWavBlob: slicedWav
        });
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not decode audio file.');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [maxSliceDurationSec, onAudioChange, stopPreviewPlayback]
  );

  // Sync external audioSource if provided on mount/scene handoff
  useEffect(() => {
    if (!audioSource || audioSource === activeBlobRef.current) return;
    activeBlobRef.current = audioSource;

    let cancelled = false;
    const syncExternal = async () => {
      setIsAnalyzing(true);
      try {
        const formantData = await analyzeVocalFormantsAndBpm(audioSource);
        if (cancelled) return;
        setAnalysis(formantData);
        setTotalDuration(formantData.durationSec);
        const s0 = controlledStart ?? 0;
        const s1 =
          controlledEnd && controlledEnd > s0
            ? Math.min(formantData.durationSec, controlledEnd)
            : Math.min(formantData.durationSec, s0 + maxSliceDurationSec);
        setStartSec(s0);
        setEndSec(s1);
        setPlayheadSec(s0);

        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        if (audioSource instanceof Blob) {
          previewUrlRef.current = URL.createObjectURL(audioSource);
        } else {
          previewUrlRef.current = audioSource;
        }
      } catch {
        // Ignore silent probe error on external ref
      } finally {
        if (!cancelled) setIsAnalyzing(false);
      }
    };
    void syncExternal();
    return () => {
      cancelled = true;
    };
  }, [audioSource, controlledEnd, controlledStart, maxSliceDurationSec]);

  const commitSliceRange = useCallback(
    async (nextStart: number, nextEnd: number) => {
      const src = activeBlobRef.current;
      let slicedWav: Blob | undefined;
      if (src) {
        try {
          slicedWav = await extractAudioSliceWav(src, nextStart, nextEnd);
        } catch {
          slicedWav = undefined;
        }
      }
      onSliceChange?.(nextStart, nextEnd, slicedWav);
    },
    [onSliceChange]
  );

  const clampSlicePair = useCallback(
    (candidateStart: number, candidateEnd: number, anchor: 'start' | 'end') => {
      const dur = Math.max(minSliceDurationSec, totalDuration || 6);
      const minGap = Math.min(minSliceDurationSec, dur);
      let s = Math.max(0, Math.min(candidateStart, dur));
      let e = Math.max(0, Math.min(candidateEnd, dur));

      if (anchor === 'start') {
        s = Math.min(s, dur - minGap);
        if (e - s < minGap) e = Math.min(dur, s + minGap);
        if (e - s > maxSliceDurationSec) e = Math.min(dur, s + maxSliceDurationSec);
      } else {
        e = Math.max(minGap, e);
        if (e - s < minGap) s = Math.max(0, e - minGap);
        if (e - s > maxSliceDurationSec) s = Math.max(0, e - maxSliceDurationSec);
      }

      return {
        nextStart: Math.round(s * 100) / 100,
        nextEnd: Math.round(e * 100) / 100
      };
    },
    [maxSliceDurationSec, minSliceDurationSec, totalDuration]
  );

  // Pointer drag handling on the waveform canvas bar
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const mode = draggingHandleRef.current;
      const track = waveformTrackRef.current;
      if (!mode || !track || totalDuration <= 0) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const secAtPointer = ratio * totalDuration;

      if (mode === 'start') {
        const { nextStart, nextEnd } = clampSlicePair(secAtPointer, endSec, 'start');
        setStartSec(nextStart);
        setEndSec(nextEnd);
      } else {
        const { nextStart, nextEnd } = clampSlicePair(startSec, secAtPointer, 'end');
        setStartSec(nextStart);
        setEndSec(nextEnd);
      }
    };

    const handlePointerUp = () => {
      if (draggingHandleRef.current) {
        draggingHandleRef.current = null;
        void commitSliceRange(startSec, endSec);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [clampSlicePair, commitSliceRange, endSec, startSec, totalDuration]);

  const toggleSlicePreview = async () => {
    if (!previewUrlRef.current) return;
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
    }
    const audio = audioElRef.current;

    if (isPlaying) {
      stopPreviewPlayback();
      return;
    }

    if (audio.src !== previewUrlRef.current) {
      audio.src = previewUrlRef.current;
    }
    audio.currentTime = startSec;
    setPlayheadSec(startSec);

    try {
      await audio.play();
      setIsPlaying(true);

      const tick = () => {
        if (!audioElRef.current || audioElRef.current.paused) {
          setIsPlaying(false);
          return;
        }
        const cur = audioElRef.current.currentTime;
        setPlayheadSec(cur);
        if (cur >= endSec) {
          stopPreviewPlayback();
          setPlayheadSec(startSec);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setIsPlaying(false);
    }
  };

  // Tab 1: Upload Audio
  const handleFilePicked = (file: File | undefined) => {
    if (!file) return;
    void ingestNewAudioBlob(file, file.name);
  };

  // Tab 2: Live Microphone Recording
  const startMicRecording = async () => {
    setErrorMsg(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const recordedBlob = new Blob(recordedChunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        void ingestNewAudioBlob(recordedBlob, `Mic_Vocal_${new Date().toLocaleTimeString()}.webm`);
      };

      recorder.start(150);
      setRecordSeconds(0);
      setIsRecording(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Microphone permission denied by browser.'
      );
    }
  };

  const stopMicRecording = () => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Tab 3: AI Voice Clone
  const handleRunVoiceClone = async () => {
    if (!cloneScript.trim()) {
      setErrorMsg('Please enter spoken script or lyrics to synthesize.');
      return;
    }
    setErrorMsg(null);
    setIsCloning(true);
    try {
      const refAudio =
        cloneRefFile ??
        (activeBlobRef.current instanceof Blob
          ? activeBlobRef.current
          : typeof activeBlobRef.current === 'string' && activeBlobRef.current
            ? activeBlobRef.current
            : await generateDemoVocalWavBlob('Studio reference vocal tone', 3.0));
      const clonedBlob = await cloneVoiceWithAi(refAudio, cloneScript.trim());
      await ingestNewAudioBlob(clonedBlob, 'AI_Cloned_Vocal.wav');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'AI Voice Clone synthesis failed.');
    } finally {
      setIsCloning(false);
    }
  };

  // Tab 4: 1-Click Demo Vocal
  const handleGenerateDemoVocal = async (phrase: string, dur: number, label: string) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const wavBlob = await generateDemoVocalWavBlob(phrase, dur);
      await ingestNewAudioBlob(wavBlob, `${label}.wav`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to synthesize demo vocal.');
      setIsAnalyzing(false);
    }
  };

  const peaks = analysis?.waveformPeaks ?? [];
  const sliceDuration = Math.max(0, Math.round((endSec - startSec) * 100) / 100);
  const startPct = totalDuration > 0 ? (startSec / totalDuration) * 100 : 0;
  const endPct = totalDuration > 0 ? (endSec / totalDuration) * 100 : 100;
  const playheadPct = totalDuration > 0 ? (playheadSec / totalDuration) * 100 : 0;

  return (
    <div className="rounded-2xl bg-[#15151d] border border-white/8 p-4 space-y-4">
      {/* Top 4-Tab Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e0e14] border border-white/6 flex-wrap">
          {(
            [
              { id: 'upload', label: 'Upload Audio', icon: Upload },
              { id: 'record', label: 'Record Mic', icon: Mic },
              { id: 'clone', label: 'AI Voice Clone', icon: Wand2 },
              { id: 'demo', label: '1-Click Demo Vocal', icon: Sparkles }
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrorMsg(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {analysis && (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {analysis.feltGrooveBpm} BPM
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/6 border border-white/10 text-zinc-300">
              {totalDuration.toFixed(1)}s total
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab Content Panels */}
      {activeTab === 'upload' && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            handleFilePicked(e.dataTransfer.files?.[0]);
          }}
          className={`block rounded-xl border border-dashed p-4 text-center transition cursor-pointer ${
            isDraggingOver
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-white/15 bg-[#101017] hover:border-white/30 hover:bg-[#13131c]'
          }`}
        >
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
            onChange={(e) => handleFilePicked(e.target.files?.[0])}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-1.5">
            <Music2 className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200">
              {localLabel
                ? `Loaded: ${localLabel} (click or drop to replace)`
                : 'Drop MP3 / WAV / M4A vocal stem or full song here'}
            </span>
            <span className="text-[11px] text-zinc-500">
              Sample-accurate WebAudio chorus/verse slicer • Zero server upload lag
            </span>
          </div>
        </label>
      )}

      {activeTab === 'record' && (
        <div className="rounded-xl bg-[#101017] border border-white/10 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isRecording
                  ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 animate-pulse'
                  : 'bg-white/6 border border-white/10 text-zinc-300'
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {isRecording ? 'Recording Live Studio Vocal...' : 'Direct Microphone Capture'}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                {isRecording
                  ? `Elapsed: 00:${String(recordSeconds).padStart(2, '0')}`
                  : 'Sing or speak directly into your mic for instant lip-sync'}
              </div>
            </div>
          </div>

          {isRecording ? (
            <button
              type="button"
              onClick={stopMicRecording}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop &amp; Slice</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startMicRecording}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Start Recording</span>
            </button>
          )}
        </div>
      )}

      {activeTab === 'clone' && (
        <div className="rounded-xl bg-[#101017] border border-white/10 p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-violet-400" />
              Zero-Shot AI Voice Clone &amp; Vocal Synthesizer
            </span>
            <label className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer underline">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setCloneRefFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {cloneRefFile
                ? `Ref Voice: ${cloneRefFile.name}`
                : '+ Upload Reference Voice Sample (optional)'}
            </label>
          </div>

          <textarea
            rows={2}
            value={cloneScript}
            onChange={(e) => setCloneScript(e.target.value)}
            placeholder="Type exact dialogue or vocal lyrics to clone..."
            className="w-full px-3 py-2 rounded-xl bg-[#161621] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400/60 resize-none"
          />

          <button
            type="button"
            disabled={isCloning}
            onClick={handleRunVoiceClone}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
          >
            {isCloning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            <span>{isCloning ? 'Synthesizing Cloned Voice...' : 'Synthesize & Load Vocal'}</span>
          </button>
        </div>
      )}

      {activeTab === 'demo' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEMO_VOCAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                handleGenerateDemoVocal(preset.phrase, preset.durationSec, preset.label)
              }
              className="p-3 rounded-xl bg-[#101017] hover:bg-[#191926] border border-white/10 hover:border-emerald-400/40 text-left transition cursor-pointer space-y-1"
            >
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span className="truncate">{preset.label}</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">&ldquo;{preset.phrase}&rdquo;</p>
            </button>
          ))}
        </div>
      )}

      {/* Interactive Vocal Formant Waveform & Sample-Accurate Slicer */}
      {isAnalyzing ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-cyan-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Isolating vocal formants (280Hz–3.6kHz) &amp; computing groove BPM...</span>
        </div>
      ) : totalDuration > 0 ? (
        <div className="space-y-3 pt-1">
          {/* Interactive Waveform Bar Stage */}
          <div
            ref={waveformTrackRef}
            className="relative h-20 rounded-xl bg-[#0b0b10] border border-white/10 overflow-hidden select-none touch-none"
          >
            {/* Unselected Left & Right Dim Masks */}
            <div
              className="absolute inset-y-0 left-0 bg-black/65 z-10 pointer-events-none"
              style={{ width: `${startPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-black/65 z-10 pointer-events-none"
              style={{ width: `${Math.max(0, 100 - endPct)}%` }}
            />

            {/* Active Slice Highlight Window */}
            <div
              className="absolute inset-y-0 bg-cyan-500/12 border-y border-cyan-400/40 z-10 pointer-events-none"
              style={{
                left: `${startPct}%`,
                width: `${Math.max(1, endPct - startPct)}%`
              }}
            />

            {/* 240-Bar Formant Peaks */}
            <div className="absolute inset-0 px-1 flex items-center justify-between gap-[1px]">
              {(peaks.length > 0 ? peaks : Array.from({ length: 80 }, () => 0.35)).map(
                (peak, idx, arr) => {
                  const barPct = (idx / Math.max(1, arr.length - 1)) * 100;
                  const insideSlice = barPct >= startPct && barPct <= endPct;
                  const heightPct = Math.max(12, Math.round(peak * 88));
                  return (
                    <div
                      key={idx}
                      style={{ height: `${heightPct}%` }}
                      className={`flex-1 rounded-full transition-colors ${
                        insideSlice ? 'bg-cyan-400' : 'bg-zinc-700/60'
                      }`}
                    />
                  );
                }
              )}
            </div>

            {/* Live Playhead */}
            {isPlaying && (
              <div
                className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_#ffffff] z-20 pointer-events-none"
                style={{ left: `${playheadPct}%` }}
              />
            )}

            {/* Draggable Start Handle */}
            <div
              role="slider"
              aria-label="Audio slice start handle"
              aria-valuemin={0}
              aria-valuemax={totalDuration}
              aria-valuenow={startSec}
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                draggingHandleRef.current = 'start';
              }}
              style={{ left: `calc(${startPct}% - 6px)` }}
              className="absolute inset-y-0 w-3 z-30 cursor-ew-resize flex items-center justify-center group"
            >
              <div className="h-full w-1 bg-emerald-400 group-hover:bg-emerald-300 shadow-[0_0_8px_#34d399]" />
              <div className="absolute top-1.5 w-3 h-4 rounded-sm bg-emerald-400 text-[8px] font-black text-black flex items-center justify-center">
                S
              </div>
            </div>

            {/* Draggable End Handle */}
            <div
              role="slider"
              aria-label="Audio slice end handle"
              aria-valuemin={0}
              aria-valuemax={totalDuration}
              aria-valuenow={endSec}
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                draggingHandleRef.current = 'end';
              }}
              style={{ left: `calc(${endPct}% - 6px)` }}
              className="absolute inset-y-0 w-3 z-30 cursor-ew-resize flex items-center justify-center group"
            >
              <div className="h-full w-1 bg-cyan-400 group-hover:bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
              <div className="absolute bottom-1.5 w-3 h-4 rounded-sm bg-cyan-400 text-[8px] font-black text-black flex items-center justify-center">
                E
              </div>
            </div>
          </div>

          {/* Controls Row: Play Preview + Numeric Start/End Inputs */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSlicePreview}
                className="px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Stop Slice' : 'Preview Slice'}</span>
              </button>

              <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
                <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                <span>{sliceDuration.toFixed(2)}s active</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 bg-[#0e0e14] border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-emerald-300 font-semibold">Start (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={Math.max(0, totalDuration - 0.5)}
                  value={startSec}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const { nextStart, nextEnd } = clampSlicePair(val, endSec, 'start');
                    setStartSec(nextStart);
                    setEndSec(nextEnd);
                    void commitSliceRange(nextStart, nextEnd);
                  }}
                  className="w-14 bg-transparent text-right font-mono text-white focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-1.5 bg-[#0e0e14] border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-cyan-300 font-semibold">End (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={totalDuration}
                  value={endSec}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const { nextStart, nextEnd } = clampSlicePair(startSec, val, 'end');
                    setStartSec(nextStart);
                    setEndSec(nextEnd);
                    void commitSliceRange(nextStart, nextEnd);
                  }}
                  className="w-14 bg-transparent text-right font-mono text-white focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Detected Vocal Islands Quick-Snap Chips */}
          {analysis && analysis.vocalIslands.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Vocal Phrases:
              </span>
              {analysis.vocalIslands.slice(0, 5).map((isl, idx) => (
                <button
                  key={`${isl.startSec}-${isl.endSec}`}
                  type="button"
                  onClick={() => {
                    const { nextStart, nextEnd } = clampSlicePair(
                      isl.startSec,
                      Math.min(isl.endSec, isl.startSec + maxSliceDurationSec),
                      'start'
                    );
                    setStartSec(nextStart);
                    setEndSec(nextEnd);
                    void commitSliceRange(nextStart, nextEnd);
                  }}
                  className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-cyan-500/20 border border-white/8 text-[11px] font-mono text-zinc-300 hover:text-cyan-200 transition cursor-pointer"
                >
                  #{idx + 1} ({isl.startSec.toFixed(1)}s–{isl.endSec.toFixed(1)}s)
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default WaveformTrimmer;
