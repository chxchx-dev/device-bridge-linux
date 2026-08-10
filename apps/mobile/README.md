# Android App — Phase 04

React Native control node for DeviceBridge. Long-lived credentials must use
Android secure storage; ADB debugging is developer-only trust.

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
