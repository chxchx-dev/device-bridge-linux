import assert from 'node:assert/strict';
import test from 'node:test';
import { getCodexGatewayStatus } from './index.js';

test('Codex gateway is disabled by default and exposes no process details', () => {
  const previous = process.env.CODEX_GATEWAY_ENABLED;
  delete process.env.CODEX_GATEWAY_ENABLED;
  try {
    assert.deepEqual(getCodexGatewayStatus(), { enabled: false, mode: 'disabled', connected: false, cliVersion: null });
  } finally {
    if (previous === undefined) delete process.env.CODEX_GATEWAY_ENABLED;
    else process.env.CODEX_GATEWAY_ENABLED = previous;
  }
});
