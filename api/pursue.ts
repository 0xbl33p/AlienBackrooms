// Edge function that proxies the PURSUE archive CSV from war.gov, parses it,
// and returns a normalized JSON array of records.
//
// war.gov sits behind Akamai with a WAF that rejects requests unless they
// look like a same-origin fetch from /UFO/. The browser sets Sec-Fetch-* and
// Referer based on real origin, so a cross-site <fetch> from our site is
// 403'd. This function impersonates a same-origin fetch server-side, then
// serves the result back to our client.

export const config = { runtime: 'edge' };

const SOURCE_URL = 'https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-csv.csv';

const UPSTREAM_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/csv,*/*;q=0.9',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.war.gov/UFO/',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};

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

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      }
      if (c === '\r' && next === '\n') i++;
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function slugify(value: string, fallback: string): string {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function normalizeHeader(value: string): string {
  return String(value || '')
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase();
}

function recordsFromRows(rows: string[][]): PursueRecord[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const idx = (name: string) => headers.indexOf(normalizeHeader(name));

  const iRedaction = idx('Redaction');
  const iRelease = idx('Release Date');
  const iTitle = idx('Title');
  const iType = idx('Type');
  const iDesc = idx('Description Blurb');
  const iVideoId = idx('DVIDS Video ID');
  const iAgency = idx('Agency');
  const iIncidentDate = idx('Incident Date');
  const iIncidentLoc = idx('Incident Location');
  const iDoc = idx('PDF | Image Link');
  const iImage = idx('Modal Image');

  const out: PursueRecord[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const title = (cols[iTitle] || '').trim();
    if (!title) continue;

    const record: PursueRecord = {
      id: slugify(title, `record-${r}`),
      title,
      releaseDate: (cols[iRelease] || '').trim(),
      type: (cols[iType] || '').trim().toUpperCase(),
      agency: (cols[iAgency] || '').trim() || 'UNKNOWN',
      incidentDate: (cols[iIncidentDate] || '').trim(),
      incidentLocation: (cols[iIncidentLoc] || '').trim() || 'N/A',
      description: (cols[iDesc] || '').trim(),
      documentUrl: (cols[iDoc] || '').trim(),
      thumbnailUrl: (cols[iImage] || '').trim(),
      videoId: (cols[iVideoId] || '').trim(),
      redacted: ((cols[iRedaction] || '').trim().toLowerCase() === 'true'),
    };
    out.push(record);
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(SOURCE_URL, { headers: UPSTREAM_HEADERS });
  } catch (e) {
    return Response.json(
      { error: 'UPSTREAM UNREACHABLE', detail: (e as Error).message },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return Response.json(
      { error: `UPSTREAM ${upstream.status}` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  const records = recordsFromRows(parseCSV(text));

  return new Response(JSON.stringify({ records, count: records.length }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
