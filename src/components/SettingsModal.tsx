import React, { useState } from 'react';
import { X, Globe, RefreshCw, Volume2, VolumeX, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DEFAULT_DOME_URL, ACCESS_KEY } from '../services/memoryDomeService';
import { toggleMute } from '../services/soundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string;
  onUpdateBaseUrl: (newUrl: string) => void;
  totalLoaded: number;
  totalPhotos: number;
  version?: string;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onRelock: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  baseUrl,
  onUpdateBaseUrl,
  totalLoaded,
  totalPhotos,
  version,
  isAudioMuted,
  onToggleAudio,
  onRelock,
}) => {
  const [urlInput, setUrlInput] = useState(baseUrl);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    onUpdateBaseUrl(urlInput.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleResetToDefault = () => {
    setUrlInput(DEFAULT_DOME_URL);
    onUpdateBaseUrl(DEFAULT_DOME_URL);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleLock = () => {
    try {
      localStorage.removeItem(ACCESS_KEY);
    } catch {
      // ignore
    }
    onRelock();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Memory Dome Settings"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel rounded-3xl max-w-md w-full p-6 border border-amber-400/40 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="serif-font text-lg text-amber-100 font-semibold leading-tight">
                Dome Connection & Settings
              </h3>
              <p className="text-[11px] text-slate-400">Memory Dome source and audio preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current status */}
        <div className="my-4 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Connection Status:</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected to GitHub Pages
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Woven Photos:</span>
            <span className="text-amber-300 font-mono font-medium">
              {totalLoaded} loaded / {totalPhotos} tiles
            </span>
          </div>

          {version && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Manifest Version:</span>
              <span className="text-slate-300 font-mono text-[11px]">{version}</span>
            </div>
          )}
        </div>

        {/* URL Form */}
        <form onSubmit={handleSaveUrl} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Dome Remote Source URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://alanrodmell.github.io/memorydome"
                required
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition"
              >
                {isSaved ? 'Updated!' : 'Update'}
              </button>
            </div>
          </div>

          {urlInput !== DEFAULT_DOME_URL && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-[11px] text-amber-300/80 hover:text-amber-200 underline transition"
            >
              Reset to alanrodmell.github.io/memorydome
            </button>
          )}
        </form>

        {/* Audio controls */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs">
            <p className="font-medium text-slate-200">Cosmic Soundscape</p>
            <p className="text-[11px] text-slate-400">Chimes, whooshes & ambient drone</p>
          </div>
          <button
            type="button"
            onClick={onToggleAudio}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition ${
              !isAudioMuted
                ? 'bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-400/20'
                : 'glass-pill text-slate-300 hover:bg-slate-800'
            }`}
          >
            {!isAudioMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{!isAudioMuted ? 'Sound On' : 'Muted'}</span>
          </button>
        </div>

        {/* Security / Lock */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">Access lock</span>
          <button
            type="button"
            onClick={handleLock}
            className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-950/40 text-xs flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Chamber</span>
          </button>
        </div>
      </div>
    </div>
  );
};
