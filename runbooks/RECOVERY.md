# Recovery Runbook

## Bridge fails
- Access Fedora locally or through the independent SSH break-glass channel.
- `systemctl --user status devicebridge.service` when user service is configured.
- Inspect logs without pasting secrets into tickets/chats.

## Tailnet fails
- DeviceBridge remains accessible locally on loopback/LAN development path.
- Do not open public ports as an emergency shortcut.

## Bad release
- Revert Git commit/tag.
- Restore previous environment/config backup.
- Restart service.

## Locked out of DeviceBridge
Use local Fedora access to revoke/reset DeviceBridge pairing. DeviceBridge must never become the only way to administer the laptop.
