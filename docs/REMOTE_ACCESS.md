# Remote Access From Anywhere

## Recommended topology

```text
Samsung Android
   |
   | cellular / external Wi-Fi
   v
Tailscale encrypted tailnet
   |
   v
Fedora tailscaled (system service)
   |
   +--> Tailscale Serve HTTPS
          |
          v
        127.0.0.1:8787 DeviceBridge
```

## Why this architecture
The Fedora Tailscale service can remain available even when no desktop user is logged in. Tailscale provides connectivity; DeviceBridge remains responsible for authentication and application behavior.

## Bridge exposure
Development:

```text
127.0.0.1:8787
```

Remote target:

```bash
sudo tailscale serve --bg 8787
```

Before productionizing, verify the exact `tailscale serve` syntax installed on the machine and inspect `tailscale serve status`.

## Sunshine
Use Sunshine/Moonlight for high-bandwidth interactive desktop/game streaming. Keep Sunshine ports inside LAN/tailnet; do not port-forward its management interface to the public Internet.

## SSH
SSH is a break-glass/admin channel, not the mobile application's internal control protocol. Prefer Tailscale SSH or SSH restricted to tailnet addresses.

## Failure modes
- Fedora fully powered off: Tailscale cannot answer.
- Fedora suspended: connectivity normally disappears until wake.
- Home ISP changes IP: irrelevant to normal Tailscale connectivity.
- Tailnet relay path: streaming latency may be worse than a direct path.
