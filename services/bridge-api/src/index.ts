import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { ActionIdSchema, ActionRequestSchema, AuditEventSchema, DeviceIdSchema, PairingRequestSchema } from '@devicebridge/contracts';
import { actionRegistry } from '@devicebridge/command-registry';
import { authenticate, type AuthContext } from './auth.js';
import { PairingStore } from './pairing.js';
import { readDeviceStatus } from './system.js';
import { pairingPage } from './pairing-page.js';
import { ChallengeStore } from './challenges.js';
import { createSystemSessionAdapter, type SessionAdapter } from './system-actions.js';
import { readIntegrationStatus, type IntegrationStatus } from './integrations.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    authContext?: AuthContext;
  }
}

export interface AuditSink {
  append(event: unknown): void;
  events(): readonly unknown[];
}

class InMemoryAuditSink implements AuditSink {
  private readonly entries: unknown[] = [];

  append(event: unknown): void {
    const parsed = AuditEventSchema.parse(event);
    this.entries.push(parsed);
  }

  events(): readonly unknown[] {
    return this.entries;
  }
}

interface AuditDetails {
  actionId?: string | null;
  risk?: string | null;
  capability?: string | null;
  authorization?: 'granted' | 'denied' | 'not_required';
  executionStatus?: 'not_run' | 'completed' | 'failed';
  durationMs?: number;
}

function audit(request: { requestId: string; method: string; url: string; authContext?: AuthContext }, sink: AuditSink, outcome: 'accepted' | 'rejected' | 'failed', reason?: string, details: AuditDetails = {}): void {
  sink.append({
    timestamp: new Date().toISOString(),
    requestId: request.requestId,
    deviceId: request.authContext?.deviceId ?? null,
    method: request.method,
    path: request.url.split('?')[0],
    outcome,
    ...details,
    ...(reason ? { reason } : {}),
  });
}

class EventHub {
  private readonly clients = new Set<{ send(data: string): void }>();

  add(client: { send(data: string): void }): void { this.clients.add(client); }
  remove(client: { send(data: string): void }): void { this.clients.delete(client); }
  publish(type: string, payload: unknown): void {
    const event = JSON.stringify({ type, timestamp: new Date().toISOString(), payload });
    for (const client of this.clients) client.send(event);
  }
}

export interface AppOptions {
  store?: PairingStore;
  auditSink?: AuditSink;
  devToken?: string;
  devDeviceId?: string;
  pairingToken?: string;
  defaultCapabilities?: readonly string[];
  enableSystemLock?: boolean;
  challenges?: ChallengeStore;
  sessionAdapter?: SessionAdapter;
  integrationStatus?: () => Promise<IntegrationStatus>;
}

export function createApp(options: AppOptions = {}): FastifyInstance {
  const defaultCapabilities = options.defaultCapabilities ?? (process.env.DEVICEBRIDGE_DEFAULT_CAPABILITIES?.split(',').map((capability) => capability.trim()).filter(Boolean) ?? ['system:read', 'android:read', 'gaming:read']);
  const store = options.store ?? new PairingStore(defaultCapabilities);
  const auditSink = options.auditSink ?? new InMemoryAuditSink();
  const challenges = options.challenges ?? new ChallengeStore();
  const sessionAdapter = options.sessionAdapter ?? createSystemSessionAdapter();
  const enableSystemLock = options.enableSystemLock ?? process.env.DEVICEBRIDGE_ENABLE_SYSTEM_LOCK === 'true';
  const integrationStatus = options.integrationStatus ?? readIntegrationStatus;
  const devDeviceId = options.devDeviceId ?? process.env.DEVICEBRIDGE_DEVICE_ID;
  const devToken = options.devToken ?? process.env.DEVICEBRIDGE_DEV_TOKEN;
  const pairingToken = options.pairingToken ?? process.env.DEVICEBRIDGE_PAIRING_TOKEN;

  if (devDeviceId && devToken && DeviceIdSchema.safeParse(devDeviceId).success && devToken.length >= 24) {
    store.seedDevice(devDeviceId as `${string}`, devToken);
  }
  if (pairingToken && pairingToken.length >= 24) {
    store.issuePairingToken(pairingToken, Number(process.env.DEVICEBRIDGE_PAIRING_TTL_SECONDS ?? '600'));
  }

  const app = Fastify({ logger: true });
  const events = new EventHub();
  void app.register(websocket);
  app.decorate('devicebridgePairingStore', store);
  app.decorate('devicebridgeAuditSink', auditSink);

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = randomUUID();
    reply.header('X-Request-Id', request.requestId);
    if (request.url.split('?')[0] === '/health' || request.url.split('?')[0] === '/pair' || request.url.split('?')[0] === '/v1/pairing/complete') return;

    request.authContext = authenticate(request, store);
    if (!request.authContext) {
      audit(request, auditSink, 'rejected', 'unauthorized');
      return reply.code(401).send({ requestId: request.requestId, error: { code: 'UNAUTHORIZED', message: 'Valid paired DeviceBridge credential required' } });
    }
  });

  app.get('/health', async (request) => ({ requestId: request.requestId, status: 'ok', service: 'devicebridge' }));

  app.get('/pair', async (_request, reply) => reply.type('text/html; charset=utf-8').send(pairingPage));

  app.post('/v1/pairing/complete', async (request, reply) => {
    const bodyResult = PairingRequestSchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      audit(request, auditSink, 'rejected', 'invalid_pairing_payload');
      return reply.code(400).send({ requestId: request.requestId, error: { code: 'INVALID_INPUT', message: 'Invalid pairing payload' } });
    }
    const result = store.completePairing(bodyResult.data.deviceId, bodyResult.data.pairingToken);
    if (!result) {
      audit(request, auditSink, 'rejected', 'invalid_or_expired_pairing');
      return reply.code(401).send({ requestId: request.requestId, error: { code: 'PAIRING_DENIED', message: 'Pairing token is invalid, expired or already consumed' } });
    }
    audit(request, auditSink, 'accepted');
    return { requestId: request.requestId, ...result };
  });

  app.get('/v1/device', async (request) => {
    audit(request, auditSink, 'accepted');
    return { requestId: request.requestId, device: readDeviceStatus() };
  });

  app.get('/v1/actions', async (request) => {
    audit(request, auditSink, 'accepted');
    return { requestId: request.requestId, actions: Object.values(actionRegistry).map(({ id, risk, capability, enabledByDefault, confirmation, description }) => ({ id, risk, capability, enabledByDefault: id === 'system.lock' ? enableSystemLock : enabledByDefault, confirmation, description })) };
  });

  app.get('/v1/actions/:actionId/challenge', async (request, reply) => {
    const params = request.params as { actionId?: string };
    const idResult = ActionIdSchema.safeParse(params.actionId);
    if (!idResult.success) return reply.code(404).send({ requestId: request.requestId, error: { code: 'UNKNOWN_ACTION', message: 'Unknown action ID' } });
    const definition = actionRegistry[idResult.data];
    if (!request.authContext?.capabilities.includes(definition.capability)) {
      audit(request, auditSink, 'rejected', 'insufficient_capability', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'denied', executionStatus: 'not_run' });
      return reply.code(403).send({ requestId: request.requestId, error: { code: 'INSUFFICIENT_CAPABILITY', message: 'The paired device lacks the required capability' } });
    }
    if (definition.confirmation === 'none') return reply.code(400).send({ requestId: request.requestId, error: { code: 'CHALLENGE_NOT_REQUIRED', message: 'This action does not require confirmation' } });
    const challenge = challenges.issue(request.authContext.deviceId, definition.id);
    audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'not_run' });
    return { requestId: request.requestId, ...challenge, actionId: definition.id };
  });

  app.post('/v1/actions/:actionId', async (request, reply) => {
    const params = request.params as { actionId?: string };
    const idResult = ActionIdSchema.safeParse(params.actionId);
    if (!idResult.success) {
      audit(request, auditSink, 'rejected', 'unknown_action');
      return reply.code(404).send({ requestId: request.requestId, error: { code: 'UNKNOWN_ACTION', message: 'Unknown action ID' } });
    }
    const bodyResult = ActionRequestSchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      audit(request, auditSink, 'rejected', 'invalid_input');
      return reply.code(400).send({ requestId: request.requestId, error: { code: 'INVALID_INPUT', message: 'Invalid action payload' } });
    }
    const definition = actionRegistry[idResult.data];
    const enabled = definition.id === 'system.lock' ? enableSystemLock : definition.enabledByDefault;
    const hasCapability = request.authContext?.capabilities.includes(definition.capability) ?? false;
    if (!hasCapability) {
      audit(request, auditSink, 'rejected', 'insufficient_capability', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'denied', executionStatus: 'not_run' });
      return reply.code(403).send({ requestId: request.requestId, error: { code: 'INSUFFICIENT_CAPABILITY', message: 'The paired device lacks the required capability' } });
    }
    if (!enabled) {
      audit(request, auditSink, 'rejected', 'action_disabled', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'not_run' });
      return reply.code(403).send({ requestId: request.requestId, error: { code: 'ACTION_DISABLED', message: `${definition.id} is not enabled in the starter` } });
    }
    if (definition.confirmation !== 'none') {
      const challengeId = bodyResult.data.confirmation?.challengeId;
      if (!challengeId || !challenges.consume(request.authContext!.deviceId, definition.id, challengeId)) {
        audit(request, auditSink, 'rejected', 'confirmation_required', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'not_run' });
        return reply.code(409).send({ requestId: request.requestId, error: { code: 'CONFIRMATION_REQUIRED', message: 'A valid short-lived confirmation challenge is required' } });
      }
    }
    if (definition.id === 'system.status') {
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result: readDeviceStatus() };
    }
    if (definition.id === 'integrations.status') {
      const result = await integrationStatus();
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
    }
    if (definition.id === 'android.kdeconnect.status' || definition.id === 'android.adb.status' || definition.id === 'gaming.sunshine.status') {
      const result = await integrationStatus();
      const scopedResult = definition.id === 'android.kdeconnect.status' ? result.kdeConnect : definition.id === 'android.adb.status' ? result.adb : result.sunshine;
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result: scopedResult };
    }
    if (definition.id === 'system.lock') {
      const startedAt = performance.now();
      try {
        await sessionAdapter.lock();
        const durationMs = performance.now() - startedAt;
        audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs });
        events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
        return { requestId: request.requestId, actionId: definition.id, status: 'completed', result: null };
      } catch {
        const durationMs = performance.now() - startedAt;
        audit(request, auditSink, 'failed', 'adapter_failed', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'failed', durationMs });
        return reply.code(502).send({ requestId: request.requestId, error: { code: 'ADAPTER_FAILED', message: 'The system lock adapter failed' } });
      }
    }
    audit(request, auditSink, 'rejected', 'not_implemented', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'not_run' });
    return reply.code(501).send({ requestId: request.requestId, error: { code: 'NOT_IMPLEMENTED', message: 'Adapter not implemented' } });
  });

  app.get('/v1/ws', { websocket: true }, (socket, request) => {
    events.add(socket);
    socket.send(JSON.stringify({ type: 'bridge.connected', timestamp: new Date().toISOString(), payload: { requestId: request.requestId } }));
    socket.on('close', () => events.remove(socket));
  });

  return app;
}

const host = process.env.DEVICEBRIDGE_HOST ?? '127.0.0.1';
const port = Number(process.env.DEVICEBRIDGE_PORT ?? '8787');

if (process.env.NODE_ENV !== 'test') {
  createApp().listen({ host, port }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
