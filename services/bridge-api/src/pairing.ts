import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DeviceId } from '@devicebridge/contracts';

interface DeviceRecord {
  deviceId: DeviceId;
  tokenHash: string;
  revoked: boolean;
  createdAt: string;
  expiresAt: number;
}

interface PairingRecord {
  tokenHash: string;
  expiresAt: number;
  consumed: boolean;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
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

  seedDevice(deviceId: DeviceId, token: string): void {
    this.devices.set(deviceId, {
      deviceId,
      tokenHash: hashSecret(token),
      revoked: false,
      createdAt: new Date().toISOString(),
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }

  issuePairingToken(token: string, ttlSeconds = 600): string {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.pairing = { tokenHash: hashSecret(token), expiresAt, consumed: false };
    return new Date(expiresAt).toISOString();
  }

  completePairing(deviceId: DeviceId, token: string): PairingResult | undefined {
    const pairing = this.pairing;
    if (!pairing || pairing.consumed || pairing.expiresAt <= Date.now()) return undefined;
    if (!equalHash(pairing.tokenHash, hashSecret(token))) return undefined;

    pairing.consumed = true;
    const deviceToken = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    this.devices.set(deviceId, {
      deviceId,
      tokenHash: hashSecret(deviceToken),
      revoked: false,
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    return { deviceId, deviceToken, expiresAt: new Date(expiresAt).toISOString() };
  }

  authenticate(deviceId: DeviceId, token: string): boolean {
    const device = this.devices.get(deviceId);
    return Boolean(device && !device.revoked && device.expiresAt > Date.now() && equalHash(device.tokenHash, hashSecret(token)));
  }

  revoke(deviceId: DeviceId): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    device.revoked = true;
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
}

export function hashForTest(secret: string): string {
  return hashSecret(secret);
}
