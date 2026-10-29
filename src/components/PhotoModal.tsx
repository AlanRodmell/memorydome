import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { X, ChevronLeft, ChevronRight, Share2, Download, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import { getPhotoUrl, parsePhotoDate } from '../services/memoryDomeService';

interface PhotoModalProps {
  day: number | null;
  totalPhotos: number;
  photoFiles: string[];
  photoVersion?: string;
  baseUrl: string;
  loopMemories?: boolean;
  onClose: () => void;
  onNavigate: (newDay: number) => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  day,
  totalPhotos,
  photoFiles,
  photoVersion,
  baseUrl,
  loopMemories = false,
  onClose,
  onNavigate,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isKeystoneTop = day === 1;
  const isKeystoneBottom = day === totalPhotos;
  const file = day
    ? loopMemories
      ? photoFiles.length ? photoFiles[(day - 1) % photoFiles.length] : null
      : day <= photoFiles.length ? photoFiles[day - 1] : null
    : null;

  useEffect(() => {
    setZoomLevel(1);
    setImageLoaded(false);
    if (day !== null) {
      if (isKeystoneTop || isKeystoneBottom) {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: isKeystoneTop ? 0.3 : 0.8 },
          colors: ['#fbbf24', '#38bdf8', '#fef08a', '#ffffff'],
        });
      }

      // Preload previous and next neighboring photos in background for instant navigation
      const prevDay = day > 1 ? day - 1 : totalPhotos;
      const nextDay = day < totalPhotos ? day + 1 : 1;

      const getFileFor = (d: number) => {
        return loopMemories
          ? photoFiles.length ? photoFiles[(d - 1) % photoFiles.length] : null
          : d <= photoFiles.length ? photoFiles[d - 1] : null;
      };

      const neighbors = [getFileFor(prevDay), getFileFor(nextDay)];
      neighbors.forEach((neighborFile) => {
        if (neighborFile) {
          const img = new Image();
          img.decoding = 'async';
          img.src = getPhotoUrl(baseUrl, 'full', neighborFile, photoVersion);
        }
      });
    }
  }, [day, isKeystoneTop, isKeystoneBottom, totalPhotos, photoFiles, loopMemories, baseUrl, photoVersion]);

  // Keyboard navigation
  useEffect(() => {
    if (day === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onNavigate(day < totalPhotos ? day + 1 : 1);
      } else if (e.key === 'ArrowRight') {
        onNavigate(day > 1 ? day - 1 : totalPhotos);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [day, totalPhotos, onClose, onNavigate]);

  if (day === null) return null;

  const prevDay = day < totalPhotos ? day + 1 : 1;
  const nextDay = day > 1 ? day - 1 : totalPhotos;
  const fullUrl = file ? getPhotoUrl(baseUrl, 'full', file, photoVersion) : null;
  const thumbUrl = file ? getPhotoUrl(baseUrl, 'thumbs', file, photoVersion) : null;
  const parsedDate = file ? parsePhotoDate(file) : null;

  // Spatial hemisphere indicator
  const sphereRegion =
    day === 1
      ? 'Zenith • Overhead'
      : day === totalPhotos
      ? 'Nadir • Directly Below'
      : day < totalPhotos * 0.38
      ? 'Upper Hemisphere • Above'
      : day < totalPhotos * 0.62
      ? 'Equator • Eye Level'
      : 'Lower Hemisphere • Below';

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('day', String(day));
    navigator.clipboard.writeText(url.toString()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="glass-panel rounded-3xl max-w-2xl w-full overflow-hidden border border-amber-400/40 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 shadow ${
                isKeystoneTop
                  ? 'bg-amber-400/20 border border-amber-400/40 text-amber-200'
                  : isKeystoneBottom
                  ? 'bg-sky-400/20 border border-sky-400/40 text-sky-200'
                  : 'bg-slate-800 border border-slate-700 text-slate-200'
              }`}
            >
              {(isKeystoneTop || isKeystoneBottom) && <Sparkles className="w-3.5 h-3.5 fill-current text-amber-300" />}
              {isKeystoneTop ? '#1 Zenith' : isKeystoneBottom ? `#${totalPhotos} Nadir` : `#${day}`}
            </span>
            <span className="text-[11px] text-slate-300 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800 font-medium">
              {sphereRegion}
            </span>
            {parsedDate && (
              <span className="text-xs text-slate-400 hidden md:inline font-medium">
                {parsedDate}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl glass-pill hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition text-xs flex items-center gap-1.5"
              title="Copy link to this photo"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">{isCopied ? 'Copied!' : 'Share'}</span>
            </button>

            {fullUrl && (
              <a
                href={fullUrl}
                download={file || `memory-${day}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl glass-pill hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition text-xs"
                title="Open / Download Full Size"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Content */}
        <div className="relative bg-slate-950/90 flex-1 overflow-hidden flex items-center justify-center p-3 sm:p-5 min-h-[16rem]">
          {file ? (
            <div className="relative flex items-center justify-center max-w-full max-h-full">
              {/* Thumbnail while full loads */}
              {!imageLoaded && thumbUrl && (
                <img
                  src={thumbUrl}
                  alt={`Memory ${day}`}
                  className="max-h-[64vh] max-w-full w-auto rounded-xl filter blur-sm transition-opacity"
                />
              )}
              {/* High-res image */}
              <img
                src={fullUrl || ''}
                alt={`Memory ${day}`}
                onLoad={() => setImageLoaded(true)}
                style={{ transform: `scale(${zoomLevel})` }}
                className={`max-h-[64vh] max-w-full w-auto rounded-xl shadow-2xl border border-slate-800 object-contain transition-transform duration-200 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0 absolute'
                }`}
              />

              {/* Zoom controls float */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md rounded-xl p-1 border border-slate-700/60">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
                  disabled={zoomLevel <= 1}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-amber-300 w-8 text-center">
                  {zoomLevel.toFixed(1)}x
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  disabled={zoomLevel >= 2.5}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400">No photo for this tile yet.</p>
              <p className="text-xs text-slate-600 mt-1">Tile #{day} is empty in the tapestry</p>
            </div>
          )}
        </div>

        {/* Footer info & Prev/Next */}
        <div className="px-5 py-3 border-t border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/60">
          <button
            onClick={() => onNavigate(prevDay)}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>#{prevDay}</span>
          </button>

          {file && (
            <div className="text-center truncate px-2 max-w-[200px] sm:max-w-[280px]">
              <p className="text-[11px] text-slate-400 truncate">{file}</p>
              {parsedDate && <p className="text-[10px] text-amber-300/70 sm:hidden">{parsedDate}</p>}
            </div>
          )}

          <button
            onClick={() => onNavigate(nextDay)}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
          >
            <span>#{nextDay}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
