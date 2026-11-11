# QA v17.5 · Jira Interno TROBBU

## Resultado automatizado

- `npm run qa`: **154 / 154 PASS**.
- `app.js`: parser JSX/TypeScript **0 errores**.
- Edge Functions: **8 / 8** con parser TypeScript **0 errores**.
- CSS: llaves balanceadas.
- SQL v17.5: delimitadores `$$` balanceados.
- `database.sql`: termina exactamente con el contenido de `upgrade-v17.5.sql`.
- Marcadores de merge: ninguno.
- Cantidad de archivos del proyecto: **101**.

## Regresión crítica · Texto Knowledge

La suite verifica que:

- el nodo `contentEditable` se cree con DOM nativo y no sea hijo administrado por React;
- `input` no llame al `onChange` que actualiza estado React;
- cursor/rango se guarde y restaure para herramientas;
- el HTML vivo se mantenga en `liveRichHtmlRef` y participe en Guardar/Vista previa;
- `blur` y herramientas hagan commit sanitizado;
- pegado HTML/texto pase por sanitización;
- bold/italic/underline/strike de `span style` sobrevivan al guardado;
- fuente, tamaño, color, resaltado, listas, sangría, alineación, links y limpieza de formato sigan disponibles;
- H1-H5 coincidan en JS y CSS con 32/28/24/20/16 px.

## Knowledge completo

Se verifican CRUD de categorías, categoría General, migración de históricos, creación atómica artículo+v1, edición de borrador, nuevas versiones, publicación, multimedia, todos los tipos de bloque, separador/salto de página, portada y traducción de `content_blocks`.

`upgrade-v17.5.sql` re-normaliza `knowledge_articles` y `knowledge_article_versions` con el esquema v3 para que contenido anterior no dependa de la nueva UI para seguir siendo legible/editable.

## Configuración y portadas

Se verifica columna JSONB de configuración, defaults por plantilla, preservación de valores existentes, UI dedicada de Configuración, color pickers, fuentes, previews y CSS variables compartidas por edición/lectura/PDF.

## Modales

La advertencia de salida usa `form-body knowledge-exit-body` y `form-footer static-footer`, con las acciones solicitadas y estilos compatibles con el sistema.

## Regresiones externas a Knowledge

La suite también conserva checks de:

- autoasignación manual y automática de Helpdesk;
- counters de Helpdesk derivados de la misma base filtrada;
- selector compartido de responsable Kanban/Tabla;
- búsqueda para relacionar tickets;
- layout Gantt responsive;
- Vacaciones multi-bloque y proyección;
- exclusión de personas ausentes en autoasignación.

## Limitación del entorno de QA

El Chromium headless disponible en este contenedor no ofrece un runtime de navegador confiable por las restricciones DBus/gráficas del entorno, por lo que **no se contabilizó un smoke de navegador como aprobado**. No se sustituye esa limitación con una afirmación de producción. La comprobación final de eventos reales de `contentEditable`, RLS/Auth y Storage debe realizarse en staging con el navegador y Supabase del proyecto.
