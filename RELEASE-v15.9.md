# Jira Interno TROBBU v15.9

## Evidencia desde la creación de Helpdesk

La nueva solicitud de Helpdesk ahora permite adjuntar hasta 5 imágenes desde el alta inicial.

- JPG, PNG y WebP.
- Máximo 15 MB por imagen original.
- Redimensionado máximo a 1920 px.
- Conversión a WebP cuando realmente reduce el peso.
- Archivo final limitado a 10 MB por la capa de Storage.
- Storage privado `jira-evidence`.
- PostgreSQL guarda únicamente metadatos y tamaños; no guarda binarios.
- La evidencia inicial se muestra en el detalle de la solicitud aunque no pertenezca a un comentario.

## Creación consistente

El flujo es:

1. Crear solicitud.
2. Optimizar y subir las imágenes.
3. Registrar metadatos de evidencia.
4. Confirmar la solicitud.

Si falla la carga de evidencia, el frontend elimina la solicitud recién creada. La política RLS v15.9 permite ese rollback únicamente al propio solicitante, durante 10 minutos, si la solicitud sigue en `Creado`, no tiene responsable y proviene del portal.

## Migración

El Supabase actual ya tiene aplicado el cambio. Para otros entornos ejecutar `upgrade-v15.9.sql` después de v15.8.
