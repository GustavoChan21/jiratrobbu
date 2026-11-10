# QA — Jira Interno TROBBU v16.9

## Frontend

- TypeScript/JSX parse: PASS (`tsc` exit 0).
- Importadores CSV/XLS/XLSX/XLSM: PASS 16/16.
- `csv-import-v15.2.js`: PASS.
- `config.js`: PASS.
- `speed-insights.js`: PASS.
- CSS balanceado: 2032 `{` / 2032 `}`.
- Dialogs nativos `alert/confirm/prompt`: 0.
- Cache busting v16.9 en favicon, Apple touch icon, CSS, config y app: PASS.

## Inventario de uploaders

Se localizaron 6 inputs de archivo:

1. Importador de Backlog — XLS/XLSX/XLSM/CSV (intencional).
2. Bloque Imagen de Knowledge — imágenes solamente (intencional por tipo de bloque).
3. Adjuntos de Ticket nuevo/edición — `ATTACHMENT_ACCEPT`.
4. Comentarios/evidencias Ticket y Sprint — `ATTACHMENT_ACCEPT` compartido.
5. Evidencias al crear Helpdesk — `ATTACHMENT_ACCEPT`.
6. Comentarios/evidencias Helpdesk — `ATTACHMENT_ACCEPT`.

No queda un uploader operativo Ticket/Sprint/Helpdesk limitado únicamente a imágenes.

## Sprint: archivo sin texto

Prueba transaccional con rollback:

- comentario `Archivo adjunto` sin texto de usuario;
- metadata XLSX en `sprint_attachments`;
- whitelist Storage acepta XLSX y PPTX;
- comentario creado: PASS;
- adjunto creado: PASS;
- residuos tras rollback: 0 comentarios / 0 adjuntos.

## Contadores RLS-aware

### Recepción San Miguel

Usuario `consulta`, sin productos operativos asignados:

- Tickets visibles: 0.
- Backlog visible: 0.
- Knowledge visible: 1.
- Solicitudes Helpdesk visibles: 1.
- Productos operativos autorizados: 0.
- Consulta directa a `products`: 0.

Esto confirma que Knowledge/Mis solicitudes ya no quedan visualmente en `0` por depender del array de tickets y que no se filtran nombres de productos no autorizados.

### Superadmin

`get_navigation_counts()` se comparó con conteos directos bajo la misma sesión RLS:

- tickets: coincide;
- backlog: coincide;
- artículos: coincide;
- Helpdesk: coincide;
- suma de conteos por producto = total de tickets visibles;
- productos operativos: 5.

PASS.

## Contadores por módulo

Dentro de una transacción se creó temporalmente:

- 1 módulo;
- 1 ticket ligado;
- cambio de estado para generar actividad;
- 1 artículo Knowledge ligado.

`list_module_counts()` devolvió:

- `ticket_count = 1`;
- `activity_count >= 2`;
- `article_count = 1`.

Rollback final:

- módulos QA: 0;
- tickets QA: 0;
- artículos QA: 0.

## Privacidad durante carga

Validación estática:

- antes de resolver memberships se usa `AccessValidationShell`;
- al cambiar workspace se usa `AccessValidationShell` hasta validar permisos;
- Sidebar real no se monta durante ese estado;
- el shell no imprime nombres de módulos/productos/workspace;
- estados del workspace anterior se limpian antes de cargar el nuevo;
- si falla la validación crítica se conserva shell privado + Reintentar.

## Sidebar

Badges permitidos solamente en:

- `board`;
- `backlog`;
- `knowledge`;
- `mytasks`;
- `helpdesk`.

La sección Productos autorizados se oculta si `products.length === 0`.

## Supabase Advisors

- Health Advisor: 0 incidencias.
- Security Advisor: únicamente warning global preexistente `Leaked Password Protection Disabled`.
- v16.9 no agrega funciones `SECURITY DEFINER` públicas.
- Performance: no se detectó un finding nuevo atribuible a `get_navigation_counts`, `list_authorized_products` o la nueva policy `products_select`.

## Residuos QA

Todas las pruebas de datos se hicieron con rollback. Resultado final: 0 residuos QA.
