import React, { useId } from 'react';
import { ModelProvider } from '../types';

export interface ModelBrandIconProps {
  provider: ModelProvider;
  modelId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ModelBrandIcon: React.FC<ModelBrandIconProps> = ({
  provider,
  modelId,
  size = 'md',
  className = ''
}) => {
  const uid = useId().replace(/:/g, '');

  const containerSizeClass =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
        ? 'w-14 h-14 rounded-2xl'
        : 'w-11 h-11 rounded-xl';

  const iconScaleClass =
    size === 'sm'
      ? 'w-5 h-5'
      : size === 'lg'
        ? 'w-8 h-8'
        : 'w-6 h-6';

  const renderGlyph = () => {
    switch (provider) {
      case 'Lightricks':
        return (
          <svg
            viewBox="0 0 40 24"
            fill="none"
            className={size === 'sm' ? 'w-6 h-4' : size === 'lg' ? 'w-10 h-6' : 'w-8 h-5'}
            aria-hidden="true"
          >
            {/* Bold geometric "ltx" wordmark matching Lightricks LTX */}
            <rect x="3" y="4" width="3.8" height="16" rx="1" fill="#FFFFFF" />
            <path
              d="M11.2 4.8H15V8.4H17.8V11.4H15V15.9C15 16.7 15.5 17.1 16.4 17.1H17.9V20H15.6C12.7 20 11.2 18.7 11.2 16V11.4H9.4V8.4H11.2V4.8Z"
              fill="#FFFFFF"
            />
            <path
              d="M20.2 8.4H24.5L27.6 12.7L30.7 8.4H35L29.9 14.2L35.3 20H31L27.6 15.6L24.2 20H19.9L25.3 14.2L20.2 8.4Z"
              fill="#FFFFFF"
            />
            {/* Signature diagonal LTX accent glint */}
            <circle cx="35.8" cy="6.2" r="1.4" fill="#38bdf8" />
          </svg>
        );

      case 'ByteDance': {
        if (modelId === 'byteplus-omnihuman-1-5') {
          return (
            <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
              <g stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M14 5L22 9.5L14 14L6 9.5L14 5Z" fill="#FFFFFF" fillOpacity="0.12" />
                <path d="M6 14L14 18.5L22 14" />
                <path d="M6 18.5L14 23L22 18.5" />
              </g>
            </svg>
          );
        }
        const isLatentSync = modelId === 'latentsync-1-5';
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            <defs>
              <linearGradient id={`bd1-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isLatentSync ? '#6366f1' : '#2563eb'} />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id={`bd2-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id={`bd3-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>
              <linearGradient id={`bd4-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isLatentSync ? '#a5f3fc' : '#2dd4bf'} />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            {/* 4-bar ByteDance / Seedance / LatentSync vertical equalizer */}
            <rect x="4" y="6" width="3.6" height="16" rx="1.8" fill={`url(#bd1-${uid})`} />
            <rect x="9.5" y="11" width="3.6" height="11" rx="1.8" fill={`url(#bd2-${uid})`} />
            <rect x="15" y="8.5" width="3.6" height="13.5" rx="1.8" fill={`url(#bd3-${uid})`} />
            <rect x="20.5" y="5" width="3.6" height="17" rx="1.8" fill={`url(#bd4-${uid})`} />
          </svg>
        );
      }

      case 'Kling AI':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            <defs>
              <linearGradient id={`klA-${uid}`} x1="4" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="55%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id={`klB-${uid}`} x1="24" y1="24" x2="8" y2="8" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="50%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            {/* Twisted infinity S-loop ribbon */}
            <path
              d="M9.5 18.8C5.9 16.4 5.2 11.2 8.2 8.1C11.1 5.1 16.2 5.5 19.2 8.8L16.3 11.4C14.7 9.6 12.1 9.4 10.7 10.8C9.3 12.2 9.7 14.8 11.7 16.1L9.5 18.8Z"
              fill={`url(#klA-${uid})`}
            />
            <path
              d="M18.5 9.2C22.1 11.6 22.8 16.8 19.8 19.9C16.9 22.9 11.8 22.5 8.8 19.2L11.7 16.6C13.3 18.4 15.9 18.6 17.3 17.2C18.7 15.8 18.3 13.2 16.3 11.9L18.5 9.2Z"
              fill={`url(#klB-${uid})`}
            />
          </svg>
        );

      case 'PixVerse':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            <defs>
              <linearGradient id={`pvTop-${uid}`} x1="7" y1="5" x2="22" y2="14" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id={`pvMid-${uid}`} x1="8" y1="14" x2="23" y2="21" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d946ef" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id={`pvLeft-${uid}`} x1="7" y1="6" x2="13" y2="23" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {/* Folded prism play-triangle */}
            <path d="M8 5.5L22.5 13.2L14.2 15.4L8 5.5Z" fill={`url(#pvTop-${uid})`} />
            <path d="M22.5 13.2L8 22.5L14.2 15.4L22.5 13.2Z" fill={`url(#pvMid-${uid})`} />
            <path d="M8 5.5L14.2 15.4L8 22.5V5.5Z" fill={`url(#pvLeft-${uid})`} />
          </svg>
        );

      case 'HappyHorse':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            {/* Crisp white rocking-horse silhouette */}
            <path
              d="M9.8 6.2L11.6 4.5L12.5 6.4C14.1 6.8 15.1 8.2 15.1 9.9L14.8 11.4H18.8C20.7 11.4 22.2 12.9 22.2 14.8V16.8L20.5 20.2H18.4L19.4 16.9H13.2L11.9 20.2H9.7L11.2 15.6C9.9 14.9 9.2 13.6 9.5 12.1L10.1 9.9L7.6 10.6L6.8 8.9L9.8 6.2Z"
              fill="#FFFFFF"
            />
            {/* Curved rocker arc */}
            <path
              d="M5.5 20.6C10.5 23.4 17.5 23.4 22.5 20.6"
              stroke="#FFFFFF"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'Alibaba Wan':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            <defs>
              <linearGradient id={`wan-${uid}`} x1="5" y1="4" x2="23" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {/* Violet hexagonal interconnected triangle prism */}
            <path
              d="M14 4.2L22.6 19.2H5.4L14 4.2Z"
              stroke={`url(#wan-${uid})`}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path
              d="M14 23.8L5.4 8.8H22.6L14 23.8Z"
              stroke="#a855f7"
              strokeWidth="2.2"
              strokeLinejoin="round"
              opacity="0.88"
            />
            <circle cx="14" cy="14" r="2.1" fill="#e9d5ff" />
          </svg>
        );

      case 'Google DeepMind':
        return (
          <svg viewBox="0 0 24 24" className={iconScaleClass} aria-hidden="true">
            {/* Authentic 4-color Google G emblem */}
            <path
              fill="#4285F4"
              d="M21.8 12.23c0-.72-.06-1.41-.19-2.07H12v3.92h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.49Z"
            />
            <path
              fill="#34A853"
              d="M12 22.2c2.76 0 5.07-.91 6.76-2.48l-3.3-2.56c-.91.61-2.08.98-3.46.98-2.66 0-4.91-1.8-5.72-4.21H2.87v2.64A10.19 10.19 0 0 0 12 22.2Z"
            />
            <path
              fill="#FBBC05"
              d="M6.28 13.93a6.12 6.12 0 0 1 0-3.86V7.43H2.87a10.2 10.2 0 0 0 0 9.14l3.41-2.64Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.86c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.06 2.8 14.75 1.8 12 1.8A10.19 10.19 0 0 0 2.87 7.43l3.41 2.64c.81-2.41 3.06-4.21 5.72-4.21Z"
            />
          </svg>
        );

      case 'Creatify':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            <defs>
              <linearGradient id={`creatify-${uid}`} x1="3" y1="5" x2="25" y2="23" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            {/* Speed wing dash */}
            <path d="M4 14.5H10.5L8.5 18.5H4L5.5 14.5Z" fill={`url(#creatify-${uid})`} opacity="0.8" />
            {/* Primary double chevron speed arrow */}
            <path d="M9.5 8L17.5 14L9.5 20L13 14L9.5 8Z" fill={`url(#creatify-${uid})`} />
            <path d="M15.5 8L23.5 14L15.5 20L19 14L15.5 8Z" fill={`url(#creatify-${uid})`} />
          </svg>
        );

      case 'OpenArt':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            {/* Official OpenArt clean infinity loop */}
            <path
              d="M9 9.5C6.5 9.5 4.5 11.5 4.5 14C4.5 16.5 6.5 18.5 9 18.5C11.5 18.5 13.1 16.6 14 15.2C14.9 16.6 16.5 18.5 19 18.5C21.5 18.5 23.5 16.5 23.5 14C23.5 11.5 21.5 9.5 19 9.5C16.5 9.5 14.9 11.4 14 12.8C13.1 11.4 11.5 9.5 9 9.5ZM9 11.5C10.5 11.5 11.8 12.6 12.8 14C11.8 15.4 10.5 16.5 9 16.5C7.6 16.5 6.5 15.4 6.5 14C6.5 12.6 7.6 11.5 9 11.5ZM19 11.5C20.4 11.5 21.5 12.6 21.5 14C21.5 15.4 20.4 16.5 19 16.5C17.5 16.5 16.2 15.4 15.2 14C16.2 12.6 17.5 11.5 19 11.5Z"
              fill="#FFFFFF"
            />
          </svg>
        );

      case 'Hedra':
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            {/* Hedra signature 8-petal geometric snowflake burst */}
            <g fill="#FFFFFF">
              <rect x="12.5" y="4" width="3" height="7.5" rx="1.5" />
              <rect x="12.5" y="16.5" width="3" height="7.5" rx="1.5" />
              <rect x="4" y="12.5" width="7.5" height="3" rx="1.5" />
              <rect x="16.5" y="12.5" width="7.5" height="3" rx="1.5" />
              <rect x="12.5" y="4" width="3" height="7.5" rx="1.5" transform="rotate(45 14 14)" />
              <rect x="12.5" y="16.5" width="3" height="7.5" rx="1.5" transform="rotate(45 14 14)" />
              <rect x="4" y="12.5" width="7.5" height="3" rx="1.5" transform="rotate(45 14 14)" />
              <rect x="16.5" y="12.5" width="7.5" height="3" rx="1.5" transform="rotate(45 14 14)" />
            </g>
          </svg>
        );

      case 'LipSyncer DSP':
      default:
        return (
          <svg viewBox="0 0 28 28" fill="none" className={iconScaleClass} aria-hidden="true">
            <defs>
              <linearGradient id={`dsp-${uid}`} x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
            </defs>
            {/* Acoustic waveform flanking bars */}
            <rect x="4" y="10.5" width="2.6" height="7" rx="1.3" fill="#34d399" opacity="0.85" />
            <rect x="8" y="8" width="2.6" height="12" rx="1.3" fill="#10b981" opacity="0.9" />
            <rect x="17.4" y="8" width="2.6" height="12" rx="1.3" fill="#10b981" opacity="0.9" />
            <rect x="21.4" y="10.5" width="2.6" height="7" rx="1.3" fill="#34d399" opacity="0.85" />
            {/* Center high-speed lightning crest */}
            <path
              d="M15.4 4.2L9.8 14.6H13.9L12.6 23.8L18.2 13.4H14.1L15.4 4.2Z"
              fill={`url(#dsp-${uid})`}
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`${containerSizeClass} bg-[#1c1c24] border border-white/8 flex items-center justify-center shrink-0 select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
      title={provider}
    >
      {renderGlyph()}
    </div>
  );
};

export default ModelBrandIcon;
