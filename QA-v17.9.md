# QA v17.9.0 — Jira Interno TROBBU

## Resultado

- **327 PASS**
- **0 FAIL**
- Comando: `npm run qa`
- Salida: `qa-v17.9-output.txt`

## Cobertura nueva

### Realtime / counters

- RPC único `get_live_counters` para navegación, módulos y KPIs Helpdesk.
- Reconciliación autoritativa de counters cada 20 s.
- Reconciliación ligera de filas principales cada 60 s.
- Realtime como señal de invalidación más patch inmediato.
- Recuperación al volver a focus, visibilidad o conexión.
- Refresh resiliente de comentarios, actividad y evidencias en modales de Ticket, Sprint y Helpdesk.
- `REPLICA IDENTITY FULL` y publicación Realtime de tablas hijas relevantes.

### Tema claro / oscuro

- precarga del tema antes del CSS;
- persistencia en localStorage;
- persistencia en `profiles.theme_preference`;
- toggle global;
- cobertura de layouts, tablas, modales, drawers, Kanban, Knowledge, Vacaciones/timeline y controles secundarios.

### Helpdesk

- UI limitada a Nuevo / En revisión / Atendido / Cerrado.
- migración histórica `resolved → closed` sin disparar notificaciones de cierres históricos;
- constraint BD de cuatro estados;
- responsable secuencial hasta Atendido;
- solicitante puede cerrar desde Atendido;
- manager mantiene gestión;
- reasignación inline;
- estado inline;
- decisión inline para requerimientos;
- autoasignación y notificaciones sin `resolved`.

### Vacaciones

- switches accesibles (`role=switch`) para descontar saldo y tipo activo.

## Parseo

Usando TypeScript Compiler API:

- `app.js`: 0 parse diagnostics.
- `auto-assign-helpdesk.ts`: 0.
- `process-notifications.ts`: 0.
- `trobbu-knowledge-assistant.ts`: 0.
- `vacation-impact-assistant.ts`: 0.
- `translate-knowledge-version.ts`: 0.

## Producción / Supabase

Migración aplicada: `jira_v17_9_workflow_theme_live_counters`.

Verificado:

- `resolved_rows = 0`.
- status constraint = `created|review|attended|closed`.
- `theme_preference` existe.
- `get_live_counters` existe.
- ocho tablas de comentarios/actividad/evidencias con replica identity FULL y publicadas.
- `auto-assign-helpdesk` ACTIVE v7, JWT.
- `process-notifications` ACTIVE v14, JWT.
- Health Advisor = 0 lints.

## QA transaccional de workflow

Las pruebas utilizaron `BEGIN ... ROLLBACK` para no modificar datos productivos:

1. un responsable sin `manage_helpdesk` avanzó `created → review → attended`;
2. ese responsable fue bloqueado al intentar `attended → closed`;
3. el solicitante cerró una solicitud en `attended`;
4. `resolved` fue rechazado por el constraint;
5. `get_live_counters` respondió bajo contexto autenticado;
6. `theme_preference` pudo actualizarse por el propio usuario bajo RLS.

## Smoke local

`index.html`, `app.js` y `styles.css` respondieron correctamente por HTTP local. Chromium headless del contenedor no llegó a producir DOM por limitaciones propias del entorno/DBus, por lo que esa ejecución no se contabiliza como PASS de navegador. El parseo AST y el QA funcional estático sí fueron completados.
