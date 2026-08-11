import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { actionRegistry } from '@devicebridge/command-registry';
import { controlSunshine, readIntegrationStatus } from '@devicebridge/bridge-api/integrations';
import { createLocalDevAdapter } from '@devicebridge/bridge-api/local-services';
import { ModeOrchestrator } from '@devicebridge/bridge-api/modes';
import { readDeviceStatus } from '@devicebridge/bridge-api/system';

const capabilities = new Set((process.env.DEVICEBRIDGE_MCP_CAPABILITIES ?? 'system:read,android:read,gaming:read,mode:read,codex:read').split(',').map((value) => value.trim()).filter(Boolean));
const requireCapability = (capability: string): void => { if (!capabilities.has(capability)) throw new Error('MCP capability denied'); };
const requireConfirmedWrite = (confirmed: boolean): void => { requireCapability('mode:control'); if (!confirmed) throw new Error('Explicit confirmation is required for mode changes'); };
const auditPath = process.env.DEVICEBRIDGE_MCP_AUDIT_LOG ?? '.local/state/devicebridge/mcp-audit.jsonl';
const audit = (actionId: string, outcome: 'accepted' | 'rejected' | 'failed', capability: string): void => {
  mkdirSync(dirname(auditPath), { recursive: true, mode: 0o700 });
  appendFileSync(auditPath, `${JSON.stringify({ timestamp: new Date().toISOString(), requestId: randomUUID(), actionId, outcome, capability })}\n`, { mode: 0o600 });
};
const projects = (process.env.DEVICEBRIDGE_CODEX_PROJECTS ?? '').split(',').flatMap((entry) => {
  const separator = entry.indexOf('=');
  return separator > 0 ? [{ id: entry.slice(0, separator), path: entry.slice(separator + 1) }] : [];
});

const server = new McpServer({ name: 'devicebridge', version: '0.1.0' }, {
  instructions: 'DeviceBridge exposes typed Fedora and Android tools. Check status before proposing changes. Mode changes are disabled unless the MCP process has mode:control and the caller confirms explicitly; never ask for shell commands or secrets.'
});
const modes = new ModeOrchestrator({ local: createLocalDevAdapter(), sunshine: controlSunshine });

server.registerTool('device_status', {
  title: 'Read Fedora status', description: 'Read basic Fedora host status. Read-only.', inputSchema: {}, outputSchema: { status: z.object({ hostname: z.string(), platform: z.string(), uptimeSeconds: z.number(), cpuCount: z.number(), totalMemoryBytes: z.number(), freeMemoryBytes: z.number() }) }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async () => { requireCapability('system:read'); const status = await readDeviceStatus(); return { structuredContent: { status }, content: [{ type: 'text', text: `Fedora is reachable with ${status.cpuCount} CPUs.` }] }; });

server.registerTool('list_actions', {
  title: 'List DeviceBridge actions', description: 'List declared actions and their capabilities. Does not execute anything.', inputSchema: {}, outputSchema: { actions: z.array(z.object({ id: z.string(), risk: z.string(), capability: z.string(), description: z.string() })) }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async () => { requireCapability('system:read'); const actions = Object.values(actionRegistry).filter((action) => capabilities.has(action.capability)).map(({ id, risk, capability, description }) => ({ id, risk, capability, description })); return { structuredContent: { actions }, content: [{ type: 'text', text: `${actions.length} authorized actions are available.` }] }; });

server.registerTool('list_projects', {
  title: 'List Codex projects', description: 'List registered Codex project identifiers without exposing filesystem paths.', inputSchema: {}, outputSchema: { projects: z.array(z.object({ id: z.string() })) }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async () => { requireCapability('codex:read'); const result = projects.map(({ id }) => ({ id })); return { structuredContent: { projects: result }, content: [{ type: 'text', text: `${result.length} Codex projects are registered.` }] }; });

server.registerTool('sunshine_status', {
  title: 'Read Sunshine status', description: 'Read configured Sunshine availability. Read-only.', inputSchema: {}, outputSchema: { status: z.object({ available: z.boolean(), active: z.boolean() }) }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async () => { requireCapability('gaming:read'); const status = (await readIntegrationStatus()).sunshine; return { structuredContent: { status }, content: [{ type: 'text', text: status.active ? 'Sunshine is active.' : 'Sunshine is inactive.' }] }; });

server.registerTool('android_adb_status', {
  title: 'Read Android ADB status', description: 'Read whether the configured Android device is connected through ADB. Read-only.', inputSchema: {}, outputSchema: { status: z.object({ available: z.boolean(), connected: z.boolean(), deviceCount: z.number() }) }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async () => { requireCapability('android:read'); const status = (await readIntegrationStatus()).adb; return { structuredContent: { status }, content: [{ type: 'text', text: status.connected ? `${status.deviceCount} Android device(s) connected.` : 'No Android device connected.' }] }; });

const safeReadAction = z.enum(['system.status', 'integrations.status', 'android.kdeconnect.status', 'android.adb.status', 'gaming.sunshine.status']);
const safeReadOutput = z.object({ actionId: z.string(), result: z.record(z.unknown()) });
server.registerTool('run_safe_action', {
  title: 'Run a safe read-only action', description: 'Run one declared R0 DeviceBridge status action. The action ID is closed and no shell command or arbitrary process input is accepted.', inputSchema: { actionId: safeReadAction }, outputSchema: { result: safeReadOutput }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async ({ actionId }) => {
  const capability = actionId.startsWith('android.') ? 'android:read' : actionId.startsWith('gaming.') ? 'gaming:read' : 'system:read';
  try {
    requireCapability(capability);
    const integration = actionId === 'system.status' ? undefined : await readIntegrationStatus();
    const result = actionId === 'system.status' ? await readDeviceStatus() : actionId === 'integrations.status' ? integration : actionId === 'android.kdeconnect.status' ? integration!.kdeConnect : actionId === 'android.adb.status' ? integration!.adb : integration!.sunshine;
    audit(actionId, 'accepted', capability);
    return { structuredContent: { result: { actionId, result } }, content: [{ type: 'text', text: `${actionId} completed.` }] };
  } catch {
    audit(actionId, 'rejected', capability);
    throw new Error('MCP safe action denied');
  }
});

const modeInput = { confirmed: z.boolean().describe('Must be true after the user explicitly confirms the mode change.') };
const modeOutput = { status: z.object({ mode: z.enum(['dev', 'game']).nullable(), transitioning: z.boolean() }), preflight: z.object({ adbConnected: z.boolean(), sunshineActive: z.boolean(), webConsoleAvailable: z.boolean() }) };
const runModeAutomation = async (target: 'dev' | 'game', confirmed: boolean) => {
  requireConfirmedWrite(confirmed);
  const preflight = await readIntegrationStatus();
  audit(`mode.${target}`, 'accepted', 'mode:control');
  const status = await modes.switchTo(target);
  return { structuredContent: { status, preflight: { adbConnected: preflight.adb.connected, sunshineActive: preflight.sunshine.active, webConsoleAvailable: preflight.sunshine.available } }, content: [{ type: 'text' as const, text: `${target === 'dev' ? 'Work' : 'Game'} Mode is active.` }] };
};
server.registerTool('start_dev_mode', {
  title: 'Start Dev Mode', description: 'Switch Fedora to Dev Mode. This stops Sunshine and starts the configured local web service; it changes system state and requires explicit user confirmation.', inputSchema: modeInput, outputSchema: modeOutput, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ confirmed }) => runModeAutomation('dev', confirmed));

server.registerTool('start_game_mode', {
  title: 'Start Game Mode', description: 'Switch Fedora to Game Mode. This stops the local web service and starts Sunshine; it changes system state and requires explicit user confirmation.', inputSchema: modeInput, outputSchema: modeOutput, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ confirmed }) => runModeAutomation('game', confirmed));

server.registerTool('work_mode', {
  title: 'Activate Work Mode', description: 'Run the approved Work Mode automation: verify integrations, stop Sunshine and start the local development service. Requires explicit confirmation.', inputSchema: modeInput, outputSchema: modeOutput, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ confirmed }) => runModeAutomation('dev', confirmed));

server.registerTool('game_mode', {
  title: 'Activate Game Mode', description: 'Run the approved Game Mode automation: verify integrations, stop the local development service and start Sunshine. Requires explicit confirmation.', inputSchema: modeInput, outputSchema: modeOutput, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ confirmed }) => runModeAutomation('game', confirmed));

await server.connect(new StdioServerTransport());
