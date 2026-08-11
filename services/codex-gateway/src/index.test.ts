import assert from 'node:assert/strict';
import test from 'node:test';
import { getCodexGatewayStatus } from './index.js';
import { CodexThreadStore } from './thread-store.js';

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

test('thread event history is bounded and returned chronologically', () => {
  const store = new CodexThreadStore();
  for (let index = 0; index < 105; index += 1) {
    store.appendEvent({ eventId: `event-${index}`, threadId: 'thread-1', kind: 'progress', method: 'item/agentMessage/delta', summary: `Event ${index}`, detail: null, filePath: null, createdAt: new Date(1_000 + index).toISOString() });
  }
  const events = store.listEvents('thread-1');
  assert.equal(events.length, 100);
  assert.equal(events[0]?.eventId, 'event-5');
  assert.equal(events.at(-1)?.eventId, 'event-104');
  store.close();
});
