import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SessionAdapter {
  lock(): Promise<void>;
}

export interface FixedExecutor {
  (file: string, args: readonly string[]): Promise<void>;
}

const fixedExecutor: FixedExecutor = async (file, args) => {
  await execFileAsync(file, [...args], { shell: false, windowsHide: true });
};

export function createSystemSessionAdapter(executor: FixedExecutor = fixedExecutor): SessionAdapter {
  return {
    lock: () => executor('/usr/bin/loginctl', ['lock-session']),
  };
}
