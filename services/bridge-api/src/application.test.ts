import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceBridgeApplication } from './application.js';

const device = {
  hostname: 'test-host', platform: 'linux', uptimeSeconds: 10, cpuCount: 4,
  totalMemoryBytes: 100, freeMemoryBytes: 50,
};
const integrations = {
  kdeConnect: { available: true, pairedReachable: true, deviceCount: 1 },
  adb: { available: true, connected: true, deviceCount: 1 },
  scrcpy: { available: true, version: '3.0' },
  sunshine: { available: true, active: false },
};

test('the application service exposes shared status and pre-flight data', async () => {
  const application = new DeviceBridgeApplication({
    deviceStatus: () => device,
    integrationStatus: async () => integrations,
    webConsoleStatus: async () => true,
  });

  assert.deepEqual(application.deviceStatus(), device);
  assert.deepEqual(await application.integrations(), integrations);
  assert.deepEqual(await application.preflight(), {
    checks: { fedoraReachable: true, adbConnected: true, sunshineAvailable: true, sunshineActive: false, webConsoleAvailable: true },
    ready: true,
  });
});

test('the application service delegates mode changes to the injected orchestrator', async () => {
  const calls: string[] = [];
  const application = new DeviceBridgeApplication({
    local: { startDev: async () => { calls.push('start'); }, stopDev: async () => { calls.push('stop'); } },
    sunshineControl: async (operation) => { calls.push(`sunshine:${operation}`); return { requested: operation, active: operation === 'start' }; },
  });

  assert.deepEqual(await application.switchMode('dev'), { mode: 'dev', transitioning: false });
  assert.deepEqual(application.modeStatus(), { mode: 'dev', transitioning: false });
  assert.deepEqual(calls, ['sunshine:stop', 'start']);
});
