# DeviceBridge Protocol v1

## Base URL
Development: `http://127.0.0.1:8787`

Remote: publish the loopback service into the tailnet; do not bind to `0.0.0.0` merely to make remote access work.

## Headers

```http
Authorization: Bearer <device-token>
X-DeviceBridge-Device: <device-id>
X-Request-Id: <uuid>
```

## Core routes

```text
GET  /health
GET  /pair                 (temporary phase 1 bootstrap client)
POST /v1/pairing/complete
GET  /v1/device
GET  /v1/actions
POST /v1/actions/:actionId
GET  /v1/events   (future SSE)
WS   /v1/ws       (phase 2+)
```

Pairing completion accepts a short-lived one-time secret and a client-generated
device ID. The response contains the device bearer token once; the server keeps
only a hash of both pairing and device secrets.

For the development bridge, a six-digit numeric code derived from the active
pairing token is also accepted as a one-time convenience code. The code is
limited to five failed attempts and shares the token expiration; production
pairing should use the full secret or a stronger out-of-band flow.

```json
{
  "deviceId": "android-a17-control",
  "pairingToken": "<one-time-pairing-secret>"
}
```

## Action request

```json
{
  "input": {},
  "confirmation": {
    "challengeId": null
  }
}
```

## Action response

```json
{
  "requestId": "uuid",
  "actionId": "system.lock",
  "status": "accepted",
  "result": null
}
```

## Error shape

```json
{
  "requestId": "uuid",
  "error": {
    "code": "ACTION_NOT_ALLOWED",
    "message": "The paired device lacks system:lock"
  }
}
```

## WebSocket event envelope

```json
{
  "type": "system.metrics.updated",
  "timestamp": "2026-08-09T00:00:00Z",
  "payload": {}
}
```

## Replay protection target
For state-changing R2/R3 actions, later phases add short-lived nonce/challenge validation so a captured request cannot simply be replayed.
