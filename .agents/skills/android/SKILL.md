---
name: devicebridge-android
description: Build the Android control client, pairing, biometric step-up and device integrations.
---
# Rules
- No root requirement for baseline product.
- Store long-lived device credentials only in platform secure storage.
- Treat ADB debugging as developer-only trust.
- R3 actions require biometric step-up and explicit confirmation.
- Keep network/auth logic outside UI components.
