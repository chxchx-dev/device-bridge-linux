import os from 'node:os';
import type { DeviceStatus } from '@devicebridge/contracts';

export function readDeviceStatus(): DeviceStatus {
  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    uptimeSeconds: os.uptime(),
    cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
  };
}
