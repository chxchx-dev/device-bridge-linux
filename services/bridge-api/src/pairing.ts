import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DeviceId } from '@devicebridge/contracts';

interface DeviceRecord {
  deviceId: DeviceId;
  tokenHash: string;
  revoked: boolean;
  createdAt: string;
  expiresAt: number;
  capabilities: readonly string[];
}

interface PairingRecord {
  tokenHash: string;
  codeHash: string;
  expiresAt: number;
  consumed: boolean;
  failedAttempts: number;
}

type DeviceRow = { device_id: DeviceId; token_hash: string; revoked: number; created_at: string; expires_at: number; capabilities: string };

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function pairingCodeForToken(token: string): string {
  const numeric = Number.parseInt(hashSecret(token).slice(0, 7), 16) % 900000 + 100000;
  return String(numeric);
}

function equalHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export interface PairingResult {
  deviceId: DeviceId;
  deviceToken: string;
  expiresAt: string;
}

export class PairingStore {
  private readonly devices = new Map<DeviceId, DeviceRecord>();
  private pairing: PairingRecord | undefined;
  private readonly database?: DatabaseSync;

  constructor(private readonly defaultCapabilities: readonly string[] = ['system:read'], filename = ':memory:') {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
      this.database = new DatabaseSync(filename);
      this.database.prepare('PRAGMA journal_mode = WAL').run();
      this.database.prepare('CREATE TABLE IF NOT EXISTS paired_devices (device_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, revoked INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, capabilities TEXT NOT NULL)').run();
      const rows = this.database.prepare('SELECT * FROM paired_devices').all() as unknown as DeviceRow[];
      for (const row of rows) this.devices.set(row.device_id, { deviceId: row.device_id, tokenHash: row.token_hash, revoked: row.revoked === 1, createdAt: row.created_at, expiresAt: row.expires_at, capabilities: JSON.parse(row.capabilities) as string[] });
    }
  }

  seedDevice(deviceId: DeviceId, token: string, capabilities = this.defaultCapabilities): void {
    const record: DeviceRecord = {
      deviceId,
      tokenHash: hashSecret(token),
      revoked: false,
      createdAt: new Date().toISOString(),
      expiresAt: Number.MAX_SAFE_INTEGER,
      capabilities: [...capabilities],
    };
    this.saveDevice(record);
  }

  issuePairingToken(token: string, ttlSeconds = 600): string {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.pairing = { tokenHash: hashSecret(token), codeHash: hashSecret(pairingCodeForToken(token)), expiresAt, consumed: false, failedAttempts: 0 };
    return new Date(expiresAt).toISOString();
  }

  completePairing(deviceId: DeviceId, token: string, capabilities = this.defaultCapabilities): PairingResult | undefined {
    const pairing = this.pairing;
    if (!pairing || pairing.consumed || pairing.expiresAt <= Date.now() || pairing.failedAttempts >= 5) return undefined;
    const suppliedHash = token.length === 6 && /^\d{6}$/.test(token) ? pairing.codeHash : pairing.tokenHash;
    if (!equalHash(suppliedHash, hashSecret(token))) {
      pairing.failedAttempts += 1;
      return undefined;
    }

    pairing.consumed = true;
    const deviceToken = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const record: DeviceRecord = {
      deviceId,
      tokenHash: hashSecret(deviceToken),
      revoked: false,
      createdAt: new Date().toISOString(),
      expiresAt,
      capabilities: [...capabilities],
    };
    this.saveDevice(record);
    return { deviceId, deviceToken, expiresAt: new Date(expiresAt).toISOString() };
  }

  authenticate(deviceId: DeviceId, token: string): boolean {
    const device = this.devices.get(deviceId);
    return Boolean(device && !device.revoked && device.expiresAt > Date.now() && equalHash(device.tokenHash, hashSecret(token)));
  }

  capabilities(deviceId: DeviceId): readonly string[] {
    return this.devices.get(deviceId)?.capabilities ?? [];
  }

  revoke(deviceId: DeviceId): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    device.revoked = true;
    this.saveDevice(device);
    return true;
  }

  isRevoked(deviceId: DeviceId): boolean {
    return this.devices.get(deviceId)?.revoked ?? false;
  }

  static generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  static generateRequestId(): string {
    return randomUUID();
  }

  private saveDevice(device: DeviceRecord): void {
    this.devices.set(device.deviceId, device);
    this.database?.prepare(`INSERT INTO paired_devices(device_id, token_hash, revoked, created_at, expires_at, capabilities) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(device_id) DO UPDATE SET token_hash=excluded.token_hash, revoked=excluded.revoked, created_at=excluded.created_at, expires_at=excluded.expires_at, capabilities=excluded.capabilities`).run(device.deviceId, device.tokenHash, device.revoked ? 1 : 0, device.createdAt, device.expiresAt, JSON.stringify(device.capabilities));
  }
}

export function hashForTest(secret: string): string {
  return hashSecret(secret);
}
