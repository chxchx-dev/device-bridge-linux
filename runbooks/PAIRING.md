# Pairing Runbook

## MVP
1. Fedora creates a 2-minute pairing token.
2. Android scans a QR containing only host identity + ephemeral token.
3. Android exchanges it for a device credential.
4. Fedora stores the device ID and capability set.
5. Ephemeral token is invalidated.

## Rules
- Pair only while physically near the Fedora machine for initial setup.
- Show Fedora fingerprint/name on both sides.
- Never encode Fedora password or long-lived bearer credential in the QR.
