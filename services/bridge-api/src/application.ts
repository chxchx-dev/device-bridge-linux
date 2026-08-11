import type { DeviceStatus, Mode } from '@devicebridge/contracts';
import { controlSunshine, readIntegrationStatus, type IntegrationStatus, type SunshineControlResult, type SunshineOperation } from './integrations.js';
import { createLocalDevAdapter, isWebConsoleActive, type LocalDevAdapter } from './local-services.js';
import { ModeOrchestrator, type ModeStatus } from './modes.js';
import { readDeviceStatus } from './system.js';

export type PreflightChecks = {
  fedoraReachable: boolean;
  adbConnected: boolean;
  sunshineAvailable: boolean;
  sunshineActive: boolean;
  webConsoleAvailable: boolean;
};

export interface DeviceBridgeApplicationOptions {
  deviceStatus?: () => DeviceStatus;
  integrationStatus?: () => Promise<IntegrationStatus>;
  sunshineControl?: (operation: SunshineOperation) => Promise<SunshineControlResult>;
  local?: LocalDevAdapter;
  modes?: ModeOrchestrator;
  webConsoleStatus?: () => Promise<boolean>;
}

export class DeviceBridgeApplication {
  readonly modes: ModeOrchestrator;
  private readonly readStatus: () => DeviceStatus;
  private readonly readIntegrations: () => Promise<IntegrationStatus>;
  private readonly readWebConsoleStatus: () => Promise<boolean>;

  constructor(options: DeviceBridgeApplicationOptions = {}) {
    this.readStatus = options.deviceStatus ?? readDeviceStatus;
    this.readIntegrations = options.integrationStatus ?? readIntegrationStatus;
    this.readWebConsoleStatus = options.webConsoleStatus ?? isWebConsoleActive;
    const sunshine = options.sunshineControl ?? controlSunshine;
    this.modes = options.modes ?? new ModeOrchestrator({ local: options.local ?? createLocalDevAdapter(), sunshine });
  }

  deviceStatus(): DeviceStatus {
    return this.readStatus();
  }

  integrations(): Promise<IntegrationStatus> {
    return this.readIntegrations();
  }

  modeStatus(): ModeStatus {
    return this.modes.status();
  }

  switchMode(target: Mode): Promise<ModeStatus> {
    return this.modes.switchTo(target);
  }

  async preflight(): Promise<{ checks: PreflightChecks; ready: boolean }> {
    const [device, integration, webConsoleAvailable] = await Promise.all([this.deviceStatus(), this.integrations(), this.readWebConsoleStatus()]);
    const checks: PreflightChecks = {
      fedoraReachable: Boolean(device.platform),
      adbConnected: integration.adb.connected,
      sunshineAvailable: integration.sunshine.available,
      sunshineActive: integration.sunshine.active,
      webConsoleAvailable,
    };
    return { checks, ready: checks.fedoraReachable && checks.sunshineAvailable };
  }
}
