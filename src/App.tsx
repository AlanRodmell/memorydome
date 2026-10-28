import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Settings,
  Compass,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Layers,
  X,
  Play,
  Square,
} from 'lucide-react';
import { DomeCanvas } from './components/DomeCanvas';
import { PhotoModal } from './components/PhotoModal';
import { AccessGate } from './components/AccessGate';
import { SettingsModal } from './components/SettingsModal';
import {
  DEFAULT_DOME_URL,
  EXTERNAL_DOME_URL,
  ACCESS_KEY,
  INITIAL_MANIFEST_FILES,
  fetchDomeManifest,
} from './services/memoryDomeService';

export type SphereMode = 'adaptive' | 'sparse750' | 'repeated750';

export default function App() {
  // Connection and manifest state
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_DOME_URL);
  const [photoFiles, setPhotoFiles] = useState<string[]>(INITIAL_MANIFEST_FILES);
  const [photoVersion, setPhotoVersion] = useState<string | undefined>('2026-10-27');

  // Sphere Display Mode:
  // - 'adaptive': exactly sized to the 86 photos (0 duplicates, full 360° coverage)
  // - 'sparse750': 750 slots, photos 1-86 filled, 87-750 empty apertures (0 duplicates)
  // - 'repeated750': 750 slots, loops photos to create a continuous mosaic
  const [sphereMode, setSphereMode] = useState<SphereMode>('adaptive');

  // Authentication access gate state
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);

  // 360° Sphere interaction state
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(1);
  const [seamsVisible, setSeamsVisible] = useState<boolean>(true);
  const [currentZoomFov, setCurrentZoomFov] = useState<number>(62);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [flyToTargetDay, setFlyToTargetDay] = useState<number | null>(null);
  const [currentDayInput, setCurrentDayInput] = useState<number>(1);
  const [sliderDay, setSliderDay] = useState<number>(1);

  // Loading progress
  const [photosLoadedCount, setPhotosLoadedCount] = useState<number>(0);
  const [loadingPhotosMsg, setLoadingPhotosMsg] = useState<string | null>(null);

  // Modals & UI Controls
  const [isTitleDismissed, setIsTitleDismissed] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Observatory Telemetry & Tour state
  const [telemetry, setTelemetry] = useState<{ azimuth: number; elevation: number }>({ azimuth: 180, elevation: 10 });
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const tourIndexRef = useRef<number>(0);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reference to DomeCanvas fly function
  const flyToRef = useRef<((day: number, zoomFov?: number) => void) | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Sync initial credentials
  useEffect(() => {
    try {
      localStorage.setItem(ACCESS_KEY, '8e97b489501b5774f6bc8c1e4e266cf8865bcb988d166775b2c8e39714d7817b');
    } catch {
      // ignore
    }
  }, []);

  // Fetch fresh manifest in background
  const loadManifest = useCallback(async (sourceUrl: string) => {
    try {
      const manifest = await fetchDomeManifest(sourceUrl);
      if (manifest.files && manifest.files.length > 0) {
        setPhotoFiles(manifest.files);
      }
      if (manifest.version) {
        setPhotoVersion(manifest.version);
      }
    } catch (err) {
      console.warn('Background manifest refresh notice:', err);
    }
  }, []);

  useEffect(() => {
    loadManifest(baseUrl);
  }, [baseUrl, loadManifest]);

  // Derived sphere geometry based on mode
  const effectiveTotalPhotos =
    sphereMode === 'adaptive' ? (photoFiles.length || 86) : 750;

  const effectiveNumRings =
    sphereMode === 'adaptive' ? 11 : 25;

  const effectiveLoopMemories =
    sphereMode === 'repeated750';

  // Handle URL deep link (?day=42)
  useEffect(() => {
    if (photoFiles.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day');
    if (dayParam) {
      const dayNum = parseInt(dayParam, 10);
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= effectiveTotalPhotos) {
        setTimeout(() => {
          handleFlyToDay(dayNum, 28);
          setSelectedDay(dayNum);
        }, 800);
      }
    }
  }, [photoFiles.length, effectiveTotalPhotos]);

  // Reset slider clamp if mode changes
  useEffect(() => {
    if (sliderDay > effectiveTotalPhotos) {
      setSliderDay(effectiveTotalPhotos);
      setCurrentDayInput(effectiveTotalPhotos);
    }
  }, [effectiveTotalPhotos, sliderDay]);

  // Handle fly to day
  const handleFlyToDay = (day: number, zoomFov = 28) => {
    const clamped = Math.max(1, Math.min(effectiveTotalPhotos, Math.round(day)));
    setAutoOrbit(false);
    setCurrentDayInput(clamped);
    setSliderDay(clamped);
    setFlyToTargetDay(clamped);
    if (flyToRef.current) {
      flyToRef.current(clamped, zoomFov);
    }
  };

  // Look Zenith (straight up to Keystone #1, +90° elevation)
  const handleLookZenith = () => {
    handleFlyToDay(1, 24);
    showToast('Looking Zenith (+90°): Keystone #1 overhead');
  };

  // Look Horizon Equator (level view, 0° elevation)
  const handleLookEquator = () => {
    handleFlyToDay(Math.round(effectiveTotalPhotos / 2), 52);
    showToast('Looking Horizon (0°): Equator band');
  };

  // Look Nadir (straight down to bottom Keystone, -90° elevation)
  const handleLookNadir = () => {
    handleFlyToDay(effectiveTotalPhotos, 24);
    showToast(`Looking Nadir (-90°): Keystone #${effectiveTotalPhotos} below`);
  };

  // Reset view to horizon
  const handleResetView = () => {
    handleFlyToDay(Math.round(effectiveTotalPhotos / 2), 62);
    setAutoOrbit(true);
    showToast('Reset view to horizon');
  };

  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Cycle orbit speeds: 0.5x (Gentle) -> 1x (Normal) -> 2x (Brisk) -> -1x (Reverse)
  const orbitSpeeds = [0.5, 1, 2, -1];
  const handleCycleOrbitSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIdx = orbitSpeeds.indexOf(orbitSpeed);
    const nextSpeed = orbitSpeeds[(currentIdx + 1) % orbitSpeeds.length];
    setOrbitSpeed(nextSpeed);
    if (!autoOrbit) setAutoOrbit(true);
    const label = nextSpeed === -1 ? 'Reverse (-1x)' : `${nextSpeed}x`;
    showToast(`Orbit speed: ${label}`);
  };

  // Global Keyboard Shortcuts (Space for orbit, +/- for zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setAutoOrbit((prev) => {
          const next = !prev;
          showToast(next ? `Auto-Orbit resumed (${orbitSpeed === -1 ? 'Rev' : `${orbitSpeed}x`})` : 'Auto-Orbit paused');
          return next;
        });
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key.toLowerCase() === 't') {
        handleToggleTour();
      } else if (e.key.toLowerCase() === 'z') {
        handleLookZenith();
      } else if (e.key.toLowerCase() === 'e') {
        handleLookEquator();
      } else if (e.key.toLowerCase() === 'n') {
        handleLookNadir();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orbitSpeed, currentZoomFov, currentDayInput, effectiveTotalPhotos, isTourActive]);

  // Guided Cinematic Tour Effect
  useEffect(() => {
    if (!isTourActive) return;

    const tourWaypoints = [
      { day: 1, label: 'Zenith Keystone overhead (+90°)', zoom: 24 },
      { day: Math.round(effectiveTotalPhotos * 0.22), label: 'Northern Sky Constellation', zoom: 34 },
      { day: Math.round(effectiveTotalPhotos * 0.50), label: 'Equator Horizon Band (0°)', zoom: 44 },
      { day: Math.round(effectiveTotalPhotos * 0.78), label: 'Southern Sky Cluster', zoom: 34 },
      { day: effectiveTotalPhotos, label: 'Nadir Keystone (-90° elevation)', zoom: 24 },
      { day: Math.round(effectiveTotalPhotos * 0.36), label: 'Upper Sky Panorama', zoom: 38 },
      { day: Math.round(effectiveTotalPhotos * 0.64), label: 'Lower Sky Horizon', zoom: 38 },
    ];

    const advanceTour = () => {
      const idx = tourIndexRef.current % tourWaypoints.length;
      const wp = tourWaypoints[idx];
      tourIndexRef.current = idx + 1;
      handleFlyToDay(wp.day, wp.zoom);
      showToast(`Cinematic Tour (${idx + 1}/${tourWaypoints.length}): ${wp.label}`);
    };

    advanceTour();
    const interval = setInterval(advanceTour, 5800);
    return () => clearInterval(interval);
  }, [isTourActive, effectiveTotalPhotos]);

  const handleToggleTour = () => {
    setIsTourActive((prev) => {
      const next = !prev;
      if (next) {
        setAutoOrbit(false);
        showToast('Starting Cinematic Guided Tour');
      } else {
        showToast('Tour paused');
      }
      return next;
    });
  };

  // Cycle sphere display mode
  const handleCycleSphereMode = () => {
    if (sphereMode === 'adaptive') {
      setSphereMode('sparse750');
      showToast('750 Grid: Photos 1-86 unique, 87-750 empty apertures');
    } else if (sphereMode === 'sparse750') {
      setSphereMode('repeated750');
      showToast('750 Grid: Looped mosaic fill');
    } else {
      setSphereMode('adaptive');
      showToast(`Unique Mode: Exact ${photoFiles.length} photos (0 duplicates)`);
    }
  };

  // Zoom buttons
  const handleZoomIn = () => {
    const newFov = Math.max(16, currentZoomFov - 8);
    setCurrentZoomFov(newFov);
    if (flyToRef.current && currentDayInput) {
      flyToRef.current(currentDayInput, newFov);
    }
  };

  const handleZoomOut = () => {
    const newFov = Math.min(78, currentZoomFov + 8);
    setCurrentZoomFov(newFov);
    if (flyToRef.current && currentDayInput) {
      flyToRef.current(currentDayInput, newFov);
    }
  };

  const zoomFactor = (62 / currentZoomFov).toFixed(1);

  // Region label for the slider
  const getRegionLabel = (val: number) => {
    if (val === 1) return 'Zenith (Above)';
    if (val === effectiveTotalPhotos) return 'Nadir (Below)';
    if (val < effectiveTotalPhotos * 0.38) return 'Upper Sky';
    if (val < effectiveTotalPhotos * 0.62) return 'Equator';
    return 'Lower Sky';
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#03050c]">
      {/* 360° Spherical Canvas */}
      <DomeCanvas
        photoFiles={photoFiles}
        photoVersion={photoVersion}
        baseUrl={baseUrl}
        numRings={effectiveNumRings}
        totalPhotos={effectiveTotalPhotos}
        autoOrbit={autoOrbit}
        orbitSpeed={orbitSpeed}
        seamsVisible={seamsVisible}
        loopMemories={effectiveLoopMemories}
        targetDay={flyToTargetDay}
        onSelectPhoto={(day) => {
          setSelectedDay(day);
          setCurrentDayInput(day);
          setSliderDay(day);
        }}
        onLoadingProgress={(done, total) => {
          setPhotosLoadedCount(done);
          if (done < total) {
            setLoadingPhotosMsg(`Weaving 360° sphere: ${done}/${total} tiles`);
          } else {
            setLoadingPhotosMsg(null);
          }
        }}
        onFovChange={(fov) => setCurrentZoomFov(fov)}
        currentZoom={currentZoomFov}
        onRegisterFlyTo={(fn) => {
          flyToRef.current = fn;
        }}
        onCoordinatesChange={(azimuth, elevation) => {
          setTelemetry({ azimuth, elevation });
        }}
        onInteractionStart={() => {
          if (isTourActive) {
            setIsTourActive(false);
            showToast('Tour paused by interaction');
          }
        }}
      />

      {/* Access Gate Lock Modal (Only if locked explicitly) */}
      <AccessGate
        isOpen={!isUnlocked}
        onUnlocked={() => {
          setIsUnlocked(true);
          showToast('Welcome to the 360° Memory Chamber');
        }}
      />

      {/* Top Header Bar */}
      <header className="fixed top-3 left-3 right-3 sm:top-5 sm:left-6 sm:right-6 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Brand & Status Pill - Dismissable */}
        {!isTitleDismissed ? (
          <div className="glass-panel px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center gap-3 sm:gap-3.5 pointer-events-auto shadow-2xl transition-all">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-sky-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 fill-current" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="serif-font text-lg sm:text-2xl font-semibold tracking-wide text-amber-100 leading-none">
                  Cerebro 360° Memory Sphere
                </h1>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-medium">
                  {sphereMode === 'adaptive' ? `${effectiveTotalPhotos} Unique` : `${effectiveTotalPhotos} Slots`}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-300/80">
                <span className="hidden sm:inline">Linked to Alan&apos;s Memory Dome</span>
                <a
                  href={EXTERNAL_DOME_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 text-[11px]"
                  title="Open GitHub source page"
                >
                  <span>alanrodmell.github.io/memorydome</span>
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => {
                setIsTitleDismissed(true);
                showToast('Title box dismissed');
              }}
              className="ml-1 sm:ml-2 p-1.5 rounded-xl text-slate-400 hover:text-amber-200 hover:bg-slate-800/80 transition-colors flex items-center justify-center shrink-0"
              title="Dismiss title box"
              aria-label="Dismiss title box"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsTitleDismissed(false);
              showToast('Title box restored');
            }}
            className="glass-panel px-3 py-2 rounded-xl flex items-center gap-2 pointer-events-auto shadow-lg hover:bg-slate-800/90 transition text-amber-200 text-xs font-medium"
            title="Show title and dome info"
            aria-label="Show title box"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="font-semibold text-amber-100 hidden sm:inline">Cerebro 360°</span>
          </button>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Mode Selector Pill */}
          <button
            onClick={handleCycleSphereMode}
            className={`glass-pill hover:bg-slate-800/90 transition px-3 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 text-xs font-medium ${
              sphereMode === 'adaptive'
                ? 'text-amber-300 border border-amber-400/50 bg-amber-400/10'
                : sphereMode === 'sparse750'
                ? 'text-sky-300 border border-sky-400/40'
                : 'text-purple-300 border border-purple-400/40'
            }`}
            title="Click to cycle mode: Unique (86) / 750 (No Duplicates) / 750 (Repeated)"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="font-semibold">
              {sphereMode === 'adaptive' && `Unique (${photoFiles.length})`}
              {sphereMode === 'sparse750' && '750 (No Dups)'}
              {sphereMode === 'repeated750' && '750 (Looped)'}
            </span>
          </button>

          {/* Auto Orbit & Speed Control */}
          <div className="glass-pill flex items-center p-0.5 sm:p-1 rounded-xl">
            <button
              onClick={() => {
                const next = !autoOrbit;
                setAutoOrbit(next);
                showToast(next ? `Auto-Orbit resumed (${orbitSpeed === -1 ? 'Rev' : `${orbitSpeed}x`})` : 'Auto-Orbit paused');
              }}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition"
              title="Toggle rotation (or press Spacebar)"
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  autoOrbit ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="hidden sm:inline">Orbit</span>
            </button>

            {/* Orbit Speed Badge */}
            <button
              onClick={handleCycleOrbitSpeed}
              className="px-2 py-0.5 sm:py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/30 text-amber-300 font-mono text-[11px] font-bold border border-amber-400/30 transition hover:border-amber-300 ml-0.5"
              title="Cycle Orbit Speed: 0.5x (Gentle) → 1x (Normal) → 2x (Brisk) → Reverse (-1x)"
            >
              {orbitSpeed === -1 ? '◀ Rev' : `${orbitSpeed}x`}
            </button>
          </div>

          {/* Guided Cinematic Tour Button */}
          <button
            onClick={handleToggleTour}
            className={`glass-pill hover:bg-slate-800/90 transition px-3 py-2 sm:py-2.5 rounded-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium ${
              isTourActive
                ? 'text-amber-300 border border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/25 ring-1 ring-amber-400/50'
                : 'text-slate-200 hover:text-white'
            }`}
            title="Auto-guided cinematic tour of celestial landmarks (Shortcut: T)"
          >
            {isTourActive ? (
              <Square className="w-3.5 h-3.5 text-amber-400 fill-current animate-pulse" />
            ) : (
              <Play className="w-3.5 h-3.5 text-amber-300 fill-current" />
            )}
            <span className="hidden sm:inline">Tour</span>
          </button>

          {/* Seams Toggle */}
          <button
            onClick={() => {
              setSeamsVisible(!seamsVisible);
              showToast(seamsVisible ? 'Seam lines hidden' : 'Seam lines visible');
            }}
            className={`glass-pill hover:bg-slate-800/90 transition p-2 sm:p-2.5 rounded-xl ${
              seamsVisible ? 'text-amber-300 border border-amber-400/40' : 'text-slate-400'
            }`}
            title="Toggle celestial seam rings and meridians"
          >
            <Compass className="w-4 h-4" />
          </button>

          {/* Reset View Button */}
          <button
            onClick={handleResetView}
            className="glass-pill hover:bg-slate-800/90 transition p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-white"
            title="Reset camera to horizon"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            className="glass-pill hover:bg-slate-800/90 transition p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-white hidden sm:flex"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="glass-pill hover:bg-slate-800/90 transition p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-white"
            title="Sphere Settings & Source Link"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Progress banner */}
      {loadingPhotosMsg && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none glass-pill px-3.5 py-1.5 rounded-full text-[11px] text-amber-200 border border-amber-400/20 shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>{loadingPhotosMsg}</span>
        </div>
      )}

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300 animate-fadeIn">
          <div className="glass-panel px-4 py-2 rounded-full border border-amber-400/50 text-xs sm:text-sm text-amber-100 shadow-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar: Vertical 3D Directional Controls */}
      <footer className="fixed bottom-3 left-3 right-3 sm:bottom-5 sm:left-6 sm:right-6 z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pointer-events-none">
        {/* Jump & Vertical Spherical Slider */}
        <div className="glass-panel px-4 py-3 rounded-2xl flex-1 max-w-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pointer-events-auto">
          {/* Direct Jump Input */}
          <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-amber-300/90 font-semibold">
              Jump:
            </span>
            <div className="flex items-center bg-slate-900/90 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-xs text-slate-400 mr-1">#</span>
              <input
                type="number"
                min={1}
                max={effectiveTotalPhotos}
                value={currentDayInput}
                onChange={(e) => setCurrentDayInput(parseInt(e.target.value, 10) || 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFlyToDay(currentDayInput);
                  }
                }}
                className="w-12 bg-transparent text-amber-300 font-bold text-xs focus:outline-none text-center"
                aria-label="Photo number"
              />
            </div>
            <button
              onClick={() => handleFlyToDay(currentDayInput)}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition shadow"
            >
              Go
            </button>
          </div>

          {/* Sphere Elevation Slider */}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={effectiveTotalPhotos}
              value={sliderDay}
              onChange={(e) => {
                const day = parseInt(e.target.value, 10);
                setSliderDay(day);
                setCurrentDayInput(day);
                handleFlyToDay(day);
              }}
              className="w-full accent-amber-400 cursor-pointer"
              aria-label="Spherical latitude slider"
            />
            <div className="text-right shrink-0">
              <span className="text-xs font-mono text-amber-300 font-bold block">
                #{sliderDay}
              </span>
              <span className="text-[9px] text-slate-400 block -mt-0.5">
                {getRegionLabel(sliderDay)}
              </span>
            </div>
          </div>
        </div>

        {/* 360° Spherical Quick Navigation Buttons (Zenith / Horizon / Nadir), Telemetry & Zoom */}
        <div className="glass-panel px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl flex items-center justify-between sm:justify-end gap-2 pointer-events-auto">
          {/* Subtle Celestial Coordinates Telemetry Readout */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-[11px] font-mono text-slate-300 shrink-0"
            title="Current celestial observatory coordinates: Azimuth (horizontal 0–360°) and Elevation (vertical -90° to +90°)"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Az {telemetry.azimuth}°</span>
            <span className="text-slate-600">•</span>
            <span className={telemetry.elevation >= 0 ? 'text-amber-300 font-semibold' : 'text-sky-300 font-semibold'}>
              El {telemetry.elevation >= 0 ? `+${telemetry.elevation}` : telemetry.elevation}°
            </span>
          </div>

          <div className="h-5 w-px bg-slate-700/80 mx-1 hidden md:block" />

          {/* Look Zenith (Straight Up) */}
          <button
            onClick={handleLookZenith}
            className="px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-200 text-xs font-medium transition flex items-center gap-1"
            title="Look straight up at Zenith Keystone #1 (+90°)"
          >
            <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Zenith</span>
            <span>✨</span>
          </button>

          {/* Look Equator (Horizon) */}
          <button
            onClick={handleLookEquator}
            className="px-2.5 py-1.5 rounded-xl glass-pill hover:bg-slate-800 text-slate-200 text-xs font-medium transition flex items-center gap-1"
            title="Look level at equator horizon (0°)"
          >
            <Compass className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Equator</span>
          </button>

          {/* Look Nadir (Straight Down) */}
          <button
            onClick={handleLookNadir}
            className="px-2.5 py-1.5 rounded-xl bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/30 text-sky-200 text-xs font-medium transition flex items-center gap-1"
            title={`Look straight down at Nadir Keystone #${effectiveTotalPhotos} (-90°)`}
          >
            <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Nadir</span>
            <span>🌌</span>
          </button>

          <div className="h-5 w-px bg-slate-700/80 mx-1 hidden sm:block" />

          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl glass-pill hover:bg-slate-800 flex items-center justify-center text-slate-200 font-bold text-base"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs font-mono text-amber-300 w-11 text-center">
            {zoomFactor}x
          </span>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl glass-pill hover:bg-slate-800 flex items-center justify-center text-slate-200 font-bold text-base"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </footer>

      {/* Photo Modal */}
      <PhotoModal
        day={selectedDay}
        totalPhotos={effectiveTotalPhotos}
        photoFiles={photoFiles}
        photoVersion={photoVersion}
        baseUrl={baseUrl}
        loopMemories={effectiveLoopMemories}
        onClose={() => setSelectedDay(null)}
        onNavigate={(newDay) => {
          setSelectedDay(newDay);
          handleFlyToDay(newDay);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        baseUrl={baseUrl}
        onUpdateBaseUrl={(newUrl) => {
          setBaseUrl(newUrl);
          loadManifest(newUrl);
        }}
        totalLoaded={photosLoadedCount}
        totalPhotos={photoFiles.length}
        version={photoVersion}
        onRelock={() => setIsUnlocked(false)}
      />
    </div>
  );
}
