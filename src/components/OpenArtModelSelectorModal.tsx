import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  X,
  Image as ImageIcon,
  Film,
  Volume2,
  Video,
  Sparkles,
  ScanFace,
  Tv,
  Trophy,
  Clapperboard,
  Check,
  Zap
} from 'lucide-react';
import { LipSyncModelSpec, ModelFeatureTag } from '../types';
import {
  LIPSYNC_MODELS,
  OPENART_OFFICIAL_MODELS,
  MODEL_PROVIDERS_LIST,
  MODEL_FEATURES_LIST
} from '../data/modelCatalog';
import { ModelBrandIcon } from './ModelBrandIcon';

export interface OpenArtModelSelectorModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  selectedModelId: string;
  onSelectModel: (modelId: string, model: LipSyncModelSpec) => void;
  embedded?: boolean;
  onOpenArena?: () => void;
  onOpenDirector?: () => void;
}

type ModalityQuickFilter = 'all' | 'video_audio' | 'image_audio';

const renderFeatureMiniIcon = (feature: ModelFeatureTag) => {
  switch (feature) {
    case 'Start/End':
      return <ImageIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    case 'Start Frame':
      return <ImageIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    case 'Reference':
      return <ScanFace className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    case 'Multi-shots':
      return <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    case 'Audio':
      return <Volume2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    case 'Video Lip-Sync':
      return <Video className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
    case 'Image Lip-Sync':
      return <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    case '4K':
      return <Tv className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    default:
      return null;
  }
};

const getBadgeClasses = (variant: 'new' | 'arena_top' | 'instant' | 'video_sync'): string => {
  switch (variant) {
    case 'new':
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'arena_top':
      return 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30';
    case 'video_sync':
      return 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
    case 'instant':
      return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
  }
};

export const OpenArtModelSelectorModal: React.FC<OpenArtModelSelectorModalProps> = ({
  isOpen = true,
  onClose,
  selectedModelId,
  onSelectModel,
  embedded = false,
  onOpenArena,
  onOpenDirector
}) => {
  const [viewMode, setViewMode] = useState<'openart' | 'all'>('openart');
  const [modalityFilter, setModalityFilter] = useState<ModalityQuickFilter>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('All providers');
  const [selectedFeature, setSelectedFeature] = useState<string>('All features');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchExpanded, setSearchExpanded] = useState<boolean>(false);
  const [openDropdown, setOpenDropdown] = useState<'provider' | 'feature' | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!embedded && !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openDropdown) {
          setOpenDropdown(null);
        } else if (!embedded && onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedded, isOpen, onClose, openDropdown]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return LIPSYNC_MODELS.filter((model) => {
      if (modalityFilter === 'video_audio' && !model.supportsVideoInput) {
        return false;
      }
      if (modalityFilter === 'image_audio' && !model.supportsImageInput) {
        return false;
      }
      if (selectedProvider !== 'All providers' && model.provider !== selectedProvider) {
        return false;
      }
      if (
        selectedFeature !== 'All features' &&
        !model.features.includes(selectedFeature as ModelFeatureTag)
      ) {
        return false;
      }
      if (q) {
        const haystack = [
          model.name,
          model.provider,
          model.description,
          model.resolutionLabel,
          ...model.features,
          ...model.badges.map((b) => b.label)
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [modalityFilter, selectedProvider, selectedFeature, searchQuery]);

  if (!embedded && !isOpen) {
    return null;
  }

  const handleChooseModel = (model: LipSyncModelSpec) => {
    onSelectModel(model.id, model);
    if (!embedded && onClose) {
      onClose();
    }
  };

  const handlePromoSeedanceSelect = () => {
    const seedance =
      LIPSYNC_MODELS.find((m) => m.id === 'seedance-2-mini') || LIPSYNC_MODELS[0];
    if (seedance) {
      handleChooseModel(seedance);
    }
  };

  const handlePromoArena = () => {
    if (onOpenArena) {
      onOpenArena();
    }
    if (!embedded && onClose) {
      onClose();
    }
  };

  const handlePromoDirector = () => {
    if (onOpenDirector) {
      onOpenDirector();
    }
    if (!embedded && onClose) {
      onClose();
    }
  };

  const resetAllFilters = () => {
    setModalityFilter('all');
    setSelectedProvider('All providers');
    setSelectedFeature('All features');
    setSearchQuery('');
  };

  const contentBody = (
    <div
      className={
        embedded
          ? 'w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6'
          : `relative w-full ${
              viewMode === 'openart' ? 'max-w-2xl' : 'max-w-5xl'
            } max-h-[90vh] flex flex-col rounded-3xl bg-[#111116] border border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-200`
      }
    >
      {/* Modal Header */}
      {!embedded && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#14151c] shrink-0">
          <div className="flex items-center gap-3.5">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Model
            </h2>
            <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-xl border border-white/8">
              <button
                type="button"
                onClick={() => setViewMode('openart')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'openart'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>OpenArt Lip Sync</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  {OPENART_OFFICIAL_MODELS.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'all'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>All Models</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
                  {LIPSYNC_MODELS.length}
                </span>
              </button>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close model selector"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Mode 1: Exact OpenArt Official 6-Model Suite */}
      {viewMode === 'openart' ? (
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2 max-h-[75vh]">
          {OPENART_OFFICIAL_MODELS.map((model) => {
            const isSelected = selectedModelId === model.id;
            return (
              <div
                key={model.id}
                role="button"
                tabIndex={0}
                onClick={() => handleChooseModel(model)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleChooseModel(model);
                  }
                }}
                className={`group flex items-center justify-between gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#252836] border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.5)] ring-1 ring-white/10'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <ModelBrandIcon provider={model.provider} modelId={model.id} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-bold text-white tracking-tight">
                        {model.name}
                      </span>
                      {model.badges.map((badge) => (
                        <span
                          key={`${model.id}-${badge.label}`}
                          className="bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 leading-none"
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs sm:text-[13px] text-zinc-400 leading-relaxed mt-0.5">
                      {model.description}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 border border-white/5">
                    {model.supportsVideoInput ? 'Video + Audio' : 'Image + Audio'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={embedded ? 'space-y-6' : 'p-5 sm:p-6 overflow-y-auto space-y-6'}>
          {/* Top 3 Featured Promo Cards (OpenArt Visual Deck) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Promo 1: Which model performs best */}
          <button
            type="button"
            onClick={handlePromoArena}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#172a2e] via-[#131f28] to-[#1a1626] p-4 text-left transition-all hover:border-emerald-400/40 hover:shadow-[0_12px_32px_rgba(16,185,129,0.14)] cursor-pointer min-h-[118px] flex flex-col justify-between"
          >
            {/* Decorative leaderboard floating tiles */}
            <div className="flex items-center justify-between gap-2 z-10">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/45 backdrop-blur-md border border-emerald-400/30 text-[10px] font-semibold text-emerald-300">
                  <Trophy className="w-3 h-3" /> #1 LatentSync 1.5
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[10px] font-medium text-sky-200">
                  #2 LTX 2.5
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[10px] font-medium text-teal-200">
                  #3 Seedance 2.0
                </span>
              </div>
              <span className="text-lg font-black tracking-tight text-fuchsia-300/80 group-hover:text-fuchsia-200 transition">
                98%
              </span>
            </div>

            <div className="relative z-10 mt-3">
              <div className="text-base font-extrabold text-white tracking-tight group-hover:text-emerald-200 transition">
                Which model performs best
              </div>
              <p className="text-xs text-zinc-300/85 mt-0.5">
                Blind side-by-side Lip-Sync Arena &amp; live ELO leaderboard
              </p>
            </div>

            <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-500/15 blur-2xl group-hover:bg-emerald-400/25 transition" />
          </button>

          {/* Promo 2: Seedance 2.0 & LTX 2.5 */}
          <button
            type="button"
            onClick={handlePromoSeedanceSelect}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#12263a] via-[#162032] to-[#1a1829] p-4 text-left transition-all hover:border-sky-400/45 hover:shadow-[0_12px_32px_rgba(56,189,248,0.16)] cursor-pointer min-h-[118px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 z-10">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-[10px] font-semibold text-sky-200">
                <Zap className="w-3 h-3" /> FEATURED AUDIO SYNC
              </span>
              <span className="text-[11px] font-black tracking-widest uppercase text-sky-400/40 group-hover:text-sky-300/70 transition">
                2.0 + 2.5
              </span>
            </div>

            <div className="relative z-10 mt-3">
              <div className="text-base font-extrabold text-white tracking-tight group-hover:text-sky-200 transition">
                Seedance 2.0 &amp; LTX 2.5
              </div>
              <p className="text-xs text-zinc-300/90 mt-0.5">
                Cinematic videos with audio &amp; multi-shots
              </p>
            </div>

            <div className="pointer-events-none absolute -right-4 -top-4 w-32 h-32 rounded-full bg-sky-500/20 blur-2xl group-hover:bg-cyan-400/30 transition" />
          </button>

          {/* Promo 3: Consistent characters & targeted video edits */}
          <button
            type="button"
            onClick={handlePromoDirector}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#2a1526] via-[#1f1629] to-[#14141d] p-4 text-left transition-all hover:border-fuchsia-400/40 hover:shadow-[0_12px_32px_rgba(217,70,239,0.15)] cursor-pointer min-h-[118px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 z-10">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-400/30 text-[10px] font-semibold text-fuchsia-200">
                <Clapperboard className="w-3 h-3" /> 20-SCENE OMNI DIRECTOR
              </span>
              <span className="text-[10px] font-mono text-fuchsia-300/70">ZERO-TEXT LOCK</span>
            </div>

            <div className="relative z-10 mt-3">
              <div className="text-sm sm:text-[15px] font-extrabold text-white tracking-tight leading-snug group-hover:text-fuchsia-200 transition">
                Consistent characters &amp; targeted video edits
              </div>
              <p className="text-xs text-zinc-300/85 mt-0.5">
                20-Scene Omni Music Video Storyboard Director
              </p>
            </div>

            <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-fuchsia-500/20 blur-2xl group-hover:bg-fuchsia-400/30 transition" />
          </button>
        </div>

        {/* Filter Bar */}
        <div
          ref={dropdownContainerRef}
          className="flex flex-wrap items-center justify-between gap-3 pt-1"
        >
          {/* Left Modality Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setModalityFilter('all');
                setSelectedProvider('All providers');
                setSelectedFeature('All features');
              }}
              className={`rounded-full px-4 py-1.5 text-xs sm:text-sm transition cursor-pointer ${
                modalityFilter === 'all' &&
                selectedProvider === 'All providers' &&
                selectedFeature === 'All features'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-[#1a1a22] text-zinc-300 hover:text-white hover:bg-[#23232e] border border-white/8 font-medium'
              }`}
            >
              All models
            </button>

            <button
              type="button"
              onClick={() =>
                setModalityFilter((prev) => (prev === 'video_audio' ? 'all' : 'video_audio'))
              }
              className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer ${
                modalityFilter === 'video_audio'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-[#1a1a22] text-zinc-300 hover:text-white hover:bg-[#23232e] border border-white/8 font-medium'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video + Audio</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setModalityFilter((prev) => (prev === 'image_audio' ? 'all' : 'image_audio'))
              }
              className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer ${
                modalityFilter === 'image_audio'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-[#1a1a22] text-zinc-300 hover:text-white hover:bg-[#23232e] border border-white/8 font-medium'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Image + Audio</span>
            </button>
          </div>

          {/* Right Dropdowns & Search */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* All providers dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'provider' ? null : 'provider'))
                }
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 transition cursor-pointer ${
                  selectedProvider !== 'All providers'
                    ? 'bg-white/12 text-white border border-white/20'
                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{selectedProvider}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {openDropdown === 'provider' && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#1a1a23] border border-white/12 shadow-2xl py-1.5 z-30">
                  {MODEL_PROVIDERS_LIST.map((prov) => {
                    const active = selectedProvider === prov;
                    return (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => {
                          setSelectedProvider(prov);
                          setOpenDropdown(null);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-white/8 transition cursor-pointer ${
                          active ? 'text-white font-semibold bg-white/5' : 'text-zinc-300'
                        }`}
                      >
                        <span>{prov}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* All features dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'feature' ? null : 'feature'))
                }
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 transition cursor-pointer ${
                  selectedFeature !== 'All features'
                    ? 'bg-white/12 text-white border border-white/20'
                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{selectedFeature}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {openDropdown === 'feature' && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#1a1a23] border border-white/12 shadow-2xl py-1.5 z-30">
                  {MODEL_FEATURES_LIST.map((feat) => {
                    const active = selectedFeature === feat;
                    return (
                      <button
                        key={feat}
                        type="button"
                        onClick={() => {
                          setSelectedFeature(feat);
                          setOpenDropdown(null);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-white/8 transition cursor-pointer ${
                          active ? 'text-white font-semibold bg-white/5' : 'text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {feat !== 'All features' &&
                            renderFeatureMiniIcon(feat as ModelFeatureTag)}
                          <span>{feat}</span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expandable / Inline Search */}
            {searchExpanded || searchQuery ? (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery) setSearchExpanded(false);
                  }}
                  placeholder="Search models, 4K, audio..."
                  className="pl-8 pr-7 py-1.5 rounded-full bg-[#1c1c25] border border-white/15 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/60 w-44 sm:w-56 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-2.5 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchExpanded(true);
                  setTimeout(() => searchInputRef.current?.focus(), 20);
                }}
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Search className="w-4 h-4 text-zinc-400" />
                <span>Search</span>
              </button>
            )}
          </div>
        </div>

        {/* Model Rows List */}
        <div className="space-y-2.5">
          {filteredModels.length === 0 ? (
            <div className="rounded-2xl bg-[#16161c] border border-white/[0.06] p-8 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                No lip-sync models match your current filter combination.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = selectedModelId === model.id;
              return (
                <div
                  key={model.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChooseModel(model)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChooseModel(model);
                    }
                  }}
                  className={`bg-[#16161c] hover:bg-[#1e1e26] border rounded-2xl px-4 py-3.5 transition-all cursor-pointer flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 ${
                    isSelected
                      ? 'bg-[#22242e] border-white/25 ring-1 ring-cyan-400/50 shadow-[0_6px_28px_rgba(56,189,248,0.12)]'
                      : 'border-white/[0.06]'
                  }`}
                >
                  {/* Left: Brand Icon + Model Name + Badges + Description */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ModelBrandIcon provider={model.provider} modelId={model.id} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-bold text-white tracking-tight">
                          {model.name}
                        </span>
                        {model.badges.map((badge) => (
                          <span
                            key={`${model.id}-${badge.label}`}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md leading-none ${getBadgeClasses(
                              badge.variant
                            )}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                        {isSelected && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-zinc-400 truncate mt-0.5">
                        {model.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Dark Capability Pills + Resolution + Duration */}
                  <div className="flex items-center gap-1.5 flex-wrap lg:justify-end shrink-0">
                    {model.features.map((feature) => (
                      <span
                        key={`${model.id}-feat-${feature}`}
                        className="bg-[#22222b] text-zinc-300 text-xs px-2.5 py-1 rounded-md border border-white/5 flex items-center gap-1.5 font-medium"
                      >
                        {feature !== 'Start Frame' && renderFeatureMiniIcon(feature)}
                        <span>{feature}</span>
                      </span>
                    ))}

                    <span className="bg-[#22222b] text-zinc-300 text-xs px-2.5 py-1 rounded-md border border-white/5 font-medium">
                      {model.resolutionLabel}
                    </span>

                    <span className="bg-[#22222b] text-zinc-300 text-xs px-2.5 py-1 rounded-md border border-white/5 font-medium">
                      {model.durationLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}
    </div>
  );

  if (embedded) {
    return contentBody;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {contentBody}
    </div>
  );
};

export default OpenArtModelSelectorModal;
