import { execFile } from 'node:child_process';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type IntegrationStatus = {
  kdeConnect: { available: boolean; pairedReachable: boolean; deviceCount: number };
  adb: { available: boolean; connected: boolean; deviceCount: number };
  scrcpy: { available: boolean; version: string | null };
  sunshine: { available: boolean; active: boolean };
};

export type ScrcpyStartResult = { started: true; pid: number | null };
export type SunshineOperation = 'start' | 'stop';
export type SunshineControlResult = { requested: SunshineOperation; active: boolean };

function configuredScrcpyArgs(): string[] {
  const serial = process.env.DEVICEBRIDGE_SCRCPY_SERIAL;
  if (serial && /^[A-Za-z0-9._:-]+$/.test(serial)) return ['--serial', serial, '--no-audio', '--stay-awake'];
  return ['--no-audio', '--stay-awake'];
}

export function startScrcpy(): Promise<ScrcpyStartResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/scrcpy', configuredScrcpyArgs(), { detached: true, stdio: 'ignore' });
    child.once('error', () => reject(new Error('scrcpy adapter failed')));
    child.once('spawn', () => {
      child.unref();
      resolve({ started: true, pid: child.pid ?? null });
    });
  });
}

export async function controlSunshine(operation: SunshineOperation): Promise<SunshineControlResult> {
  const command = await fixedCommand('/usr/bin/systemctl', ['--user', operation, 'sunshine']);
  if (!command.ok) throw new Error('Sunshine adapter failed');
  const status = await fixedCommand('/usr/bin/systemctl', ['--user', 'is-active', 'sunshine']);
  return { requested: operation, active: status.ok && status.stdout.trim() === 'active' };
}

async function fixedCommand(file: string, args: readonly string[]): Promise<{ ok: boolean; stdout: string }> {
  try {
    const result = await execFileAsync(file, [...args], { timeout: 15_000, maxBuffer: 64 * 1024 });
    return { ok: true, stdout: result.stdout };
  } catch (error) {
    const result = error as { stdout?: string };
    return { ok: false, stdout: result.stdout ?? '' };
  }
}

export async function readIntegrationStatus(): Promise<IntegrationStatus> {
  const [kde, adb, scrcpy, sunshine] = await Promise.all([
    fixedCommand('/usr/bin/kdeconnect-cli', ['--list-devices']),
    fixedCommand('/usr/bin/adb', ['devices', '-l']),
    fixedCommand('/usr/bin/scrcpy', ['--version']),
    fixedCommand('/usr/bin/systemctl', ['--user', 'is-active', 'sunshine']),
  ]);

  const kdeLines = kde.stdout.split('\n').filter((line) => line.trim().startsWith('- '));
  const adbLines = adb.stdout.split('\n').filter((line) => /^\S+\s+device\b/.test(line));
  const scrcpyVersion = scrcpy.stdout.match(/scrcpy\s+([^\s]+)/)?.[1] ?? null;

  return {
    kdeConnect: { available: kde.ok, pairedReachable: kde.ok && kdeLines.some((line) => /paired and reachable/i.test(line)), deviceCount: kdeLines.length },
    adb: { available: adb.ok, connected: adb.ok && adbLines.length > 0, deviceCount: adbLines.length },
    scrcpy: { available: scrcpy.ok, version: scrcpyVersion },
    sunshine: { available: true, active: sunshine.ok && sunshine.stdout.trim() === 'active' },
  };
}
