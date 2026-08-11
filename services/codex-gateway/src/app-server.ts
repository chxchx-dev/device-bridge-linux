import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { isAbsolute, relative, resolve } from 'node:path';

export type CodexServerEvent = { method: string; params: unknown };
export type CodexApprovalRequest = { method: string; params: unknown; requestId: number | string };

type ProtocolMessage = { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { code?: number; message?: string } };
type PendingRequest = { resolve: (value: unknown) => void; reject: (error: Error) => void };

export interface CodexAppServerOptions {
  allowedProjects: readonly string[];
  onEvent?: (event: CodexServerEvent) => void;
  onApproval?: (request: CodexApprovalRequest) => Promise<unknown>;
  executable?: string;
  timeoutMs?: number;
}

function isInsideAllowedProject(candidate: string, allowedProjects: readonly string[]): string | undefined {
  if (!isAbsolute(candidate)) return undefined;
  const resolved = resolve(candidate);
  return allowedProjects.some((project) => {
    const root = resolve(project);
    const remainder = relative(root, resolved);
    return remainder === '' || (!remainder.startsWith('..') && !isAbsolute(remainder));
  }) ? resolved : undefined;
}

function objectValue(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function threadIdFromResult(value: unknown): string {
  const thread = objectValue(value, 'thread');
  const id = objectValue(thread, 'id') ?? objectValue(value, 'threadId');
  if (typeof id !== 'string' || id.length < 1) throw new Error('Codex App Server returned no thread ID');
  return id;
}

/** Narrow local App Server client. It accepts only typed thread/turn requests. */
export class CodexAppServer {
  private readonly options: Required<Pick<CodexAppServerOptions, 'timeoutMs'>> & Omit<CodexAppServerOptions, 'timeoutMs'>;
  private child?: ChildProcess;
  private lines?: Interface;
  private nextId = 2;
  private readonly pending = new Map<number | string, PendingRequest>();

  constructor(options: CodexAppServerOptions) {
    this.options = { ...options, timeoutMs: options.timeoutMs ?? 15_000 };
  }

  async connect(): Promise<void> {
    if (this.child) return;
    const child = spawn(this.options.executable ?? 'codex', ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.child = child;
    this.lines = createInterface({ input: child.stdout });
    child.once('error', (error) => this.failPending(error instanceof Error ? error : new Error('Codex App Server process failed')));
    child.once('exit', () => this.failPending(new Error('Codex App Server exited')));
    this.lines.on('line', (line) => this.handleLine(line));
    await this.request('initialize', { clientInfo: { name: 'devicebridge', title: 'DeviceBridge', version: '0.1.0' } });
    this.write({ method: 'initialized', params: {} });
  }

  async startThread(projectPath: string, title: string | null = null): Promise<{ threadId: string; projectPath: string; title: string | null }> {
    const safeProject = isInsideAllowedProject(projectPath, this.options.allowedProjects);
    if (!safeProject) throw new Error('Project is not registered for Codex control');
    await this.connect();
    const result = await this.request('thread/start', { cwd: safeProject, approvalPolicy: 'untrusted', sandbox: 'workspace-write' });
    return { threadId: threadIdFromResult(result), projectPath: safeProject, title };
  }

  async startTurn(threadId: string, prompt: string): Promise<unknown> {
    if (!/^[A-Za-z0-9._:-]{1,200}$/.test(threadId)) throw new Error('Invalid Codex thread ID');
    if (prompt.length < 1 || prompt.length > 20_000) throw new Error('Invalid Codex prompt');
    await this.connect();
    return this.request('turn/start', { threadId, input: [{ type: 'text', text: prompt }] });
  }

  close(): void {
    this.lines?.close();
    this.child?.kill('SIGTERM');
    this.child = undefined;
    this.failPending(new Error('Codex App Server closed'));
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Codex App Server request timed out')); }, this.options.timeoutMs);
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolvePromise(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      this.write({ id, method, params });
    });
  }

  private write(message: Record<string, unknown>): void {
    const stdin = this.child?.stdin;
    if (!stdin?.writable) throw new Error('Codex App Server is not connected');
    stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    let message: ProtocolMessage;
    try { message = JSON.parse(line) as ProtocolMessage; } catch { return; }
    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'Codex App Server request failed'));
      else pending.resolve(message.result);
      return;
    }
    if (message.method && message.id !== undefined) {
      const approval = message.method.includes('requestApproval');
      if (approval && this.options.onApproval) void this.options.onApproval({ method: message.method, params: message.params, requestId: message.id }).then((result) => this.write({ id: message.id, result })).catch(() => this.write({ id: message.id, error: { code: -32000, message: 'Approval was denied' } }));
      else if (this.options.onEvent) this.options.onEvent({ method: message.method, params: message.params });
      return;
    }
    if (message.method) this.options.onEvent?.({ method: message.method, params: message.params });
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
