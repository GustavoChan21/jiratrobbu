# Jira Interno TROBBU v17.21.0

## Correcciones

### UI / Responsive
- Recupera siete componentes eliminados por el refactor de Bitácora que provocaban pantalla blanca en Staff y riesgo de fallos en Configuración.
- Homologa tabs de Bitácora con el componente `.tabs` existente.
- Ajusta periodo de análisis y espaciado de filtros.
- Corrige `Fuera hoy`: cuerpo con padding, cards separadas, footer estándar sin margen negativo, responsive y dark mode.

### Staff CRUD
- La edición ya no se divide entre una Edge Function y escrituras directas del navegador.
- `update_member` centraliza perfil, email de Auth, puesto, rol, estado, productos, permisos y parámetros Helpdesk.
- Protege Superadmin, valida productos del workspace y evita correos duplicados.
- `remove_member` elimina la membresía; productos asociados se eliminan por FK `ON DELETE CASCADE`.
- Rollback conserva todos los campos mutables del miembro.

### Emails
- `process-notifications` v24 permite entrega productiva incluso con sender SMTP Test.
- Configuración aplicada: `email_qa_mode=false`, alias `Notificaciones Jira x Helpdesk`, sender `devtest@sendpulseemail.com` y tope 10/h.
- Se conserva asunto canónico por folio y destinatarios reales.
- En SMTP Test se controla además el remanente de 50 mensajes observado por Jira.

## Producción Supabase
- `manage-member`: v14 ACTIVE.
- `process-notifications`: v24 ACTIVE.
- Health Advisor posterior: 0 lints.
- Cola accionable al habilitar PROD: 0 mensajes, evitando liberar histórico.

## Empaquetado
- Archivos de despliegue en raíz del ZIP.
- Sin carpeta `vendor/`.
