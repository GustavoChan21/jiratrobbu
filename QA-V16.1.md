# QA v16.1

No se crearon tickets ni solicitudes Helpdesk para QA.

## Frontend
- TypeScript 5.8.3 sobre app.js JSX: PASS, exit 0.
- Importación CSV/XLS/XLSX/XLSM: 16/16 PASS.
- csv-import-v15.2.js: sintaxis PASS.
- config.js: sintaxis PASS.
- speed-insights.js: sintaxis PASS.
- CSS: 1697 aperturas / 1697 cierres.
- Notificaciones: drawer flex con min-height:0, overflow-y:auto, 100dvh y scrollbar-gutter.
- Helpdesk: comentarios con max-height y overflow-y:auto; botón de alta fuera del área scrolleable.
- Knowledge: editor y render de todos los tipos de bloque compilados.

## Backend / RLS
- Knowledge content_blocks JSON: PASS.
- Metadata de imagen Knowledge con tamaño original/final: PASS.
- Administrador puede subir media Knowledge: PASS.
- Miembro normal puede leer media de artículo publicado: PASS.
- Miembro normal no puede subir media Knowledge: PASS.
- Pruebas realizadas con ROLLBACK: 0 residuos.
- Snapshot de autor en Helpdesk: PASS.
- Comentarios existentes: 0 sin author_name, 0 sin author_email (5 totales al momento del QA).
- Supabase Health Advisor: 0 incidencias.
- Security Advisor: solo warning global previo `Leaked Password Protection Disabled`.
- Performance Advisor: 39 FK legacy sin índice; ninguna FK nueva de Knowledge sin índice. Índices nuevos pueden aparecer inicialmente como unused hasta recibir tráfico real.

## Asistente IA
- Logs previos: múltiples POST 200 a `trobbu-knowledge-assistant`.
- La versión v6 de la función está ACTIVE y JWT requerido.
- Se añadió logging del proveedor sin exponer secretos. La verificación de `openai-responses` vs fallback queda observable en la siguiente invocación real del usuario.
