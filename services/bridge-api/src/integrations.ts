import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type IntegrationStatus = {
  kdeConnect: { available: boolean; pairedReachable: boolean; deviceCount: number };
  adb: { available: boolean; connected: boolean; deviceCount: number };
  scrcpy: { available: boolean; version: string | null };
  sunshine: { available: boolean; active: boolean };
};

async function fixedCommand(file: string, args: readonly string[]): Promise<{ ok: boolean; stdout: string }> {
  try {
    const result = await execFileAsync(file, [...args], { timeout: 5000, maxBuffer: 64 * 1024 });
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
