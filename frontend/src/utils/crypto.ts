/**
 * Client-side cryptographic helper utilities using the Web Crypto API
 */

export async function sha256Client(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function formatHash(hash: string, lead = 8, trail = 8): string {
  if (!hash) return '';
  if (hash.length <= lead + trail) return hash;
  return `${hash.slice(0, lead)}...${hash.slice(-trail)}`;
}

export function verifyClientBlockIntegrity(
  block: {
    index: number;
    timestamp: number;
    prev_hash: string;
    event_type: string;
    agent_source: string;
    payload: any;
    nonce: number;
    block_hash: string;
  }
): Promise<boolean> {
  const payloadJson = JSON.stringify(block.payload, Object.keys(block.payload).sort(), 0);
  // Canonical string matching Python backend
  const rawString = `${block.index}|${block.timestamp.toFixed(6)}|${block.prev_hash}|${block.event_type}|${block.agent_source}|${payloadJson}|${block.nonce}`;
  return sha256Client(rawString).then(computed => computed === block.block_hash);
}

