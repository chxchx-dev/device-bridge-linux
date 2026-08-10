# Architecture

## Components

### 1. Bridge API
Local HTTP/WebSocket control plane. Binds to loopback by default and can be published only inside the tailnet using Tailscale Serve.

Responsibilities:
- authenticate clients;
- validate requests;
- authorize action IDs;
- call command registry adapters;
- emit structured events;
- append audit events.

### 2. Device Agent
Collects Fedora state and wraps operating-system operations.

It must not accept network traffic directly.

### 3. Command Registry
The sole list of executable remote actions.

Example:

```ts
{
  id: 'system.lock',
  risk: 'R2',
  capability: 'system:lock',
  confirmation: 'required'
}
```

### 4. Web Console
React/Vite fallback control surface. Valuable before the native Android app exists and for recovery from another trusted device.

### 5. Android App
React Native client for biometric step-up, push/local notifications, device storage and deep links into Moonlight/other apps.

### 6. Codex Gateway
Server-side integration with Codex SDK/App Server. It translates Codex lifecycle and approval events into DeviceBridge events.

### 7. MCP Server
Typed automation interface for Codex. MCP tools call the same application services as the API; they never duplicate command execution logic.

## Trust boundaries

```text
[Android UI]
    |
    | untrusted input
    v
[Auth + Schemas + Capabilities]
    |
    v
[Application Services]
    |
    v
[Command Registry]
    |
    +--> [User-session adapters]
    +--> [Codex Gateway]
    +--> [Sunshine adapter]
    +--> [ADB adapter]
```

## Network model

### Local
Android and Fedora may communicate through LAN, but the Bridge API should still require authentication.

### Remote
Preferred path:

```text
Android -> Tailscale -> Tailscale Serve -> 127.0.0.1:8787 -> Bridge API
```

The Bridge API does not need a public port.

## Persistence
SQLite stores:
- paired devices;
- public device keys;
- capabilities;
- audit log metadata;
- modes/automation definitions;
- optional Codex thread metadata.

Secrets should use OS-backed secret storage where available, not SQLite plaintext.
