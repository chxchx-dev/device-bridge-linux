import type { Mode } from '@devicebridge/contracts';
import type { ServiceRecord } from './service-registry.js';

export type ModePlan = {
  target: Mode;
  start: readonly string[];
  stop: readonly string[];
  checks: readonly string[];
};

export function buildModePlan(target: Mode, services: readonly ServiceRecord[]): ModePlan {
  const registered = new Set(services.map((service) => service.id));
  const pick = (ids: readonly string[]) => ids.filter((id) => registered.has(id));
  return target === 'dev'
    ? { target, start: pick(['bridge', 'web-console']), stop: pick(['sunshine']), checks: ['fedora', 'tailnet', 'web-console'] }
    : { target, start: pick(['sunshine']), stop: pick(['bridge', 'web-console']), checks: ['fedora', 'tailnet', 'sunshine'] };
}
