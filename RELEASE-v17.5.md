# RELEASE v17.5 · Jira Interno TROBBU

Base: **v17.3.1 Final Completo**. La distribución conserva exactamente **101 archivos**.

## Knowledge · bloque Texto

- Sustitución de la superficie `contentEditable` controlada por React por un editor nativo imperativo dentro de un host React estable.
- La escritura no ejecuta `setState`/`onChange` por pulsación. El DOM mantiene cursor, selección y HTML mientras se escribe.
- Guardar y Vista previa mezclan el HTML vivo del editor aunque todavía tenga el foco.
- Persistencia segura en `blur` y al ejecutar herramientas de formato.
- Selección restaurable al usar toolbar, fuente, tamaño, colores, links, listas y alineación.
- Pegado HTML/texto sanitizado; archivos soltados directamente sobre Texto se bloquean.
- Sanitizador ampliado para conservar `font-weight`, `font-style`, `underline` y `line-through` emitidos por Safari/Chrome en `span style`.
- Herramientas: Normal/H1-H5, fuente, 11–32 px, undo/redo, negrita, cursiva, subrayado, tachado, color, resaltado, listas, sangría, alineación, links/unlink, limpiar formato e interlineado.
- Escala H canónica: H1 32 px, H2 28 px, H3 24 px, H4 20 px, H5 16 px.

## Configuración · Portadas Knowledge

- Nuevo apartado visible en Configuración con preview de TROBBU Verde, Marfil y Azul Ejecutivo.
- Parámetros globales por plantilla: fondo, fondo final, texto, acento, borde, fuente de título y fuente de contenido.
- Los mismos parámetros se aplican a editor, lector, vista previa e impresión/PDF.
- Persistencia en `workspace_settings.knowledge_cover_templates`.
- Los artículos guardan el identificador de plantilla, por lo que los existentes heredan cambios visuales sin modificar sus bloques.

## Migración de contenido existente

`upgrade-v17.5.sql` vuelve a ejecutar el normalizador canónico v3 sobre artículos y versiones, preservando compatibilidad con bloques anteriores. También agrega y completa la configuración de portadas sin eliminar valores personalizados.

## Modales / UX

La confirmación al abandonar un artículo con cambios usa la estructura estándar de modales (`form-body` + `form-footer`), respetando paddings, márgenes y acciones del resto del sistema.

## Regresiones preservadas

Se mantienen CRUD de categorías, creación atómica artículo+v1, borradores/versionado/publicación, multimedia, Knowledge Assistant, autoasignación manual de Helpdesk, counters filtrados, selector de responsable Kanban/Tabla, relaciones de tickets, Gantt responsive y Vacaciones multi-bloque.

## Despliegue

1. Ejecutar `upgrade-v17.5.sql` sobre la BD que ya está en v17.3.1.
2. Publicar los archivos estáticos v17.5.
3. Las Edge Functions no requieren un cambio funcional específico para el editor, pero se incluyen en la distribución completa y fueron revisadas por parser.
4. Ejecutar `npm run qa`.
5. En staging, probar con un usuario autorizado: crear artículo, escribir varias líneas sin salir del bloque, seleccionar texto y aplicar cada formato, guardar con foco dentro del editor, recargar/reabrir, crear nueva versión y publicar.
