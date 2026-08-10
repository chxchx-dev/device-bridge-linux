# Android App — Phase 04

React Native control node for DeviceBridge. Long-lived credentials must use
Android secure storage; ADB debugging is developer-only trust.

## Local configuration

The real bridge URL is intentionally excluded from Git. Before running the
mobile app, copy `src/config.local.example.ts` to `src/config.local.ts` and
set the private tailnet URL and local device ID there. The local file is
ignored by Git.

## Target modules

```text
src/
  api/
  auth/
  pairing/
  events/
  features/
  native/
  security/
```

The baseline app must not require root. Pairing, secure credential storage,
biometric step-up and authenticated API/event clients will be added in the
next Phase 04 slices.
