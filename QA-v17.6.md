# QA v17.6.0 — Jira Interno TROBBU

## Resultado automatizado

- **238 PASS**
- **0 FAIL**
- Comando: `npm run qa`

La suite valida contratos de navegación, permisos, Vacaciones, Knowledge, migraciones, UI Gantt/Backlog, Realtime y Edge Function.

## Verificaciones live Supabase

1. `vacation_requests.decision_by` y `ai_*` existen.
2. `update_knowledge_draft_version` existe con la firma consumida por frontend.
3. `create_knowledge_initial_draft` existe con la firma consumida por frontend.
4. `publish_knowledge_version` permanece `SECURITY INVOKER`.
5. `content_schema_version=3` existe en artículos y versiones.
6. Caso real verificado: v1 publicada permanece activa mientras v2 está en borrador.
7. Bloques legacy `paragraph` migraron a `richtext`; otros tipos se preservaron.
8. `trg_guard_vacation_request` está habilitado y su función lee `request.jwt.claims`.
9. Escritura de `ai_*` como `service_role` ejecutada dentro de transacción y revertida con rollback: sin error de campos restringidos.
10. RPC de actualización de draft y creación inicial ejecutados dentro de transacción y revertidos con rollback: sin error de función ausente.
11. `vacation-impact-assistant` desplegado como v9 con JWT requerido.
12. Supabase Health advisor: sin incidencias.

## Hallazgos no bloqueantes de hardening

Los advisors de Supabase reportan recomendaciones heredadas que no son regresiones de v17.6 ni bloquean los flujos corregidos:

- Auth: **Leaked Password Protection** desactivado. Se recomienda habilitarlo desde la configuración de Auth si la política corporativa lo permite.
- Performance: varias FKs históricas no tienen índice de cobertura y existen algunas políticas permisivas redundantes/optimizables.
- Performance: dos policies de Knowledge pueden optimizar evaluación de `current_setting()` para gran escala.

No se eliminaron índices reportados como “unused”: una métrica de uso reciente no es evidencia suficiente para borrar índices de producción.

## Smoke test recomendado tras publicar frontend

- Abrir `?view=vacations&tab=mine`, recargar y confirmar persistencia.
- Como gestor, abrir `?view=vacations&tab=requests`, analizar una pendiente y confirmar que el resultado se guarda.
- Aprobar/rechazar con y sin análisis IA.
- Editar saldo a 16 y confirmar que Mis Vacaciones refleja 16 tras recargar.
- Abrir Knowledge con v1 publicada/v2 borrador: lectura pública debe mostrar v1.
- Guardar v2 como borrador; no debe aparecer PGRST202/404.
- Publicar v2; lectura debe cambiar a v2 y v1 pasar a histórico.
- Crear un ticket Helpdesk relacionado y comprobar que Knowledge Assistant sugiera únicamente coincidencias específicas.
- Recargar Configuración/Staff/Roles/Board con `tab`/`mode` y confirmar persistencia.
- Validar responsive de Backlog bulk actions y Gantt en ancho móvil.
