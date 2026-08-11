import assert from 'node:assert/strict';
import test from 'node:test';
import { ModeOrchestrator } from './modes.js';

test('Dev Mode stops Sunshine before starting the local web service', async () => {
  const calls: string[] = [];
  const modes = new ModeOrchestrator({
    local: { startDev: async () => { calls.push('local.start'); }, stopDev: async () => { calls.push('local.stop'); } },
    sunshine: async (operation) => { calls.push(`sunshine.${operation}`); return { requested: operation, active: operation === 'start' }; },
  });

  assert.deepEqual(await modes.switchTo('dev'), { mode: 'dev', transitioning: false });
  assert.deepEqual(calls, ['sunshine.stop', 'local.start']);
});

test('a failed Dev Mode transition rolls back the Sunshine change', async () => {
  const calls: string[] = [];
  const modes = new ModeOrchestrator({
    local: { startDev: async () => { calls.push('local.start'); throw new Error('service failed'); }, stopDev: async () => { calls.push('local.stop'); } },
    sunshine: async (operation) => { calls.push(`sunshine.${operation}`); return { requested: operation, active: operation === 'start' }; },
  });

  await assert.rejects(() => modes.switchTo('dev'));
  assert.deepEqual(calls, ['sunshine.stop', 'local.start', 'sunshine.start']);
  assert.deepEqual(modes.status(), { mode: null, transitioning: false });
});
