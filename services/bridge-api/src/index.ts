import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { ActionIdSchema, ActionRequestSchema, AuditEventSchema, CodexApprovalRespondInputSchema, CodexThreadStartInputSchema, CodexTurnStartInputSchema, DeviceIdSchema, ModeSwitchInputSchema, PairingRequestSchema } from '@devicebridge/contracts';
import { actionRegistry } from '@devicebridge/command-registry';
import { CodexAppServer, CodexApprovalBroker, CodexThreadStore, probeCodexGateway, type CodexApprovalMetadata, type CodexGatewayStatus, type CodexThreadMetadata } from '@devicebridge/codex-gateway';
import { authenticate, type AuthContext } from './auth.js';
import { PairingStore } from './pairing.js';
import { readDeviceStatus } from './system.js';
import { pairingPage } from './pairing-page.js';
import { ChallengeStore } from './challenges.js';
import { createSystemSessionAdapter, type SessionAdapter } from './system-actions.js';
import { controlSunshine, readIntegrationStatus, startScrcpy, type IntegrationStatus, type ScrcpyStartResult, type SunshineControlResult, type SunshineOperation } from './integrations.js';
import { createLocalDevAdapter } from './local-services.js';
import { ModeOrchestrator } from './modes.js';

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

interface CodexProject { id: string; path: string }

function configuredCodexProjects(value: string | undefined): CodexProject[] {
  return (value ?? '').split(',').map((entry) => {
    const separator = entry.indexOf('=');
    if (separator < 1) return undefined;
    const id = entry.slice(0, separator);
    const path = entry.slice(separator + 1);
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(id) && isAbsolute(path) ? { id, path } : undefined;
  }).filter((project): project is CodexProject => project !== undefined);
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
  enableScrcpy?: boolean;
  enableSunshineControl?: boolean;
  enableModes?: boolean;
  enableCodexGateway?: boolean;
  challenges?: ChallengeStore;
  sessionAdapter?: SessionAdapter;
  integrationStatus?: () => Promise<IntegrationStatus>;
  scrcpyStart?: () => Promise<ScrcpyStartResult>;
  sunshineControl?: (operation: SunshineOperation) => Promise<SunshineControlResult>;
  codexGatewayStatus?: () => Promise<CodexGatewayStatus>;
  codexThreadStore?: CodexThreadStore;
  codexThreadList?: () => CodexThreadMetadata[];
  codexThreadStart?: (projectId: string, title: string | null) => Promise<CodexThreadMetadata>;
  codexTurnStart?: (threadId: string, prompt: string) => Promise<unknown>;
  codexProjects?: readonly CodexProject[];
  codexApprovalBroker?: CodexApprovalBroker;
  modeOrchestrator?: ModeOrchestrator;
}

export function createApp(options: AppOptions = {}): FastifyInstance {
  const defaultCapabilities = options.defaultCapabilities ?? (process.env.DEVICEBRIDGE_DEFAULT_CAPABILITIES?.split(',').map((capability) => capability.trim()).filter(Boolean) ?? ['system:read', 'mode:read', 'android:read', 'gaming:read']);
  const store = options.store ?? new PairingStore(defaultCapabilities, process.env.DEVICEBRIDGE_STATE_DB ?? ':memory:');
  const auditSink = options.auditSink ?? new InMemoryAuditSink();
  const challenges = options.challenges ?? new ChallengeStore();
  const sessionAdapter = options.sessionAdapter ?? createSystemSessionAdapter();
  const enableSystemLock = options.enableSystemLock ?? process.env.DEVICEBRIDGE_ENABLE_SYSTEM_LOCK === 'true';
  const integrationStatus = options.integrationStatus ?? readIntegrationStatus;
  const scrcpyStart = options.scrcpyStart ?? startScrcpy;
  const enableScrcpy = options.enableScrcpy ?? process.env.DEVICEBRIDGE_ENABLE_SCRCPY === 'true';
  const enableSunshineControl = options.enableSunshineControl ?? process.env.DEVICEBRIDGE_ENABLE_SUNSHINE_CONTROL === 'true';
  const sunshineControl = options.sunshineControl ?? controlSunshine;
  const enableModes = options.enableModes ?? process.env.DEVICEBRIDGE_ENABLE_MODES === 'true';
  const enableCodexGateway = options.enableCodexGateway ?? process.env.CODEX_GATEWAY_ENABLED === 'true';
  const codexGatewayStatus = options.codexGatewayStatus ?? probeCodexGateway;
  const codexThreadStore = options.codexThreadStore ?? new CodexThreadStore();
  const codexThreadList = options.codexThreadList ?? (() => codexThreadStore.list());
  const events = new EventHub();
  const codexApprovalBroker = options.codexApprovalBroker ?? new CodexApprovalBroker();
  const codexThreadStart = options.codexThreadStart;
  const codexTurnStart = options.codexTurnStart;
  const codexProjects = options.codexProjects ?? configuredCodexProjects(process.env.DEVICEBRIDGE_CODEX_PROJECTS);
  const codexServer = codexProjects.length ? new CodexAppServer({ allowedProjects: codexProjects.map((project) => project.path), onEvent: (event) => events.publish('codex.event', event), onApproval: async (request) => { const result = codexApprovalBroker.request(request); const pending = codexApprovalBroker.list().at(-1); if (pending) events.publish('codex.approval.requested', pending); return result; } }) : undefined;
  const startThread = codexThreadStart ?? (codexServer ? async (projectId: string, title: string | null): Promise<CodexThreadMetadata> => {
    const project = codexProjects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('Unknown Codex project');
    const thread = await codexServer.startThread(project.path, title);
    const now = new Date().toISOString();
    const metadata: CodexThreadMetadata = { ...thread, status: 'idle', lastEventAt: now, createdAt: now };
    codexThreadStore.upsert(metadata);
    return metadata;
  } : undefined);
  const startTurn = codexTurnStart ?? (codexServer ? async (threadId: string, prompt: string): Promise<unknown> => {
    const metadata = codexThreadStore.get(threadId);
    if (!metadata) throw new Error('Unknown Codex thread');
    codexThreadStore.upsert({ ...metadata, status: 'running', lastEventAt: new Date().toISOString() });
    return codexServer.startTurn(threadId, prompt);
  } : undefined);
  const modes = options.modeOrchestrator ?? new ModeOrchestrator({ local: createLocalDevAdapter(), sunshine: sunshineControl });
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
    return { requestId: request.requestId, actions: Object.values(actionRegistry).map(({ id, risk, capability, enabledByDefault, confirmation, description }) => ({ id, risk, capability, enabledByDefault: id === 'system.lock' ? enableSystemLock : id === 'android.scrcpy.start' ? enableScrcpy : id === 'gaming.sunshine.start' || id === 'gaming.sunshine.stop' ? enableSunshineControl : id === 'mode.switch' ? enableModes : id === 'codex.status' || id === 'codex.threads.list' || id === 'codex.thread.start' || id === 'codex.turn.start' || id === 'codex.approvals.list' || id === 'codex.approval.respond' ? enableCodexGateway : enabledByDefault, confirmation, description })) };
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
    if (idResult.data === 'mode.switch' && !ModeSwitchInputSchema.safeParse(bodyResult.data.input).success) {
      audit(request, auditSink, 'rejected', 'invalid_mode_input');
      return reply.code(400).send({ requestId: request.requestId, error: { code: 'INVALID_INPUT', message: 'Mode must be dev or game' } });
    }
    if (idResult.data === 'codex.thread.start' && !CodexThreadStartInputSchema.safeParse(bodyResult.data.input).success) return reply.code(400).send({ requestId: request.requestId, error: { code: 'INVALID_INPUT', message: 'Invalid Codex project input' } });
    if (idResult.data === 'codex.turn.start' && !CodexTurnStartInputSchema.safeParse(bodyResult.data.input).success) return reply.code(400).send({ requestId: request.requestId, error: { code: 'INVALID_INPUT', message: 'Invalid Codex turn input' } });
    if (idResult.data === 'codex.approval.respond' && !CodexApprovalRespondInputSchema.safeParse(bodyResult.data.input).success) return reply.code(400).send({ requestId: request.requestId, error: { code: 'INVALID_INPUT', message: 'Invalid Codex approval response' } });
    const definition = actionRegistry[idResult.data];
    const hasCapability = request.authContext?.capabilities.includes(definition.capability) ?? false;
    if (!hasCapability) {
      audit(request, auditSink, 'rejected', 'insufficient_capability', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'denied', executionStatus: 'not_run' });
      return reply.code(403).send({ requestId: request.requestId, error: { code: 'INSUFFICIENT_CAPABILITY', message: 'The paired device lacks the required capability' } });
    }
    const actionEnabled = definition.id === 'system.lock' ? enableSystemLock : definition.id === 'android.scrcpy.start' ? enableScrcpy : definition.id === 'gaming.sunshine.start' || definition.id === 'gaming.sunshine.stop' ? enableSunshineControl : definition.id === 'mode.switch' ? enableModes : definition.id === 'codex.status' || definition.id === 'codex.threads.list' || definition.id === 'codex.thread.start' || definition.id === 'codex.turn.start' || definition.id === 'codex.approvals.list' || definition.id === 'codex.approval.respond' ? enableCodexGateway : definition.enabledByDefault;
    if (!actionEnabled) {
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
    if (definition.id === 'mode.status') {
      const result = modes.status();
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
    }
    if (definition.id === 'mode.switch') {
      const target = ModeSwitchInputSchema.parse(bodyResult.data.input).target;
      const startedAt = performance.now();
      try {
        const result = await modes.switchTo(target);
        audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: performance.now() - startedAt });
        events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
        return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
      } catch {
        audit(request, auditSink, 'failed', 'mode_transition_failed', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'failed', durationMs: performance.now() - startedAt });
        return reply.code(502).send({ requestId: request.requestId, error: { code: 'MODE_TRANSITION_FAILED', message: 'The requested mode transition failed' } });
      }
    }
    if (definition.id === 'integrations.status') {
      const result = await integrationStatus();
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
    }
    if (definition.id === 'codex.status') {
      const startedAt = performance.now();
      try {
        const result = await codexGatewayStatus();
        audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: performance.now() - startedAt });
        events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
        return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
      } catch {
        audit(request, auditSink, 'failed', 'adapter_failed', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'failed', durationMs: performance.now() - startedAt });
        return reply.code(502).send({ requestId: request.requestId, error: { code: 'ADAPTER_FAILED', message: 'The Codex gateway adapter failed' } });
      }
    }
    if (definition.id === 'codex.threads.list') {
      const result = codexThreadList();
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('codex.threads.updated', { requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
    }
    if (definition.id === 'codex.approvals.list') {
      const result: CodexApprovalMetadata[] = codexApprovalBroker.list();
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
    }
    if (definition.id === 'codex.approval.respond') {
      const input = CodexApprovalRespondInputSchema.parse(bodyResult.data.input);
      const responded = codexApprovalBroker.respond(input.approvalId, input.decision);
      if (!responded) return reply.code(404).send({ requestId: request.requestId, error: { code: 'APPROVAL_NOT_FOUND', message: 'Approval is no longer pending' } });
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('codex.approval.responded', { approvalId: input.approvalId, decision: input.decision, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result: { decision: input.decision } };
    }
    if (definition.id === 'codex.thread.start' || definition.id === 'codex.turn.start') {
      const startedAt = performance.now();
      try {
        const result = definition.id === 'codex.thread.start'
          ? startThread ? await startThread(CodexThreadStartInputSchema.parse(bodyResult.data.input).projectId, CodexThreadStartInputSchema.parse(bodyResult.data.input).title) : undefined
          : startTurn ? await startTurn(CodexTurnStartInputSchema.parse(bodyResult.data.input).threadId, CodexTurnStartInputSchema.parse(bodyResult.data.input).prompt) : undefined;
        if (result === undefined) return reply.code(501).send({ requestId: request.requestId, error: { code: 'NOT_CONFIGURED', message: 'Codex task control is not configured' } });
        audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: performance.now() - startedAt });
        events.publish('codex.task.updated', { actionId: definition.id, requestId: request.requestId });
        return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
      } catch {
        audit(request, auditSink, 'failed', 'adapter_failed', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'failed', durationMs: performance.now() - startedAt });
        return reply.code(502).send({ requestId: request.requestId, error: { code: 'ADAPTER_FAILED', message: 'The Codex task adapter failed' } });
      }
    }
    if (definition.id === 'android.kdeconnect.status' || definition.id === 'android.adb.status' || definition.id === 'gaming.sunshine.status') {
      const result = await integrationStatus();
      const scopedResult = definition.id === 'android.kdeconnect.status' ? result.kdeConnect : definition.id === 'android.adb.status' ? result.adb : result.sunshine;
      audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: 0 });
      events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
      return { requestId: request.requestId, actionId: definition.id, status: 'completed', result: scopedResult };
    }
    if (definition.id === 'android.scrcpy.start') {
      const startedAt = performance.now();
      try {
        const result = await scrcpyStart();
        audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: performance.now() - startedAt });
        events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
        return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
      } catch {
        audit(request, auditSink, 'failed', 'adapter_failed', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'failed', durationMs: performance.now() - startedAt });
        return reply.code(502).send({ requestId: request.requestId, error: { code: 'ADAPTER_FAILED', message: 'The scrcpy adapter failed' } });
      }
    }
    if (definition.id === 'gaming.sunshine.start' || definition.id === 'gaming.sunshine.stop') {
      const startedAt = performance.now();
      try {
        const operation = definition.id === 'gaming.sunshine.start' ? 'start' : 'stop';
        const result = await sunshineControl(operation);
        audit(request, auditSink, 'accepted', undefined, { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'completed', durationMs: performance.now() - startedAt });
        events.publish('action.completed', { actionId: definition.id, requestId: request.requestId });
        return { requestId: request.requestId, actionId: definition.id, status: 'completed', result };
      } catch {
        audit(request, auditSink, 'failed', 'adapter_failed', { actionId: definition.id, risk: definition.risk, capability: definition.capability, authorization: 'granted', executionStatus: 'failed', durationMs: performance.now() - startedAt });
        return reply.code(502).send({ requestId: request.requestId, error: { code: 'ADAPTER_FAILED', message: 'The Sunshine adapter failed' } });
      }
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
    const candidate = socket as { send?: unknown; on?: unknown };
    if (typeof candidate.send !== 'function' || typeof candidate.on !== 'function') return;
    const client = socket as { send(data: string): void; on(event: 'close', listener: () => void): void };
    events.add(client);
    client.send(JSON.stringify({ type: 'bridge.connected', timestamp: new Date().toISOString(), payload: { requestId: request.requestId } }));
    client.on('close', () => events.remove(client));
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
