# Release v17.9.2 — Jira Interno TROBBU

## Objetivo

Completar la migración visual del sistema a modo oscuro con paridad de legibilidad respecto al modo claro y corregir definitivamente los counters visibles de comentarios/actividad/evidencias.

## Cambios principales

- Barrido completo de contraste en modo oscuro, incluyendo superficies secundarias con colores claros hardcodeados.
- Knowledge reader/editor: hero, contenido renderizado, toolbar, bloques, preview, callouts y multimedia.
- Staff/Roles: permisos, accesos, autoasignación, scope y switches.
- Gantt/Sprints: KPIs, grupos, filtros, sticky review, side stats y comentarios.
- Ticket/Helpdesk: metadata, aside transparente, dropzones, inline controls, counters y comentarios.
- Importación, Reportes/AI y Vacaciones: paneles, tabs y estados adaptados a dark.
- Switch activo: track verde y knob blanco; inactivo: gris oscuro.
- Counters resilientes: `Math.max(serverCount, loadedRows.length)` para comentarios/actividad/evidencias.

## Backend

No requiere nueva migración. La v17.9.2 conserva las migraciones, RLS, Realtime y workflow productivo de v17.9.0.

## QA

**373 PASS / 0 FAIL**.
