# Jira Interno TROBBU v17.19.0

Base: **v17.18.1**  
Objetivo: estabilización integral de Realtime, Bitácora/Sesiones, Staff, Vacaciones, Helpdesk y Menciones.

## 1. Bitácora y sesiones

- Se elimina el falso tope visual de **1,000 acciones**.
- Las métricas del periodo se obtienen mediante `get_audit_period_metrics`, calculadas en PostgreSQL y no por `rows.length`.
- El periodo inicia en **hoy** y permite consultar fechas anteriores con `Desde` / `Hasta`.
- La lista de actividad usa paginación de 1,000 registros por página para no truncar el detalle.
- Realtime escucha cambios en `app_user_sessions` y `app_audit_events`.
- Se amplían traducciones ES/EN para acciones, estados, booleanos, campos y módulos.
- El modal de detalle de actividad se homologa con el sistema actual: paddings, espaciado, responsive y dark mode.

## 2. Realtime global

- Canal global con `postgres_changes` y `event: '*'`.
- Cambios en tablas secundarias relevantes disparan reconciliación inmediata corta.
- Se mantiene reconciliación cada 30 s solo como red de seguridad.
- Revalidación al recuperar `focus`, conexión `online` o visibilidad de la pestaña.
- `REPLICA IDENTITY FULL` reforzado para flujos sensibles de Vacaciones, Staff y Menciones.

## 3. Staff

- `manage-member` sincroniza correctamente cambios de correo entre **Supabase Auth** y `profiles`.
- Se conserva `user_metadata` existente al modificar nombre/correo.
- Se mantienen todos los campos actuales del integrante: rol, activo, productos, permisos y configuración de enrutamiento Helpdesk.
- Los errores de la función ya no se degradan a un genérico `Unknown error` cuando Supabase devuelve un objeto de error.

## 4. Vacaciones

- El solicitante puede editar su propia solicitud mientras permanezca en estado `pending`.
- El update queda limitado por `workspace_id`, `user_id` y `status = pending`.
- Sábados y domingos dejan de contabilizarse tanto en frontend como en PostgreSQL.
- Bloques compuestos únicamente por fin de semana son rechazados.
- El saldo, días solicitados, días ocupados y backfill histórico usan días hábiles de lunes a viernes.
- La fecha de reincorporación sugerida avanza al siguiente día hábil.
- Editar fechas invalida el análisis previo para evitar mostrar una evaluación obsoleta.

## 5. Asistente de Vacaciones

Se corrigieron dos causas independientes detectadas en el entorno real:

1. El proveedor OpenAI configurado actualmente reporta falta de créditos. La función conserva un análisis determinístico de respaldo.
2. El campo legado `assistant_recommendation` tenía un constraint con valores `approve | review | avoid`, mientras la versión nueva usa `approve | approve_with_conditions | review | decline`. El trigger ahora conserva compatibilidad mediante:
   - `approve` → `approve`
   - `approve_with_conditions` → `review`
   - `review` → `review`
   - `decline` → `avoid`

Además:
- Se validan explícitamente errores de las consultas dependientes.
- Se conserva el mensaje real de Supabase en vez de convertirlo en `Unknown error`.
- El fallback determinístico se puede guardar aunque la IA externa no esté disponible.

> Para obtener análisis generado por el modelo, la cuenta/API configurada debe volver a disponer de créditos o debe configurarse un AI Gateway válido. El fallback funcional no depende de ese saldo.

## 6. Helpdesk

- Los filtros pasan a ser **multiopción** mediante checkboxes.
- Se pueden combinar múltiples estados, prioridades, responsables, áreas, productos y tipos de solicitud.
- Dentro de una columna se aplica OR; entre columnas se aplica AND.
- Ejemplo válido: `Nuevo` + `Crítico/Alto` + `Gustavo/Luis`.
- Se agregan estilos responsive y dark mode para el selector múltiple.

## 7. Fuera hoy

- El indicador del header es clicable.
- Abre un modal con integrantes fuera, periodo(s), reincorporación y cantidad de días hábiles.
- En sábado/domingo no se marca al usuario como “fuera hoy” por vacaciones de jornada laboral.

## 8. Menciones

- `Mencionados` queda visible también para perfiles Helpdesk en desktop.
- La vista se segmenta en:
  - **Menciones**
  - **Tickets solicitados**
- Las políticas RLS mantienen acceso a menciones propias independientemente del rol.
- `ticket_mentions` y `helpdesk_mentions` continúan en Realtime.

## 9. Estructura BD / CRUD

Revisión estructural realizada contra el código y contra el proyecto Supabase real:

- Todas las tablas referenciadas actualmente por el frontend existen.
- Todas las tablas referenciadas tienen RLS habilitado.
- Las tablas mutadas desde la UI cuentan con políticas compatibles con las operaciones que realiza el frontend.
- Se verificaron los campos actuales de Staff y Vacaciones.
- Supabase Health Advisor no reportó problemas de salud al momento de la revisión.

Los advisors todavía reportan recomendaciones no bloqueantes de seguridad/performance del proyecto existente, como protección de contraseñas filtradas desactivada, tres RPC `SECURITY DEFINER` intencionalmente expuestos a `authenticated` con comprobación interna de identidad/workspace y varios FK sin índice dedicado. No se modificaron de forma masiva en esta versión para evitar un cambio de seguridad/performance fuera del alcance funcional de este release.

## Instalación sobre v17.18.1

1. Publicar los archivos web de v17.19.0.
2. Ejecutar `upgrade-v17.19.0.sql` en el proyecto Supabase correspondiente.
3. Desplegar nuevamente las Edge Functions modificadas:
   - `manage-member`
   - `vacation-impact-assistant`
4. Validar una sesión Superadmin, una sesión Helpdesk y una sesión de usuario estándar.

Para instalaciones nuevas, `database.sql` ya contiene el estado final y la migración v17.19.0 al final del archivo.
