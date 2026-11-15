# Jira Interno TROBBU v17.13.0

Hotfix de producción posterior a auditoría de las capturas de v17.12.0.

## Causa raíz corregida

El bloque CSS agregado en v17.12.0 fue empaquetado con secuencias literales `\\n`. El navegador encontraba una regla CSS sin cerrar desde ese punto y descartaba las reglas posteriores de Kanban, Mencionados, preview, pulse y contraste Gantt. v17.13.0 normaliza el archivo y se valida con un parser CSS real: 0 errores.

## Kanban

- Cada contador tiene clase explícita `kanban-count status-*`.
- Los ocho estados tienen fondo semántico y texto oscuro legible en dark mode.
- No se depende de selectores heredados del contenedor para aplicar el contraste.

## Mencionados

- La vista vuelve a utilizar el contenedor estándar `.page` del sistema.
- Recupera gutters, max-width, padding y márgenes del resto de módulos.
- Breakpoints dedicados a 1100, 820 y 520 px.
- Cards y filas evitan overflow y truncamiento incorrecto.

## Comentarios / seguimiento

- Ticket, Sprint y Helpdesk cargan filas y `count:'exact'` en la misma consulta.
- El contador visible usa `authoritativeCount(rows,count)` y nunca puede ser menor que las filas renderizadas.
- Realtime y reconciliación periódica continúan refrescando los mismos arrays.
- Pruebas RLS reales con Gustavo Chan confirman en producción:
  - HD-15: 2 comentarios / 5 movimientos.
  - HD-4: 1 comentario / 3 movimientos.
  - ADM-64: 1 comentario / 3 movimientos.
  - ADM-73: 1 comentario / 4 movimientos.

## Otros puntos revalidados

- Nombre del sprint en Gantt: blanco en dark mode.
- Porcentaje de actividad: texto oscuro para máximo contraste.
- Workflow Helpdesk: pulso verde en el paso actual.
- Adjuntos browser-renderable: preview en modal interno.
- Actividad Helpdesk: nombres de usuarios en asignaciones, no UUID crudo.
- Kanban mantiene actualización optimista al mover tickets.
- Se muestra discretamente `v17.13.0` en el Sidebar para verificar qué bundle está realmente desplegado.
