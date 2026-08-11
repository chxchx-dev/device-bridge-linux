import assert from 'node:assert/strict';
import test from 'node:test';
import { toSafeCodexTaskEvent } from './task-events.js';

test('task events are reduced to bounded safe metadata', () => {
  const event = toSafeCodexTaskEvent({ method: 'item/fileChange', params: { item: { changes: [{ path: 'src/app.ts' }] }, delta: 'secret=do-not-leak' } }, '/workspace/project', 'thread-1');
  assert.equal(event.kind, 'file.changed');
  assert.equal(event.filePath, 'src/app.ts');
  assert.equal(event.detail, null);
  assert.equal(event.threadId, 'thread-1');
  assert.equal(event.method, 'item/fileChange');
});

test('unsafe file paths and protocol names are not exposed', () => {
  const event = toSafeCodexTaskEvent({ method: 'bad value\nwith secrets', params: { item: { changes: [{ path: '../../etc/passwd' }] } } }, '/workspace/project', 'thread-2');
  assert.equal(event.filePath, null);
  assert.equal(event.method, 'codex/event');
  assert.equal(event.summary, 'Codex is working');
});
