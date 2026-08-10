# Wake, Login and Unlock Design

## Three different states

### 1. Fedora awake + desktop unlocked
Everything can work.

### 2. Fedora awake + screen locked
`tailscaled` can still be reachable. Bridge availability depends on how it is installed. Streaming/login behavior depends on the desktop/session stack.

### 3. Fedora suspended/off
The laptop cannot answer Tailscale while asleep/off. Wake requires hardware/network support plus a packet source on the home network.

## Wake-on-LAN

### Local WOL
If Ethernet NIC + firmware support WOL, Android on the same LAN may send the magic packet.

### WOL while away
Use an always-on home relay, for example:
- router with secure WOL capability;
- Raspberry Pi / mini server;
- another trusted Linux node in the tailnet and home LAN.

Flow:

```text
Android -> Tailscale -> always-on WOL relay -> LAN magic packet -> Fedora wakes
```

A sleeping Fedora laptop cannot serve as its own relay.

## Laptop caveat
Wake over Wi-Fi is hardware/firmware-specific and often less reliable than wired WOL. Phase 08 begins with capability detection, not assumptions.

## "Unlock PC from phone"

### Preferred security behavior
1. Phone authenticates to DeviceBridge.
2. User completes biometric step-up on Android.
3. DeviceBridge issues a short-lived unlock challenge.
4. An explicitly enabled local unlock adapter requests the desktop/session to unlock.
5. If the desktop stack refuses or cannot authenticate securely, action fails.

### Forbidden implementation
- storing the Fedora password in `.env`;
- piping a password into PAM/sudo;
- enabling automatic desktop login;
- exposing `loginctl unlock-session` as an unprotected endpoint;
- letting Codex invent an unlock shell command.

### Practical MVP
Treat unlock as **experimental and off by default**. First support:
- remote online check;
- remote lock;
- remote wake via relay;
- secure access to DeviceBridge;
- remote desktop/streaming once the user session supports it.

Then validate the exact KDE Plasma/Fedora session behavior before enabling an unlock adapter.
