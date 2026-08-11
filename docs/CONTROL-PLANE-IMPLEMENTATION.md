# DeviceBridge — Plan de evolución del control plane

## Propósito

Este documento mantiene el hilo de implementación posterior a las fases base.
Describe cómo evolucionar DeviceBridge desde un control remoto funcional hacia
un producto personal con:

- una consola Codex visible y comprensible desde Android;
- perfiles Dev/Game declarativos y reversibles;
- servicios Fedora coordinados desde la aplicación;
- seguridad, auditoría y recuperación verificables.

La app Android es el control node. Fedora es el compute node. Codex, los
servicios locales y los adaptadores del sistema siempre se ejecutan en Fedora.

## Estado actual

Fecha de referencia: 2026-08-11.

### Ya disponible

- Pairing con token de un solo uso y código corto.
- Credenciales persistentes únicamente en Android Keychain.
- Bridge API autenticada sobre tailnet privado.
- Acciones tipadas y allowlisted; no existe ejecución remota de shell.
- Confirmaciones y step-up biométrico para acciones sensibles.
- Cliente Android con pestañas `Estado`, `Codex` y `Acciones`.
- Vista Android inmersiva y consola visual de telemetría.
- Codex App Server local en Fedora.
- Threads, prompts, estados, aprobaciones y resúmenes de archivos.
- Estado y rollback básico de Dev/Game Mode.
- Adaptadores de KDE Connect, ADB, scrcpy y Sunshine.
- Servicios Fedora user-level automatizados con `pnpm devicebridge up`.

### Limitaciones actuales

- Codex guarda principalmente el último evento y la última respuesta; todavía
  no existe un timeline completo de eventos visible en Android.
- La vista Codex no presenta una consola viva con etapas, duración y resultado
  estructurado.
- Dev Mode y Game Mode todavía coordinan pocos servicios, pero ya existe un
  registro declarativo inicial de servicios user-level.
- El estado del modo vive en memoria del proceso y debe recuperarse después de
  reinicios.
- El streaming de juego sigue dependiendo de un cliente compatible con
  Sunshine; crear un cliente propio es una iniciativa separada.

## Arquitectura objetivo

```text
Android control client
  ├─ Estado / Codex / Modos / Acciones
  ├─ WebSocket autenticado para eventos
  └─ Keychain + biometría
          │ tailnet privado + Bridge auth
          ▼
Fedora Bridge API
  ├─ Zod contracts + capability checks
  ├─ audit + request IDs + replay protection
  ├─ Codex gateway adapter
  ├─ Mode orchestrator
  └─ fixed system adapters
       ├─ user-level systemd services
       ├─ Sunshine
       ├─ ADB / scrcpy
       └─ KDE Connect
          │
          ▼
Codex App Server / registered projects / local services
```

Regla central: el teléfono selecciona acciones y perfiles declarados; nunca
envía comandos, rutas arbitrarias ni scripts para que Fedora los ejecute.

## Bloques de implementación

### Bloque 1 — Codex event timeline

Estado: `implementado; prueba manual end-to-end pendiente`.

Objetivo: mostrar la ejecución de una tarea como una consola viva, sin exponer
stdout crudo ni secretos.

Trabajo:

- [x] Definir un contrato `CodexTaskEvent` compartido con tipos acotados:
  `task.received`, `thread.started`, `turn.started`, `progress`,
  `file.changed`, `approval.requested`, `turn.completed`, `task.failed`.
- [x] Reducir cada evento del App Server a metadata segura y limitada.
- [x] Mantener una ventana acotada de 100 eventos por thread.
- [x] Emitir los eventos seguros por el WebSocket autenticado existente.
- [x] Persistir solo metadata no secreta y truncada.
- [x] Exponer `codex.events.list` con capability `codex:read`.
- [x] Consumir y renderizar el timeline en Android.
- Mantener el mensaje final separado del timeline.

Criterios de aceptación:

- [x] Android muestra eventos en tiempo real durante una tarea.
- Un evento nunca contiene stdout/stderr sin filtrar, tokens, prompts
  completos ni rutas fuera del proyecto registrado.
- Un thread completado conserva un resumen acotado después de reiniciar Bridge.
- Los eventos tienen request/thread IDs y timestamps.
- Una aprobación aparece como estado bloqueante y conserva el step-up actual.

### Bloque 2 — Consola Codex visual

Estado: `slice inicial implementado; respuesta estructurada y estados ampliados pendientes`.

Objetivo: reemplazar la presentación plana por una experiencia tipo terminal/HUD.

Vista prevista:

```text
CODEX TASK                           RUNNING  00:42
project: devicebridge                thread: selected

● TASK RECEIVED       10:42:01
● ANALYZING PROJECT   10:42:02
● FILE CHANGED        services/.../modes.ts
◌ WAITING APPROVAL    requires biometric confirmation

FINAL RESULT
  Summary
  Changed files
  Tests
  Warnings
```

Trabajo:

- [x] Timeline con un único proceso activo visible y animaciones discretas.
- [x] Respuesta viva de Codex acumulada y mostrada en Android.
- [x] Consultas rápidas de estado de Fedora, preflight y resumen desde Android.
- Tarjeta de tarea activa con duración y estado.
- Respuesta final estructurada en resumen, cambios, pruebas y advertencias.
- Diff plegable y redacción de rutas sensibles.
- Aprobaciones como tarjetas destacadas, nunca mezcladas con logs normales.
- Estados vacíos, reconexión, error y tarea completada.

Criterios de aceptación:

- El usuario entiende qué está haciendo Codex sin leer un log completo.
- La tarea se puede seguir aunque Android se reconecte.
- El resultado final se puede revisar sin navegar por todo el timeline.

### Bloque 3 — Registro de proyectos y servicios

Estado: `slice inicial implementado; transición por perfil pendiente`.

Objetivo: que Codex y los modos trabajen con IDs declarados, no con rutas o
comandos introducidos desde el teléfono.

Modelo conceptual:

```text
projectId: devicebridge
  root: ruta local validada en Fedora
  allowedCodex: true
  devServices: [bridge, web-console, codex-gateway]

serviceId: web-console
  unit: devicebridge-web-console.service
  control: user-systemd
  allowedModes: [dev]
```

Trabajo:

- [x] Configuración declarativa server-side con IDs, unidades user-systemd y modos permitidos.
- [x] IDs estables y allowlist server-side; entradas inválidas no se registran.
- [x] Ninguna ruta ni unidad arbitraria desde Android.
- [x] Estado y disponibilidad de cada servicio mediante acción R0 autenticada.
- Registro persistente de dependencias y perfiles en una fase posterior, cuando el modelo esté validado.
- Instalación documentada de unidades user-level.

Criterios de aceptación:

- [x] Un prompt solo puede usar un proyecto registrado.
- Los perfiles solo podrán iniciar servicios registrados (la transición declarativa completa queda para el Bloque 4).
- [x] Un servicio fuera del registro no puede aparecer en el catálogo ni ejecutarse.

### Bloque 4 — Perfiles Dev/Game de segunda generación

Estado: `pendiente`.

Objetivo: transformar los modos actuales en perfiles declarativos, visibles y
reversibles.

Ejemplo:

```text
DEV
  start: bridge, web-console, codex-gateway
  stop: sunshine
  checks: fedora, tailnet, adb, web-console

GAME
  stop: web-console, project-services
  start: sunshine
  checks: fedora, tailnet, sunshine
```

Trabajo:

- Modelo de perfil y plan de transición.
- Preview antes de confirmar.
- Dependencias y orden de ejecución.
- Estado por servicio, no solo un booleano global.
- Rollback por cada paso aplicado.
- Recuperación después de reinicio de Fedora.
- Auditoría del perfil solicitado, aplicado y resultado.

Criterios de aceptación:

- La app muestra qué se detendrá, iniciará y comprobará antes de ejecutar.
- Un fallo deja el sistema en el estado anterior o en un estado marcado como
  degradado y recuperable.
- No se usa Docker como requisito del flujo normal.
- No se agrega una ruta de shell remota.

### Bloque 5 — Acciones integradas de alto nivel

Estado: `futuro`.

Posibles capacidades dentro de DeviceBridge:

- iniciar/detener servicios registrados;
- comprobar pre-flight y mostrar diagnóstico;
- preparar Dev Mode para Codex;
- preparar Game Mode para Sunshine;
- iniciar una sesión scrcpy con configuración fija;
- abrir handoffs permitidos cuando una función realmente requiera un cliente
  externo.

No forma parte de este bloque implementar desbloqueo automático, replay de
contraseñas, shell genérico ni un cliente completo de streaming sin una fase
de diseño independiente.

## Seguridad no negociable

- Validar toda entrada externa con contratos Zod.
- Capabilities comprobadas en Bridge, no solo ocultando botones Android.
- Confirmación y step-up para cambios de estado o riesgo elevado.
- IDs de proyectos, perfiles y servicios allowlisted.
- No enviar stdout/stderr sin filtrar al teléfono.
- No guardar tokens, credenciales ni prompts completos en SQLite.
- Mantener Bridge y Sunshine en tailnet/loopback, nunca público por defecto.
- Auditar acciones de cambio de estado y decisiones de aprobación.
- Usar servicios user-level y adaptadores fijos.
- Mantener rollback y recuperación documentados.

## Orden de ejecución

1. Bloque 1: contrato y transporte de eventos Codex.
2. Bloque 2: consola Codex Android.
3. Bloque 3: registro de proyectos y servicios.
4. Bloque 4: perfiles Dev/Game de segunda generación.
5. Bloque 5: acciones integradas y handoffs opcionales.
6. Pruebas manuales de reinicio, pérdida de teléfono y recuperación.
7. Cierre de Phase 09 y release personal versionado.

## Verificación por bloque

Cada bloque debe terminar con:

```bash
pnpm typecheck
pnpm lint
pnpm test
bash -n scripts/*.sh
git diff --check
```

Los cambios Android deben añadir además:

```bash
pnpm --filter DeviceBridgeMobile typecheck
pnpm --filter DeviceBridgeMobile test
cd apps/mobile/android && ./gradlew assembleDebug
```

## Bitácora

### 2026-08-11 — Documento inicial

- Se documentó el estado real de Codex, Dev/Game Mode y los adaptadores.
- Se decidió priorizar el timeline de eventos y la consola Codex.
- Se decidió usar perfiles declarativos para evolucionar Dev/Game.
- Se mantiene fuera de alcance el shell remoto genérico y el desbloqueo.

### 2026-08-11 — Bloque 1, backend

- Se creó `CodexTaskEvent` con schema compartido en `packages/contracts`.
- El gateway reduce eventos del App Server a tipos, summaries, detalles y rutas
  acotadas; los secretos se redactan y las rutas fuera del proyecto se omiten.
- SQLite conserva como máximo 100 eventos por thread.
- Bridge publica `codex.task.event` y mantiene `codex.event` con payload seguro
  para compatibilidad.
- `codex.events.list` requiere `codex:read` y valida thread/limit con Zod.
- Gateway, Bridge y monorepo completo pasaron typecheck y tests.

### 2026-08-11 — Bloque 1, cliente Android

- Android consume `codex.events.list` al seleccionar un thread.
- Android añade eventos seguros recibidos por `codex.task.event` sin duplicarlos
  y conserva una ventana local de 100 eventos.
- La pestaña Codex muestra un timeline compacto con hora, tipo, resumen, archivo
  afectado y detalle limitado.
- La prueba manual de una tarea real desde Samsung queda pendiente antes de
  cerrar formalmente el bloque.
