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

## ADR-009 — Native SQLite for Codex thread metadata
**Status:** Accepted for Phase 06

Codex thread metadata is stored with Node's native `node:sqlite` API. The
database contains only thread ID, project path, title and lifecycle timestamps;
prompts, tokens, process output and approval payloads are excluded. The runtime
requirement is Node `>=22.5`, enforced in the workspace engine and Fedora
service template. The database path is local operational state and is ignored
by Git.

## ADR-010 — Remote wake requires an external relay
**Status:** Accepted for Phase 08

The Fedora laptop's active Wi-Fi interface does not advertise Wake-on-LAN
support. DeviceBridge will not pretend that Tailscale can wake a suspended or
powered-off laptop, and it will not send magic packets from the laptop itself.
Remote wake may be implemented only through an always-on, tailnet-reachable
relay on the home LAN (or a router with an equivalent restricted WOL feature).
The relay destination must be configured locally, strictly allowlisted and
audited; no arbitrary destination or packet parameters may come from a remote
request.

Until such a relay is selected and verified, remote wake remains unavailable.

## ADR-011 — Secure unlock remains disabled
**Status:** Accepted for Phase 08

DeviceBridge will not expose an unlock action while the Fedora/KDE session
cannot be validated with a device-bound, short-lived challenge and Android
biometric step-up. Fedora passwords, PAM input, sudo replay and automatic login
are forbidden. The existing `system.unlock` registry entry remains disabled by
default and is not an implementation target for this phase without a separate
security review.
