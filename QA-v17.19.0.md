# QA + Code Review — Jira Interno TROBBU v17.19.0

## Resultado focal de la versión

**55 PASS · 0 FAIL**

Ejecutar localmente:

```bash
npm run qa
```

Salida conservada en `qa-v17.19.0-output.txt`.

## Hallazgos reproducidos en el entorno Supabase real

La auditoría se realizó en modo lectura sobre el proyecto configurado por el build (`Jira Interno Trobbu`). No se aplicaron migraciones ni se modificó producción durante esta revisión.

### Contador de Bitácora

Se comprobó que el problema de “1,000 acciones” era truncamiento y no el total real. Conteos observados por fecha local `America/Merida`:

- 2026-11-17: **2,350** acciones.
- 2026-11-16: **2,150** acciones.
- 2026-11-15: **1,993** acciones.

La corrección usa una RPC agregada por rango y paginación independiente para el listado.

### Asistente de Vacaciones

Se reprodujo una llamada HTTP 400 en la Edge Function. Los logs mostraron la secuencia:

1. El proveedor de OpenAI devuelve falta de créditos.
2. Se activa correctamente el fallback determinístico.
3. El guardado falla por `vacation_requests_assistant_recommendation_check`.
4. El catch de la función desplegada convertía el objeto de error a `Unknown error`.

La BD real confirmó que el constraint legado permite únicamente:

`approve | review | avoid`

mientras el campo actual permite:

`approve | approve_with_conditions | review | decline`

v17.19.0 corrige la sincronización entre ambos contratos y conserva el error real si vuelve a ocurrir otra incidencia.

## Cobertura de QA focal

### Bitácora / sesiones

- Fecha inicial = hoy.
- Rango histórico.
- Métrica exacta en BD.
- Paginación superior a 1,000 registros.
- Realtime de sesiones y actividad.
- Traducciones ES ampliadas.
- Modal de actividad.
- Responsive y dark mode.
- RPC restringida a Superadmin.

### Realtime

- Eventos INSERT/UPDATE/DELETE.
- Reconciliación inmediata para tablas relacionadas.
- Polling de seguridad de 30 s.
- Recuperación por focus/online/visibility.
- `REPLICA IDENTITY FULL` en flujos sensibles nuevos.

### Staff

- Nombre.
- Correo Auth + `profiles`.
- Puesto.
- Rol y estado activo.
- Productos.
- Permisos.
- Descripción/ruteo Helpdesk.
- Autoasignación, límites y overflow.
- Errores descriptivos de Edge Function.

### Vacaciones

- Días hábiles frontend + BD.
- Exclusión sábado/domingo.
- Rechazo de bloque solo-fin-de-semana.
- Edición de solicitud propia pendiente.
- Invalidación del análisis al modificar fechas.
- Reincorporación hábil.
- Backfill histórico protegido.
- “Fuera hoy” y modal de periodos.

### Asistente de Vacaciones

- Duración en días hábiles.
- Error explícito por consulta dependiente.
- Formateador robusto de errores.
- Fallback determinístico.
- Compatibilidad del constraint legado.

### Helpdesk

- Estado de filtros mediante arrays.
- Multiselección por estado/prioridad/responsable.
- OR por columna.
- AND entre columnas.
- Responsive/dark de filtros.

### Menciones

- Menú disponible para Helpdesk.
- Separación Menciones / Tickets solicitados.
- RLS de menciones propias.
- Realtime de las tablas de menciones.

### BD / CRUD

- 100% de referencias `.from(...)` del frontend encontradas en `database.sql`.
- RLS habilitado en todas esas tablas.
- Verificación en BD real de políticas por operación para las tablas mutadas por el frontend.
- Campos actuales de Staff presentes.
- Campos actuales de Vacaciones presentes.
- Copias `app.js/styles.css` idénticas al build versionado.

## Regresión

La suite específica de v17.18.1 mantiene las verificaciones funcionales de Bitácora; su única incompatibilidad esperada es el pin de versión/asset al cambiar a v17.19.0.

La suite histórica v17.18 contiene varias aserciones de cadenas/estado escalar que ya no representan el contrato actual (por ejemplo filtros Helpdesk escalares frente a arrays). Se usó como señal de regresión, no como criterio de release para comportamientos reemplazados intencionalmente.

## Revisión de Supabase real

- Proyecto activo y saludable.
- Todas las tablas públicas listadas tienen RLS habilitado.
- Health Advisor: sin lints de salud.
- Security Advisor mantiene recomendaciones existentes:
  - leaked-password protection desactivado;
  - RPC de tracking/auditoría `SECURITY DEFINER` accesibles a `authenticated`. Su código valida `auth.uid()` y membresía del workspace, por lo que son intencionales en el diseño actual, aunque el advisor seguirá mostrándolas.
- Performance Advisor mantiene FK sin índices dedicados y algunas políticas permissive duplicadas. Son recomendaciones de optimización, no fallos CRUD reproducidos.

## Límite de la validación

El ZIP se valida estructuralmente y contra el esquema/logs del entorno real, pero los cambios no se aplicaron a producción durante esta tarea. La verificación end-to-end final debe hacerse después de ejecutar `upgrade-v17.19.0.sql` y desplegar las dos Edge Functions actualizadas. En particular, el análisis generado por OpenAI seguirá usando fallback mientras la credencial configurada no tenga créditos.
