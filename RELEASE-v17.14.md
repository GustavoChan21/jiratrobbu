# Jira Interno TROBBU v17.14.0

## Correcciones

- Los badges de detalle dejan de usar un contador paralelo susceptible de quedar en `0`.
- Helpdesk: **Comentarios = `comments.length`** y **Seguimiento = `activity.length`**, exactamente las colecciones renderizadas en el modal.
- Ticket: **Revisión y evidencias** usa los comentarios cargados y **Actividad** usa los movimientos cargados.
- Sprint: el contador usa comentarios cargados más evidencias independientes no asociadas a comentario, evitando doble conteo.
- Se conserva Realtime + reconciliación periódica: cuando cambian las filas, cambia el mismo array que alimenta el badge.
- Preview de adjuntos migrado a un modal dedicado `modal-preview`, centrado y limitado a **90vw × 90dvh** en desktop, tablet y móvil.
- Imagen/iframe ocupan el espacio disponible dentro del preview sin desbordar el dispositivo.
- Cache bust y marcador de build actualizados a **v17.14.0**.

## Datos de aceptación

La BD productiva reporta, bajo RLS autenticado:

- HD-15: 2 comentarios / 5 movimientos.
- HD-4: 1 comentario / 3 movimientos.
- ADM-64: 1 comentario / 3 actividades.
- ADM-73: 1 comentario / 4 actividades.

La UI v17.14 toma el número directamente de las mismas filas cargadas, por lo que no puede mostrar 0 mientras dichas filas estén renderizadas.
