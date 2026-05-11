export interface AISMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function queryAIS(messages: AISMessage[], signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/ais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });

  let payload: { content?: string; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    // fall through to status-based error below
  }

  if (!response.ok) {
    throw new Error(payload.error || `A.I.S. ERROR: HTTP ${response.status}`);
  }
  if (!payload.content) {
    throw new Error('A.I.S. RETURNED EMPTY TRANSMISSION.');
  }
  return payload.content;
}
