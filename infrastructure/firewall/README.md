# Firewall posture

DeviceBridge should not require a public inbound firewall rule.

Default:
- Bridge: loopback only.
- Tailscale: handled by the Tailscale interface/policy.
- Sunshine: LAN/tailnet only; no router port forward by default.
- SSH: tailnet-restricted for remote administration.

Do not solve connectivity problems by disabling firewalld or SELinux.
