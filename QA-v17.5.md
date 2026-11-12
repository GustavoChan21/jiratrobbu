# QA v17.5.2 · Jira Interno TROBBU

## Resultado automatizado
- `npm run qa`: **188 / 188 PASS**.
- Archivos del proyecto: **101 exactos**.
- `database.sql` termina exactamente con `upgrade-v17.5.sql`.
- Balance de llaves CSS y delimitadores SQL: PASS.
- Sin marcadores de merge.

## Sintaxis
- `app.js`: parser TypeScript/JSX PASS.
- 8 Edge Functions `.ts`: parser TypeScript PASS.
- `vacation-impact-assistant.ts`: PASS después de incorporar tipo, medio día y saldo cargado.

## Vacaciones cubierto por QA
- Reparación autosuficiente de `return_date` + `date_blocks`.
- Trigger legado desacoplado durante backfill histórico y reinstalado al finalizar.
- Solicitud mínima de 1 día.
- 1–8 bloques sin traslapes.
- Fecha de reincorporación posterior al fin del bloque.
- CRUD `vacation_types` con RLS.
- Seeds Vacaciones / Compensación / Medio día / Enfermedad.
- Configuración descontable/no descontable.
- Primera/segunda mitad obligatoria para Medio día.
- `vacation_balances` con RLS.
- Permitidos / Ocupados / Ajuste usado / Disponibles.
- Ocupados = pending + approved de tipos descontables.
- Contadores por tipo para compensaciones y otras ausencias no descontables.
- Rechazo en servidor al superar saldo anual.
- Notice IA solicitado removido.
- Timeline desktop en una sola row y responsive móvil.
- Asistente IA consume `date_blocks`, `vacation_type_id`, `half_day_period`, `absence_days` y `charged_days`.

## Compatibilidad real del esquema
Se verificó en modo lectura el proyecto Supabase `Jira Interno Trobbu` (`prweelxfuvbsdsxfopuh`): antes de aplicar esta entrega `vacation_requests` no contiene `return_date` ni `date_blocks`. También se verificó la existencia de los helpers/PK requeridos por la migración (`set_updated_at`, `is_workspace_member`, `has_workspace_permission`, PK workspace_members).

## Smoke test obligatorio en staging/producción
Después de aplicar SQL y desplegar frontend:
1. Solicitud de 1 día.
2. Solicitud de 2 bloques separados.
3. Medio día primera mitad y segunda mitad.
4. Compensación: contador incrementa y saldo no baja.
5. Vacaciones: saldo baja.
6. Ajuste manual: Disponibles disminuye.
7. Solicitud por encima del saldo: debe fallar desde UI y desde API.
8. Aprobar tras análisis IA.
9. Cancelar/rechazar: debe liberar saldo ocupado.
10. CRUD de tipos y desactivación con histórico.

No se aplicó la migración automáticamente sobre producción durante QA; debe ejecutarse conscientemente como parte del deploy.
