import assert from 'node:assert/strict';
import test from 'node:test';
import { ModeOrchestrator } from './modes.js';

test('Dev Mode stops Sunshine before starting the configured Docker project', async () => {
  const calls: string[] = [];
  const modes = new ModeOrchestrator({
    docker: { startDev: async () => { calls.push('docker.start'); }, stopDev: async () => { calls.push('docker.stop'); } },
    sunshine: async (operation) => { calls.push(`sunshine.${operation}`); return { requested: operation, active: operation === 'start' }; },
  });

  assert.deepEqual(await modes.switchTo('dev'), { mode: 'dev', transitioning: false });
  assert.deepEqual(calls, ['sunshine.stop', 'docker.start']);
});

test('a failed Dev Mode transition rolls back the Sunshine change', async () => {
  const calls: string[] = [];
  const modes = new ModeOrchestrator({
    docker: { startDev: async () => { calls.push('docker.start'); throw new Error('compose failed'); }, stopDev: async () => { calls.push('docker.stop'); } },
    sunshine: async (operation) => { calls.push(`sunshine.${operation}`); return { requested: operation, active: operation === 'start' }; },
  });

  await assert.rejects(() => modes.switchTo('dev'));
  assert.deepEqual(calls, ['sunshine.stop', 'docker.start', 'sunshine.start']);
  assert.deepEqual(modes.status(), { mode: null, transitioning: false });
});
