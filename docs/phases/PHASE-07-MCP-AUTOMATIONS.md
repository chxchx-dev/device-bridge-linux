# Phase 07 — MCP and Automations

## Objective
Make DeviceBridge a first-class typed tool provider.

## MCP tools
- [x] `device_status`
- [x] `list_actions`
- [x] `run_safe_action` (closed R0 read-only catalog with audit events)
- [x] `list_projects`
- [x] `start_dev_mode` (disabled by default; requires `mode:control` and explicit confirmation)
- [x] `start_game_mode` (disabled by default; requires `mode:control` and explicit confirmation)
- [x] `sunshine_status`
- [x] `android_adb_status`

## Rules
- Tool descriptions must state side effects.
- R2/R3 tools require approval/challenge behavior.
- [x] MCP and HTTP now call the shared typed `DeviceBridgeApplication` service for status, integrations, pre-flight and mode transitions.

## Automations
- [x] Work mode (pre-flight + confirmed orchestration).
- [x] Game mode (pre-flight + confirmed orchestration).
- [x] Sleep mode (R2, disabled by default; fixed `systemctl suspend` adapter).
- [x] Pre-flight health checks.

## Exit criteria
Codex can use DeviceBridge capabilities without shell access.
