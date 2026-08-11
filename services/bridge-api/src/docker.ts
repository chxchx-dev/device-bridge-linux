import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type DockerModeAdapter = {
  startDev(): Promise<void>;
  stopDev(): Promise<void>;
};

function composeFile(): string {
  const configured = process.env.DEVICEBRIDGE_DEV_COMPOSE_FILE;
  if (!configured || !configured.startsWith('/')) throw new Error('DeviceBridge Compose file is not configured');
  return configured;
}

async function runCompose(args: readonly string[]): Promise<void> {
  const file = composeFile();
  await access(file);
  try {
    await execFileAsync('/usr/bin/docker', ['compose', '--file', file, ...args], { timeout: 30_000, maxBuffer: 64 * 1024 });
  } catch {
    throw new Error('Docker mode adapter failed');
  }
}

export function createDockerModeAdapter(): DockerModeAdapter {
  return {
    startDev: () => runCompose(['up', '--detach']),
    stopDev: () => runCompose(['stop']),
  };
}
