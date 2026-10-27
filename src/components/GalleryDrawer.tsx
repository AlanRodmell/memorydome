import React, { useState, useMemo } from 'react';
import { X, Search, Sparkles, Image as ImageIcon, ArrowUp, ArrowDown, Compass } from 'lucide-react';
import { getPhotoUrl, parsePhotoDate } from '../services/memoryDomeService';

interface GalleryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  photoFiles: string[];
  photoVersion?: string;
  baseUrl: string;
  totalPhotos: number;
  currentDay: number;
  onSelectPhoto: (day: number) => void;
}

type SphereFilter = 'all' | 'above' | 'equator' | 'below';

export const GalleryDrawer: React.FC<GalleryDrawerProps> = ({
  isOpen,
  onClose,
  photoFiles,
  photoVersion,
  baseUrl,
  totalPhotos,
  currentDay,
  onSelectPhoto,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState<SphereFilter>('all');

  const items = useMemo(() => {
    const list: Array<{
      day: number;
      file: string | null;
      date: string | null;
      region: 'above' | 'equator' | 'below';
    }> = [];

    for (let i = 1; i <= totalPhotos; i++) {
      const file = photoFiles.length > 0 ? photoFiles[(i - 1) % photoFiles.length] : null;
      const region: 'above' | 'equator' | 'below' =
        i < totalPhotos * 0.38 ? 'above' : i < totalPhotos * 0.62 ? 'equator' : 'below';

      list.push({
        day: i,
        file,
        date: file ? parsePhotoDate(file) : null,
        region,
      });
    }
    return list;
  }, [photoFiles, totalPhotos]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (regionFilter !== 'all') {
      result = result.filter((item) => item.region === regionFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((item) => {
        if (item.day.toString().includes(term)) return true;
        if (item.file && item.file.toLowerCase().includes(term)) return true;
        if (item.date && item.date.toLowerCase().includes(term)) return true;
        return false;
      });
    }
    return result;
  }, [items, searchTerm, regionFilter]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Memory Gallery"
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl h-full glass-panel border-l border-amber-400/30 flex flex-col shadow-2xl overflow-hidden bg-slate-950/90">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="serif-font text-xl text-amber-100 font-semibold leading-tight">
                360° Sphere Memory Gallery
              </h2>
              <p className="text-xs text-slate-400">
                {totalPhotos} celestial tiles wrapping above and below
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Region Filter Chips */}
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setRegionFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              regionFilter === 'all'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow'
                : 'glass-pill text-slate-300 hover:text-white'
            }`}
          >
            All Sphere (750)
          </button>
          <button
            onClick={() => setRegionFilter('above')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              regionFilter === 'above'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow'
                : 'glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <ArrowUp className="w-3 h-3" />
            <span>Above (Zenith)</span>
          </button>
          <button
            onClick={() => setRegionFilter('equator')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              regionFilter === 'equator'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow'
                : 'glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Equator (Horizon)</span>
          </button>
          <button
            onClick={() => setRegionFilter('below')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              regionFilter === 'below'
                ? 'bg-sky-400 text-slate-950 font-semibold shadow'
                : 'glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            <span>Below (Nadir)</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900/20 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search photo #day, date, or filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Grid of memories */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5 content-start">
          {filteredItems.map(({ day, file, date, region }) => {
            const isSelected = day === currentDay;
            const isKeystoneTop = day === 1;
            const isKeystoneBottom = day === totalPhotos;
            const thumbUrl = file ? getPhotoUrl(baseUrl, 'thumbs', file, photoVersion) : null;

            return (
              <button
                key={day}
                onClick={() => {
                  onSelectPhoto(day);
                  onClose();
                }}
                className={`group relative aspect-square rounded-xl overflow-hidden border transition text-left flex flex-col justify-end p-1.5 focus:outline-none ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]'
                    : isKeystoneTop
                    ? 'border-amber-400 shadow-md shadow-amber-400/20'
                    : isKeystoneBottom
                    ? 'border-sky-400 shadow-md shadow-sky-400/20'
                    : 'border-slate-800 hover:border-amber-400/50 hover:scale-[1.02]'
                } bg-slate-900/90`}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`Memory ${day}`}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center">
                    <span className="text-[10px] text-slate-600 font-mono">#{day}</span>
                  </div>
                )}

                {/* Dark gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

                {/* Badge top-left */}
                <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow ${
                      isKeystoneTop
                        ? 'bg-amber-400 text-slate-950 flex items-center gap-0.5'
                        : isKeystoneBottom
                        ? 'bg-sky-400 text-slate-950 flex items-center gap-0.5'
                        : isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-900/80 text-amber-200 border border-slate-700/60'
                    }`}
                  >
                    {(isKeystoneTop || isKeystoneBottom) && (
                      <Sparkles className="w-2.5 h-2.5 fill-current" />
                    )}
                    #{day}
                  </span>
                </div>

                {/* Region indicator top-right */}
                <div className="absolute top-1.5 right-1.5 z-10">
                  <span
                    className={`text-[8px] font-semibold px-1 py-0.2 rounded ${
                      region === 'above'
                        ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                        : region === 'below'
                        ? 'bg-sky-950/70 text-sky-300 border border-sky-500/30'
                        : 'bg-slate-900/70 text-slate-300'
                    }`}
                  >
                    {region === 'above' ? '↑' : region === 'below' ? '↓' : '•'}
                  </span>
                </div>

                {/* Date bottom */}
                {date && (
                  <p className="relative z-10 text-[9px] text-slate-300 font-medium truncate leading-tight drop-shadow">
                    {date}
                  </p>
                )}
              </button>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 text-xs">
              No memories found in this region
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
