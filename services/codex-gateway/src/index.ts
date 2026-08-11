import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export { CodexThreadStore } from './thread-store.js';
export type { CodexFileChange, CodexThreadMetadata, CodexThreadStatus } from './thread-store.js';
export { CodexAppServer } from './app-server.js';
export type { CodexApprovalRequest, CodexAppServerOptions, CodexServerEvent } from './app-server.js';
export { CodexApprovalBroker } from './approval-broker.js';
export type { CodexApprovalDecision, CodexApprovalMetadata, CodexApprovalRisk } from './approval-broker.js';

/** Do not expose this module directly to the network. */
export interface CodexGatewayStatus {
  enabled: boolean;
  mode: 'disabled' | 'sdk' | 'app-server';
  connected: boolean;
  cliVersion: string | null;
}

export function getCodexGatewayStatus(): CodexGatewayStatus {
  return {
    enabled: process.env.CODEX_GATEWAY_ENABLED === 'true',
    mode: process.env.CODEX_GATEWAY_ENABLED === 'true' ? 'app-server' : 'disabled',
    connected: false,
    cliVersion: null,
  };
}

type AppServerMessage = { id?: number; result?: { userAgent?: string } };

/**
 * Performs a bounded, read-only App Server handshake. It deliberately does
 * not start a thread or turn, and never forwards stderr or raw protocol data.
 */
export function probeCodexGateway(timeoutMs = 10_000): Promise<CodexGatewayStatus> {
  const base = getCodexGatewayStatus();
  if (!base.enabled) return Promise.resolve(base);

  return new Promise((resolve) => {
    const child = spawn('codex', ['app-server', '--listen', 'stdio://'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const readline = createInterface({ input: child.stdout });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve(base);
    }, timeoutMs);
    let settled = false;

    const finish = (status: CodexGatewayStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      readline.close();
      child.kill('SIGTERM');
      resolve(status);
    };

    child.once('error', () => finish(base));
    readline.on('line', (line) => {
      try {
        const message = JSON.parse(line) as AppServerMessage;
        if (message.id !== 1 || !message.result?.userAgent) return;
        const version = message.result.userAgent.match(/codex_[^/]+\/(\S+)/)?.[1] ?? null;
        finish({ ...base, connected: true, cliVersion: version });
      } catch {
        // Ignore non-protocol lines; no process output is returned to clients.
      }
    });

    child.stdin.write(`${JSON.stringify({ method: 'initialize', id: 1, params: { clientInfo: { name: 'devicebridge', title: 'DeviceBridge', version: '0.1.0' } } })}\n`);
    child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
  });
}
