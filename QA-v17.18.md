# QA v17.18.0

## Resultado local

- Suite integral: **505 PASS / 0 FAIL** (el total final se valida de nuevo al empaquetar).
- Knowledge browser QA: **17 PASS / 0 FAIL** con Chromium + CDP.
- JSX/TypeScript parser: sin errores.
- `database.sql` termina exactamente con `upgrade-v17.18.sql`.
- Runtime versionado `app-v17.18.0.js` y `styles-v17.18.0.css` aislado por versión.

## Casos de aceptación Knowledge

1. Escribir en medio de una palabra conserva el caret.
2. Mutaciones/re-render del DOM padre no roban el caret del iframe.
3. Mover el cursor a otra posición y continuar escribiendo funciona.
4. Seleccionar un link, mover foco a la toolbar y editar URL conserva exactamente el texto visible.
5. El link editado permanece como un único `<a>`.
6. Continuar escribiendo inmediatamente después del link no extiende ni duplica el anchor.
7. Editor vacío acepta escritura desde la posición esperada.
8. Continuar escribiendo tras cambios del DOM padre mantiene la selección.

## QA producción Supabase

- `app_session_max_hours = 12`.
- 15 sesiones Auth existentes importadas como baseline.
- RLS: Superadmin ve las sesiones/eventos del workspace.
- RLS negativa: usuario Dev probado ve 0 sesiones y 0 eventos.
- `touch_app_session` devuelve sesión activa, límite 12h y `expired=false` bajo claims reales.
- `log_app_event` registra actor, `session_id`, módulo y acción; prueba ejecutada en transacción/rollback.
- Trigger de ticket: actualización QA de ADM-4 produjo evento con actor/session y `changed_fields=["title"]`; rollback sin modificar producción.
- Realtime activo para `app_user_sessions` y `app_audit_events`.
- Health advisor: 0 lints.
- Nuevos FK de auditoría tienen índices de usuario/actor.

## Seguridad

Los RPC de telemetría son `SECURITY DEFINER` de forma intencional para impedir escritura directa a las tablas de auditoría. Se revoca acceso a `anon`, se concede únicamente a `authenticated`, y cada RPC toma el actor de `auth.uid()`, obtiene el `session_id` del JWT firmado y valida membresía activa del workspace. Las tablas no permiten mutaciones directas a usuarios autenticados y la lectura está restringida por RLS a Superadmin.

El advisor mantiene el warning preexistente de Leaked Password Protection deshabilitado. También reporta los tres RPC anteriores como `SECURITY DEFINER` ejecutables por `authenticated`; su exposición es intencional y está validada en el cuerpo de cada función.
