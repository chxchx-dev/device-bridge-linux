import { BRIDGE_BASE_URL } from '../config';
import type { StoredSession } from '../security/credential-store';

export type BridgeEvent = { type?: string; payload?: { actionId?: string; requestId?: string; [key: string]: unknown } };

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
