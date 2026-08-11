import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WEB_CONSOLE_SERVICE = 'devicebridge-web-console.service';

export type LocalDevAdapter = {
  startDev(): Promise<void>;
  stopDev(): Promise<void>;
};

async function controlWebConsole(operation: 'start' | 'stop'): Promise<void> {
  try {
    await execFileAsync('/usr/bin/systemctl', ['--user', operation, WEB_CONSOLE_SERVICE], { timeout: 10_000, maxBuffer: 16 * 1024 });
  } catch {
    throw new Error('Local web console service adapter failed');
  }
}

export function createLocalDevAdapter(): LocalDevAdapter {
  return {
    startDev: () => controlWebConsole('start'),
    stopDev: () => controlWebConsole('stop'),
  };
}
