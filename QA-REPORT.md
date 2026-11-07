# QA Report — Jira Interno TROBBU v11.2

Fecha de revisión: 6–7 noviembre 2026.

## Resultado

**Backend/RLS:** PASS  
**Jerarquía por workspace:** PASS  
**Backlog/Sprints:** PASS  
**Helpdesk requester/staff:** PASS  
**Evidencias:** PASS  
**Frontend estático:** PASS  
**Responsive/layout:** PASS

Todas las pruebas de escritura sobre Supabase se ejecutaron dentro de transacciones con `ROLLBACK`; no se conservaron datos QA.

## Matriz de permisos — 22/22 PASS

1. Nuevo workspace crea Superadmin, 3 productos y 10 departamentos activos.
2. Superadmin puede administrar productos.
3. Administrador no puede otorgarse/otorgar Superadmin.
4. Administrador puede administrar productos.
5. PM puede crear/administrar sprints.
6. PM no puede administrar productos.
7. Desarrollo puede crear y actualizar tickets.
8. Desarrollo no puede crear sprints.
9. QA puede operar estados de tickets.
10. Solo carga puede crear su ticket en Backlog.
11. Solo carga no puede planificar fechas ni datos internos.
12. Solo carga solo puede consultar tickets propios.
13. Solo carga no puede editar tickets después del alta.
14. Requester puede crear solicitud de Helpdesk.
15. Requester no puede editar datos internos de la solicitud.
16. Requester puede comentar su solicitud.
17. Solo dashboards puede leer el tablero.
18. Solo dashboards no puede escribir tickets.
19. Cierre/rollover de sprint trasladó exactamente 2 tickets no resueltos; los cerrados permanecieron en origen.
20. Fecha de entrega anterior a fecha de inicio fue rechazada.
21. Metadatos de evidencia de ticket y sprint respetaron RLS.
22. Helpdesk registró timestamps para En revisión, Atendido, Resuelto y Cerrado.

## Helpdesk

Se validó además que un requester que intente enviar valores internos manipulados en el INSERT sea normalizado por backend a:

- `status = created`
- `source = portal`
- `requester_user_id = auth.uid()`
- `assigned_to = null`
- SLA calculado automáticamente

Departamentos validados: Reservaciones, Recepción, Gerencia, Administración, Aperturas, Marketing, Callcenter, Plataforma, Atención a clientes y Atención a socios.

## Storage/evidencias

- Superadmin/Administrador/PM/Dev/QA pueden subir evidencia válida del workspace.
- Solo carga puede leer evidencia de sus propios tickets y no puede subirla.
- Solo carga no puede leer evidencias de sprint.
- Solo dashboards es lectura únicamente.
- Bucket privado `jira-evidence`, máximo 10 MB por imagen.

## Frontend estático

- JSX parse diagnostics: **0**.
- Botones auditados: **109**.
- Botones sin acción: **0**.
- Botones dentro de forms sin `type`: **0**.
- Tipos globales de modal detectados: **32**.
- Rutas globales de modal: **32**.
- Rutas faltantes: **0**.
- Uso de `alert()`, `prompt()` o `confirm()`: **0**.
- Todas las cargas principales filtran explícitamente por `workspace_id`; tablas hijas están además protegidas por RLS/FK.

## QA visual de modales — 12/12 PASS

Desktop, tablet y móvil:

- footer del formulario alineado;
- Cancelar integrado en footer propio;
- acción primaria alineada;
- modal dentro del viewport;
- sin overflow horizontal general;
- navegación móvil visible.

En móvil, Cancelar y acción primaria se apilan a ancho completo.

## QA visual de módulos — 16/16 PASS

Desktop/tablet/móvil:

- Calendario presente y contenido dentro del viewport;
- Backlog/Sprints presente;
- Helpdesk con stepper de 5 estados;
- detalle de sprint con evidencia;
- sin overflow horizontal de página.

En móvil, el único scroll horizontal permitido queda contenido dentro del calendario mensual, no en el documento completo.

## Supabase

El Security Advisor mantiene únicamente la recomendación de habilitar **Leaked Password Protection** de Supabase Auth. No representa un error funcional de Jira Interno.
