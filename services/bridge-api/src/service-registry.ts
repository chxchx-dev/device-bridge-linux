import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type RegisteredMode = 'dev' | 'game';
export type ServiceRecord = {
  id: string;
  unit: string;
  control: 'user-systemd';
  allowedModes: readonly RegisteredMode[];
};
export type ServiceStatus = ServiceRecord & {
  active: boolean;
  available: boolean;
};

const DEFAULT_SERVICES: readonly ServiceRecord[] = [
  { id: 'bridge', unit: 'devicebridge-bridge.service', control: 'user-systemd', allowedModes: ['dev'] },
  { id: 'web-console', unit: 'devicebridge-web-console.service', control: 'user-systemd', allowedModes: ['dev'] },
  { id: 'sunshine', unit: 'sunshine.service', control: 'user-systemd', allowedModes: ['game'] },
];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;
const UNIT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9@_.-]{0,120}\.service$/;

function parseEntry(entry: string): ServiceRecord | undefined {
  const separator = entry.indexOf('=');
  if (separator < 1) return undefined;
  const id = entry.slice(0, separator);
  const parts = entry.slice(separator + 1).split(':', 2);
  const unit = parts[0] ?? '';
  const modes = parts[1] ?? '';
  const allowedModes = modes.split('|').filter((mode): mode is RegisteredMode => mode === 'dev' || mode === 'game');
  if (!ID_PATTERN.test(id) || !UNIT_PATTERN.test(unit) || allowedModes.length === 0) return undefined;
  return { id, unit, control: 'user-systemd', allowedModes: [...new Set(allowedModes)] };
}

export function configuredServices(value: string | undefined): readonly ServiceRecord[] {
  if (!value?.trim()) return DEFAULT_SERVICES;
  const parsed = value.split(',').map((entry) => parseEntry(entry.trim())).filter((service): service is ServiceRecord => service !== undefined);
  return parsed.length ? parsed : DEFAULT_SERVICES;
}

export type ServiceStatusReader = (unit: string) => Promise<{ available: boolean; active: boolean }>;

async function readUserService(unit: string): Promise<{ available: boolean; active: boolean }> {
  try {
    const result = await execFileAsync('/usr/bin/systemctl', ['--user', 'is-active', unit], { timeout: 10_000, maxBuffer: 16 * 1024 });
    return { available: true, active: result.stdout.trim() === 'active' };
  } catch (error) {
    const result = error as { stdout?: string; code?: string | number };
    return { available: result.code !== 'ENOENT', active: result.stdout?.trim() === 'active' };
  }
}

export class ServiceRegistry {
  constructor(private readonly records: readonly ServiceRecord[], private readonly readStatus: ServiceStatusReader = readUserService) {}

  list(): readonly ServiceRecord[] { return this.records; }

  async status(): Promise<readonly ServiceStatus[]> {
    return Promise.all(this.records.map(async (record) => ({ ...record, ...(await this.readStatus(record.unit)) })));
  }
}

export function createServiceRegistry(value = process.env.DEVICEBRIDGE_SERVICES): ServiceRegistry {
  return new ServiceRegistry(configuredServices(value));
}
