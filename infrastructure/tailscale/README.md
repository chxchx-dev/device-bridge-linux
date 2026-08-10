# Tailscale deployment notes

1. Install Tailscale using current official Fedora/Linux instructions.
2. Authenticate Fedora and Android into the same tailnet.
3. Name Fedora predictably, e.g. `devicebridge-fedora`.
4. Keep Bridge API bound to `127.0.0.1`.
5. Publish it only into the tailnet using current `tailscale serve` syntax.
6. Configure tailnet ACL/grants so only the owner's devices can reach DeviceBridge.
7. Do not enable Funnel.

For a laptop intended to remain remotely reachable while at the login screen, Tailscale on Linux runs as a system service. DeviceBridge itself needs a deliberate pre-login service design if control before desktop login is required.
