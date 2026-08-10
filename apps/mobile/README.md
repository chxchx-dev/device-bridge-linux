# Android App — Phase 04

Do not bootstrap React Native before Phase 03 exits successfully.

## Target modules

```text
src/
  api/
  auth/
  pairing/
  events/
  features/
    dashboard/
    actions/
    codex/
    gaming/
    files/
    system/
  native/
  security/
```

## Required native capabilities
- secure credential storage;
- biometric step-up abstraction;
- network connectivity awareness;
- deep links/app intents where supported;
- QR scanner for pairing;
- background notification strategy only if justified.

## Root policy
The app must not require root for baseline features.
