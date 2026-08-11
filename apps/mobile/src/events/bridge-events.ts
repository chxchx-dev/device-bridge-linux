import { BRIDGE_BASE_URL } from '../config';
import type { StoredSession } from '../security/credential-store';
import type { CodexTaskEvent } from '../api/bridge-client';

export type BridgeEvent = { type?: string; payload?: { actionId?: string; requestId?: string; [key: string]: unknown } };

export function isCodexTaskEvent(value: unknown): value is CodexTaskEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<CodexTaskEvent>;
  return typeof event.eventId === 'string' && typeof event.threadId === 'string' && typeof event.kind === 'string' && typeof event.summary === 'string' && typeof event.createdAt === 'string';
}

export function connectBridgeEvents(session: StoredSession, onEvent: (event: BridgeEvent) => void): () => void {
  const socketUrl = `${BRIDGE_BASE_URL.replace(/^https:/, 'wss:')}/v1/ws`;
  const socket = new WebSocket(socketUrl, [], {
    headers: {
      authorization: `Bearer ${session.deviceToken}`,
      'x-devicebridge-device': session.deviceId,
    },
  });
  socket.onmessage = (message) => {
    try { onEvent(JSON.parse(message.data) as BridgeEvent); } catch { /* Ignore malformed events. */ }
  };
  socket.onerror = () => socket.close();
  return () => socket.close();
}
