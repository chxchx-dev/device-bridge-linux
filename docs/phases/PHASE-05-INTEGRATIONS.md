# Phase 05 — Fedora/Android Integrations

## Objective
Orchestrate mature tools instead of rebuilding them.

## Adapters
- [x] Read-only integration status adapter (KDE Connect, ADB, scrcpy and Sunshine).
- [x] KDE Connect status; mutating actions remain disabled pending explicit adapters.
- [x] ADB status and trusted-device checks.
- [ ] scrcpy launch helper on Fedora.
- [x] Sunshine status; start/stop remains disabled pending a reversible service adapter.
- [ ] Moonlight handoff/deep link research.
- [ ] Docker service/project mode actions.
- [ ] Project registry for dev mode.

## Modes
### Dev Mode
Start selected project services, open expected workspace and expose status.

### Game Mode
Stop selected heavy dev workloads, start Sunshine, expose connection status and hand off to Moonlight.

## Exit criteria
One-tap modes are deterministic, reversible and never invoke arbitrary shell input from Android.
