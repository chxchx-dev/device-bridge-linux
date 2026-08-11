import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CodexTaskEvent } from './task-events.js';

export type CodexThreadStatus = 'idle' | 'running' | 'waiting-approval' | 'completed' | 'failed';
export type CodexFileChange = { path: string; kind: string; diff: string | null };

export interface CodexThreadMetadata {
  threadId: string;
  projectPath: string;
  title: string | null;
  status: CodexThreadStatus;
  lastEventAt: string;
  lastEvent?: string | null;
  lastMessage?: string | null;
  changedFiles?: readonly CodexFileChange[];
  createdAt: string;
}

type ThreadRow = {
  thread_id: string;
  project_path: string;
  title: string | null;
  status: CodexThreadStatus;
  last_event_at: string;
  last_event: string | null;
  last_message: string | null;
  changed_files: string | null;
  created_at: string;
};

/** Stores only non-secret Codex lifecycle metadata. Prompts and process output never enter this store. */
export class CodexThreadStore {
  private readonly database: DatabaseSync;

  constructor(filename = process.env.DEVICEBRIDGE_CODEX_DB ?? ':memory:') {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS codex_threads (
        thread_id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'waiting-approval', 'completed', 'failed')),
        last_event_at TEXT NOT NULL,
        last_event TEXT,
        last_message TEXT,
        changed_files TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS codex_task_events (
        event_id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        method TEXT NOT NULL,
        summary TEXT NOT NULL,
        detail TEXT,
        file_path TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_codex_task_events_thread_created ON codex_task_events(thread_id, created_at);
    `);
    try { this.database.exec('ALTER TABLE codex_threads ADD COLUMN last_event TEXT'); } catch { /* Existing database already migrated. */ }
    try { this.database.exec('ALTER TABLE codex_threads ADD COLUMN last_message TEXT'); } catch { /* Existing database already migrated. */ }
    try { this.database.exec('ALTER TABLE codex_threads ADD COLUMN changed_files TEXT'); } catch { /* Existing database already migrated. */ }
  }

  upsert(metadata: CodexThreadMetadata): void {
    this.database.prepare(`
      INSERT INTO codex_threads(thread_id, project_path, title, status, last_event_at, last_event, last_message, changed_files, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        project_path = excluded.project_path,
        title = excluded.title,
        status = excluded.status,
        last_event_at = excluded.last_event_at,
        last_event = excluded.last_event,
        last_message = excluded.last_message,
        changed_files = excluded.changed_files
    `).run(metadata.threadId, metadata.projectPath, metadata.title, metadata.status, metadata.lastEventAt, metadata.lastEvent ?? null, metadata.lastMessage ?? null, metadata.changedFiles ? JSON.stringify(metadata.changedFiles) : null, metadata.createdAt);
  }

  get(threadId: string): CodexThreadMetadata | undefined {
    const row = this.database.prepare('SELECT * FROM codex_threads WHERE thread_id = ?').get(threadId) as ThreadRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  list(limit = 20): CodexThreadMetadata[] {
    const rows = this.database.prepare('SELECT * FROM codex_threads ORDER BY last_event_at DESC LIMIT ?').all(limit) as unknown as ThreadRow[];
    return rows.map((row) => this.fromRow(row));
  }

  appendEvent(event: CodexTaskEvent): void {
    this.database.prepare(`
      INSERT INTO codex_task_events(event_id, thread_id, kind, method, summary, detail, file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.eventId, event.threadId, event.kind, event.method, event.summary, event.detail, event.filePath, event.createdAt);
    this.database.prepare(`
      DELETE FROM codex_task_events WHERE thread_id = ? AND event_id NOT IN
        (SELECT event_id FROM codex_task_events WHERE thread_id = ? ORDER BY created_at DESC LIMIT 100)
    `).run(event.threadId, event.threadId);
  }

  listEvents(threadId: string, limit = 100): CodexTaskEvent[] {
    const rows = this.database.prepare(`
      SELECT event_id, thread_id, kind, method, summary, detail, file_path, created_at
      FROM codex_task_events WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(threadId, Math.min(Math.max(limit, 1), 100)) as unknown as Array<{ event_id: string; thread_id: string; kind: CodexTaskEvent['kind']; method: string; summary: string; detail: string | null; file_path: string | null; created_at: string }>;
    return rows.reverse().map((row) => ({ eventId: row.event_id, threadId: row.thread_id, kind: row.kind, method: row.method, summary: row.summary, detail: row.detail, filePath: row.file_path, createdAt: row.created_at }));
  }

  close(): void { this.database.close(); }

  private fromRow(row: ThreadRow): CodexThreadMetadata {
    let changedFiles: CodexFileChange[] = [];
    try { changedFiles = row.changed_files ? JSON.parse(row.changed_files) as CodexFileChange[] : []; } catch { changedFiles = []; }
    return { threadId: row.thread_id, projectPath: row.project_path, title: row.title, status: row.status, lastEventAt: row.last_event_at, lastEvent: row.last_event ?? null, lastMessage: row.last_message ?? null, changedFiles, createdAt: row.created_at };
  }
}
