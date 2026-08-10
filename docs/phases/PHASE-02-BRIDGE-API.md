# Phase 02 — Bridge API and Command Registry

## Objective
Build the secure control plane.

## Tasks
- [ ] Finish Fastify API skeleton.
- [ ] Implement system metrics adapter.
- [ ] Implement command catalog endpoint.
- [ ] Implement action authorization.
- [ ] Implement `system.status`.
- [ ] Implement `system.lock` through a fixed adapter and local test.
- [ ] Add R2 confirmation flow.
- [ ] Add structured audit sink.
- [ ] Add WebSocket event channel.
- [ ] Unit-test invalid IDs, invalid payloads and insufficient capabilities.

## Exit criteria
No route can execute arbitrary user-supplied shell. All state-changing actions are typed and audited.
