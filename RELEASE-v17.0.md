# Jira Interno TROBBU v17.0

Base: v16.9. Esta entrega concentra correcciones operativas y de seguridad para Helpdesk, Knowledge, Staff y Sprints, e incorpora el módulo de Vacaciones.

## Cambios funcionales

### Knowledge Assistant
- Ya no devuelve el artículo actual ni el primer artículo disponible por defecto.
- Construye contexto con título, descripción, producto, departamento y tipo de solicitud.
- Prefiltra candidatos por título, etiquetas, resumen, contenido y producto.
- Revalida semánticamente los candidatos con IA y exige relevancia mínima de 0.58.
- Puede devolver cero sugerencias cuando no existe una coincidencia suficientemente confiable.
- Si IA no está disponible, usa un fallback determinista con umbral mínimo; nunca muestra un artículo arbitrario.
- Modelo default de evaluación: `gpt-6.1-sol`; puede cambiarse por variables de entorno.

### Helpdesk
- Filtros rápidos: Nuevo, En revisión, Atendido, Resuelto y Cerrado.
- “Ver todo” ordena: Nuevo → En revisión → Atendido → Resuelto → Cerrado.
- Autoasignación usa descripción de responsabilidades, puesto/rol, producto, departamento y tipo de solicitud.
- Límites por integrante: asignaciones diarias y tickets activos.
- Modos de overflow: heredado, fallback configurado, siguiente disponible o cola.
- El siguiente disponible debe tener coincidencia funcional local; si no existe, el ticket queda en cola.
- Integrantes con vacaciones aprobadas para el día actual quedan fuera de autoasignación y de selección manual nueva.

### Staff y contraseñas
- Staff permite capturar y persistir responsabilidades de Helpdesk, habilitación de autoasignación, límites y overflow.
- La descripción es obligatoria cuando la autoasignación está habilitada.
- Un usuario autorizado con `manage_staff` puede establecer una contraseña nueva elegida manualmente, con confirmación y validación de longitud.
- El cambio de contraseña se realiza únicamente en la Edge Function con Supabase Admin; no se expone `service_role` al navegador.

### Sprints
- El detalle de sprint incluye filtro por producto.
- Contadores de pendientes, resueltos, story points y total visible se recalculan según el producto seleccionado.

### Knowledge RBAC y clasificación
Permisos separados:
- `view_knowledge`
- `create_knowledge`
- `edit_knowledge`
- `delete_knowledge`

Un rol con “Crear” puede crear, leer y mantener su borrador inicial, pero no publicar/versionar contenido existente sin “Editar/Publicar”. La eliminación es independiente.

Clasificación:
- Producto
- Módulo
- Categoría Knowledge
- Tags

Categorías iniciales: Sistemas, Recepción, Operaciones, Políticas, SOP, Reservaciones, Administración y General.

### Editor Knowledge
- Bloque Rich Text compatible con artículos existentes.
- H1, H2, H3, H4 y H5.
- Negrita, cursiva, subrayado.
- Tamaño de texto para selección parcial.
- Listas y limpieza de formato.
- Sanitización HTML allowlist antes de persistir/renderizar.
- La traducción ES/EN conserva estructura y estilos HTML permitidos.

### Vacaciones
Permisos separados:
- `view_vacations`
- `request_vacations`
- `manage_vacations`

Flujo:
1. El colaborador solicita fechas y nota opcional.
2. PM/Admin/Superadmin o rol autorizado visualiza solicitudes pendientes.
3. Antes de aprobar debe ejecutar “Analizar impacto con IA”.
4. El asistente considera sprints activos/planeados, tickets asignados, story points, estado, prioridad, dependencias, duración y ausencias simultáneas.
5. La aprobación queda bloqueada si no existe análisis.
6. El análisis se considera obsoleto si pasan más de 12 horas o si después del análisis cambia un ticket asignado, la planeación de un sprint involucrado o la disponibilidad del equipo.
7. Al aprobar, la ausencia aparece en calendario y se notifica al solicitante.
8. El sistema muestra “Fuera hoy” y excluye a esas personas del routing de Helpdesk.

Privacidad RLS: un usuario con permiso de visualización general solo puede consultar solicitudes aprobadas de otros integrantes; sus propias solicitudes siempre son visibles para seguimiento. Pendientes/rechazadas de terceros requieren `manage_vacations`.

## Archivos principales modificados
- `app.js`
- `styles.css`
- `database.sql`
- `upgrade-v17.0.sql`
- `manage-member.ts`
- `invite-member.ts`
- `auto-assign-helpdesk.ts`
- `trobbu-knowledge-assistant.ts`
- `translate-knowledge-version.ts`
- `vacation-impact-assistant.ts` (nuevo)
- `qa-v17.0.mjs` (nuevo)

## Despliegue

### 1. Base de datos
Ejecutar `upgrade-v17.0.sql` sobre la BD de v16.9. El archivo `database.sql` ya contiene el mismo bloque para instalaciones completas.

### 2. Edge Functions
Desplegar:
- `manage-member`
- `invite-member`
- `auto-assign-helpdesk`
- `trobbu-knowledge-assistant`
- `translate-knowledge-version`
- `vacation-impact-assistant`

### 3. Secrets
Mantener los secretos Supabase habituales. Para IA configurar al menos uno:
- `OPENAI_API_KEY`
- `AI_GATEWAY_API_KEY`

Opcionales:
- `TROBBU_OPENAI_MODEL=gpt-6.1-sol`
- `TROBBU_AI_MODEL=openai/gpt-6.1-sol`

### 4. Frontend
Publicar los archivos estáticos de esta carpeta; `index.html` ya usa cache-busting `v=17.0.0`.

### 5. QA
Ejecutar:

```bash
npm run qa
```

Después del despliegue hacer pruebas autenticadas con al menos: un Superadmin/Admin, un PM, un Dev/QA, un rol solo lectura y un rol personalizado de Knowledge “Crear sin Editar”.
