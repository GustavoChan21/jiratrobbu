# QA v17.7.0 — Jira Interno TROBBU

## Resultado automatizado

- **272 PASS**
- **0 FAIL**
- Comando: `npm run qa`
- Salida completa: `qa-v17.7-output.txt`

## Cobertura Live Data

La suite valida:

- Un único canal Realtime central por workspace.
- Patch inmediato de Tickets, Sprints, Helpdesk, Knowledge, Vacaciones, Settings y Notificaciones.
- Debounce separado para contadores derivados.
- Refetch completo únicamente para tablas estructurales/permisos.
- Recuperación tras `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`, foco, `online` y `visibilitychange`.
- Polling de contingencia solo con socket no saludable y pestaña visible.
- Eliminación del canal duplicado de metadata de Vacaciones.
- Sincronización de modales abiertos mediante revisiones Live.
- Knowledge multimedia/preview reactivo sin pisar un editor con cambios sin guardar.
- Guards de secuencia para que respuestas async antiguas no sobrescriban datos nuevos.

## Cobertura URL

- `?view=` conserva el módulo.
- `?tab=` conserva Staff/Roles, Configuración y Vacaciones.
- `?mode=` conserva Tabla/Kanban/Calendario/Gantt.
- Back/Forward restablece el modo y usa `table` cuando `mode` no existe.
- Se eliminan parámetros `tab`/`mode` huérfanos al entrar a una vista que no los utiliza.
- Una actualización Live no cambia la URL actual.

## Verificación live Supabase

Después de aplicar `jira_v17_7_live_data_sync` se verificó:

1. `workspace_settings` está en `supabase_realtime`.
2. `helpdesk_departments` está en `supabase_realtime`.
3. `helpdesk_request_types` está en `supabase_realtime`.
4. `helpdesk_activity` está en `supabase_realtime`.
5. `workspaces` está en `supabase_realtime`.
6. Tablas críticas (`tickets`, `vacation_requests`, `knowledge_articles`, `workspace_settings`, Helpdesk y `workspaces`) reportan `relreplident = f` (`FULL`).
7. Supabase Health advisor: sin lints.
8. `helpdesk_assignment_queue` y `helpdesk_assignment_log` también usan `REPLICA IDENTITY FULL` para refrescar capacidad de Staff.
9. Security advisor conserva únicamente el warning ya existente `auth_leaked_password_protection`.

## Decisión Redux

Se auditó la arquitectura solicitada. v17.6/v17.7 no tenía Redux instalado ni un store Redux existente. Introducir Redux en este hotfix habría obligado a duplicar o migrar decenas de estados de servidor mientras se corrige Realtime. Se eligió una única fuente de verdad dentro de `WorkspaceApp` con un coordinador Live central, revisiones por dominio y reconciliación de servidor. Esto corrige el problema sin agregar una segunda capa de estado.

Una migración futura a Redux Toolkit/RTK Query tendría sentido si el frontend pasa a bundler moderno y se desea cache normalizada transversal, pero no es requisito para que v17.7 sincronice correctamente.

## Smoke test recomendado tras publicar frontend

1. Abrir dos sesiones del mismo workspace.
2. En A editar un ticket; en B confirmar cambio sin navegar.
3. Mantener detalle de Ticket abierto en B; comentar desde A y confirmar que comentarios/evidencia se actualicen.
4. Repetir con Sprint y Helpdesk.
5. Crear/aprobar/cancelar Vacaciones y modificar saldo/tipo; confirmar actualización de la tab activa.
6. Editar/publicar Knowledge; confirmar actualización de lista, versión y multimedia sin cambiar de tab.
7. Cambiar configuración de Helpdesk/Workspace y confirmar reflejo inmediato.
8. Dejar la pestaña B en background, realizar cambios en A, volver a B y confirmar reconciliación automática.
9. Cortar/restaurar red y confirmar indicador Reconectando → En vivo y datos reconciliados.
10. Abrir `?view=vacations&tab=projection`, recargar y confirmar que permanece exactamente en esa vista.
11. Abrir `?view=board&mode=gantt`, usar atrás/adelante y confirmar restauración correcta del modo.
