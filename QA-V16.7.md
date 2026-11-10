# QA v16.7

## Frontend / código

- TypeScript/JSX parse: PASS (`tsc` exit 0).
- Importación CSV/XLS/XLSX/XLSM: 16/16 PASS.
- `csv-import-v15.2.js`, `config.js`, `speed-insights.js`: PASS.
- CSS balanceado: 1955 `{` / 1955 `}`.
- Native `alert()`, `confirm()`, `prompt()`: 0.
- Topbar sin app/workspace grid icon: PASS.
- Centro de ayuda eliminado del flujo UI: PASS.
- TicketModal/Helpdesk/comments usan selector único de adjuntos imágenes + documentos: PASS.
- Favicon SVG y Apple Touch Icon generados desde el isotipo TROBBU: PASS.

## Workspace governance

Probado con rollback real:
- Helpdesk/Consulta: create workspace bloqueado.
- Dev: create workspace bloqueado.
- PM: create workspace permitido + bootstrap 5 productos.
- Admin simulado dentro de transacción: permitido.
- Superadmin: permitido.
- INSERT directo a `workspaces` por Helpdesk/Consulta: bloqueado por RLS.
- Residuos QA: 0.

## Asignación rápida / auditoría

- Asignación Dev desde null → usuario: actividad registrada.
- Reasignación Dev usuario A → usuario B: actividad registrada.
- Asignación QA: actividad registrada.
- Alta de ticket ya asignado a Dev/QA: actividades iniciales registradas.
- Consulta/Helpdesk intentando cambiar responsable directo: bloqueado.
- Rollback: ticket y actividades regresan a estado original; residuos QA 0.

## Contadores por módulo

Prueba con módulo temporal + ticket + cambio de estado + artículo Knowledge:
- `ticket_count = 1`: PASS.
- `activity_count >= 2`: PASS.
- `article_count = 1`: PASS.
- RPC ejecuta correctamente también para Helpdesk sin romper carga general: PASS.
- Residuos QA: 0.

## Adjuntos / Storage

Bucket `jira-evidence`:
- privado: se conserva.
- límite: 25 MB.
- whitelist MIME ampliada.
- whitelist extensión validada para XLSX, XLSM, PDF, PPTX, DOTX y variantes.
- EXE: bloqueado.
- HTML: bloqueado.
- Knowledge continúa limitado a imágenes.
- Tickets / Helpdesk / Sprints aceptan documentos.
- imágenes siguen comprimiéndose; documentos no se transforman.
- columnas `original_size_bytes` disponibles también en ticket/sprint attachments.
- FK indexes añadidos para cargas documentales de mayor volumen.

## Advisors

- Supabase Health Advisor: 0 incidencias.
- Security Advisor: solo permanece `Leaked Password Protection Disabled`, warning global preexistente.
- 8 FK warnings históricos de attachments corregidos; índices nuevos pueden aparecer temporalmente como `unused` hasta recibir tráfico.
