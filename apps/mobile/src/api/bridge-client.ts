import { BRIDGE_BASE_URL } from '../config';
import type { StoredSession } from '../security/credential-store';

export type DeviceStatus = {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpuCount: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
};

export type Action = {
  id: string;
  risk: string;
  capability: string;
  enabledByDefault: boolean;
  confirmation: string;
  description: string;
};

type ErrorBody = { error?: { message?: string } };

export class BridgeClient {
  constructor(private readonly baseUrl = BRIDGE_BASE_URL) {}

  private async request<T>(path: string, session: StoredSession, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${session.deviceToken}`);
    headers.set('x-devicebridge-device', session.deviceId);
    if (init.body) headers.set('content-type', 'application/json');
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body = await response.json() as T & ErrorBody;
    if (!response.ok) throw new Error(body.error?.message ?? `Bridge request failed (${response.status})`);
    return body;
  }

  async pair(deviceId: string, pairingToken: string): Promise<StoredSession> {
    const response = await fetch(`${this.baseUrl}/v1/pairing/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId, pairingToken }),
    });
    const body = await response.json() as { deviceId?: string; deviceToken?: string; error?: { message?: string } };
    if (!response.ok || !body.deviceId || !body.deviceToken) throw new Error(body.error?.message ?? 'Pairing failed');
    return { deviceId: body.deviceId, deviceToken: body.deviceToken };
  }

  getDevice(session: StoredSession): Promise<{ device: DeviceStatus }> {
    return this.request('/v1/device', session);
  }

  getActions(session: StoredSession): Promise<{ actions: Action[] }> {
    return this.request('/v1/actions', session);
  }
}
