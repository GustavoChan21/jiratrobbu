# Jira Interno TROBBU v17.1

**Base requerida:** v17.0  
**Tipo de release:** corrección de regresiones + mejoras funcionales solicitadas.

## Resumen

v17.1 recupera la estabilidad de los flujos que se vieron afectados en v17.0 y conserva las mejoras de RBAC, IA, Knowledge y Vacaciones. La actualización está diseñada para aplicarse directamente sobre una instalación v17.0.

## Knowledge

- Se recupera la creación de artículos con un alta inicial atómica mediante `create_knowledge_initial_draft`.
- La creación inicial ya no depende de varias escrituras cliente consecutivas para crear artículo + versión.
- Si falla una carga de media durante el alta, se realiza limpieza/rollback del borrador y archivos subidos.
- Editor enriquecido ampliado con:
  - Párrafo y H1–H5.
  - Negrita, cursiva y subrayado.
  - Fuentes permitidas: Inter, Arial, Verdana, Georgia, Times New Roman y Courier New.
  - Tamaños de texto seguros.
  - Listas ordenadas/no ordenadas.
  - Alineación izquierda, centro y derecha.
  - Limpieza de formato.
- El sanitizador conserva exclusivamente etiquetas/estilos permitidos.
- La traducción conserva bloques enriquecidos.
- Se corrige el estado de guardado después de crear/actualizar un artículo.

## Helpdesk

- Los counters y el listado ahora usan la misma fuente de filtros.
- `Ver todo` conserva prioridad operativa: Nuevo → En revisión → Atendido → Resuelto → Cerrado.
- Nuevo botón **Autoasignar pendientes** para procesar tickets activos existentes sin responsable.
- El disparo manual reutiliza el mismo motor de autoasignación de nuevos tickets:
  - responsabilidades/descripción del integrante;
  - producto y permisos;
  - capacidad diaria y tickets activos;
  - ausencias aprobadas;
  - reglas de overflow/cola.
- La Edge Function valida permiso `manage_helpdesk` cuando la ejecución es manual.

## Vacaciones

- Nueva `Fecha de Reincorporación`.
- Una sola solicitud puede contener de 1 a 8 bloques independientes.
- Los bloques admiten huecos entre periodos; esos días intermedios se consideran laborables.
- La base valida fechas, reincorporación, solapamientos y un máximo acumulado de 61 días de ausencia.
- Calendario, badge “fuera hoy”, autoasignación Helpdesk y asistente de impacto usan los bloques reales y no el rango envolvente.
- Nueva vista de proyección tipo timeline con:
  - 1, 4, 6 y 8 semanas;
  - 1, 2, 3 y 6 meses.
- El asistente de impacto recibe los bloques exactos y calcula duración real y ausencias simultáneas reales.
- Se mejoran márgenes, paddings, distribución responsive y cards del módulo.

## Timeline / Gantt

- Primera línea: título + rango + duración + contexto.
- Segunda línea: controles y filtros.
- Se mantienen los rangos 1/4/6/8 semanas y 1/2/3/6 meses.

## Kanban y vista Tabla

- Selector rápido de responsable compartido por ambos modos.
- Toda la superficie visible del selector es clicable.
- Misma lógica de candidatos por producto/rol y etapa Dev/QA.
- La vista Tabla permite asignar o reasignar sin abrir el detalle del ticket.

## Relaciones entre tickets

- Selector con buscador por clave, título, producto y estado.
- Se pueden relacionar tickets activos/en curso con tickets resueltos o cerrados.
- Los activos se muestran primero y los cerrados después.
- Se impiden relaciones duplicadas desde el selector.

## Base de datos

Aplicar únicamente `upgrade-v17.1.sql` sobre una base que ya tenga v17.0. La migración:

- crea `public.create_knowledge_initial_draft(...)` con `SECURITY INVOKER`;
- añade `return_date` a `vacation_requests`;
- añade `date_blocks jsonb` y migra solicitudes antiguas a un bloque legacy;
- reemplaza las validaciones/guardas de Vacaciones para soportar bloques;
- actualiza las notificaciones de Vacaciones.

La migración v17.1 también está incorporada al final de `database.sql` para instalaciones nuevas.

## Archivos principales modificados

- `app.js`
- `styles.css`
- `index.html`
- `package.json`
- `database.sql`
- `upgrade-v17.1.sql`
- `auto-assign-helpdesk.ts`
- `vacation-impact-assistant.ts`
- `qa-v17.1.mjs`

## Despliegue recomendado

1. Hacer backup de la base y validar primero en staging.
2. Si la instalación ya está en v17.0, ejecutar **solo** `upgrade-v17.1.sql`.
3. Desplegar `auto-assign-helpdesk.ts` y `vacation-impact-assistant.ts`.
4. Publicar `index.html`, `app.js`, `styles.css` y el resto de archivos estáticos del paquete.
5. Ejecutar `npm run qa`.
6. Realizar el checklist post-deploy documentado en `QA-v17.1.md`.

## Nota de rollback

Los cambios de base son aditivos pero reemplazan funciones/guardas existentes. Para un rollback íntegro se recomienda restaurar el backup de base generado antes de la migración o preparar una migración inversa específica; no se recomienda ejecutar archivos de versiones anteriores sobre una base ya migrada.
