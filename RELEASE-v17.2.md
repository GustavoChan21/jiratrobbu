# Jira Interno TROBBU v17.2

**Base requerida:** v17.1  
**Migración incremental:** `upgrade-v17.2.sql`

## Objetivo

v17.2 corrige las regresiones restantes del módulo Knowledge detectadas después de v17.1 y endurece el flujo completo de autoría y consulta. También ajusta el Asistente Knowledge para reducir falsos positivos y compacta los controles del Timeline/Gantt.

## Knowledge: creación, edición y versiones

- Se restaura el flujo de alta estable basado en RLS: artículo borrador → versión 1 → media → vínculo `draft_version_id`.
- Si falla una subida o inserción intermedia, se eliminan media y artículo parcial para no dejar registros huérfanos.
- Un usuario con `create_knowledge` puede crear, volver a abrir y continuar editando **su borrador inicial** aunque no tenga `edit_knowledge`.
- `edit_knowledge` continúa siendo requerido para crear versiones posteriores y publicar/versionar artículos existentes.
- Los administradores/editoriales abren Knowledge en **Todos** por defecto para que un borrador recién creado no quede oculto bajo “Publicados”.
- Se reafirman RLS y grants para `knowledge_articles`, `knowledge_article_versions` y `knowledge_media`.
- Se corrige la discrepancia entre RLS de tablas y Storage: el autor de un borrador inicial puede leer, subir y revertir sus propios archivos/imágenes.

## Editor de artículos

Se conservan los bloques anteriores y se agregan/mejoran estas capacidades:

- Títulos H1, H2, H3, H4 y H5, con cambio de nivel desde cada bloque.
- Bloque **Texto** enriquecido con:
  - Inter, Arial, Verdana, Georgia, Times New Roman y Courier New.
  - 11, 12, 14, 16, 18, 24 y 32 px.
  - Negrita, cursiva y subrayado.
  - Listas numeradas y con viñetas.
  - Alineación izquierda, centro, derecha y justificada.
- Los párrafos heredados siguen siendo compatibles y pueden convertirse a texto enriquecido sin perder su contenido.
- Separador horizontal visual.
- Nuevo bloque **Salto de página**, independiente del separador y efectivo al imprimir/exportar.
- Se mantienen cita, destacado, código, imagen y video.
- El sanitizador conserva únicamente tags, fuentes, tamaños y estilos permitidos.

## Asistente Knowledge

- Ya no dispara recomendaciones a partir de un asunto corto solamente: exige una descripción con contexto suficiente.
- Evalúa el asunto + descripción y contrasta contra:
  - título del artículo;
  - etiquetas;
  - resumen;
  - **contenido completo consultable** del artículo;
  - producto/departamento/tipo de solicitud como contexto secundario.
- Palabras genéricas como `crear`, `admin`, `panel`, `perfil`, `editar`, `configurar`, etc. tienen peso débil y nunca son suficientes por sí mismas.
- Se exigen términos ancla específicos del problema antes de que un artículo pueda ser candidato.
- La IA recibe extractos de evidencia obtenidos del contenido completo y puede devolver **cero coincidencias**.
- Umbral semántico IA: 0.68; fallback determinístico: 0.62 + término ancla real.
- La UI muestra porcentaje y conceptos coincidentes para facilitar la validación del usuario.

### Caso de regresión validado

`crear familiares en admin` no puede sugerir `Crear Perfil de Socio Inversionista en Panel Administrativo` solo por compartir palabras genéricas como `crear`, `admin`, `panel` o `perfil`. Debe existir evidencia del concepto específico `familiares` u otro concepto real aportado por la descripción.

## UI

- Se corrige el buscador de Knowledge que dibujaba dos bordes/inputs solapados. Ahora existe un solo campo visual con `focus-within`.
- Timeline/Gantt mantiene la línea de título y contexto arriba.
- En escritorio, los cinco controles lógicos quedan en una sola fila:
  1. Desde.
  2. Periodo.
  3. Agrupación.
  4. Ir a sprint.
  5. Navegación anterior / Hoy / siguiente.
- En `<= 900 px`, los cinco controles se apilan en filas completas; la navegación conserva sus tres botones en una misma subfila.

## Despliegue desde v17.1

1. Respaldar base/configuración antes de migrar.
2. Ejecutar **solo** `upgrade-v17.2.sql` si la instalación ya está en v17.1.
3. Desplegar `app.js`, `styles.css`, `index.html` y `trobbu-knowledge-assistant.ts`.
4. Volver a desplegar la Edge Function `trobbu-knowledge-assistant`.
5. Limpiar CDN/cache si aplica; `index.html` referencia assets con `v=17.2.0`.
6. Ejecutar `npm run qa`.
7. En staging, validar con roles reales:
   - `view_knowledge` únicamente;
   - `create_knowledge` + `view_knowledge`;
   - `edit_knowledge`;
   - `delete_knowledge`;
   - admin/superadmin.

## Archivos modificados/agregados sobre v17.1

- `app.js`
- `styles.css`
- `trobbu-knowledge-assistant.ts`
- `database.sql`
- `index.html`
- `package.json`
- `README.md`
- `upgrade-v17.2.sql` **nuevo**
- `qa-v17.2.mjs` **nuevo**
- `QA-v17.2.md` **nuevo**
- `RELEASE-v17.2.md` **nuevo**

