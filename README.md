# Jira Interno TROBBU v17.5.4

**Base:** v17.5.3 / Git v17.5.1 compatible mediante `upgrade-v17.5.sql` → v17.5.4. El proyecto conserva exactamente **101 archivos**.

## Objetivo

v17.5.4 consolida navegación persistente por URL, Vacaciones segmentado por permisos, compatibilidad de esquema histórica/nueva, Knowledge Assistant estricto y filtros operativos de Gantt/Backlog.


## Cambios v17.5.4

- **URL persistente:** `?view=` conserva el módulo al recargar; `?tab=` conserva tabs de Vacaciones, Configuración y Staff/Roles; `?mode=` conserva Tabla/Kanban/Calendario/Cronograma.
- **Vacaciones:** tabs `Mis Vacaciones`, `Solicitudes`, `Proyección de Vacaciones`, `Control por Integrante` y `Tipos de Vacaciones`, visibles según RBAC.
- Nuevo permiso `view_vacation_projection`: Superadmin/Admin siempre, PM por defecto, otros roles solo si se habilita. La RLS protege la proyección también desde API.
- Compatibilidad para instalaciones con columnas históricas: se crean `decision_by` y `ai_*`, se conserva/migra `decided_by` y `assistant_*`, y se agrega el helper `private.vacation_units_for_year`.
- El saldo anual usa la fila autoritativa de `vacation_balances`; guardar 16/0.5 actualiza el estado local inmediatamente y Realtime mantiene la vista sincronizada.
- `vacation-impact-assistant` trabaja por `request_id`, usa IA cuando hay clave configurada y fallback determinístico cuando no; la IA nunca bloquea Aprobar/Rechazar.
- Knowledge Assistant filtra artículos publicados con versión activa, analiza contenido, usa términos ancla y umbral estricto; puede devolver cero coincidencias. El enlace abre el lector del artículo publicado.
- Los chips KPI del Gantt son filtros reales.
- La barra de selección/movimiento de Backlog queda en una sola row en escritorio y se apila únicamente en móvil.

### Correcciones de solicitudes

- La Edge Function `vacation-impact-assistant` vuelve a usar `request_id` como contrato principal y obtiene desde BD el workspace, integrante y bloques. El frontend también envía los campos legado como compatibilidad.
- Las métricas **Fuera hoy / Pendientes / Aprobadas próximas / Mis solicitudes** son clicables y aplican el mismo filtro que los tabs.
- Las solicitudes aparecen inmediatamente después de las métricas, antes del saldo, timeline y administración.
- Tabs: **Pendientes, Fuera hoy, Aprobadas próximas, Mis solicitudes y Ver todo**.
- En Ver todo se priorizan pendientes, después aprobadas y finalmente rechazadas/canceladas.
- Se eliminó el calendario mensual de ausencias; la proyección tipo cronograma es la visualización temporal principal.

### IA = sugerencia, no requisito

- **Aprobar/Rechazar no depende del análisis IA.**
- El asistente únicamente proyecta riesgo y mitigaciones con sprints/tickets/ausencias coincidentes.
- Si no existe análisis, el aprobador puede decidir normalmente.
- Si el análisis está desactualizado, se permite reanalizar, pero nunca bloquea la aprobación.

### Saldo y medios días

- `allowed_days` y `adjustment_used_days` admiten decimales con escala de 2 posiciones.
- La UI acepta `0.5` o `0,5` y normaliza a pasos de medio día.
- Continúan Permitidos, Ocupados, Ajuste usado y Disponibles.
- El control de saldo en servidor sigue impidiendo exceder el límite anual.

### Realtime / WebSocket

- `vacation_requests`, `vacation_types` y `vacation_balances` se publican en `supabase_realtime`.
- Las tres usan `REPLICA IDENTITY FULL`.
- El frontend escucha las tres en el canal del workspace.
- `SUBSCRIBED` mantiene Realtime como fuente principal.
- `CHANNEL_ERROR`, `TIMED_OUT` o `CLOSED` activan automáticamente un refresco de respaldo cada 15 segundos hasta recuperar el WebSocket.

## Actualización

Si vienes de v17.5.1 o v17.5.2:

1. Respaldar BD.
2. Ejecutar **todo** `upgrade-v17.5.sql` de esta entrega en Supabase. Es re-ejecutable y también repara `date_blocks`, `return_date`, tipos y saldos si faltaran.
3. Desplegar `vacation-impact-assistant.ts`.
4. Publicar frontend v17.5.4 (`index.html`, `app.js`, `styles.css`, etc.).
5. Forzar recarga. `index.html` usa cache-bust `?v=17.5.4`.
6. Ejecutar `npm run qa`.

> En el proyecto Supabase utilizado durante esta corrección ya se aplicó el bloque de DB v17.5.4 y se desplegó `vacation-impact-assistant` v6. Al publicar el Git debes conservar esos mismos archivos para evitar futuros desfases entre repo y producción.

## Verificación post-deploy

- Pulsar Pendientes y comprobar que contador/listado coinciden.
- Pulsar Fuera hoy, Aprobadas próximas y Mis solicitudes y comprobar filtros.
- Abrir una pendiente y analizar impacto: no debe aparecer el error de `workspace_id, user_id, start_date and end_date`.
- Aprobar una solicitud sin ejecutar IA: debe ser válido.
- Guardar `0.5` y `0,5` como Ajuste usado.
- Crear Medio día y comprobar consumo de 0.5.
- Abrir dos sesiones y modificar solicitud/saldo/tipo: la otra debe refrescar por Realtime; si el canal falla, entra el polling de respaldo.
- Confirmar que no aparece `Calendario de ausencias` mensual.

## Esquema canónico

`database.sql` contiene el esquema completo consolidado y termina exactamente con el contenido vigente de `upgrade-v17.5.sql`.
