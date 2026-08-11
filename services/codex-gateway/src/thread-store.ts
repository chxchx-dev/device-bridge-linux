import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type CodexThreadStatus = 'idle' | 'running' | 'waiting-approval' | 'completed' | 'failed';

export interface CodexThreadMetadata {
  threadId: string;
  projectPath: string;
  title: string | null;
  status: CodexThreadStatus;
  lastEventAt: string;
  lastEvent?: string | null;
  lastMessage?: string | null;
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
        created_at TEXT NOT NULL
      );
    `);
    try { this.database.exec('ALTER TABLE codex_threads ADD COLUMN last_event TEXT'); } catch { /* Existing database already migrated. */ }
    try { this.database.exec('ALTER TABLE codex_threads ADD COLUMN last_message TEXT'); } catch { /* Existing database already migrated. */ }
  }

  upsert(metadata: CodexThreadMetadata): void {
    this.database.prepare(`
      INSERT INTO codex_threads(thread_id, project_path, title, status, last_event_at, last_event, last_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        project_path = excluded.project_path,
        title = excluded.title,
        status = excluded.status,
        last_event_at = excluded.last_event_at,
        last_event = excluded.last_event,
        last_message = excluded.last_message
    `).run(metadata.threadId, metadata.projectPath, metadata.title, metadata.status, metadata.lastEventAt, metadata.lastEvent ?? null, metadata.lastMessage ?? null, metadata.createdAt);
  }

  get(threadId: string): CodexThreadMetadata | undefined {
    const row = this.database.prepare('SELECT * FROM codex_threads WHERE thread_id = ?').get(threadId) as ThreadRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  list(limit = 20): CodexThreadMetadata[] {
    const rows = this.database.prepare('SELECT * FROM codex_threads ORDER BY last_event_at DESC LIMIT ?').all(limit) as unknown as ThreadRow[];
    return rows.map((row) => this.fromRow(row));
  }

  close(): void { this.database.close(); }

  private fromRow(row: ThreadRow): CodexThreadMetadata {
    return { threadId: row.thread_id, projectPath: row.project_path, title: row.title, status: row.status, lastEventAt: row.last_event_at, lastEvent: row.last_event ?? null, lastMessage: row.last_message ?? null, createdAt: row.created_at };
  }
}
