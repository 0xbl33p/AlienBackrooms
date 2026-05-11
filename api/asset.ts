// Edge function that proxies images and PDFs from war.gov.
//
// Akamai blocks cross-site requests from the browser, so the client cannot
// load <img src="https://www.war.gov/..."> directly. This proxy refetches
// with same-origin-looking headers and streams the response back, allowing
// our client to load PURSUE archive assets via /api/asset?u=...

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = new Set(['www.war.gov', 'war.gov']);

function upstreamHeaders(dest: 'image' | 'document'): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      dest === 'image'
        ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        : 'application/pdf,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.war.gov/UFO/',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': dest === 'image' ? 'no-cors' : 'navigate',
    'Sec-Fetch-Dest': dest,
    ...(dest === 'document' ? { 'Sec-Fetch-User': '?1' } : {}),
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const u = new URL(req.url);
  const target = u.searchParams.get('u');
  if (!target) {
    return new Response('Missing ?u', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response('Host not allowed', { status: 400 });
  }

  const isPdf = parsed.pathname.toLowerCase().endsWith('.pdf');
  const dest = isPdf ? 'document' : 'image';

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: upstreamHeaders(dest),
      redirect: 'follow',
    });
  } catch (e) {
    return new Response(`Upstream unreachable: ${(e as Error).message}`, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream ${upstream.status}`, { status: 502 });
  }

  const headers = new Headers();
  const ct = upstream.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);
  const cl = upstream.headers.get('Content-Length');
  if (cl) headers.set('Content-Length', cl);
  headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  return new Response(upstream.body, { status: 200, headers });
}
