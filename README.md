# Jira Interno TROBBU v17.16.0

## v17.16.0

Knowledge refactoriza el bloque Texto a edición enriquecida en vivo: se elimina Escritura segura, los enlaces usan DOM Range sin duplicar contenido, se preserva la selección al operar la toolbar y se mantiene compatibilidad completa con los `content_blocks` existentes. La suite v17.16 cubre los 12 tipos de bloque y valida round-trip del contenido productivo.

## v17.15.0

Counters de detalle determinísticos basados en las filas renderizadas y preview de adjuntos centrado al 90% del viewport.

Versión estabilizada después de auditoría de producción. Incluye dark mode corregido, Kanban con counters legibles en todos los estados, Mencionados con layout responsive estándar, counters autoritativos de comentarios/actividad, preview interno de adjuntos, workflow Helpdesk animado, Realtime resiliente y SendPulse QA/product readiness heredado de v17.11-v17.12.

Ejecuta `npm run qa` para validar la distribución.