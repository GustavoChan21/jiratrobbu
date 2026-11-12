# QA v17.9.2 — Jira Interno TROBBU

## Alcance

Validación de regresión de la aplicación completa con foco adicional en paridad visual del modo oscuro y counters de detalle de Ticket, Sprint y Helpdesk.

## Resultado

- Suite: `npm run qa`
- Resultado final: **373 PASS / 0 FAIL**
- Tema oscuro: login, shell, Knowledge lector/editor, Gantt, Sprint, Staff/Roles, Helpdesk, Ticket detail/edit, importación, reportes/AI, Vacaciones y superficies secundarias auditadas.
- Switches: track verde + knob blanco cuando están activos; track/knob gris oscuro cuando están inactivos.
- Counters: el UI usa el máximo entre `COUNT(*)` exacto autorizado por Supabase y las filas ya cargadas, evitando badges `0` cuando existen comentarios/actividad.
- Realtime: conserva la reconciliación de v17.9 y el refresco resiliente de modales.
- Base de datos: sin migración nueva; utiliza el esquema/RLS/Realtime productivo de v17.9.0.

## Casos visuales añadidos

Se añadieron regresiones específicas para eliminar superficies claras heredadas en Knowledge, Staff/Permisos, Gantt, Sprint detail, Ticket metadata/upload, Helpdesk, Importación, Reportes/AI y Vacaciones.
