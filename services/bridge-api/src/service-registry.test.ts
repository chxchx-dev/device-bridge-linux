import assert from 'node:assert/strict';
import test from 'node:test';
import { configuredServices, ServiceRegistry } from './service-registry.js';

test('service registry accepts only declarative user-systemd entries', () => {
  const services = configuredServices('web-console=devicebridge-web-console.service:dev,invalid=rm -rf:dev,bridge=devicebridge-bridge.service:dev|game');
  assert.deepEqual(services, [
    { id: 'web-console', unit: 'devicebridge-web-console.service', control: 'user-systemd', allowedModes: ['dev'] },
    { id: 'bridge', unit: 'devicebridge-bridge.service', control: 'user-systemd', allowedModes: ['dev', 'game'] },
  ]);
});

test('service status uses the declared unit and never request data', async () => {
  const calls: string[] = [];
  const registry = new ServiceRegistry(configuredServices('bridge=devicebridge-bridge.service:dev'), async (unit) => {
    calls.push(unit);
    return { available: true, active: true };
  });
  assert.deepEqual(await registry.status(), [{ id: 'bridge', unit: 'devicebridge-bridge.service', control: 'user-systemd', allowedModes: ['dev'], available: true, active: true }]);
  assert.deepEqual(calls, ['devicebridge-bridge.service']);
});
