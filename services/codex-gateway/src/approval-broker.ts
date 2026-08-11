import { randomUUID } from 'node:crypto';

export type CodexApprovalDecision = 'approve' | 'deny';
export type CodexApprovalRisk = 'R1' | 'R2' | 'R3';

export interface CodexApprovalMetadata {
  approvalId: string;
  method: string;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  kind: 'command' | 'file-change' | 'permissions' | 'other';
  cwd: string | null;
  summary: string;
  reason: string | null;
  risk: CodexApprovalRisk;
  createdAt: string;
}

type PendingApproval = { metadata: CodexApprovalMetadata; resolve: (decision: CodexApprovalDecision) => void; timer: ReturnType<typeof setTimeout> };

function text(value: unknown, max = 240): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;
}

export class CodexApprovalBroker {
  private readonly pending = new Map<string, PendingApproval>();

  request(input: { method: string; params: unknown }): Promise<CodexApprovalDecision> {
    const params = typeof input.params === 'object' && input.params !== null ? input.params as Record<string, unknown> : {};
    const method = input.method;
    const kind = method.includes('commandExecution') ? 'command' : method.includes('fileChange') ? 'file-change' : method.includes('permissions') ? 'permissions' : 'other';
    const command = text(params.command);
    const summary = command ?? text(params.reason) ?? 'Codex requests user approval';
    const metadata: CodexApprovalMetadata = {
      approvalId: randomUUID(), method, threadId: text(params.threadId, 200), turnId: text(params.turnId, 200), itemId: text(params.itemId, 200), kind,
      cwd: text(params.cwd, 500), summary, reason: text(params.reason), risk: kind === 'permissions' ? 'R3' : kind === 'command' ? 'R2' : 'R1', createdAt: new Date().toISOString(),
    };
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(metadata.approvalId); resolve('deny'); }, 5 * 60 * 1000);
      this.pending.set(metadata.approvalId, { metadata, resolve, timer });
    });
  }

  list(): CodexApprovalMetadata[] { return [...this.pending.values()].map(({ metadata }) => metadata); }

  respond(approvalId: string, decision: CodexApprovalDecision): boolean {
    const pending = this.pending.get(approvalId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(approvalId);
    pending.resolve(decision);
    return true;
  }
}
