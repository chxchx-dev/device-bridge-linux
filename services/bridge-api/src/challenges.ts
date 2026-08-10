import { randomUUID } from 'node:crypto';
import type { ActionId } from '@devicebridge/contracts';

interface ChallengeRecord {
  challengeId: string;
  deviceId: string;
  actionId: ActionId;
  expiresAt: number;
  consumed: boolean;
}

export class ChallengeStore {
  private readonly challenges = new Map<string, ChallengeRecord>();

  issue(deviceId: string, actionId: ActionId, ttlSeconds = 60): { challengeId: string; expiresAt: string } {
    const challengeId = randomUUID();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.challenges.set(challengeId, { challengeId, deviceId, actionId, expiresAt, consumed: false });
    return { challengeId, expiresAt: new Date(expiresAt).toISOString() };
  }

  consume(deviceId: string, actionId: ActionId, challengeId: string): boolean {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.consumed || challenge.expiresAt <= Date.now()) return false;
    if (challenge.deviceId !== deviceId || challenge.actionId !== actionId) return false;
    challenge.consumed = true;
    return true;
  }
}
