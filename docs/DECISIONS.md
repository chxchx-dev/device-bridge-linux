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

## ADR-007 — Temporary browser pairing client
**Status:** Accepted for Phase 1 bootstrap

Until the native Android client exists, `/pair` provides a minimal browser
client for the pairing acceptance test. It keeps the returned device token in
JavaScript memory only, never local storage, and performs the authenticated
`/v1/device` check immediately. It is not the production mobile client and
must be removed or replaced during Phase 3/4 hardening.

## ADR-008 — Phase 3 browser session storage
**Status:** Accepted for Phase 3

The React console keeps the paired device token only in component memory. It
does not use localStorage, cookies or URL parameters for credentials. A page
refresh requires pairing again until the native Android client provides a
dedicated secure storage strategy.
