# QA / Code Review — Jira Interno TROBBU v17.2

## Resultado

- **QA automatizado v17.2:** 90/90 verificaciones aprobadas.
- **Frontend `app.js`:** parser TypeScript/JSX aprobado sin errores.
- **Edge Functions:** compilación/sintaxis aprobada para las 8 funciones `.ts` del paquete usando stubs del runtime Deno/Supabase.
- **SQL:** balance de dollar-quotes aprobado, migración incremental integrada exactamente al final de `database.sql`, RLS/grants revisados.
- **CSS:** llaves balanceadas y overrides de v17.2 revisados.
- **Archivos estáticos:** `index.html`, `styles.css` y `app.js` responden HTTP 200 mediante servidor local.
- **Diff contra v17.1:** cambios limitados a Knowledge, Asistente Knowledge, Gantt, versionado/documentación y migración v17.2.

## Cobertura específica de Knowledge

### Alta inicial

- Inserción del artículo borrador bajo RLS.
- Confirmación de lectura inmediata del registro creado.
- Inserción de versión 1 en estado draft.
- Actualización de `draft_version_id`.
- Rollback de media y artículo parcial en error.
- Mensaje específico para colisión de slug.

### RBAC / RLS

- `view_knowledge`: lectura de publicados.
- `create_knowledge`: alta y mantenimiento del borrador inicial propio.
- `edit_knowledge`: edición/versionado/publicación editorial.
- `delete_knowledge`: eliminación según permiso.
- Autor con create puede volver a abrir su propio borrador desde la UI.
- Storage replica las mismas reglas del borrador propio para lectura/subida/eliminación de media.
- Se conserva el allowlist de archivos del bucket `jira-evidence`.

### Versionado

- Creación de nueva versión mediante `create_knowledge_draft_version`.
- Publicación mediante `publish_knowledge_version`.
- La versión pública permanece activa mientras existe un borrador nuevo.
- `category_id`, producto, módulo, tags, resumen, texto plano y `content_blocks` se conservan en el ciclo de versión.

### Bloques/editor

- H1–H5.
- Fuente y escala 11–32 px.
- Negrita/cursiva/subrayado.
- Listas y alineación.
- Párrafos heredados convertibles a texto enriquecido.
- Cita/destacado/código/imagen/video.
- Separador horizontal.
- Salto de página persistente y `page-break-after` / `break-after` al imprimir.
- Sanitización de HTML/formato mediante allowlist.
- Traducción mantiene `content_blocks` y HTML permitido.

## Asistente Knowledge

Se verificó que:

- No se consulta con un asunto corto sin descripción suficiente.
- El motor local indexa hasta 40,000 caracteres del contenido del artículo, además de título/tags/resumen.
- Los términos genéricos no pueden originar una recomendación por sí solos.
- Debe existir al menos un término ancla real de la solicitud.
- Producto/departamento/tipo de solicitud sirven como contexto/boost, no como sustituto del concepto principal.
- La IA recibe evidencias extraídas del contenido completo.
- Puede retornar cero artículos.
- La UI muestra conceptos coincidentes.

### Regresión de la captura

Entrada: `crear familiares en admin`  
Artículo no relacionado: `Crear Perfil de Socio Inversionista en Panel Administrativo`.

Resultado esperado y validado en la lógica: `crear` y `admin` se consideran genéricos; el término ancla es `familiares`. Si el artículo no contiene evidencia de ese concepto, no pasa a recomendación.

## Buscador Knowledge

- Wrapper único con borde.
- Input interior fuerza `border:0`, `box-shadow:none`, `background:transparent`.
- Estado focus aplicado sobre el wrapper, eliminando el efecto de doble input de la captura.

## Timeline/Gantt

Desktop:
- Contexto/título en primera línea.
- Cinco controles lógicos en una sola fila mediante grid.
- Navegación anterior/Hoy/siguiente agrupada como el quinto control.

Responsive (`<=900px`):
- Un control lógico por fila.
- Inputs/selects al 100%.
- Navegación mantiene tres botones proporcionados.

## Regresiones v17.1 conservadas

El script también vuelve a verificar:

- counters/filtros Helpdesk;
- orden activo → resuelto/cerrado;
- autoasignación manual;
- capacidad/descripciones de Staff;
- exclusión de vacaciones en routing;
- vacaciones multibloque y reincorporación;
- timeline de vacaciones;
- selector rápido Kanban/Tabla;
- buscador y relaciones de tickets activos/cerrados;
- permisos Knowledge/Vacaciones;
- cambio administrativo de contraseña server-side.

## Limitaciones del entorno de QA

No se declara una prueba end-to-end contra tu Supabase de producción porque el contenedor no tiene las sesiones, RLS, Storage ni datos reales del proyecto. Chromium headless tampoco consigue iniciar en este entorno por ausencia de DBus (`/run/oai/bus`), por lo que el smoke visual de navegador real debe ejecutarse en staging después del despliegue.

Esto no se contabiliza como aprobado artificialmente. Antes de producción debe ejecutarse el checklist de staging descrito en `RELEASE-v17.2.md`.
