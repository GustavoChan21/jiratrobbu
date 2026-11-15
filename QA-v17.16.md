# QA v17.16.0 — Jira Interno TROBBU

## Resultado

- Suite automática: **474 PASS / 0 FAIL**.
- Parseo JSX/JavaScript mediante TypeScript transpiler:
  - `app.js`: **0 errores**.
  - `app-v17.16.0.js`: **0 errores**.
- Supabase: normalización de contenido productivo sin pérdida de bloques.

## Casos críticos Knowledge

### Texto enriquecido

- Escritura continua sin modo alterno.
- No existe `safeWriting`, `safeText` ni UI de “Escritura segura”.
- Selección se conserva al interactuar con toolbar/input de URL.
- Bold/italic/underline/strike.
- H1–H5, fuente, tamaño, color, resaltado.
- Listas, indentación, alineación e interlineado.
- Pegado sanitizado.

### Enlaces

- No se usa `execCommand('createLink')`.
- La selección se extrae una sola vez con `Range.extractContents()` y se inserta dentro de un único `<a>`.
- Un caret sin selección inserta la URL una sola vez.
- Editar un enlace existente modifica su `href` sin recrear contenido alrededor.
- Quitar enlace conserva los nodos/texto internos.
- Enter aplica y Escape cancela el editor de URL.

### Bloques

Revisión/regresión para:

- Portada.
- Texto.
- Títulos H1–H5.
- Lista ordenada/no ordenada.
- Cita + autor/fuente.
- Destacado info/success/warning/danger.
- Código + lenguaje.
- Imagen + alt/caption/alineación + compresión.
- Video YouTube/Vimeo.
- Separador.
- Salto de página.

### Producción / compatibilidad

Consulta sobre datos reales de `knowledge_articles` y `knowledge_article_versions`:

- Artículos: 13 bloques originales / 13 normalizados.
- Versiones: 22 bloques originales / 22 normalizados.
- 0 normalizaciones nulas.

El esquema persistente no cambia; el nuevo editor consume el mismo HTML existente.
