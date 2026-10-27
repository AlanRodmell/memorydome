// Subtle Web Audio synthesizer for cosmic Cerebro atmosphere

let audioCtx: AudioContext | null = null;
let ambientGain: GainNode | null = null;
let isMuted = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playChime(freq = 520, decay = 0.8) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.1);
  osc.frequency.exponentialRampToValueAtTime(freq, now + decay);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + decay);
}

export function playWhoosh() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.4);
  filter.Q.value = 3.0;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.4);
}

export function toggleMute(muted?: boolean): boolean {
  if (muted !== undefined) {
    isMuted = muted;
  } else {
    isMuted = !isMuted;
  }

  const ctx = getAudioContext();
  if (!ctx) return isMuted;

  if (isMuted) {
    if (ambientGain) {
      ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    }
  } else {
    if (!ambientGain) {
      startCosmicDrone(ctx);
    } else {
      ambientGain.gain.setTargetAtTime(0.025, ctx.currentTime, 0.5);
    }
    playChime(640, 1.2);
  }

  return isMuted;
}

function startCosmicDrone(ctx: AudioContext) {
  try {
    ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0.001, ctx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 2.0);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.value = 55; // A1 deep drone

    osc2.type = 'triangle';
    osc2.frequency.value = 110; // A2 harmonic

    filter.type = 'lowpass';
    filter.frequency.value = 180;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(ctx.destination);

    osc1.start();
    osc2.start();
  } catch (e) {
    console.warn('Audio drone failed to initialize', e);
  }
}

export function getIsMuted(): boolean {
  return isMuted;
}
