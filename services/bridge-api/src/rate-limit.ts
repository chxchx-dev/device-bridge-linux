export interface RateLimitOptions {
  windowMs?: number;
  pairingMax?: number;
  authFailureMax?: number;
  actionMax?: number;
}

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly pairingMax: number;
  private readonly authFailureMax: number;
  private readonly actionMax: number;

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.pairingMax = options.pairingMax ?? 5;
    this.authFailureMax = options.authFailureMax ?? 20;
    this.actionMax = options.actionMax ?? 30;
  }

  allowPairing(key: string): boolean { return this.allow(`pairing:${key}`, this.pairingMax); }
  allowAuthFailure(key: string): boolean { return this.allow(`auth:${key}`, this.authFailureMax); }
  allowAction(key: string): boolean { return this.allow(`action:${key}`, this.actionMax); }

  private allow(key: string, limit: number): boolean {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }
}
