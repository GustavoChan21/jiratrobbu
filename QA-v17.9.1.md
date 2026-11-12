# QA v17.9.1 — Jira Interno TROBBU

## Resultado

- **347 PASS**
- **0 FAIL**
- Comando: `npm run qa`
- Salida: `qa-v17.9.1-output.txt`

## Cobertura nueva

### Dark mode

- login conserva `auth-bg.webp`;
- logo/isotipo blanco en dark mode;
- card e inputs de login con contraste explícito;
- Backlog/Sprints sin superficies blancas;
- drawer de notificaciones completamente oscuro;
- pantalla de validación de acceso y skeleton oscuros;
- modal/asides/comentarios Helpdesk oscuros;
- Staff/Roles, Gantt, importación, Reportes/AI, Knowledge, Vacaciones y relaciones de ticket auditados;
- opciones de selects nativos con fondo/texto oscuro;
- estados semánticos con variantes dark.

### Helpdesk inline controls

- `table-inline-native` cubre 100% de ancho/alto;
- select nativo transparente para no ocultar el color del status;
- cursor y focus corresponden al componente completo;
- valor visual independiente del control nativo.

### Counters exactos

- helper `exactRelationCount()` con `{count:'exact',head:true}`;
- Helpdesk comentarios / seguimiento / evidencias;
- Ticket comentarios / actividad / evidencias;
- Sprint comentarios / evidencias;
- cambio de estado Helpdesk fuerza recarga inmediata del detalle;
- Realtime y refresco resiliente se mantienen como mecanismos adicionales de actualización.

## Producción / RLS

Se validó con un usuario `authenticated` solicitante de Helpdesk que los conteos son visibles bajo RLS.

Durante la validación productiva:

- HD-17 devolvió 1 comentario y actividad real;
- HD-18 devolvió 1 comentario y actividad real.

Esto confirma que el dato estaba en Supabase y que la corrección necesaria era la fuente del contador en frontend.

## Auditoría de superficies

Se escanearon reglas con fondos claros hardcodeados y se añadieron overrides oscuros para superficies secundarias que no estaban incluidas en las capturas originales. Se mantienen colores semánticos, evitando aplicar un filtro global que destruya estados y jerarquía visual.

## Chromium

El smoke visual automatizado con Chromium headless no puede completarse en este contenedor por errores del bus DBus. No se contabiliza como PASS ni se oculta esta limitación. La validación restante se realiza por suite funcional/estática, reglas de contraste, producción/RLS e integridad del paquete.
