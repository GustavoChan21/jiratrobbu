# QA v17.14.0

## Resultado

- `npm run qa`: **460 PASS / 0 FAIL**.
- Versionado/cache-bust: v17.14.0.
- CSS: llaves balanceadas y sin corrupción por `\\n` literal.
- Counters de Helpdesk: fuente única = arrays renderizados.
- Counters Ticket/Sprint: fuente única = arrays renderizados.
- Preview adjuntos: modal dedicado 90vw × 90dvh, responsive.
- Realtime/reconciliación de comentarios y actividad conservados.

## Casos de regresión específicos

1. Un comentario visible implica badge `>= 1`; el badge usa `comments.length`.
2. Un movimiento visible implica badge `>= 1`; el badge usa `activity.length`.
3. El preview no abre una nueva pestaña para imágenes/PDF/texto soportado y se centra en 90% del viewport.
4. El botón Descargar permanece disponible dentro del preview.
