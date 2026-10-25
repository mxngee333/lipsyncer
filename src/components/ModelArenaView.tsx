import React, { useState } from 'react';
import { Swords, Trophy, Play, Pause, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';
import { LIPSYNC_MODELS } from '../data/modelCatalog';
import { ModelBrandIcon } from './ModelBrandIcon';
import { generateLipSyncWithModel } from '../services/lipSyncEngineService';
import { generateDemoPortraitDataUrl, generateDemoVocalWavBlob } from '../services/audioDspService';
import { GeneratedLipSyncClip, InputMediaMode } from '../types';

export const ModelArenaView: React.FC = () => {
  const [modelAId, setModelAId] = useState<string>('ltx-2-5-audio');
  const [modelBId, setModelBId] = useState<string>('latentsync-1-5');
  const [inputMode, setInputMode] = useState<InputMediaMode>('image_audio');

  const [imageSource, setImageSource] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<Blob | File | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const [clipA, setClipA] = useState<GeneratedLipSyncClip | null>(null);
  const [clipB, setClipB] = useState<GeneratedLipSyncClip | null>(null);

  const [isPlayingBoth, setIsPlayingBoth] = useState<boolean>(false);
  const [votedWinner, setVotedWinner] = useState<'A' | 'B' | null>(null);

  const modelA = LIPSYNC_MODELS.find((m) => m.id === modelAId) || LIPSYNC_MODELS[0];
  const modelB = LIPSYNC_MODELS.find((m) => m.id === modelBId) || LIPSYNC_MODELS[1];

  const handleLoadDemoContest = async () => {
    const demoPortrait = generateDemoPortraitDataUrl('singer_female');
    const demoAudio = await generateDemoVocalWavBlob('I will praise your holy name forever', 4.5);
    setImageSource(demoPortrait);
    setAudioSource(demoAudio);
    setClipA(null);
    setClipB(null);
    setVotedWinner(null);
  };

  const handleRunArenaBattle = async () => {
    if (!audioSource && !imageSource) {
      await handleLoadDemoContest();
    }

    const currentImg = imageSource || generateDemoPortraitDataUrl('singer_female');
    const currentAudio = audioSource || (await generateDemoVocalWavBlob('Praise your name forever', 4.5));

    setIsRunning(true);
    setStatusMsg('Benchmarking Contender A and Contender B in parallel...');
    setVotedWinner(null);

    try {
      const results = await Promise.allSettled([
        generateLipSyncWithModel({
          modelId: modelAId,
          inputMode,
          imageSource: currentImg,
          audioSource: currentAudio,
          prompt: 'A professional vocalist singing passionately into a stage microphone',
          exactLyrics: 'Praise your name forever',
          aspectRatio: '16:9',
          resolution: '720p',
          durationSec: 4
        }),
        generateLipSyncWithModel({
          modelId: modelBId,
          inputMode,
          imageSource: currentImg,
          audioSource: currentAudio,
          prompt: 'A professional vocalist singing passionately into a stage microphone',
          exactLyrics: 'Praise your name forever',
          aspectRatio: '16:9',
          resolution: '720p',
          durationSec: 4
        })
      ]);

      if (results[0].status === 'fulfilled') setClipA(results[0].value);
      if (results[1].status === 'fulfilled') setClipB(results[1].value);

      setStatusMsg('Both contender renders complete! Compare phoneme sync and vote for the winner.');
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMsg(`Benchmark notice: ${error?.message || 'Error executing battle'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleSyncPlayback = () => {
    const vidA = document.getElementById('arena-video-a') as HTMLVideoElement | null;
    const vidB = document.getElementById('arena-video-b') as HTMLVideoElement | null;
    if (!vidA && !vidB) return;

    if (isPlayingBoth) {
      vidA?.pause();
      vidB?.pause();
      setIsPlayingBoth(false);
    } else {
      if (vidA) vidA.currentTime = 0;
      if (vidB) vidB.currentTime = 0;
      vidA?.play().catch(() => {});
      vidB?.play().catch(() => {});
      setIsPlayingBoth(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs font-semibold text-fuchsia-300 mb-2">
            <Swords className="w-3.5 h-3.5" />
            <span>OpenArt Lip-Sync Model Arena</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Which model performs best?</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Run two neural audio-video engines head-to-head on the exact same subject portrait &amp; vocal audio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLoadDemoContest}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Load Demo Contest</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunArenaBattle}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-violet-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <Swords className="w-4 h-4" />
            <span>{isRunning ? 'Benchmarking...' : 'Start Battle'}</span>
          </button>
        </div>
      </div>

      {/* Contenders Selector Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model A */}
        <div className="p-5 rounded-2xl bg-[#13131b] border border-violet-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Contender A</span>
            <span className="text-xs text-zinc-500 font-mono">ELO {modelA.arenaElo}</span>
          </div>
          <div className="flex items-center gap-3">
            <ModelBrandIcon provider={modelA.provider} modelId={modelA.id} size="lg" />
            <div className="flex-1 min-w-0">
              <select
                aria-label="Select Contender A model"
                value={modelAId}
                onChange={(e) => setModelAId(e.target.value)}
                className="w-full bg-[#1b1b24] border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                {LIPSYNC_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-400 mt-1 truncate">{modelA.description}</p>
            </div>
          </div>
        </div>

        {/* Model B */}
        <div className="p-5 rounded-2xl bg-[#13131b] border border-fuchsia-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">Contender B</span>
            <span className="text-xs text-zinc-500 font-mono">ELO {modelB.arenaElo}</span>
          </div>
          <div className="flex items-center gap-3">
            <ModelBrandIcon provider={modelB.provider} modelId={modelBId} size="lg" />
            <div className="flex-1 min-w-0">
              <select
                aria-label="Select Contender B model"
                value={modelBId}
                onChange={(e) => setModelBId(e.target.value)}
                className="w-full bg-[#1b1b24] border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-fuchsia-500 cursor-pointer"
              >
                {LIPSYNC_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-400 mt-1 truncate">{modelB.description}</p>
            </div>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-800/40 text-xs font-medium text-violet-200 text-center">
          {statusMsg}
        </div>
      )}

      {/* Battle Cinema Stage */}
      <div className="p-6 rounded-3xl bg-[#111117] border border-white/10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSyncPlayback}
              disabled={!clipA && !clipB}
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              {isPlayingBoth ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
              <span>{isPlayingBoth ? 'Pause Synchronized Play' : 'Play Both Together'}</span>
            </button>
            <span className="text-xs text-zinc-400">Listen for consonant attack sharpness &amp; mouth closure timing.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Output A */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                <span className="text-sm font-bold text-white">{modelA.name}</span>
              </div>
              {clipA && (
                <button
                  type="button"
                  onClick={() => setVotedWinner('A')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    votedWinner === 'A'
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{votedWinner === 'A' ? 'Winner Picked!' : 'Vote Contender A'}</span>
                </button>
              )}
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center relative">
              {clipA ? (
                <video
                  id="arena-video-a"
                  src={clipA.videoUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-white/5 flex items-center justify-center text-zinc-500">
                    <Play className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-zinc-500">Click &quot;Start Battle&quot; to render Contender A</p>
                </div>
              )}
            </div>
          </div>

          {/* Output B */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400"></span>
                <span className="text-sm font-bold text-white">{modelB.name}</span>
              </div>
              {clipB && (
                <button
                  type="button"
                  onClick={() => setVotedWinner('B')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    votedWinner === 'B'
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{votedWinner === 'B' ? 'Winner Picked!' : 'Vote Contender B'}</span>
                </button>
              )}
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center relative">
              {clipB ? (
                <video
                  id="arena-video-b"
                  src={clipB.videoUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-white/5 flex items-center justify-center text-zinc-500">
                    <Play className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-zinc-500">Click &quot;Start Battle&quot; to render Contender B</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Arena Leaderboard Table */}
      <div className="p-6 rounded-3xl bg-[#111117] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Lip-Sync Model Arena Leaderboard</h2>
          </div>
          <span className="text-xs text-zinc-500">Live community ELO ratings</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#181822] text-zinc-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Arena ELO</th>
                <th className="py-3 px-4">Input Specialty</th>
                <th className="py-3 px-4">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {[...LIPSYNC_MODELS]
                .sort((a, b) => b.arenaElo - a.arenaElo)
                .map((m, index) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 font-mono text-zinc-400">#{index + 1}</td>
                    <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                      <ModelBrandIcon provider={m.provider} modelId={m.id} size="sm" />
                      <span>{m.name}</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{m.provider}</td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-300">{m.arenaElo}</td>
                    <td className="py-3 px-4 text-zinc-300">
                      {m.supportsVideoInput && m.supportsImageInput
                        ? 'Video + Image Sync'
                        : m.supportsVideoInput
                        ? 'Video-to-Video Re-Sync'
                        : 'Image + Audio Sync'}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{m.resolutionLabel}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
