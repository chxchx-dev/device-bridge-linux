# Phase 05 — Fedora/Android Integrations

## Objective
Orchestrate mature tools instead of rebuilding them.

## Adapters
- [x] Read-only integration status adapter (KDE Connect, ADB, scrcpy and Sunshine).
- [x] KDE Connect status; mutating actions remain disabled pending explicit adapters.
- [x] ADB status and trusted-device checks.
- [x] Opt-in scrcpy launch helper on Fedora with fixed arguments; arbitrary input remains rejected.
- [x] Sunshine status and opt-in confirmed start/stop adapter.
- [ ] Moonlight handoff/deep link research.
- [x] Local user-service mode actions; Docker orchestration is intentionally out of scope.
- [ ] Project registry for additional dev services.

## Modes
### Dev Mode
Start selected project services, open expected workspace and expose status.

### Game Mode
Stop selected heavy dev workloads, start Sunshine, expose connection status and hand off to Moonlight.

The mode-orchestration slice validates `dev`/`game`, applies fixed local
user-service/Sunshine plans and rolls back a failed transition. SQLite
persistence, the local project registry and service installation remain pending.

## Exit criteria
One-tap modes are deterministic, reversible and never invoke arbitrary shell input from Android.
