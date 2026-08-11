import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModePlan } from './mode-profiles.js';

const services = [
  { id: 'bridge', unit: 'devicebridge-bridge.service', control: 'user-systemd' as const, allowedModes: ['dev' as const] },
  { id: 'web-console', unit: 'devicebridge-web-console.service', control: 'user-systemd' as const, allowedModes: ['dev' as const] },
  { id: 'sunshine', unit: 'sunshine.service', control: 'user-systemd' as const, allowedModes: ['game' as const] },
];

test('mode plans contain only registered service IDs', () => {
  assert.deepEqual(buildModePlan('dev', services), { target: 'dev', start: ['bridge', 'web-console'], stop: ['sunshine'], checks: ['fedora', 'tailnet', 'web-console'] });
  assert.deepEqual(buildModePlan('game', services), { target: 'game', start: ['sunshine'], stop: ['bridge', 'web-console'], checks: ['fedora', 'tailnet', 'sunshine'] });
  assert.deepEqual(buildModePlan('dev', services.slice(0, 1)).stop, []);
});
