import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendAuditRecord } from './audit.js';

test('audit records rotate at a bounded size and preserve restrictive permissions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'devicebridge-audit-'));
  const path = join(directory, 'audit.jsonl');
  appendAuditRecord(path, { event: 'first', payload: 'x'.repeat(120) }, 100);
  appendAuditRecord(path, { event: 'second' }, 100);
  const files = readdirSync(directory).sort();
  assert.deepEqual(files, ['audit.jsonl', 'audit.jsonl.1']);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).event, 'second');
  assert.equal(JSON.parse(readFileSync(`${path}.1`, 'utf8')).event, 'first');
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(statSync(`${path}.1`).mode & 0o777, 0o600);
  rmSync(directory, { recursive: true, force: true });
});
