import type { ActionId, RiskClass } from '@devicebridge/contracts';

export interface ActionDefinition {
  id: ActionId;
  risk: RiskClass;
  capability: string;
  enabledByDefault: boolean;
  confirmation: 'none' | 'required' | 'step-up';
  description: string;
}

export const actionRegistry: Readonly<Record<ActionId, ActionDefinition>> = {
  'system.status': { id: 'system.status', risk: 'R0', capability: 'system:read', enabledByDefault: true, confirmation: 'none', description: 'Read basic Fedora status' },
  'mode.status': { id: 'mode.status', risk: 'R0', capability: 'mode:read', enabledByDefault: true, confirmation: 'none', description: 'Read active DeviceBridge mode' },
  'mode.switch': { id: 'mode.switch', risk: 'R1', capability: 'mode:control', enabledByDefault: false, confirmation: 'required', description: 'Switch between Dev Mode and Game Mode' },
  'integrations.status': { id: 'integrations.status', risk: 'R0', capability: 'system:read', enabledByDefault: true, confirmation: 'none', description: 'Read KDE Connect, ADB, scrcpy and Sunshine status' },
  'android.kdeconnect.status': { id: 'android.kdeconnect.status', risk: 'R0', capability: 'android:read', enabledByDefault: true, confirmation: 'none', description: 'Read KDE Connect status' },
  'android.scrcpy.start': { id: 'android.scrcpy.start', risk: 'R1', capability: 'android:display', enabledByDefault: false, confirmation: 'none', description: 'Start the configured scrcpy display' },
  'system.lock': { id: 'system.lock', risk: 'R2', capability: 'system:lock', enabledByDefault: false, confirmation: 'required', description: 'Lock current desktop session' },
  'system.suspend': { id: 'system.suspend', risk: 'R2', capability: 'system:suspend', enabledByDefault: false, confirmation: 'required', description: 'Suspend Fedora after local validation' },
  'system.shutdown': { id: 'system.shutdown', risk: 'R3', capability: 'system:shutdown', enabledByDefault: false, confirmation: 'step-up', description: 'Power off Fedora' },
  'system.unlock': { id: 'system.unlock', risk: 'R3', capability: 'system:unlock', enabledByDefault: false, confirmation: 'step-up', description: 'Experimental secure unlock adapter; no password replay' },
  'gaming.sunshine.status': { id: 'gaming.sunshine.status', risk: 'R0', capability: 'gaming:read', enabledByDefault: true, confirmation: 'none', description: 'Read Sunshine status' },
  'gaming.sunshine.start': { id: 'gaming.sunshine.start', risk: 'R1', capability: 'gaming:start', enabledByDefault: false, confirmation: 'required', description: 'Start configured Sunshine service' },
  'gaming.sunshine.stop': { id: 'gaming.sunshine.stop', risk: 'R1', capability: 'gaming:stop', enabledByDefault: false, confirmation: 'required', description: 'Stop configured Sunshine service' },
  'android.adb.status': { id: 'android.adb.status', risk: 'R0', capability: 'android:read', enabledByDefault: true, confirmation: 'none', description: 'Read ADB connectivity state' },
  'codex.status': { id: 'codex.status', risk: 'R0', capability: 'codex:read', enabledByDefault: false, confirmation: 'none', description: 'Read Codex gateway state' },
  'codex.threads.list': { id: 'codex.threads.list', risk: 'R0', capability: 'codex:read', enabledByDefault: false, confirmation: 'none', description: 'List active Codex thread metadata' },
  'codex.approval.respond': { id: 'codex.approval.respond', risk: 'R3', capability: 'codex:approve', enabledByDefault: false, confirmation: 'step-up', description: 'Respond to a pending Codex approval' },
};
