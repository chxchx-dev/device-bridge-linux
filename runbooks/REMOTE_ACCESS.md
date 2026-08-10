# Remote Access Runbook

## Preconditions
- Fedora and Android appear online in the same tailnet.
- Bridge responds on `127.0.0.1:8787`.
- Phone is paired at DeviceBridge level.

## Publish inside tailnet
Check installed syntax first:

```bash
tailscale serve --help
```

Then publish loopback service using the current supported `tailscale serve` command.

Verify:

```bash
tailscale serve status
tailscale status
```

## Test
Disable Wi-Fi on Android and use cellular data. Open the tailnet hostname and verify:
- authenticated status works;
- unknown device is denied;
- no router port-forward exists.
