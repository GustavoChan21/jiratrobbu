# QA v17.8.0 — Jira Interno TROBBU

## Resultado automatizado

- **293 PASS**
- **0 FAIL**
- Comando: `npm run qa`
- Salida: `qa-v17.8-output.txt`

## Cobertura Knowledge Assistant

Se valida que:

1. El frontend dispara el asistente desde 5 caracteres en el título, sin requerir descripción.
2. Existe debounce de 650 ms.
3. Se envían `product_id`, `department_id` y `request_type_id` cuando existen.
4. Backend acepta modo `title` y modo `full`.
5. Solo se consultan artículos publicados con `active_version_id`.
6. La versión activa debe pertenecer al artículo sugerido.
7. Ranking utiliza título, tags, categoría, resumen, contenido, producto y contexto Helpdesk.
8. Se normalizan plural/singular y prefijos para términos relevantes.
9. El prefiltrado ya no deja fuera todos los candidatos antes de la validación semántica.
10. OpenAI mantiene umbral semántico alto (`>= 0.72`).
11. Si OpenAI falla, el sistema conserva únicamente coincidencias determinísticas fuertes.
12. Puede devolver cero artículos si no existe evidencia suficiente.
13. La respuesta expone proveedor y diagnóstico `ai_configured` para trazabilidad.

## Diagnóstico de OpenAI

En logs productivos se observó respuesta del proveedor:

`You have no credits remaining.`

Esto confirma que la configuración llega a OpenAI y no es un error de KEY ausente. Mientras el saldo permanezca agotado, v17.8 utiliza el fallback determinístico; al recuperar créditos la capa semántica se utilizará automáticamente.

## Cobertura Helpdesk KPI

Se valida:

- filtro `all` / Solicitudes;
- filtro `open` / Abiertas;
- filtro `pending_requirements` / Requerimientos por decidir;
- filtro `overdue` / Vencidas;
- filtro `closed` / Resueltas-cerradas;
- integración con el predicado canónico de filtros;
- reset de filtros detallados al pulsar un KPI;
- reset de KPI al aplicar filtros detallados o estatus;
- eliminación del card `SLA cumplido` del resumen;
- distribución 5 columnas desktop, 3/2/1 responsive.

## Regresiones v17.7

La suite también conserva la validación de:

- canal Live Data único por workspace;
- patch inmediato y reconciliación silenciosa;
- recuperación al reconectar/focus/online;
- modales abiertos sincronizados;
- Vacaciones, Knowledge, Helpdesk, Staff y Settings en Realtime;
- `view`, `tab`, `mode` persistentes en URL;
- esquema v17.6 de Knowledge y Vacaciones;
- `database.sql` consolidado hasta v17.7.

## Parseo / integridad de frontend

- `app.js`: AST JSX parseado con TypeScript compiler API, **0 parse diagnostics**.
- `trobbu-knowledge-assistant.ts`: AST TypeScript parseado, **0 parse diagnostics**.
- `index.html`, `app.js`, `styles.css` utilizan cache-bust v17.8.0.
- El smoke headless completo no pudo cargar los CDNs públicos desde el sandbox de QA; esta limitación es de red del entorno y no se contabilizó como prueba funcional aprobada.

## Supabase post-deploy

- `trobbu-knowledge-assistant`: **ACTIVE v20**.
- `verify_jwt=true`.
- Health advisor: **0 lints**.
- No se aplicó migración v17.8 porque este release no cambia esquema de base de datos.

## Smoke del ranking actual

Se ejecutó directamente la función `localScore` extraída/transpilada del Edge Function incluido en el paquete contra el artículo publicado actual de alta de socio:

- `Crear perfil de socio inversionista` → sugerencia esperada.
- `Alta de nuevo socio` → sugerencia esperada.
- `Dar de alta un socio` → sugerencia esperada.
- `Problema con reservación y tarifa` → correctamente no relacionado.

Resultado: **4/4 casos esperados**. Ver `qa-v17.8-knowledge-scorer.txt`.
