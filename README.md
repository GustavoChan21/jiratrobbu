# Jira Interno TROBBU v17.8.0

Versión estabilizada sobre v17.7.0 con **Asistente Knowledge proactivo desde el título de Helpdesk**, filtros rápidos accionables y toda la sincronización Live Data/URL de v17.7.

## Objetivo de v17.8.0

Recuperar la sugerencia de artículos mientras se escribe el asunto de una nueva solicitud, sin obligar a completar primero la descripción, y convertir los KPIs superiores de Helpdesk en accesos de filtrado reales.

## Knowledge Assistant

- Se dispara desde 5 caracteres del título con debounce de 650 ms.
- Descripción, producto, departamento y tipo de solicitud refinan el análisis.
- Solo usa artículos `published` y la versión indicada por `active_version_id`.
- Ranking por título, tags, categoría, resumen, contenido y contexto Helpdesk.
- Puede retornar cero coincidencias para no sugerir artículos genéricos.
- Fallback determinístico de alta confianza cuando el proveedor IA no responde.
- Edge Function productiva: `trobbu-knowledge-assistant` v20.

### Estado OpenAI

La KEY está configurada, pero durante este QA la API respondió `You have no credits remaining`. El sistema sigue sugiriendo coincidencias fuertes mediante fallback local. Cuando se recarguen créditos, la validación semántica vuelve a utilizarse automáticamente.

## Helpdesk

Los 5 KPIs superiores son filtros: **Solicitudes, Abiertas, Requerimientos por decidir, Vencidas y Resueltas/cerradas**. Se retiró `SLA cumplido` de esta fila y el layout se distribuye en 5/3/2/1 columnas según ancho.

## Live Data y URL

Se conserva íntegro v17.7: Realtime centralizado, reconciliación silenciosa, recuperación por focus/online/reconexión y persistencia de `view`, `tab` y `mode`.

## Base de datos

v17.8 no requiere migración adicional. `database.sql` termina en el bloque consolidado de `upgrade-v17.7.sql`.

## QA

Resultado automatizado previo al smoke test de navegador: **293 PASS / 0 FAIL**. Ver `QA-v17.8.md` y `qa-v17.8-output.txt`.

## Historial

Los archivos `RELEASE-v17.7.md`, `QA-v17.7.md` y versiones anteriores permanecen en el paquete para trazabilidad.
