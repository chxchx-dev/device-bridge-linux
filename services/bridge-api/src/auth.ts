import type { FastifyRequest } from 'fastify';
import { DeviceIdSchema } from '@devicebridge/contracts';
import { PairingStore } from './pairing.js';

export interface AuthContext {
  deviceId: string;
}

export function authenticate(request: FastifyRequest, store: PairingStore): AuthContext | undefined {
  const deviceIdResult = DeviceIdSchema.safeParse(request.headers['x-devicebridge-device']);
  const authorization = request.headers.authorization;
  if (!deviceIdResult.success || !authorization?.startsWith('Bearer ')) return undefined;

  const token = authorization.slice('Bearer '.length);
  if (!token || !store.authenticate(deviceIdResult.data, token)) return undefined;
  return { deviceId: deviceIdResult.data };
}
