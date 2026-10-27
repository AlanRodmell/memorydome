import * as THREE from 'three';

export interface PhotoMeta {
  day: number;
  position: THREE.Vector3;
  azimuth: number;
  elevation: number;
  tileW: number;
  tileH: number;
  img: HTMLImageElement | null;
  texture?: THREE.Texture | null;
  filename?: string;
  ringIndex?: number;
}

export interface DomeManifest {
  version?: string;
  rings: number;
  files: string[];
}

export interface TapestryRing {
  ringIndex: number;
  latDeg: number;
  latRad: number;
  weight: number;
  count: number;
}
