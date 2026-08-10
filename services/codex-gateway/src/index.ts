/**
 * Phase 06 placeholder.
 *
 * Do not expose this module directly to the network.
 * The Bridge application layer will own authentication/authorization, while
 * this gateway will translate Codex SDK/App Server lifecycle events.
 *
 * Before implementation, re-check the current official Codex SDK/App Server
 * API because it evolves independently from this starter.
 */
export interface CodexGatewayStatus {
  enabled: boolean;
  mode: 'disabled' | 'sdk' | 'app-server';
}

export function getCodexGatewayStatus(): CodexGatewayStatus {
  return {
    enabled: process.env.CODEX_GATEWAY_ENABLED === 'true',
    mode: 'disabled',
  };
}
