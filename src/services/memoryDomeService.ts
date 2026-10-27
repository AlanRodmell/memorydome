import { DomeManifest } from '../types/dome';

export function cleanBaseUrl(url: string): string {
  let cleaned = (url || '').trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

export function getDefaultDomeUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('github.io')) {
      const path = window.location.pathname.replace(/\/+$/, '');
      return path || '/memorydome';
    }
    const base = import.meta.env.BASE_URL || '/';
    return cleanBaseUrl(base);
  }
  return '';
}

export const DEFAULT_DOME_URL = getDefaultDomeUrl();
export const EXTERNAL_DOME_URL = 'https://alanrodmell.github.io/memorydome';
export const ACCESS_KEY = 'cerebro-access-v1';
export const ALLOWED_EMAIL_HASHES = [
  '8e97b489501b5774f6bc8c1e4e266cf8865bcb988d166775b2c8e39714d7817b', // alan.rodmell@gmail.com
];

export const INITIAL_MANIFEST_FILES = [
  "1762271434085.jpg",
  "1762410637985.jpg",
  "1762444210087.jpg",
  "1762585950015.jpg",
  "1762676539302.jpg",
  "1762754233637.jpg",
  "1762841133811.jpg",
  "1762927133073.jpg",
  "1763012823337.jpg",
  "1763100680585.jpg",
  "1763197194875.jpg",
  "1763281913156.jpg",
  "1763357546462.jpg",
  "1763445378891~2.jpg",
  "1763531225319.jpg",
  "1763618058128.jpg",
  "1763730193556.jpg",
  "1763795071856.jpg",
  "1763851330573.jpg",
  "1763963566801.jpg",
  "1764050476304.jpg",
  "1764155179340.jpg",
  "1764223993584.jpg",
  "1764309052390.jpg",
  "1764373125209.jpg",
  "1764491162997~2.jpg",
  "1764655557662.jpg",
  "1764741835691.jpg",
  "1764827933915.jpg",
  "1764916142260.jpg",
  "1765097814018.jpg",
  "1765173073775~2.jpg",
  "1765262984763.jpg",
  "1765521628570.jpg",
  "1765608501027.jpg",
  "1765699349144.jpg",
  "1765866555683.jpg",
  "1765950695668.jpg",
  "1766041224450.jpg",
  "1766123874630~2.jpg",
  "1766212212100.jpg",
  "1766305360628.jpg",
  "1766384213797.jpg",
  "1766555342276.jpg",
  "1766667647479.jpg",
  "1766734368150.jpg",
  "1766829541556~2.jpg",
  "1766911818761.jpg",
  "1767080621613.jpg",
  "1767165619745.jpg",
  "1767258957958.jpg",
  "1767518454553.jpg",
  "1767599083798.jpg",
  "1767685068517.jpg",
  "1767767478590.jpg",
  "1767850027563.jpg",
  "1767947905376.jpg",
  "1768033918775.jpg",
  "1768198895476.jpg",
  "1768285165841.jpg",
  "1768372397516.jpg",
  "1768462776900.jpg",
  "1768545495335.jpg",
  "1768634767747.jpg",
  "1768724039645.jpg",
  "1768803802976.jpg",
  "1768889199297.jpg",
  "1768976149633.jpg",
  "1787115394558~2.jpg",
  "1790051384125.jpg",
  "1790137573701.jpg",
  "1790227569521.jpg",
  "1791433643654.jpg",
  "1791614668592.jpg",
  "1791868027724.jpg",
  "1791953727191.jpg",
  "1792219124301.jpg",
  "1792347744980.jpg",
  "1792386790255.jpg",
  "1792645959446.jpg",
  "1792911860616.jpg",
  "1793081669036.jpg",
  "IMG-20260522-WA0000.jpg",
  "IMG-20260727-WA0000.jpg",
  "IMG-20260729-WA0000.jpg",
  "IMG-20260925-WA0000.jpg"
];

export async function sha256Hex(text: string): Promise<string> {
  const clean = text.trim().toLowerCase();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const buf = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(clean)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

export async function fetchDomeManifest(baseUrl: string = DEFAULT_DOME_URL): Promise<DomeManifest> {
  const cleaned = cleanBaseUrl(baseUrl);
  const candidateUrls = [
    cleaned ? `${cleaned}/photos/manifest.json` : '/photos/manifest.json',
    '/memorydome/photos/manifest.json',
    './photos/manifest.json',
    '/photos/manifest.json',
    `${EXTERNAL_DOME_URL}/photos/manifest.json`,
  ];
  const uniqueUrls = Array.from(new Set(candidateUrls.filter(Boolean)));

  for (const url of uniqueUrls) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        return {
          version: data.version ? String(data.version) : '2026-10-27',
          rings: Number.isInteger(data.rings) && data.rings >= 11 && data.rings <= 24 ? data.rings : 15,
          files: Array.isArray(data.files) && data.files.length > 0 ? data.files.filter((f: unknown) => typeof f === 'string') : INITIAL_MANIFEST_FILES,
        };
      }
    } catch {
      // try next
    }
  }

  // If network failed, return pristine pre-loaded manifest
  return {
    version: '2026-10-27',
    rings: 15,
    files: INITIAL_MANIFEST_FILES,
  };
}

export function getPhotoUrl(
  baseUrl: string,
  kind: 'thumbs' | 'full',
  filename: string,
  version?: string
): string {
  const cleaned = cleanBaseUrl(baseUrl);
  const v = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${cleaned}/photos/${kind}/${encodeURIComponent(filename)}${v}`;
}

export function parsePhotoDate(filename: string): string | null {
  try {
    const nameWithoutExt = filename.split('.')[0].replace(/~.*/, '');
    const ts = parseInt(nameWithoutExt, 10);
    if (!isNaN(ts) && ts > 1000000000000 && ts < 2500000000000) {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    const matchImg = filename.match(/IMG-(\d{4})(\d{2})(\d{2})/);
    if (matchImg) {
      const [, y, m, d] = matchImg;
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}
