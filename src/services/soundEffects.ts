// Sound effects disabled per user preference
export function playChime(_freq?: number, _decay?: number) {}
export function playWhoosh() {}
export function toggleMute(_muted?: boolean): boolean {
  return true;
}
export function getIsMuted(): boolean {
  return true;
}
