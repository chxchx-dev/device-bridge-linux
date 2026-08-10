# Wake-on-LAN relay

Remote WOL is Phase 08.

## Detection
Use `scripts/check-prereqs.sh` and inspect `ethtool` output. Hardware/firmware support is mandatory.

## Recommended remote topology

```text
Android -> Tailscale -> always-on relay in home LAN -> fixed MAC magic packet -> Fedora
```

The future relay API must:
- contain a fixed allowlist of target MAC addresses;
- never accept a raw MAC from arbitrary client input;
- require an authenticated capability;
- log request ID + device ID + target alias.
