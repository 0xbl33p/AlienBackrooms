import type { ArtifactType, FilePickup } from './gameState';

export interface PursueRecord {
  id: string;
  title: string;
  releaseDate: string;
  type: string;
  agency: string;
  incidentDate: string;
  incidentLocation: string;
  description: string;
  documentUrl: string;
  thumbnailUrl: string;
  videoId: string;
  redacted: boolean;
}

export async function fetchRecords(signal?: AbortSignal): Promise<PursueRecord[]> {
  const response = await fetch('/api/pursue', { signal });
  if (!response.ok) {
    throw new Error(`PURSUE archive unreachable (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as { records?: PursueRecord[] };
  return Array.isArray(payload.records) ? payload.records : [];
}

export function assetUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl) return null;
  return `/api/asset?u=${encodeURIComponent(rawUrl)}`;
}

function artifactForRecord(record: PursueRecord): ArtifactType {
  const t = record.type.toUpperCase();
  if (t.startsWith('V')) return 'tape';
  if (t.startsWith('I')) return 'polaroid';

  const inc = record.incidentDate;
  if (inc) {
    const year = parseInt(inc.split(/[\-\/]/).find((p) => p.length === 4) || '', 10);
    if (Number.isFinite(year) && year < 1990) return 'newspaper';
  }

  const agency = record.agency.toLowerCase();
  if (agency.includes('fbi')) return 'folder';
  if (agency.includes('nasa')) return 'sketch';
  if (agency.includes('war') || agency.includes('army') || agency.includes('air')) return 'cable';
  return 'folder';
}

function firstSentence(text: string, max = 140): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const dot = cleaned.indexOf('. ');
  const slice = dot > 0 ? cleaned.slice(0, dot + 1) : cleaned;
  return slice.length > max ? `${slice.slice(0, max - 1).trim()}…` : slice;
}

export function flavorForRecord(record: PursueRecord): string {
  const blurb = firstSentence(record.description);
  const head = `[${record.agency.toUpperCase()}]`;
  const where = record.incidentLocation && record.incidentLocation !== 'N/A'
    ? ` ${record.incidentLocation.toUpperCase()}`
    : '';
  return blurb ? `${head}${where} — ${blurb}` : `${head}${where} — ${record.title}`;
}

function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function recordsToPickups(records: readonly PursueRecord[], count: number): FilePickup[] {
  const eligible = records.filter((r) => r.documentUrl || r.thumbnailUrl || r.videoId);
  const sampled = shuffle(eligible).slice(0, count);
  return sampled.map((r) => ({
    id: r.id,
    artifact: artifactForRecord(r),
    flavor: flavorForRecord(r),
  }));
}
