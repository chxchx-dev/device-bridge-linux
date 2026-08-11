import { appendFileSync, chmodSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const MAX_AUDIT_BYTES = 1_048_576;
const ROTATED_SUFFIX = '.1';

export function appendAuditRecord(path: string, record: Record<string, unknown>, maxBytes = MAX_AUDIT_BYTES): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    if (statSync(path).size >= maxBytes) {
      renameSync(path, `${path}${ROTATED_SUFFIX}`);
      chmodSync(`${path}${ROTATED_SUFFIX}`, 0o600);
    }
  } catch (error) {
    const code = error as NodeJS.ErrnoException;
    if (code.code !== 'ENOENT') throw error;
  }
  appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
