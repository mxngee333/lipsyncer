import React from 'react';
import { Download, Trash2, ArrowUpRight, Film, Sparkles, Clock } from 'lucide-react';
import { GeneratedLipSyncClip } from '../types';
import { LIPSYNC_MODELS } from '../data/modelCatalog';
import { ModelBrandIcon } from './ModelBrandIcon';
import { buildVideoFileName, downloadVideoWithName } from '../services/clipNaming';

interface Props {
  clips: GeneratedLipSyncClip[];
  onDeleteClip: (id: string) => void;
  onReuseInStudio: (clip: GeneratedLipSyncClip) => void;
  onChainAsVideoInput: (clip: GeneratedLipSyncClip) => void;
}

export const CreationsVaultView: React.FC<Props> = ({
  clips,
  onDeleteClip,
  onReuseInStudio,
  onChainAsVideoInput
}) => {
  if (clips.length === 0) {
    return (
      <div className="max-w-3xl mx-auto my-16 p-10 rounded-3xl bg-[#13131a] border border-white/8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300">
          <Film className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Your Lip-Sync Vault is Empty</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          Every Video+Audio and Image+Audio lip-sync clip you render is automatically archived in your browser&apos;s IndexedDB &amp; Cloud Vault so you never lose a take across refreshes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <span>Creations Vault ({clips.length})</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Zero-egress R2 &amp; local IndexedDB binary archive • Instant replay, MP4 download, or re-lip-sync chaining
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {clips.map((clip) => {
          const spec = LIPSYNC_MODELS.find((m) => m.id === clip.modelId);
          return (
            <div
              key={clip.id}
              className="group rounded-2xl bg-[#14141c] border border-white/8 overflow-hidden flex flex-col hover:border-white/20 transition"
            >
              <div className="relative aspect-video bg-black overflow-hidden">
                <video
                  src={clip.videoUrl}
                  poster={clip.thumbnailUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white pointer-events-none">
                  <span>{clip.modelName}</span>
                </div>
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-mono text-zinc-300 border border-white/10 pointer-events-none">
                  {clip.resolution} • {clip.durationSec}s
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {spec && <ModelBrandIcon provider={spec.provider} modelId={spec.id} size="sm" />}
                      <span className="text-xs font-semibold text-zinc-200 truncate">
                        {clip.inputMode === 'video_audio' ? 'Video + Audio Sync' : 'Portrait + Audio Sync'}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(clip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{clip.prompt}</p>
                  {clip.exactLyrics && (
                    <p className="text-[11px] text-cyan-300/90 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1 line-clamp-1">
                      Lyrics: &ldquo;{clip.exactLyrics}&rdquo;
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/6 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={clip.videoUrl}
                      download={buildVideoFileName(clip)}
                      onClick={(e) => {
                        e.preventDefault();
                        void downloadVideoWithName(clip.videoUrl, buildVideoFileName(clip));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>MP4</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onChainAsVideoInput(clip)}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border border-violet-500/30 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                      title="Send this video into Video + Audio Lip-Sync mode"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Re-Sync Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReuseInStudio(clip)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs transition cursor-pointer"
                    >
                      Settings
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteClip(clip.id)}
                    aria-label="Delete clip"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
