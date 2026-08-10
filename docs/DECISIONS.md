# Architecture Decision Record Log

## ADR-001 — Fedora is the compute node
**Status:** Accepted

The laptop owns compute, repositories, games, Codex and integrations. Android remains a control/display node.

## ADR-002 — No arbitrary remote shell
**Status:** Accepted

DeviceBridge exposes typed actions only. SSH remains an independent administrative channel.

## ADR-003 — Tailscale private overlay for remote access
**Status:** Accepted

Bridge binds to loopback by default and is published into the tailnet instead of opening public router ports.

## ADR-004 — Unlock disabled by default
**Status:** Accepted

Remote unlock is a security-sensitive optional adapter and must never rely on stored passwords or automatic login.

## ADR-005 — Codex approvals remain active
**Status:** Accepted

Phone UX may answer approval requests but does not remove the approval mechanism.

## ADR-006 — In-memory identity store for Phase 1
**Status:** Accepted for Phase 1

The first connectivity slice uses an in-memory pairing/device store so the
trust boundary and protocol can be tested before selecting the SQLite schema.
Pairing and device secrets are stored only as SHA-256 hashes in memory. The
store is intentionally non-persistent; restarting the bridge invalidates all
paired state unless a development seed token is configured. Production
pairing persistence must move to SQLite with revocation and secret-rotation
semantics before Phase 2 is released.
