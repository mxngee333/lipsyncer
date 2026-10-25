import React from 'react';
import { X, Shield, FileText, BookOpen, Sparkles } from 'lucide-react';

export type LegalDocKey = 'about' | 'how-to-use' | 'privacy' | 'terms';

interface Props {
  activeDoc: LegalDocKey | null;
  onSelectDoc: (doc: LegalDocKey) => void;
  onClose: () => void;
}

export const LegalPagesModal: React.FC<Props> = ({ activeDoc, onSelectDoc, onClose }) => {
  if (!activeDoc) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121218] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#16161e]">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'how-to-use' as LegalDocKey, label: 'How to Use', icon: BookOpen },
              { id: 'about' as LegalDocKey, label: 'About LipSyncer', icon: Sparkles },
              { id: 'privacy' as LegalDocKey, label: 'Privacy Policy', icon: Shield },
              { id: 'terms' as LegalDocKey, label: 'Terms of Service', icon: FileText }
            ].map((item) => {
              const Icon = item.icon;
              const active = activeDoc === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectDoc(item.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-white text-black shadow'
                      : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close documentation dialog"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-zinc-300 leading-relaxed">
          {activeDoc === 'how-to-use' && (
            <article className="space-y-4">
              <h2 className="text-2xl font-bold text-white">How to Use LipSyncer AI Studio</h2>
              <p>
                LipSyncer AI combines an OpenArt-style Multi-Model Lip-Sync Workspace with a full 20-Scene Music Video Storyboard &amp; Omni Production Director. You can synchronize any vocal audio clip with either an uploaded video or a still character portrait.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                  <h3 className="font-bold text-white">1. Video + Audio Neural Lip-Sync</h3>
                  <p className="text-xs text-zinc-400">
                    Switch input mode to <strong>Video + Audio</strong>, upload an MP4/MOV/WebM subject video, and select <strong>ByteDance LatentSync 1.5</strong> or <strong>Kling 3.0 Omni</strong>. The model re-synthesizes mouth, jaw, and teeth articulation to match your uploaded vocal audio syllable-for-syllable.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                  <h3 className="font-bold text-white">2. Image + Audio Talking/Singing Portrait</h3>
                  <p className="text-xs text-zinc-400">
                    Upload a character headshot (or click <strong>Generate AI Portrait</strong> with FLUX) and pair it with uploaded audio, live microphone voice, or cloned voice audio. Choose <strong>LTX 2.5 Audio-to-Video</strong>, <strong>Seedance 2.0 Mini</strong>, <strong>PixVerse V6</strong>, <strong>Wan 2.7</strong>, or <strong>Veo 3.1</strong>.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                  <h3 className="font-bold text-white">3. 20-Scene Omni Music Video Director</h3>
                  <p className="text-xs text-zinc-400">
                    Open the <strong>20-Scene Director</strong> tab, upload a full song, auto-transcribe lyrics via browser Whisper AI, run <strong>Expert Song DNA Analysis</strong>, generate Folder A (01–10) &amp; Folder B (11–20) keyframes with zero visible text, and export canonical Omni TXT + Dual Offline HTML Consoles + ZIPs.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                  <h3 className="font-bold text-white">4. Zero-Quota 60fps Instant DSP Engine</h3>
                  <p className="text-xs text-zinc-400">
                    Need instant zero-wait previews or unlimited renders when public GPU clusters are busy? Select <strong>LipSyncer 60fps DSP Instant</strong> to synthesize 1080p H.264 MP4 clips locally using 280Hz–3600Hz Web Audio vocal formant analysis.
                  </p>
                </div>
              </div>
            </article>
          )}

          {activeDoc === 'about' && (
            <article className="space-y-4">
              <h2 className="text-2xl font-bold text-white">About LipSyncer AI</h2>
              <p>
                LipSyncer AI is a next-generation multimodal creative studio engineered for filmmakers, music artists, content creators, and animation directors. Inspired by modern multi-model creative arenas, LipSyncer unifies leading open and distilled audio-to-video diffusion architectures—including Lightricks LTX 2.5, ByteDance LatentSync 1.5, Seedance/MiniMax H3, Kling LivePortrait, Alibaba Wan 2.7, and 4K CodeFormer restoration—under one unified interface.
              </p>
              <p>
                Our built-in <strong>Music Video Storyboard Director</strong> enforces strict cinematic realism: natural skin texture, consistent character proportions, two-layer musical synchronization (BPM beat-grid for body/camera groove + original song audio as final phoneme authority), zero unwanted on-screen text, and dual standalone offline HTML production consoles.
              </p>
            </article>
          )}

          {activeDoc === 'privacy' && (
            <article className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
              <p>
                LipSyncer AI respects creator ownership and data privacy. Uploaded portraits, source videos, microphone recordings, and song tracks are processed solely to fulfill your requested lip-sync, transcription, and storyboard renders.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                <li><strong>Local-First Persistence:</strong> Drafts, rendered video blobs, and storyboard notes are cached directly in your browser&apos;s IndexedDB and localStorage so your session survives reloads privately on your device.</li>
                <li><strong> Whisper In-Browser Transcription:</strong> Automatic lyric extraction runs locally via WebAssembly without transmitting your full master song to third-party transcription servers.</li>
                <li><strong>Encrypted Cloud Vault:</strong> When signed in, account records use SHA-256 hashed identifiers and salted credentials, and rendered MP4 assets are delivered over HTTPS edge storage.</li>
              </ul>
            </article>
          )}

          {activeDoc === 'terms' && (
            <article className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Terms of Service</h2>
              <p>
                By using LipSyncer AI Studio, you confirm that you hold the necessary rights or permissions for any portrait likeness, video footage, voice reference, or musical audio you upload for synchronization.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                <li><strong>Ethical Likeness &amp; Deepfake Policy:</strong> Users may not generate deceptive non-consensual impersonations, defamatory media, or unlawful content.</li>
                <li><strong>Creator Commercial Ownership:</strong> Subject to underlying model licenses, you retain full creative rights to original music videos, storyboards, and Omni production boards created with your own assets.</li>
                <li><strong>Compute Pool Fair Use:</strong> Remote ZeroGPU cluster generations automatically rotate across available tokens; users may attach personal Hugging Face tokens at any time for dedicated PRO throughput.</li>
              </ul>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};
