# Jira Interno TROBBU v17.16.0

## Knowledge — editor de texto enriquecido en vivo

- Se elimina por completo **Escritura segura** del bloque Texto.
- El bloque usa un único `contentEditable` enriquecido durante toda la edición.
- Es posible escribir, seleccionar y aplicar formato sin cambiar de modo: H1–H5, fuentes, tamaños, negritas, cursivas, subrayado, tachado, color, resaltado, listas, sangrías, alineación, interlineado y enlaces.
- La inserción/edición de enlaces deja de usar `document.execCommand('createLink')` y usa `Range` del DOM para envolver únicamente la selección. Esto evita duplicar el párrafo/contenido al agregar un link.
- El flujo preserva la selección al pasar del contenido a controles del mismo editor (toolbar, URL, fuente, color), evitando carreras de foco que podían restaurar HTML antiguo o perder estilos.
- Quitar un enlace conserva el texto seleccionado.
- Pegar HTML usa sanitización + inserción por `Range`, sin `insertHTML` deprecado.

## Compatibilidad de contenido

No se cambia el esquema persistido. Los bloques `richtext` existentes siguen usando `html` + `line_height`, por lo que artículos y versiones actuales abren directamente en el nuevo editor sin conversión destructiva.

Se verificó en producción que todos los bloques almacenados normalizan con la misma cantidad de elementos:

- Artículos: 13 bloques -> 13 bloques.
- Versiones: 22 bloques -> 22 bloques.

## Revisión de bloques Knowledge

Se verificaron Portada, Texto, H1–H5, Lista, Cita, Destacado, Código, Imagen, Video, Separador y Salto de página. Se reforzó además la fidelidad de saltos de línea en listas, citas y destacados.

## Cache isolation

La release carga assets únicos:

- `app-v17.16.0.js`
- `styles-v17.16.0.css`

Esto evita mezclar HTML nuevo con JavaScript/CSS de releases anteriores en Vercel o navegador.

## Base de datos

No requiere nueva migración SQL. El esquema Knowledge v3 actual es compatible con el nuevo componente.
