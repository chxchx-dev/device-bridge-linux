import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { actionRegistry } from '@devicebridge/command-registry';
import { readIntegrationStatus } from '@devicebridge/bridge-api/integrations';
import { readDeviceStatus } from '@devicebridge/bridge-api/system';

const capabilities = new Set((process.env.DEVICEBRIDGE_MCP_CAPABILITIES ?? 'system:read,android:read,gaming:read,mode:read,codex:read').split(',').map((value) => value.trim()).filter(Boolean));
const requireCapability = (capability: string): void => { if (!capabilities.has(capability)) throw new Error('MCP capability denied'); };
const projects = (process.env.DEVICEBRIDGE_CODEX_PROJECTS ?? '').split(',').flatMap((entry) => {
  const separator = entry.indexOf('=');
  return separator > 0 ? [{ id: entry.slice(0, separator), path: entry.slice(separator + 1) }] : [];
});

const server = new McpServer({ name: 'devicebridge', version: '0.1.0' }, {
  instructions: 'DeviceBridge exposes read-only Fedora and Android status through typed tools. Check status before proposing changes. Write actions are not available through this server; never ask for shell commands or secrets.'
});

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

await server.connect(new StdioServerTransport());
