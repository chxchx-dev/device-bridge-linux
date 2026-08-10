import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './index.js';
import { PairingStore, pairingCodeForToken } from './pairing.js';
import { createSystemSessionAdapter } from './system-actions.js';

const deviceId = 'android-a17-test';
const pairingToken = 'pairing-token-for-tests-1234567890';

test('health is public and does not expose machine details', async () => {
  const app = createApp({ pairingToken });
  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.json()).sort(), ['requestId', 'service', 'status']);
  assert.match(response.headers['x-request-id'] as string, /^[0-9a-f-]{36}$/);
  await app.close();
});

test('temporary pairing client is available without embedding secrets', async () => {
  const app = createApp({ pairingToken });
  const response = await app.inject({ method: 'GET', url: '/pair' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] as string, /text\/html/);
  assert.equal(response.body.includes(pairingToken), false);
  await app.close();
});

test('unpaired device cannot read Fedora details', async () => {
  const app = createApp({ pairingToken });
  const response = await app.inject({ method: 'GET', url: '/v1/device' });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'UNAUTHORIZED');
  await app.close();
});

test('pairing token is one-time and returns a device token', async () => {
  const app = createApp({ pairingToken });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/pairing/complete',
    payload: { deviceId, pairingToken },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.deviceId, deviceId);
  assert.equal(typeof body.deviceToken, 'string');
  assert.match(body.expiresAt, /^20/);

  const replay = await app.inject({
    method: 'POST',
    url: '/v1/pairing/complete',
    payload: { deviceId: 'android-a17-replay', pairingToken },
  });
  assert.equal(replay.statusCode, 401);

  const deviceResponse = await app.inject({
    method: 'GET',
    url: '/v1/device',
    headers: { authorization: `Bearer ${body.deviceToken}`, 'x-devicebridge-device': deviceId },
  });
  assert.equal(deviceResponse.statusCode, 200);
  assert.equal(deviceResponse.json().device.platform.startsWith('linux'), true);
  await app.close();
});

test('six-digit pairing code maps to the final six characters of the active token', async () => {
  const app = createApp({ pairingToken });
  const code = pairingCodeForToken(pairingToken);
  const response = await app.inject({
    method: 'POST',
    url: '/v1/pairing/complete',
    payload: { deviceId, pairingToken: code },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().deviceId, deviceId);
  await app.close();
});

test('revoked device token is denied', () => {
  const store = new PairingStore();
  const token = 'device-token-for-revocation-test-123456';
  store.seedDevice(deviceId, token);
  assert.equal(store.authenticate(deviceId, token), true);
  assert.equal(store.revoke(deviceId), true);
  assert.equal(store.authenticate(deviceId, token), false);
  assert.equal(store.isRevoked(deviceId), true);
});

test('pairing token expires', () => {
  const store = new PairingStore();
  store.issuePairingToken(pairingToken, 0);
  assert.equal(store.completePairing(deviceId, pairingToken), undefined);
});

test('action catalog and status require the declared read capability', async () => {
  const token = 'device-token-for-status-test-1234567890';
  const store = new PairingStore(['system:read']);
  store.seedDevice(deviceId, token);
  const app = createApp({ store });
  const headers = { authorization: `Bearer ${token}`, 'x-devicebridge-device': deviceId };

  const catalog = await app.inject({ method: 'GET', url: '/v1/actions', headers });
  assert.equal(catalog.statusCode, 200);
  assert.equal(catalog.json().actions.find((action: { id: string }) => action.id === 'system.status').enabledByDefault, true);

  const status = await app.inject({ method: 'POST', url: '/v1/actions/system.status', headers, payload: {} });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().actionId, 'system.status');
  await app.close();
});

test('integration status uses the fixed adapter boundary', async () => {
  const token = 'device-token-for-integration-test-1234567890';
  const store = new PairingStore(['system:read']);
  store.seedDevice(deviceId, token);
  const app = createApp({ store, integrationStatus: async () => ({
    kdeConnect: { available: true, pairedReachable: true, deviceCount: 1 },
    adb: { available: true, connected: true, deviceCount: 1 },
    scrcpy: { available: true, version: '4.1' },
    sunshine: { available: true, active: true },
  }) });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/actions/integrations.status',
    headers: { authorization: `Bearer ${token}`, 'x-devicebridge-device': deviceId },
    payload: {},
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.adb.connected, true);
  await app.close();
});

test('scoped integration status actions enforce capabilities and return only their adapter result', async () => {
  const token = 'device-token-for-scoped-integration-test-1234567890';
  const store = new PairingStore(['system:read', 'android:read', 'gaming:read']);
  store.seedDevice(deviceId, token);
  const app = createApp({ store, integrationStatus: async () => ({
    kdeConnect: { available: true, pairedReachable: true, deviceCount: 1 },
    adb: { available: true, connected: true, deviceCount: 1 },
    scrcpy: { available: true, version: '4.1' },
    sunshine: { available: true, active: false },
  }) });
  const headers = { authorization: `Bearer ${token}`, 'x-devicebridge-device': deviceId };

  const adb = await app.inject({ method: 'POST', url: '/v1/actions/android.adb.status', headers, payload: {} });
  assert.equal(adb.statusCode, 200);
  assert.deepEqual(adb.json().result, { available: true, connected: true, deviceCount: 1 });

  const sunshine = await app.inject({ method: 'POST', url: '/v1/actions/gaming.sunshine.status', headers, payload: {} });
  assert.equal(sunshine.statusCode, 200);
  assert.deepEqual(sunshine.json().result, { available: true, active: false });
  await app.close();
});

test('invalid action IDs and payloads are rejected before execution', async () => {
  const token = 'device-token-for-input-test-1234567890';
  const store = new PairingStore(['system:read']);
  store.seedDevice(deviceId, token);
  const app = createApp({ store });
  const headers = { authorization: `Bearer ${token}`, 'x-devicebridge-device': deviceId };

  const unknown = await app.inject({ method: 'POST', url: '/v1/actions/not-an-action', headers, payload: {} });
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.json().error.code, 'UNKNOWN_ACTION');

  const invalid = await app.inject({ method: 'POST', url: '/v1/actions/system.status', headers, payload: { input: 'not-an-object' } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'INVALID_INPUT');
  await app.close();
});

test('R2 system.lock requires a capability and one-time confirmation challenge', async () => {
  const token = 'device-token-for-lock-test-1234567890';
  const store = new PairingStore(['system:read', 'system:lock']);
  store.seedDevice(deviceId, token);
  let lockCalls = 0;
  const app = createApp({
    store,
    enableSystemLock: true,
    sessionAdapter: { lock: async () => { lockCalls += 1; } },
  });
  const headers = { authorization: `Bearer ${token}`, 'x-devicebridge-device': deviceId };

  const missing = await app.inject({ method: 'POST', url: '/v1/actions/system.lock', headers, payload: {} });
  assert.equal(missing.statusCode, 409);
  assert.equal(lockCalls, 0);

  const challengeResponse = await app.inject({ method: 'GET', url: '/v1/actions/system.lock/challenge', headers });
  assert.equal(challengeResponse.statusCode, 200);
  const challenge = challengeResponse.json();
  const executed = await app.inject({ method: 'POST', url: '/v1/actions/system.lock', headers, payload: { confirmation: { challengeId: challenge.challengeId } } });
  assert.equal(executed.statusCode, 200);
  assert.equal(lockCalls, 1);

  const replay = await app.inject({ method: 'POST', url: '/v1/actions/system.lock', headers, payload: { confirmation: { challengeId: challenge.challengeId } } });
  assert.equal(replay.statusCode, 409);
  await app.close();
});

test('paired devices without system:lock cannot request an R2 challenge', async () => {
  const token = 'device-token-without-lock-capability-123456';
  const store = new PairingStore(['system:read']);
  store.seedDevice(deviceId, token);
  const app = createApp({ store, enableSystemLock: true });
  const response = await app.inject({
    method: 'GET',
    url: '/v1/actions/system.lock/challenge',
    headers: { authorization: `Bearer ${token}`, 'x-devicebridge-device': deviceId },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'INSUFFICIENT_CAPABILITY');
  await app.close();
});

test('system lock adapter invokes only the fixed loginctl action', async () => {
  let receivedFile = '';
  let receivedArgs: readonly string[] = [];
  const adapter = createSystemSessionAdapter(async (file, args) => {
    receivedFile = file;
    receivedArgs = args;
  });
  await adapter.lock();
  assert.equal(receivedFile, '/usr/bin/loginctl');
  assert.deepEqual(receivedArgs, ['lock-session']);
});
