# Phase 04 — Native Android Client

## Objective
Create the Android control node.

## Stack
React Native CLI + TypeScript. Use native modules only where they add concrete value.

## Tasks
- [x] Bootstrap app under `apps/mobile`.
- [x] Secure token/key storage.
- [x] Device biometric step-up abstraction.
- [x] HTTP client with certificate/host expectations.
- [x] WebSocket event client.
- [x] Dashboard.
- [x] Action confirmation UX.
- [ ] Deep-link hooks for Moonlight/KDE Connect where feasible.
- [ ] Pairing QR flow.
- [x] Lost/revoked session handling.

## Exit criteria
Native app replaces PWA for daily control without weakening auth.

## Verification checkpoint

- React Native `0.86.2` scaffold generated with pnpm under `apps/mobile`.
- `pnpm --filter DeviceBridgeMobile test` — passed.
- `pnpm --filter DeviceBridgeMobile lint` — passed.
- `JAVA_HOME=/tmp/devicebridge-jdk17 ./gradlew assembleDebug` — passed.
- Debug APK installed and launched on Samsung `SM-A175F/DS` over ADB.

The portable JDK is a local build dependency only; Fedora's global Java 25 installation was not changed. The Samsung debug APK was rebuilt, installed and relaunched after the security client changes.

The first implementation slice now contains those client boundaries and a
working pairing/status UI. Pairing was manually confirmed on the Samsung
`SM-A175F/DS` using the one-time six-digit development code. The client now
uses Keychain-backed biometric step-up for sensitive actions, displays
confirmation before challenges/actions, clears invalid or revoked sessions,
and supports explicit secure-session removal. Deep-link and QR pairing are
optional follow-up enhancements; the phase exit criterion is satisfied by the
native pairing, authenticated status and recovery flow.
