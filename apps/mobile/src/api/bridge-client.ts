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

export type ActionChallenge = { challengeId: string; actionId: string; expiresAt: string };
export type Mode = 'dev' | 'game';
export type ModeStatus = { mode: Mode | null; transitioning: boolean };
export type IntegrationStatus = {
  kdeConnect: { available: boolean; pairedReachable: boolean; deviceCount: number };
  adb: { available: boolean; connected: boolean; deviceCount: number };
  scrcpy: { available: boolean; version: string | null };
  sunshine: { available: boolean; active: boolean };
};
export type CodexGatewayStatus = {
  enabled: boolean;
  mode: 'disabled' | 'sdk' | 'app-server';
  connected: boolean;
  cliVersion: string | null;
};
export type CodexThreadMetadata = {
  threadId: string;
  projectPath: string;
  title: string | null;
  status: 'idle' | 'running' | 'waiting-approval' | 'completed' | 'failed';
  lastEventAt: string;
  createdAt: string;
};
export type CodexApprovalMetadata = { approvalId: string; method: string; threadId: string | null; turnId: string | null; itemId: string | null; kind: 'command' | 'file-change' | 'permissions' | 'other'; cwd: string | null; summary: string; reason: string | null; risk: 'R1' | 'R2' | 'R3'; createdAt: string };

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

  getIntegrationStatus(session: StoredSession): Promise<{ result: IntegrationStatus }> {
    return this.request('/v1/actions/integrations.status', session, { method: 'POST', body: JSON.stringify({ input: {} }) });
  }

  getModeStatus(session: StoredSession): Promise<{ result: ModeStatus }> {
    return this.request('/v1/actions/mode.status', session, { method: 'POST', body: JSON.stringify({ input: {} }) });
  }

  getCodexStatus(session: StoredSession): Promise<{ result: CodexGatewayStatus }> {
    return this.request('/v1/actions/codex.status', session, { method: 'POST', body: JSON.stringify({ input: {} }) });
  }

  getCodexThreads(session: StoredSession): Promise<{ result: CodexThreadMetadata[] }> {
    return this.request('/v1/actions/codex.threads.list', session, { method: 'POST', body: JSON.stringify({ input: {} }) });
  }

  startCodexThread(session: StoredSession, projectId: string, title: string | null, challengeId: string): Promise<{ result: CodexThreadMetadata }> {
    return this.request('/v1/actions/codex.thread.start', session, { method: 'POST', body: JSON.stringify({ input: { projectId, title }, confirmation: { challengeId } }) });
  }

  startCodexTurn(session: StoredSession, threadId: string, prompt: string, challengeId: string): Promise<unknown> {
    return this.request('/v1/actions/codex.turn.start', session, { method: 'POST', body: JSON.stringify({ input: { threadId, prompt }, confirmation: { challengeId } }) });
  }

  getCodexApprovals(session: StoredSession): Promise<{ result: CodexApprovalMetadata[] }> {
    return this.request('/v1/actions/codex.approvals.list', session, { method: 'POST', body: JSON.stringify({ input: {} }) });
  }

  respondCodexApproval(session: StoredSession, approvalId: string, decision: 'approve' | 'deny', challengeId: string): Promise<unknown> {
    return this.request('/v1/actions/codex.approval.respond', session, { method: 'POST', body: JSON.stringify({ input: { approvalId, decision }, confirmation: { challengeId } }) });
  }

  switchMode(session: StoredSession, target: Mode, challengeId: string): Promise<{ result: ModeStatus }> {
    return this.request('/v1/actions/mode.switch', session, {
      method: 'POST',
      body: JSON.stringify({ input: { target }, confirmation: { challengeId } }),
    });
  }

  getChallenge(session: StoredSession, actionId: string): Promise<ActionChallenge> {
    return this.request(`/v1/actions/${encodeURIComponent(actionId)}/challenge`, session);
  }

  runAction(session: StoredSession, actionId: string, challengeId: string | null = null): Promise<unknown> {
    return this.request(`/v1/actions/${encodeURIComponent(actionId)}`, session, {
      method: 'POST',
      body: JSON.stringify({ input: {}, confirmation: challengeId ? { challengeId } : undefined }),
    });
  }
}
