# Jira Interno TROBBU v17.11.0

**Release actual:** v17.11.0 - menciones con acceso acotado, UX optimista en Kanban, correo SendPulse con guardas de producción/free-plan, login sin registro público y hardening final de dark mode/counters.

Consulta `RELEASE-v17.11.md`, `QA-v17.11.md`, `SENDPULSE-PRODUCTION-READINESS-v17.11.md` y `Manual-Jira-TROBBU-Knowledge-Helpdesk-v17.11.pdf`.

## Puntos principales

### Menciones
- Los comentarios de tickets Jira y Helpdesk permiten mencionar miembros activos del workspace.
- Una mención concede acceso **solo al ticket/solicitud mencionada** para consultar contexto, actividad, comentarios y evidencias.
- La persona mencionada puede comentar y adjuntar evidencia, pero no puede modificar estado, responsable, producto ni campos administrativos.
- La vista `Mencionados` concentra Jira + Helpdesk y participa en Realtime.
- Las menciones generan notificación in-app, no correo, para evitar ruido.

### Kanban / live UX
- Mover estado y reasignar responsable se reflejan primero de forma optimista.
- Si Supabase rechaza la operación, la fila vuelve al estado anterior.
- En éxito se hace reconciliación dirigida del ticket + Realtime, sin `refresh()` global.
- `vercel.json` desactiva cache de HTML/JS/CSS/config para impedir que una versión antigua sobreviva después del deploy.

### Counters
- Ticket, Sprint y Helpdesk usan conteo exacto de servidor y nunca muestran menos que las filas cargadas:
  `Math.max(serverCount, loadedRows.length)`.
- Continúan Realtime, `liveRevision`, refetch de seguridad y reconciliación periódica.
- Si se ve un badge `0` junto a registros visibles después de desplegar v17.11, comprobar que Vercel esté sirviendo `app.js?v=17.11.0`; la release incluye headers no-cache para resolver este caso.

### Dark mode
- Porcentajes de Gantt usan texto negro de alto contraste.
- Counters de Staff/Roles y tabs de detalle usan fondos oscuros/azules con texto legible.
- Paneles de metadata mantienen fondo integrado/transparente.
- El switch activo usa knob blanco; inactivo usa gris oscuro.

### SendPulse
- La cola histórica se reinicia a cero en `upgrade-v17.11.sql`.
- Solo entran al outbox: recordatorio diario, asignación Helpdesk, comentario Helpdesk, cierre Helpdesk y cierre Jira.
- Los límites operativos se fijan en 45/h y 11,000/mes para conservar margen dentro del plan SMTP Free.
- El recordatorio diario productivo se limita a usuarios con trabajo abierto real.
- El procesador v21 bloquea producción si `helpdesk@trobbucollection.com` no figura como remitente corporativo activo/no-test.
- Mientras SendPulse siga en SMTP Test, `email_qa_mode=true` debe permanecer activo.

## Registro de usuarios
La interfaz de login ya no ofrece `Crear cuenta` ni ejecuta `signUp`. El alta normal se realiza desde Staff/Roles con credenciales administradas.

**Nota de servidor:** durante QA se verificó que Supabase Auth reporta actualmente `disable_signup=false`. El MCP disponible no permite editar Auth Config. Para bloquear también el endpoint público de signup, cambiar en Supabase Dashboard el ajuste de Auth que deshabilita nuevos registros públicos. La aplicación v17.11 ya no ofrece ese flujo.

## Base de datos
`upgrade-v17.11.sql` agrega:
- `ticket_mentions` / `helpdesk_mentions` + RLS + Realtime FULL.
- RPC `mention_entity_users`.
- acceso acotado a comentarios/evidencias para mencionados.
- límites y remitente preferido de email.
- filtrado de eventos que sí pueden generar correo.
- recordatorio diario role-aware.

## Manual
`Manual-Jira-TROBBU-Knowledge-Helpdesk-v17.11.pdf` contiene 6 páginas con capturas reales del sistema y los pasos para Knowledge y Helpdesk.

## QA
Ejecutar:

```bash
npm run qa
```

La entrega final se valida además con parse JSX/TypeScript, CRC ZIP y `git fsck`.

## Distribuciones
- **FULL:** conserva documentación y releases/QA históricos individualmente.
- **COMPACT:** mismo runtime y misma suite QA, con histórico agrupado para reducir archivos visibles.
