import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { ActionIdSchema, ActionRequestSchema, AuditEventSchema, DeviceIdSchema, PairingRequestSchema } from '@devicebridge/contracts';
import { actionRegistry } from '@devicebridge/command-registry';
import { authenticate, type AuthContext } from './auth.js';
import { PairingStore } from './pairing.js';
import { readDeviceStatus } from './system.js';

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

function audit(request: { requestId: string; method: string; url: string; authContext?: AuthContext }, sink: AuditSink, outcome: 'accepted' | 'rejected' | 'failed', reason?: string): void {
  sink.append({
    timestamp: new Date().toISOString(),
    requestId: request.requestId,
    deviceId: request.authContext?.deviceId ?? null,
    method: request.method,
    path: request.url.split('?')[0],
    outcome,
    ...(reason ? { reason } : {}),
  });
}

export interface AppOptions {
  store?: PairingStore;
  auditSink?: AuditSink;
  devToken?: string;
  devDeviceId?: string;
  pairingToken?: string;
}

export function createApp(options: AppOptions = {}): FastifyInstance {
  const store = options.store ?? new PairingStore();
  const auditSink = options.auditSink ?? new InMemoryAuditSink();
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
  app.decorate('devicebridgePairingStore', store);
  app.decorate('devicebridgeAuditSink', auditSink);

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = randomUUID();
    reply.header('X-Request-Id', request.requestId);
    if (request.url.split('?')[0] === '/health' || request.url.split('?')[0] === '/v1/pairing/complete') return;

    request.authContext = authenticate(request, store);
    if (!request.authContext) {
      audit(request, auditSink, 'rejected', 'unauthorized');
      return reply.code(401).send({ requestId: request.requestId, error: { code: 'UNAUTHORIZED', message: 'Valid paired DeviceBridge credential required' } });
    }
  });

  app.get('/health', async (request) => ({ requestId: request.requestId, status: 'ok', service: 'devicebridge' }));

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
    return { requestId: request.requestId, actions: Object.values(actionRegistry).map(({ id, risk, capability, enabledByDefault, confirmation, description }) => ({ id, risk, capability, enabledByDefault, confirmation, description })) };
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
    if (!definition.enabledByDefault) {
      audit(request, auditSink, 'rejected', 'action_disabled');
      return reply.code(403).send({ requestId: request.requestId, error: { code: 'ACTION_DISABLED', message: `${definition.id} is not enabled in the starter` } });
    }
    if (definition.id === 'system.status') {
      audit(request, auditSink, 'accepted');
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result: readDeviceStatus() };
    }
    audit(request, auditSink, 'rejected', 'not_implemented');
    return reply.code(501).send({ requestId: request.requestId, error: { code: 'NOT_IMPLEMENTED', message: 'Adapter not implemented' } });
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
