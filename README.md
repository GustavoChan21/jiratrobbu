# Jira Interno TROBBU v17.9.2

Release correctiva sobre v17.9.0 enfocada en **modo oscuro profesional/luxury**, contraste global, controles inline de Helpdesk completamente clicables y **counters exactos de comentarios/actividad/evidencias**.

## Principales cambios

### Modo oscuro integral

- Se conserva la misma fotografía `auth-bg.webp` en login; solo cambia overlay, card y controles.
- Logo/isotipo TROBBU se muestra blanco (`#FFFFFF`) en dark mode mediante tratamiento CSS del SVG existente.
- Nueva paleta oscura coherente: fondo, shell, superficies, bordes, texto, texto secundario y estados semánticos.
- Se eliminaron “islas blancas” de Backlog/Sprints, notificaciones, validación de permisos, modales, Helpdesk, Staff/Roles, importaciones, Reportes/AI, Gantt, Knowledge, Vacaciones y relaciones de tickets.
- Inputs, selects, textareas y opciones nativas tienen contraste explícito en dark mode.
- Estados conservan su significado mediante variantes oscuras: revisión azul, atendido dorado, cerrado verde, rechazado rojo.

### Helpdesk inline

- Responsable, estado y decisión conservan el color visual del componente.
- El `<select>` nativo queda transparente sobre todo el control, por lo que **100% del área visible es clicable**.
- Los menús nativos usan opciones oscuras cuando el tema activo es dark.

### Counters de detalle

Los badges ya no dependen únicamente del array local cargado en React.

- Helpdesk: comentarios, seguimiento/actividad y evidencias consultan `COUNT(*)` exacto autorizado por RLS.
- Ticket: comentarios, actividad y evidencias usan conteos exactos.
- Sprint: comentarios y evidencias usan conteos exactos.
- Se mantienen Realtime, `liveRevision` y reconciliación resiliente; los counts exactos son la fuente autoritativa del badge.
- Después de cambiar un estado Helpdesk, el modal vuelve a cargar inmediatamente el detalle y sus counters.

Verificación productiva con un solicitante normal:

- HD-17: 1 comentario y actividad existente visible para el solicitante.
- HD-18: 1 comentario y actividad existente visible para el solicitante.

## Base de datos

**No hay una nueva migración v17.9.2.** Esta release utiliza la base v17.9.0 ya aplicada en producción (`upgrade-v17.9.sql`), que contiene Realtime, RLS y el workflow canónico de Helpdesk.

## QA

**373 PASS / 0 FAIL** con `npm run qa`.

Consulta `QA-v17.9.2.md`, `RELEASE-v17.9.2.md` y `qa-v17.9.2-output.txt`.

El Chromium headless del contenedor no puede completar el smoke visual por una limitación DBus del entorno; esa ejecución no se contabiliza como PASS. La suite funcional/estática, integridad de CSS, RLS productivo, CRC y Git sí se verifican en esta entrega.

## Paquetes

1. **FULL**: documentación, releases, QA y migraciones históricas individualizadas.
2. **COMPACT**: misma aplicación y misma suite QA; documentación histórica agrupada en `_history-v17.9.1-and-earlier.zip` para mantener el repositorio pequeño.
