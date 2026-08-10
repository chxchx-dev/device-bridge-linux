# Phase 01 — Pairing, Identity and Private Connectivity

## Objective
Create DeviceBridge-level device identity independent from KDE Connect/Tailscale accounts.

## Tasks
- [x] Define device ID format.
- [x] Implement pairing token model with short expiration.
- [x] Store only hashed server-side pairing secrets.
- [x] Implement `/health` unauthenticated with minimal data.
- [x] Implement authenticated `/v1/device`.
- [x] Add device revocation model.
- [x] Add request IDs and audit event schema.
- [x] Verify loopback-only bind.
- [x] Test Tailscale Serve to loopback service.

## Exit criteria ✅
A paired phone authenticated over tailnet through `/pair` and read `/v1/device`; unpaired access was rejected.
