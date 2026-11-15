# QA v17.12.0

## Criterio crítico de aceptación de counters
Los badges de comentarios/actividad se calculan con exactamente el mismo array que renderiza las filas. No existe una fuente de count independiente que pueda quedarse en cero.

Casos reales consultados en producción antes del empaquetado:
- HD-15: 2 comentarios, 5 movimientos, 5 adjuntos.
- HD-4: 1 comentario, 3 movimientos.
- ADM-64: 1 comentario, 3 movimientos, 1 adjunto.
- ADM-73: 1 comentario, 4 movimientos, 1 adjunto.

## Validaciones
- `npm run qa`: suite completa + regresiones v17.12.
- TypeScript parser sobre `app.js` con JSX React.
- Cache bust v17.12.0.
- Contraste Gantt/Kanban.
- Responsive Mencionados.
- Preview interno de adjuntos renderizables.
- Pulso del estado actual.
- Integridad ZIP y Git para FULL/COMPACT.
