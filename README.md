# DeviceBridge Professional Starter

> Control plane personal para integrar una laptop Fedora y un teléfono Android de forma segura, extensible y preparada para Codex.

## Objetivo

DeviceBridge convierte la laptop Fedora en el **Compute Node** y el Android en el **Control Node**. La aplicación móvil y la consola web hablan con un servicio local en Fedora, y ese servicio invoca únicamente acciones registradas y auditables.

Principio central:

> **El teléfono nunca envía shell arbitrario. Envía intenciones tipadas; Fedora decide si están permitidas.**

## Qué cubre este starter

- Arquitectura completa y threat model.
- Orquestador de desarrollo por fases.
- `AGENTS.md` y Skills para trabajar con Codex.
- API base en Node.js + TypeScript + Fastify.
- Registro de comandos allowlist.
- Gateway de Codex preparado para SDK/App Server.
- Consola web de contingencia y plan para app React Native.
- Tailscale como red privada para acceso desde cualquier lugar.
- Integración prevista con Sunshine/Moonlight, KDE Connect, ADB/scrcpy y systemd.
- Runbooks de pairing, acceso remoto, pérdida del teléfono y recuperación.
- Diseño de Wake-on-LAN y desbloqueo seguro **sin almacenar la contraseña del sistema**.

## Qué NO hace todavía

Este paquete es una base profesional, no un instalador mágico. Por seguridad no activa automáticamente:

- apertura de puertos públicos;
- login automático;
- desbloqueo de KDE sin autenticación;
- acceso root para el bridge;
- shell remoto arbitrario;
- Wake-on-LAN sin comprobar compatibilidad de hardware/red.

## Arquitectura resumida

```text
                 INTERNET / LAN
                       │
                    Tailscale
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐            ┌───────▼──────────┐
│ Android A17    │            │ Fedora Laptop    │
│ Control Node   │            │ Compute Node     │
│                │            │                  │
│ Mobile App     │◄──────────►│ Bridge API       │
│ Web/PWA        │  HTTPS/WS  │ Device Agent     │
│ Moonlight      │            │ Command Registry │
│ KDE Connect    │            │ Codex Gateway    │
│ Tailscale      │            │ MCP Server       │
└────────────────┘            │ Sunshine         │
                              │ ADB/scrcpy        │
                              │ systemd           │
                              └──────────────────┘
```

## Orden de ejecución

1. `docs/phases/PHASE-00-FOUNDATION.md`
2. `PHASE-01-CONNECTIVITY.md`
3. `PHASE-02-BRIDGE-API.md`
4. `PHASE-03-WEB-CONSOLE.md`
5. `PHASE-04-ANDROID.md`
6. `PHASE-05-INTEGRATIONS.md`
7. `PHASE-06-CODEX.md`
8. `PHASE-07-MCP-AUTOMATIONS.md`
9. `PHASE-08-REMOTE-WAKE-UNLOCK.md`
10. `PHASE-09-HARDENING-RELEASE.md`

No avances una fase hasta cumplir sus criterios de salida.

## Primer arranque

```bash
cd devicebridge-professional-starter
./scripts/check-prereqs.sh
cp .env.example .env
npm install
npm run typecheck
npm run dev:bridge
```

Luego lee `runbooks/FIRST_BOOT.md`.

## Trabajo con Codex

Codex debe comenzar leyendo:

1. `AGENTS.md`
2. `ORCHESTRATOR.md`
3. `STATE.md`
4. la fase activa

Prompt recomendado:

```text
Read AGENTS.md, ORCHESTRATOR.md and STATE.md.
Identify the active phase and execute only its pending tasks.
Do not weaken security controls to make tests pass.
Run the required validations and update STATE.md when done.
```

## Estado inicial

La fase activa empieza en `00`. No cambies `current_phase` manualmente si los criterios de salida no están completos.
