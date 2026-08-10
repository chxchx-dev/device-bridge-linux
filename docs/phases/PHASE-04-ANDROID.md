# Phase 04 — Native Android Client

## Objective
Create the Android control node.

## Stack
React Native CLI + TypeScript. Use native modules only where they add concrete value.

## Tasks
- [x] Bootstrap app under `apps/mobile`.
- [ ] Secure token/key storage.
- [ ] Device biometric step-up abstraction.
- [ ] HTTP client with certificate/host expectations.
- [ ] WebSocket event client.
- [ ] Dashboard.
- [ ] Action confirmation UX.
- [ ] Deep-link hooks for Moonlight/KDE Connect where feasible.
- [ ] Pairing QR flow.
- [ ] Lost/revoked session handling.

## Exit criteria
Native app replaces PWA for daily control without weakening auth.

## Verification checkpoint

- React Native `0.86.2` scaffold generated with pnpm under `apps/mobile`.
- `pnpm --filter DeviceBridgeMobile test` — passed.
- `pnpm --filter DeviceBridgeMobile lint` — passed.
- `JAVA_HOME=/tmp/devicebridge-jdk17 ./gradlew assembleDebug` — passed.
- Debug APK installed and launched on Samsung `SM-A175F/DS` over ADB.

The portable JDK is a local build dependency only; Fedora's global Java 25 installation was not changed. Biometric step-up and final authenticated-network acceptance remain pending.

The first implementation slice now contains those client boundaries and a
working pairing/status UI, but the checklist remains open until pairing is
manually confirmed on the Samsung.
