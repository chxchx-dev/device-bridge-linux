import { z } from 'zod';

export const RiskClassSchema = z.enum(['R0', 'R1', 'R2', 'R3']);
export type RiskClass = z.infer<typeof RiskClassSchema>;

export const ActionIdSchema = z.enum([
  'system.status',
  'mode.status',
  'mode.switch',
  'integrations.status',
  'android.kdeconnect.status',
  'android.scrcpy.start',
  'system.lock',
  'system.suspend',
  'system.shutdown',
  'system.unlock',
  'gaming.sunshine.status',
  'gaming.sunshine.start',
  'gaming.sunshine.stop',
  'android.adb.status',
  'codex.status',
  'codex.threads.list',
  'codex.approval.respond',
]);
export type ActionId = z.infer<typeof ActionIdSchema>;

export const ModeSchema = z.enum(['dev', 'game']);
export type Mode = z.infer<typeof ModeSchema>;

export const ModeSwitchInputSchema = z.object({ target: ModeSchema });
export type ModeSwitchInput = z.infer<typeof ModeSwitchInputSchema>;

export const DeviceIdSchema = z.string().regex(/^(android|fedora)-[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/, 'Invalid DeviceBridge device ID');
export type DeviceId = z.infer<typeof DeviceIdSchema>;

export const PairingRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  pairingToken: z.string().max(256).refine((value) => value.length >= 24 || /^\d{6}$/.test(value), 'Pairing token must be a long token or six-digit code'),
});
export type PairingRequest = z.infer<typeof PairingRequestSchema>;

export const PairingResponseSchema = z.object({
  deviceId: DeviceIdSchema,
  deviceToken: z.string().min(32),
  expiresAt: z.string().datetime(),
});
export type PairingResponse = z.infer<typeof PairingResponseSchema>;

export const ActionRequestSchema = z.object({
  input: z.record(z.unknown()).default({}),
  confirmation: z.object({ challengeId: z.string().min(16).nullable() }).optional(),
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const DeviceStatusSchema = z.object({
  hostname: z.string(),
  platform: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  cpuCount: z.number().int().positive(),
  totalMemoryBytes: z.number().nonnegative(),
  freeMemoryBytes: z.number().nonnegative(),
});
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const AuditEventSchema = z.object({
  timestamp: z.string().datetime(),
  requestId: z.string().uuid(),
  deviceId: DeviceIdSchema.nullable(),
  method: z.string().min(1),
  path: z.string().min(1),
  outcome: z.enum(['accepted', 'rejected', 'failed']),
  actionId: ActionIdSchema.nullable().optional(),
  risk: RiskClassSchema.nullable().optional(),
  capability: z.string().min(1).nullable().optional(),
  authorization: z.enum(['granted', 'denied', 'not_required']).optional(),
  executionStatus: z.enum(['not_run', 'completed', 'failed']).optional(),
  durationMs: z.number().nonnegative().optional(),
  reason: z.string().min(1).optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const ActionChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  actionId: ActionIdSchema,
  expiresAt: z.string().datetime(),
});
export type ActionChallenge = z.infer<typeof ActionChallengeSchema>;
