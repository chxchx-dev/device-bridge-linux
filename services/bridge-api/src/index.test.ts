import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './index.js';
import { PairingStore } from './pairing.js';

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
