# Release v17.9.1 — Jira Interno TROBBU

## Alcance

v17.9.1 endurece el modo oscuro y corrige los counters de detalle detectados en producción. No modifica el workflow ni el esquema funcional de v17.9.0.

## Dark mode luxury

La migración visual conserva la identidad del sistema claro y cambia únicamente la representación cromática.

- Fondo base `#0B1117`, shell `#0E151D`, superficies `#131C25 / #18232E / #202D39`.
- Bordes oscuros `#314151` y texto principal cercano a blanco sin usar blanco puro en superficies extensas.
- Logo/isotipo TROBBU blanco en Topbar, Login y estados vacíos.
- Login conserva `auth-bg.webp`, con overlays oscuros y card translúcida luxury.
- Se corrigieron Backlog/Sprints, drawer de notificaciones, pantalla de validación de acceso, tabla y modal Helpdesk, Staff/Roles, importaciones, Reportes/AI, Gantt, Knowledge, Vacaciones, relaciones de ticket y superficies secundarias.
- Los colores semánticos se conservaron con variantes oscuras para no perder lectura de estado.
- Inputs/selects/textareas/opciones nativas tienen contraste explícito.

## Helpdesk inline controls

Los controles de responsable, estado y decisión ahora separan:

1. la capa visual (`table-inline-value`), y
2. el `<select>` nativo transparente (`table-inline-native`) posicionado sobre el 100% del componente.

Esto mantiene visible el color del estado y hace clicable todo el control, no solo el texto o el icono.

## Counters exactos

Se añadió `exactRelationCount()` basado en PostgREST `COUNT(*)` con `head:true`.

- Helpdesk: `helpdesk_comments`, `helpdesk_activity`, `helpdesk_attachments`.
- Ticket: `ticket_comments`, `ticket_activity`, `ticket_attachments`.
- Sprint: `sprint_comments`, `sprint_attachments`.

Los conteos exactos conviven con Realtime/live revisions y el refresco resiliente. Las mutaciones locales (comentarios, archivos y cambio de estado) vuelven a ejecutar `load()` para reflejar el valor correcto de inmediato.

## Producción / RLS

Sin cambios de esquema en esta patch. Se verificó el conteo bajo rol PostgreSQL `authenticated` y JWT de un solicitante Helpdesk real.

La consulta productiva confirmó que los datos sí existían en BD; el `0` era un problema del frontend anterior.

## QA

- Suite v17.9.1: **347 PASS / 0 FAIL**.
- Sin merge markers.
- CSS balanceado.
- RLS de counts validado como solicitante normal.
- FULL y COMPACT ejecutan la misma suite.
- ZIP CRC y Git integrity se verifican al empaquetar.

### Limitación del entorno de QA visual

Chromium headless del sandbox se bloquea por DBus y no genera screenshot. Esa ejecución se marca como **no ejecutable**, no como PASS. Las capturas aportadas por el usuario se utilizaron como referencia directa y la auditoría estática cubre además superficies no visibles en dichas capturas.
