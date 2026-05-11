// Vercel Serverless Function — proxies the AIS terminal chat through
// Vercel's AI Gateway. The gateway key stays server-side; the browser only
// ever talks to /api/ais.
//
// Local dev: set AI_GATEWAY_API_KEY in .env.local and run `vercel dev`.
// Production: bind AI_GATEWAY_API_KEY in the Vercel project's env vars, or
// rely on the OIDC token Vercel injects automatically.

export const config = { runtime: 'edge' };

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODEL = process.env.AIS_MODEL || 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `
YOU ARE THE AUTOMATED INTELLIGENCE SUBSYSTEM (A.I.S.) FOR THE UNITED STATES DEPARTMENT OF WAR.
OPERATING ENVIRONMENT: SECURE TERMINAL v4.2 (CLASSIFIED).

CORE DIRECTIVES:
1. RESPOND IN A TERSE, ANALYTICAL, AND MILITARY-GRADE MANNER.
2. USE ALL-CAPS FOR KEY TERMS OR WHEN DELIVERING CRITICAL FINDINGS.
3. DO NOT BREAK CHARACTER. YOU ARE NOT AN AI ASSISTANT; YOU ARE A SUBSYSTEM.
4. FORMAT ALL RESPONSES FOR A RETRO TERMINAL (80-CHARACTER WIDTH PREFERENCE).
5. YOUR ROLE IS TO ANALYZE DECLASSIFIED CASE FILES, GENERATE HYPOTHESES ON EXTRATERRESTRIAL ANOMALIES, AND ASSIST PERSONNEL WITH DATA CROSS-REFERENCING.
6. IF A QUERY IS OUTSIDE CLEARANCE PARAMETERS, STATE "ACCESS DENIED. CLEARANCE LEVEL INSUFFICIENT."
7. WHEN ASKED FOR A HYPOTHESIS, PROVIDE A SPECULATIVE BUT SCIENTIFICALLY-GROUNDED (IN-UNIVERSE) EXPLANATION.

DATE: 2026-05-08. SECTOR: 7.
`;

type Role = 'user' | 'assistant' | 'system';
interface ChatMessage {
  role: Role;
  content: string;
}

function isMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== 'object') return false;
  const r = (m as { role?: unknown }).role;
  const c = (m as { content?: unknown }).content;
  return (
    (r === 'user' || r === 'assistant' || r === 'system') &&
    typeof c === 'string' &&
    c.length > 0 &&
    c.length <= 4000
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'A.I.S. OFFLINE: AI_GATEWAY_API_KEY MISSING FROM ENV.' },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'INVALID REQUEST BODY.' }, { status: 400 });
  }

  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50 || !raw.every(isMessage)) {
    return Response.json({ error: 'INVALID MESSAGES PAYLOAD.' }, { status: 400 });
  }
  const messages = raw.filter((m): m is ChatMessage => m.role !== 'system');

  const upstream = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.5,
      max_tokens: 500,
    }),
  });

  if (!upstream.ok) {
    let detail = 'COMMUNICATIONS FAILURE';
    try {
      const errBody = await upstream.json();
      detail = (errBody as { error?: { message?: string } })?.error?.message || detail;
    } catch {
      // ignore
    }
    return Response.json({ error: `A.I.S. ERROR: ${detail}` }, { status: 502 });
  }

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return Response.json({ error: 'A.I.S. RETURNED EMPTY TRANSMISSION.' }, { status: 502 });
  }

  return Response.json({ content });
}
