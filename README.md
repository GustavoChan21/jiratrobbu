# Jira Interno TROBBU v17.5.3

**Base:** v17.5.2 / Git v17.5.1 compatible → v17.5.3. El proyecto conserva exactamente **101 archivos**.

## Objetivo

v17.5.3 estabiliza el flujo operativo de **Vacaciones**: solicitudes prioritarias y filtrables, análisis IA opcional, aprobación humana independiente, decimales para medios días y sincronización Realtime/WebSocket completa.

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
4. Publicar frontend v17.5.3 (`index.html`, `app.js`, `styles.css`, etc.).
5. Forzar recarga. `index.html` usa cache-bust `?v=17.5.3`.
6. Ejecutar `npm run qa`.

> En el proyecto Supabase utilizado durante esta corrección ya se aplicó el bloque de DB v17.5.3 y se desplegó `vacation-impact-assistant` v6. Al publicar el Git debes conservar esos mismos archivos para evitar futuros desfases entre repo y producción.

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
