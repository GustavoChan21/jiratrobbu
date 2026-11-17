# Jira Interno TROBBU

Versión actual: **v17.21.0**

## Estabilización UI

- Recuperados los componentes `StaffRolesView`, `SettingsView`, `WorkspaceSettings`, `HelpdeskSettings`, `NotificationSettings`, `Toggle` y `EntitySettings` eliminados accidentalmente durante el refactor anterior.
- Staff & Roles vuelve a renderizar su listado, tabs, roles, edición y acciones.
- Bitácora vuelve a usar el componente visual estándar de tabs; se ajustaron periodo de análisis, márgenes y responsive.
- Modal **Fuera hoy** usa footer estándar, padding interno y adaptación light/dark/mobile.
- Se mantuvieron todos los componentes funcionales presentes en v17.18.1; el comparador reporta 0 funciones históricas faltantes.

## Staff CRUD

- Create: `invite-member`.
- Read: membresías/perfiles del workspace.
- Update: `manage-member` acción `update_member`, centralizando perfil, email, rol, productos, permisos y configuración Helpdesk.
- Delete: `manage-member` acción `remove_member`; PostgreSQL elimina `workspace_member_products` mediante FK `ON DELETE CASCADE`.
- La actualización conserva snapshot y ejecuta rollback best-effort si una fase administrativa falla.

## Correo

- Modo de Jira: **PROD** (`email_qa_mode=false`).
- Alias lógico configurado: **Notificaciones Jira x Helpdesk**.
- Sender temporal: `devtest@sendpulseemail.com` mientras SendPulse permanezca en SMTP Test.
- Límite temporal: **10 correos/hora** y control de remanente del máximo de 50 envíos del entorno Test.
- El asunto canónico por folio se conserva para Helpdesk/Jira.

> SendPulse puede sustituir visualmente el nombre/remitente por su identidad de prueba mientras la cuenta continúe en SMTP Test; Jira ya envía el alias solicitado en el payload y entrega a los destinatarios reales.

## Actualización desde v17.20.0

1. Publica los archivos de esta carpeta desde la raíz del hosting.
2. Ejecuta `upgrade-v17.21.0.sql` si la base aún no tiene la migración.
3. Despliega `manage-member.ts` como `manage-member` y `process-notifications.ts` como `process-notifications`.
4. Ejecuta `npm run qa` para la validación estática/focal.

El ZIP de distribución está aplanado: no contiene carpeta contenedora ni `vendor/`.
