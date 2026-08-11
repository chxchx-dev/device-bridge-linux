# Phase 06 — Codex Cockpit

## Objective
Control and supervise Codex work from Android while Fedora performs the actual coding work.

## Tasks
- [x] Verify current Codex CLI, SDK and App Server docs.
- [x] Implement bounded server-side App Server handshake experiment (local stdio only).
- [ ] Evaluate App Server for rich approvals/events.
- [ ] Persist non-secret thread metadata.
- [ ] Display active project/thread on phone.
- [ ] Stream task status.
- [ ] Display changed-file summaries/diffs safely.
- [ ] Forward approval requests with risk metadata.
- [ ] Approve/deny from phone with step-up for sensitive operations.
- [ ] Never expose a generic `run command` Codex feature.

The first slice uses the local `codex app-server` stdio transport only. It sends
`initialize`, records a bounded connectivity/version result and terminates the
probe without starting a thread or turn. The App Server WebSocket transport is
not exposed remotely; thread, turn and approval contracts remain pending.

## Exit criteria
A Codex task can be started/continued and an approval can be safely handled from Android with full audit trail.
