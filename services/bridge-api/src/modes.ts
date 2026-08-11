import type { Mode } from '@devicebridge/contracts';
import type { DockerModeAdapter } from './docker.js';
import type { SunshineOperation } from './integrations.js';

export type ModeStatus = { mode: Mode | null; transitioning: boolean };

export interface ModeAdapters {
  docker: DockerModeAdapter;
  sunshine(operation: SunshineOperation): Promise<{ requested: SunshineOperation; active: boolean }>;
}

export class ModeOrchestrator {
  private activeMode: Mode | null = null;
  private transitioning = false;

  constructor(private readonly adapters: ModeAdapters) {}

  status(): ModeStatus {
    return { mode: this.activeMode, transitioning: this.transitioning };
  }

  async switchTo(target: Mode): Promise<ModeStatus> {
    if (this.transitioning) throw new Error('Mode transition already in progress');
    if (this.activeMode === target) return this.status();

    const previous = this.activeMode;
    this.transitioning = true;
    let dockerChanged = false;
    let sunshineChanged = false;
    try {
      if (target === 'dev') {
        sunshineChanged = true;
        await this.adapters.sunshine('stop');
        await this.adapters.docker.startDev();
        dockerChanged = true;
      } else {
        await this.adapters.docker.stopDev();
        dockerChanged = true;
        sunshineChanged = true;
        await this.adapters.sunshine('start');
      }
      this.activeMode = target;
      this.transitioning = false;
      return this.status();
    } catch (error) {
      await this.rollback(target, dockerChanged, sunshineChanged, previous);
      throw error;
    } finally {
      this.transitioning = false;
    }
  }

  private async rollback(target: Mode, dockerChanged: boolean, sunshineChanged: boolean, previous: Mode | null): Promise<void> {
    try {
      if (target === 'dev' && dockerChanged) await this.adapters.docker.stopDev();
      if (target === 'game' && sunshineChanged) await this.adapters.sunshine('stop');
      if (target === 'dev' && sunshineChanged) await this.adapters.sunshine('start');
      if (target === 'game' && dockerChanged && previous === 'dev') await this.adapters.docker.startDev();
    } catch {
      this.activeMode = null;
    }
  }
}
