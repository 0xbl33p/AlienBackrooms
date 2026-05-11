export type ArtifactType = 'polaroid' | 'folder' | 'cable' | 'sketch' | 'newspaper' | 'tape';

export interface FilePickup {
  id: string;
  artifact: ArtifactType;
  flavor: string;
  exitHint?: string;
}

export const MAZE_PICKUP_COUNT = 14;
export const PICKUP_GRACE_SECONDS = 30;

export interface EscalationTier {
  threshold: number;
  lightsFailRatio: number;
  fogDensity: number;
  ambientBoost: number;
  mibActive: boolean;
  mibSpeed: number;
  mibCount: number;
}

export const ESCALATION: EscalationTier[] = [
  { threshold:   0, lightsFailRatio: 0.00, fogDensity: 0.060, ambientBoost: 1.0, mibActive: false, mibSpeed: 0,   mibCount: 0 },
  { threshold:  20, lightsFailRatio: 0.10, fogDensity: 0.075, ambientBoost: 1.1, mibActive: false, mibSpeed: 0,   mibCount: 0 },
  { threshold:  45, lightsFailRatio: 0.20, fogDensity: 0.090, ambientBoost: 1.3, mibActive: true,  mibSpeed: 1.8, mibCount: 1 },
  { threshold:  80, lightsFailRatio: 0.40, fogDensity: 0.110, ambientBoost: 1.6, mibActive: true,  mibSpeed: 2.4, mibCount: 2 },
  { threshold: 120, lightsFailRatio: 0.65, fogDensity: 0.140, ambientBoost: 2.0, mibActive: true,  mibSpeed: 3.2, mibCount: 3 },
];

export function tierForElapsed(seconds: number): EscalationTier {
  let t = ESCALATION[0];
  for (const e of ESCALATION) if (seconds >= e.threshold) t = e;
  return t;
}
