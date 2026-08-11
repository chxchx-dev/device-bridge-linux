# Phase 07 — MCP and Automations

## Objective
Make DeviceBridge a first-class typed tool provider.

## MCP tools
- [x] `device_status`
- [x] `list_actions`
- [ ] `run_safe_action`
- [x] `list_projects`
- [x] `start_dev_mode` (disabled by default; requires `mode:control` and explicit confirmation)
- [x] `start_game_mode` (disabled by default; requires `mode:control` and explicit confirmation)
- [x] `sunshine_status`
- [x] `android_adb_status`

## Rules
- Tool descriptions must state side effects.
- R2/R3 tools require approval/challenge behavior.
- MCP calls use the same authorization/application services as HTTP.

## Automations
- [ ] Work mode.
- [ ] Game mode.
- [ ] Sleep mode.
- [ ] Pre-flight health checks.

## Exit criteria
Codex can use DeviceBridge capabilities without shell access.
