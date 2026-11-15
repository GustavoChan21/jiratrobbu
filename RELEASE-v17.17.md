# Jira Interno TROBBU v17.17.0

## Knowledge editor: corrección real del bundle

La v17.16.0 etiquetó un archivo nuevo pero el bundle activo resultó byte-a-byte idéntico a v17.15.0. v17.17.0 parte del ZIP FULL entregado y crea un runtime realmente nuevo (`app-v17.17.0.js`).

## Bloque Texto

- Se mantiene un único editor enriquecido en vivo; no existe el flujo Escritura Segura.
- La selección para links se persiste mediante bookmarks de ruta DOM + offsets, no mediante un Range frágil que dependa del foco del input URL.
- Aplicar un link sobre texto seleccionado conserva exactamente el texto visible. Si el DOM cambia inesperadamente, la operación se revierte antes de guardar.
- Editar un link modifica únicamente el href; quitarlo conserva el texto.
- El editor permite seguir escribiendo después de aplicar un link sin perder el ancla ni los estilos existentes.
- URLs válidas: https://, http://, mailto: y tel:.

## Compatibilidad

No cambia el esquema `content_blocks`. Los bloques `richtext` existentes conservan el mismo campo `html`, por lo que artículos publicados, borradores y versiones históricas cargan en el nuevo componente sin migración destructiva.

## Regresión de bloques

QA cubre Portada, Texto enriquecido, H1-H5, Lista, Cita, Destacado, Código, Imagen, Video, Separador y Salto de página. Se verificó además preservación de link, strong/bold, color y font-size durante normalización.

## QA browser

`qa-knowledge-editor-browser-v17.17.py` ejecuta Chromium vía DevTools Protocol y reproduce el flujo de selección/link/continuación de escritura. También prueba el round-trip de los 12 tipos de bloque.
