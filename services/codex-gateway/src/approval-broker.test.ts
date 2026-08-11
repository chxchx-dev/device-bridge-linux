import assert from 'node:assert/strict';
import test from 'node:test';
import { CodexApprovalBroker } from './approval-broker.js';

test('approval broker exposes bounded metadata and resolves explicit decisions', async () => {
  const broker = new CodexApprovalBroker();
  const pending = broker.request({ method: 'item/commandExecution/requestApproval', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'item-1', command: 'pnpm test', cwd: '/workspace/project' } });
  const approval = broker.list()[0];
  assert.ok(approval);
  assert.equal(approval.kind, 'command');
  assert.equal(approval.risk, 'R2');
  assert.equal(broker.respond(approval.approvalId, 'deny'), true);
  assert.equal(await pending, 'deny');
  assert.equal(broker.list().length, 0);
});
