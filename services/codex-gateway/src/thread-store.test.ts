import assert from 'node:assert/strict';
import test from 'node:test';
import { CodexThreadStore } from './thread-store.js';

test('Codex thread store persists only bounded metadata and updates lifecycle state', () => {
  const store = new CodexThreadStore();
  store.upsert({ threadId: 'thread-1', projectPath: '/workspace/project', title: 'Phase 06', status: 'idle', lastEventAt: '2026-08-11T00:00:00.000Z', createdAt: '2026-08-11T00:00:00.000Z' });
  store.upsert({ threadId: 'thread-1', projectPath: '/workspace/project', title: 'Phase 06', status: 'running', lastEventAt: '2026-08-11T00:01:00.000Z', createdAt: '2026-08-11T00:00:00.000Z' });
  assert.deepEqual(store.get('thread-1'), { threadId: 'thread-1', projectPath: '/workspace/project', title: 'Phase 06', status: 'running', lastEventAt: '2026-08-11T00:01:00.000Z', lastEvent: null, lastMessage: null, changedFiles: [], createdAt: '2026-08-11T00:00:00.000Z' });
  assert.deepEqual(store.list().map((thread) => thread.threadId), ['thread-1']);
  store.close();
});
