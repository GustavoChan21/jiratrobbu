# Jira Interno TROBBU · Release v17.3

## Objetivo

v17.3 estabiliza completamente **Knowledge** sobre v17.2 y cambia el flujo a una arquitectura **categoría → artículo → versión → bloques**. No elimina las mejoras previas de Helpdesk, Vacaciones, Timeline/Gantt, Kanban/Tabla ni relaciones de tickets.

## Regresiones corregidas

1. **Pantalla en blanco al crear/editar un artículo.** El editor enriquecido usa `useRef`, pero v17.2 no lo importaba desde React. El render fallaba con `ReferenceError: useRef is not defined`. v17.3 importa el hook y agrega un `KnowledgeModuleErrorBoundary` para que un error futuro no deje la pantalla vacía.
2. **Creación de borrador frágil.** El alta ya no depende de varias escrituras independientes desde el navegador. `create_knowledge_initial_draft` crea atómicamente artículo + versión v1 + relación `draft_version_id`.
3. **RPC SECURITY INVOKER sin permiso para el normalizador.** Las RPC de autoría llaman a `private.normalize_knowledge_blocks_v3`; el rol `authenticated` ahora tiene `EXECUTE` sobre los helpers puros necesarios. Sin este grant la creación podía fallar aunque las políticas RLS fueran correctas.
4. **Editor legado incompatible.** Se retiró el modal de artículo antiguo no utilizado que mantenía validaciones anteriores a categorías.

## Knowledge · UX categoría primero

- CRUD de categorías dentro del módulo.
- Tarjetas de categoría con icono, color, descripción, orden y contador de artículos.
- Un artículo nuevo se crea explícitamente **dentro de una categoría seleccionada**.
- La categoría `General` se mantiene como contenedor de sistema y no se puede eliminar.
- Al eliminar una categoría usada se obliga a elegir una categoría destino; se reclasifican artículo e historial completo de versiones.
- Categoría visible en listado, lector y vista previa.
- Búsqueda y filtros de artículos se mantienen dentro del contexto de categoría.

## Knowledge · autoría y versiones

- Crear artículo como borrador v1.
- Reabrir y guardar borrador propio inicial con `create_knowledge`.
- Crear nueva versión de un artículo publicado.
- Mantener versión pública mientras existe un borrador.
- Publicar/restaurar versiones mediante `publish_knowledge_version`.
- `content_schema_version=3` se mantiene sincronizado entre versión y artículo publicado.
- Slugs duplicados muestran error comprensible.
- La carga de imágenes ocurre después de que existe el borrador atómico; si Storage falla, el borrador queda recuperable.

## Editor por bloques v3

### Texto enriquecido tipo Word

Cada bloque Texto dispone de:

- Normal / H1 / H2 / H3 / H4 / H5 dentro del texto.
- Fuentes: Inter, Arial, Verdana, Georgia, Times New Roman y Courier New.
- Tamaños: 11, 12, 14, 16, 18, 24 y 32 px.
- Deshacer / rehacer.
- Negrita, cursiva, subrayado y tachado.
- Color de texto y resaltado.
- Lista numerada y lista con viñetas.
- Aumentar/reducir sangría.
- Alineación izquierda, centro, derecha y justificada.
- Insertar enlace, quitar enlace y limpiar formato.
- Interlineado: sencillo, 1.15, 1.3, 1.5, 1.75 y doble.
- Conteo de palabras y caracteres.
- Sanitización de HTML pegado y URLs permitidas.

### Otros bloques

- Título independiente H1–H5, con cambio de nivel posterior.
- Lista ordenada/no ordenada.
- Cita con autor/fuente.
- Destacado info/éxito/advertencia/crítico.
- Código con lenguaje.
- Imagen con alt, pie, alineación y compresión automática.
- Video YouTube/Vimeo con pie.
- Separador visual.
- Salto de página real para impresión/exportación.
- Reordenamiento drag & drop y botones subir/bajar.
- Eliminación individual de bloques.

## Migración de contenido existente

`upgrade-v17.3.sql` migra contenido histórico sin exigir recrear artículos:

- Artículos/versiones sin categoría → `General`.
- `category_id` pasa a ser obligatorio después del backfill.
- `paragraph` / `text` → `richtext`.
- `heading` legado → `heading2`.
- H1–H5 existentes se conservan.
- Se conservan listas, citas, destacados, código, imágenes, videos, separadores y saltos de página.
- Bloques desconocidos se degradan de forma segura a texto enriquecido en lugar de impedir la edición.

## Asistente Knowledge

Se conserva el endurecimiento semántico de v17.2: no recomienda únicamente por palabras genéricas del asunto, exige contexto de descripción y valida título, tags, resumen y contenido completo del artículo. Puede devolver cero coincidencias si ninguna es suficientemente relevante.

## Actualización desde v17.2

1. Respaldar la base de datos.
2. Ejecutar **solo** `upgrade-v17.3.sql` sobre una instalación que ya tenga v17.2.
3. Publicar `app.js`, `styles.css`, `index.html` y el resto de archivos estáticos del paquete.
4. No es necesario volver a ejecutar `upgrade-v17.0.sql`, `upgrade-v17.1.sql` ni `upgrade-v17.2.sql`.
5. Las Edge Functions no requieren una lógica nueva específica de v17.3, pero el paquete conserva las versiones compatibles actuales.

## Verificación recomendada en staging

Después de aplicar la migración, probar con roles reales:

- `create_knowledge`: crear categoría no debe estar permitido si no tiene `edit_knowledge`; sí debe poder crear y mantener su propio borrador inicial dentro de una categoría existente.
- `edit_knowledge`: CRUD de categorías (crear/editar), nuevas versiones y publicación.
- `delete_knowledge`: eliminar artículos; para eliminar una categoría con contenido también se necesita `edit_knowledge` porque implica reclasificar artículos/versiones.
- `view_knowledge`: lectura de publicados sin acceso a borradores privados.
- Storage: subir, leer y borrar imágenes de un borrador propio inicial.

