# Jira Interno TROBBU v15.8

Base: v15.7 estable.

## Helpdesk · fotos de evidencia comprimidas
- Comentarios de Helpdesk permiten adjuntar hasta 5 fotos.
- Tipos de entrada: JPEG, PNG y WebP.
- Compresión en navegador antes de subir: lado máximo 1920 px y WebP con calidad adaptativa cuando genera ahorro real.
- Archivos pequeños (<=300 KB) no se recomprimen innecesariamente.
- Original máximo: 15 MB; objeto final máximo: 10 MB según bucket.
- Storage privado `jira-evidence`; la BD almacena únicamente metadatos, `size_bytes` y `original_size_bytes`.
- Galería con URL firmada, tamaño y eliminación controlada.
- Eliminar un comentario conserva su evidencia en historial hasta que se elimine explícitamente.

## Helpdesk · asignación rápida
- Botón `Asignar` en solicitudes operativas sin responsable.
- `Asignar ahora / Reasignar` desde el detalle y menú de acciones.
- Modal de responsable + comentario opcional.
- Operación atómica mediante `assign_helpdesk_ticket` con `SECURITY INVOKER` y RLS.
- Se mantienen notificaciones y actividad existentes.
- Requerimientos continúan usando el flujo especial de decisión y no se asignan por este mecanismo.

## Sprint detalle
- Listado de actividades con scroll interno para sprints con muchos tickets.
- Acción rápida `Backlog` por ticket en sprints activos/planeados.
- Regresar a Backlog limpia sprint y fechas mediante el flujo ya existente.
- Responsive adaptado para desktop/tablet/móvil.

## Base de datos
Ejecutar `upgrade-v15.8.sql` al actualizar un entorno distinto. En el Supabase actual del proyecto la migración ya quedó aplicada y validada.
