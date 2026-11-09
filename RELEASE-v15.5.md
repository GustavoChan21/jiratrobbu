# Jira Interno TROBBU v15.5

Base estable: v15.4.1 Hotfix (runtime v15.1).

## Cambios integrados

- Importación Backlog desde XLSX, XLS y CSV de Google Sheets.
- Configuración > Helpdesk > Departamentos / Tipos de solicitudes.
- CRUD escalable de Tipos de solicitud.
- Selector obligatorio de Tipo de solicitud al crear Helpdesk.
- Filtro y estadísticas por Tipo de solicitud.
- Eliminación segura: tipos usados se desactivan para conservar histórico.
- QA backend y parser documentado en QA-REPORT.md.
- Actividad QA registrada como ADM-1.

No requiere volver a ejecutar upgrade-v15.4.sql en el Supabase actual, porque esa migración ya fue aplicada.
