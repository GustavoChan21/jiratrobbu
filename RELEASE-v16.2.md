# Jira Interno TROBBU v16.2

## Knowledge
- Alta y edición de artículos migrada de modal a vista completa.
- Sección superior de detalles/metadatos y sección independiente de contenido.
- Editor por bloques sin scroll interno artificial en desktop; la página completa controla el desplazamiento.
- Vista de lectura de artículo también pasa a página completa.
- Conserva imágenes comprimidas privadas y videos embebidos de YouTube/Vimeo.

## Sprint
- El detalle del sprint ya no oculta comentarios/evidencias cuando existen muchas actividades.
- Scroll independiente para actividades y comentarios, más scroll de seguridad en la columna principal.
- El sidebar conserva scroll independiente.
- Responsive en desktop/tablet/móvil y tolerante al zoom del navegador.

## Auditoría de overflow
- Se normalizaron contenedores largos de detalles en modales xl/detail-grid con min-height:0 y overflow controlado.
- Se evita contenido inaccesible por overflow:hidden en vistas de detalle extensas.

## QA
- TypeScript/JSX: exit 0.
- Importación CSV/XLS/XLSX/XLSM: 16/16.
- CSS balanceado.
- Health Advisor Supabase: 0 incidencias.
- Security Advisor: solo warning global preexistente de leaked password protection.
- No se crearon tickets ni solicitudes Helpdesk para QA.
