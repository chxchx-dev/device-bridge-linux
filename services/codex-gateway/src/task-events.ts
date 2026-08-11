import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';

export type CodexTaskEventKind =
  | 'task.received'
  | 'thread.started'
  | 'turn.started'
  | 'progress'
  | 'item.started'
  | 'item.completed'
  | 'file.changed'
  | 'approval.requested'
  | 'turn.completed'
  | 'task.failed';

export interface CodexTaskEvent {
  eventId: string;
  threadId: string;
  kind: CodexTaskEventKind;
  method: string;
  summary: string;
  detail: string | null;
  filePath: string | null;
  createdAt: string;
}

type RawEvent = { method: string; params: unknown };

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value.replace(/(token|secret|password|private[_ -]?key|authorization)\s*[:=]\s*[^\s]+/gi, '$1=[redacted]').slice(0, max);
}

function eventKind(method: string): CodexTaskEventKind {
  if (method === 'devicebridge/task.received') return 'task.received';
  if (method.includes('requestApproval')) return 'approval.requested';
  if (method.includes('fileChange') || method.includes('file_change')) return 'file.changed';
  if (method.includes('turn/started')) return 'turn.started';
  if (method.includes('turn/completed')) return 'turn.completed';
  if (method.includes('turn/failed')) return 'task.failed';
  if (method.includes('thread/started')) return 'thread.started';
  if (method.includes('item/started')) return 'item.started';
  if (method.includes('item/completed')) return 'item.completed';
  return method.includes('/delta') ? 'progress' : 'progress';
}

function summaryFor(kind: CodexTaskEventKind): string {
  switch (kind) {
    case 'thread.started': return 'Codex thread started';
    case 'turn.started': return 'Codex task started';
    case 'progress': return 'Codex is working';
    case 'item.started': return 'Codex started a work item';
    case 'item.completed': return 'Codex completed a work item';
    case 'file.changed': return 'Codex changed a project file';
    case 'approval.requested': return 'Codex requests approval';
    case 'turn.completed': return 'Codex task completed';
    case 'task.failed': return 'Codex task failed';
    case 'task.received': return 'Codex task received';
  }
}

function safeRelativeFilePath(params: Record<string, unknown>, projectPath: string): string | null {
  const item = record(params.item);
  const changes = Array.isArray(item.changes) ? item.changes : [];
  const first = record(changes[0]);
  const candidate = text(first.path, 500);
  if (!candidate) return null;
  const resolved = resolve(projectPath, candidate);
  const remainder = relative(resolve(projectPath), resolved);
  return remainder && !remainder.startsWith('..') && !isAbsolute(remainder) ? remainder : null;
}

export function toSafeCodexTaskEvent(event: RawEvent, projectPath: string, threadId: string): CodexTaskEvent {
  const params = record(event.params);
  const kind = eventKind(event.method);
  const delta = text(params.delta) ?? text(params.text);
  const detail = kind === 'progress' ? delta : text(params.reason);
  return {
    eventId: randomUUID(),
    threadId,
    kind,
    method: /^[A-Za-z][A-Za-z0-9_./:-]{0,120}$/.test(event.method) ? event.method : 'codex/event',
    summary: summaryFor(kind),
    detail,
    filePath: kind === 'file.changed' ? safeRelativeFilePath(params, projectPath) : null,
    createdAt: new Date().toISOString(),
  };
}
