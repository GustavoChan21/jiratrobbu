# Jira Interno TROBBU v16.7

## Cambios principales

- Se elimina el icono superior izquierdo de cambio de workspace; el cambio de workspace queda concentrado en la tarjeta lateral.
- Solo Admin, PM y Superadmin pueden crear nuevos workspaces. La restricción existe tanto en UI como RLS/RPC.
- Los contadores laterales usan datos visibles reales y Campos y módulos incorpora conteos por módulo de Tickets, Actividades y Artículos Knowledge.
- Kanban incorpora responsable como badge/select rápido, con asignación a uno mismo/equipo según permisos.
- Toda asignación/reasignación/desasignación Dev/QA se registra en `ticket_activity`, incluida la asignación inicial al crear un ticket.
- Se retira el Centro de ayuda; Knowledge queda como fuente de soporte/autoservicio.
- Nuevo favicon TROBBU: isotipo oficial en blanco sobre fondo corporativo, con SVG y Apple Touch Icon.
- Adjuntos privados ampliados a imágenes y documentos: PDF, CSV, Excel, Word, PowerPoint, RTF, OpenDocument y variantes Office.
- Imágenes continúan comprimiéndose en navegador; documentos se conservan intactos.
- Límite por documento: 25 MB. Límite por imagen original: 15 MB. Máximo 5 adjuntos por operación.

## Backend

Incluye `upgrade-v16.7.sql` y `database.sql` consolidado. El Supabase actual ya contiene estos cambios.
