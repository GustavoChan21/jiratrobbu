# Release v17.8.0 — Jira Interno TROBBU

## Alcance

Release correctivo sobre v17.7.0 para recuperar el **Asistente Knowledge proactivo en Helpdesk** y convertir los KPIs superiores de Helpdesk en filtros de consulta reales, conservando el coordinador Live Data y la navegación persistente por URL.

## Asistente Knowledge en Helpdesk

En v17.6/v17.7 el disparo se había endurecido y exigía descripción con al menos 12 caracteres. Eso impedía que el asistente reaccionara mientras el usuario escribía únicamente el título/asunto, que era el comportamiento esperado del flujo original.

v17.8 restaura el análisis incremental:

- se activa desde 5 caracteres significativos en el título;
- usa debounce de 650 ms para evitar llamadas por cada tecla;
- la descripción, producto, departamento y tipo de solicitud refinan la misma búsqueda cuando existen;
- solo consulta artículos `published` con `active_version_id` válido;
- valida que la versión publicada pertenezca exactamente al artículo sugerido;
- utiliza título, tags, categoría, resumen, contenido, producto y contexto Helpdesk para perfilar la coincidencia;
- normaliza plurales y variantes por prefijo para reducir falsos negativos;
- puede devolver cero resultados cuando la evidencia es débil.

## OpenAI / degradación controlada

La Edge Function productiva conserva `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` como fuente de validación semántica. Durante QA, OpenAI respondió que la organización no tiene créditos disponibles. La KEY no está ausente: la llamada llega al proveedor, pero el proveedor rechaza por saldo.

Para que Helpdesk no dependa de facturación externa, v17.8 incorpora un fallback determinístico de alta confianza. Si OpenAI no está disponible, solo se muestran artículos con evidencia fuerte en título/tags/categoría/resumen/contenido. Cuando vuelvan a existir créditos, la validación semántica se reanuda automáticamente sin cambiar frontend ni Edge Function.

La Edge Function `trobbu-knowledge-assistant` quedó desplegada en producción como **v20**, `ACTIVE` y con `verify_jwt=true`.

## Filtros rápidos de Helpdesk

Los KPIs superiores ahora son botones/filtros reales:

- Solicitudes
- Abiertas
- Requerimientos por decidir
- Vencidas
- Resueltas / cerradas

Al seleccionar un KPI se limpia el resto de filtros detallados para que el conjunto mostrado corresponda exactamente con el contador elegido. Al aplicar filtros detallados o un filtro por estatus se limpia el filtro rápido activo para evitar intersecciones ambiguas.

## SLA en resumen

Se retiró el KPI `SLA cumplido` de la cabecera de Helpdesk. No se elimina la configuración ni lógica SLA del sistema; únicamente se elimina ese indicador del resumen solicitado, donde estaba mostrando un porcentaje que no representaba correctamente el estado operativo.

## Responsive / UI

La fila principal queda en 5 columnas en desktop y adapta automáticamente a 3, 2 y 1 columnas en resoluciones menores. Se mantiene el mismo componente visual de métricas y su estado activo.

## Compatibilidad v17.7

No hay cambios de esquema adicionales. `database.sql` continúa terminando en `upgrade-v17.7.sql`, que conserva la publicación Realtime, `REPLICA IDENTITY FULL`, reconciliación Live, recuperación por focus/online y persistencia de `view`, `tab` y `mode`.

## QA

- **293 PASS / 0 FAIL** en `npm run qa` antes del smoke test final.
- Knowledge Assistant v20 verificado directamente en Supabase.
- JWT sigue obligatorio.
- Verificada presencia de modo título, normalización, categorías, contexto Helpdesk, fallback determinístico y binding a versión publicada activa.
