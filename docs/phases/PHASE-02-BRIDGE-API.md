# Phase 02 — Bridge API and Command Registry

## Objective
Build the secure control plane.

## Tasks
- [x] Finish Fastify API skeleton.
- [x] Implement system metrics adapter.
- [x] Implement command catalog endpoint.
- [x] Implement action authorization.
- [x] Implement `system.status`.
- [x] Implement `system.lock` through a fixed adapter and local test.
- [x] Add R2 confirmation flow.
- [x] Add structured audit sink.
- [x] Add WebSocket event channel.
- [x] Unit-test invalid IDs, invalid payloads and insufficient capabilities.

## Exit criteria
No route can execute arbitrary user-supplied shell. All state-changing actions are typed and audited.

## Verification

- `pnpm test` — passed.
- `pnpm run typecheck` — passed.
- `pnpm run lint` — passed.
- `bash scripts/validate-project.sh` — passed.
- `bash -n scripts/*.sh` — passed.

`system.lock` remains disabled by default and requires both `system:lock` and a short-lived one-time confirmation challenge. Its adapter test verifies the fixed `loginctl lock-session` invocation without locking the developer session.
