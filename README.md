# Jira Interno TROBBU v17.6.0

Versión estabilizada sobre v17.5.4 con reparación de drift entre frontend, migraciones y Supabase de producción.

## Objetivo de v17.6.0

Esta entrega cierra los pendientes de navegación persistente, Vacaciones, Knowledge y QA global solicitados para el Jira interno TROBBU. El foco principal es que el repositorio sea desplegable sobre una instalación v17.5.x y conserve el mismo contrato que la base de datos/Edge Functions de producción.

## Cambios principales

### Navegación persistente por URL

- `?view=` conserva el módulo activo al recargar.
- `?tab=` conserva tabs en Vacaciones, Configuración y Staff/Roles.
- `?mode=` conserva Tabla/Kanban/Calendario/Cronograma en tableros.
- `popstate` vuelve a sincronizar la vista al navegar atrás/adelante.

### Vacaciones

- Tabs: **Mis Vacaciones**, **Solicitudes**, **Proyección de Vacaciones**, **Control por Integrante** y **Tipos de Vacaciones**.
- Las tabs administrativas se muestran por permisos; `view_vacation_projection` y `manage_vacations` controlan exposición y operación.
- Superadmin conserva acceso total; overrides explícitos de permisos también son respetados por la Edge Function.
- Se estabilizó la lectura de `vacation_balances`: la fila del usuario autenticado se consulta explícitamente y se fusiona con la consulta general.
- Mientras el saldo está cargando ya no se presenta el fallback de 12 días como dato definitivo.
- Guardar 16, 0.5 u otro valor válido usa `upsert(...).select().single()` y actualiza inmediatamente la fila autoritativa.
- El guard de BD reconoce correctamente `service_role` desde `request.jwt.claims`, por lo que `vacation-impact-assistant` puede persistir `ai_*`.
- Se mantiene compatibilidad con campos históricos `decided_by` / `assistant_*`.
- `vacation-impact-assistant` registra proveedor, configuración IA y motivo de fallback; OpenAI/AI Gateway son opcionales y la decisión final siempre pertenece al aprobador.
- La IA nunca bloquea Aprobar/Rechazar.

### Knowledge

- Se reparó el RPC ausente `public.update_knowledge_draft_version(...)`.
- Se agregó/reparó `public.create_knowledge_initial_draft(...)`.
- Los RPC públicos son `SECURITY INVOKER`, con permisos por workspace y RLS.
- Se agregó `content_schema_version = 3` a artículos y versiones.
- Los bloques históricos `paragraph/text` se normalizan a `richtext` sin alterar el significado del contenido.
- La migración de versiones históricas desactiva temporalmente, dentro de la misma transacción, únicamente los triggers de guard/auditoría para no romper la inmutabilidad normal ni crear eventos falsos; ambos se reactivan antes del commit.
- El lector siempre resuelve la versión publicada del **mismo artículo**. Si v1 está publicada y v2 permanece en borrador, los lectores continúan viendo v1 hasta publicar v2.
- Knowledge Assistant solo considera artículos publicados con `active_version_id` publicado y puede devolver cero coincidencias cuando la evidencia no es suficientemente específica.
- Las sugerencias enlazan al lector de Knowledge correspondiente.

### UI solicitada

- Los chips KPI del Gantt operan como filtros reales: planificados, backlog/sin fechas, vencidos, históricos y cerrados.
- Los controles de selección/movimiento masivo del Backlog permanecen en una sola fila en escritorio y se apilan en móvil.
- Vacaciones separa operación, proyección, control y catálogo para reducir densidad visual.

## Actualización desde v17.5.x

1. Respaldar la base de datos.
2. Ejecutar `upgrade-v17.6.sql` completo en Supabase. Es re-ejecutable sobre v17.5.x.
3. Desplegar `vacation-impact-assistant.ts` con JWT requerido.
4. Mantener `trobbu-knowledge-assistant.ts` desplegado con JWT requerido.
5. Publicar `index.html`, `app.js`, `styles.css` y el resto del paquete.
6. Forzar recarga del navegador; `index.html` usa cache-bust `?v=17.6.0`.
7. Ejecutar `npm run qa`.

`database.sql` es el esquema consolidado y termina exactamente con el bloque vigente de `upgrade-v17.6.sql`.

## Estado de producción verificado durante v17.6.0

En el proyecto Supabase `Jira Interno Trobbu` se verificó/aplicó:

- `decision_by` y campos `ai_*` presentes.
- RPCs de Knowledge con las firmas esperadas.
- `content_schema_version=3` en artículos/versiones.
- Caso real v1 publicada + v2 borrador conservado correctamente.
- Conversión de bloques legacy a `richtext` confirmada.
- Guard de Vacaciones con `request.jwt.claims` y trigger habilitado.
- Escritura `service_role` de `ai_*` probada dentro de transacción y revertida con rollback.
- `vacation-impact-assistant` desplegado como v9.

## QA

Ejecutar:

```bash
npm run qa
```

Resultado de esta entrega: **238 pruebas aprobadas, 0 fallos**.

Además se ejecutaron verificaciones live en Supabase de funciones, schema, triggers, RLS/RPC y advisors. El advisor de Health no reportó incidencias. Permanecen recomendaciones de hardening no bloqueantes heredadas del proyecto (índices de algunas FKs y Leaked Password Protection de Auth), documentadas en `QA-v17.6.md`.
