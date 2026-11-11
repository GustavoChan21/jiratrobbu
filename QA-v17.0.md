# QA v17.0

Fecha de revisión: 11 de noviembre de 2026.

## Resultado de QA ejecutado en el paquete

- `node qa-v17.0.mjs`: **39/39 checks aprobados**.
- Parser TypeScript/JSX sobre `app.js`: **sin errores**.
- TypeScript sobre Edge Functions modificadas con stubs de runtime Deno/Supabase: **sin errores de sintaxis/tipos locales**.
- `git diff --check`: **sin whitespace errors**.
- Verificación léxica/estructural de `upgrade-v17.0.sql` y `database.sql`: **delimitadores y bloques SQL balanceados**.
- Hash/igualdad del bloque v17.0 en `database.sql` contra `upgrade-v17.0.sql`: **idéntico**.
- Sin marcadores de merge pendientes.

## Casos cubiertos por el QA reproducible

1. Permisos nuevos presentes en frontend, invitación, administración y SQL.
2. Categorías Knowledge y clasificación solicitada.
3. Flujo “Crear Knowledge sin Editar/Publicar” con acceso solo al borrador propio inicial.
4. H1-H5, negrita, cursiva, subrayado y tamaño en editor rico.
5. Sanitización y traducción del HTML rico.
6. Knowledge Assistant con umbral semántico y resultado vacío permitido.
7. Estados y orden de Helpdesk.
8. Filtro por producto en detalle de Sprint.
9. Cambio administrativo de contraseña server-side.
10. Responsabilidades/capacidad/overflow de autoasignación.
11. Exclusión de ausentes por vacaciones en routing.
12. Vacaciones: RLS, análisis obligatorio, caducidad/revalidación, calendario y “Fuera hoy”.
13. Notificaciones de Vacaciones en el centro de actividad.
14. Homologación visual de inputs/selects/textareas.

## Validación que requiere el entorno real

No se modificó ni se ejecutó una migración sobre un proyecto Supabase remoto desde esta revisión. El contenedor de QA no dispone de PostgreSQL/Supabase local, por lo que la migración se validó estáticamente pero no se aplicó sobre una copia real de la BD.

El smoke test con Chromium del frontend estático se intentó, pero el Chromium disponible en el contenedor quedó bloqueado por limitaciones del entorno headless/DBus. No se considera una prueba aprobada y no se contabiliza dentro de los 39 checks.

Por ello, la garantía final de producción debe cerrarse después de desplegar en un entorno staging conectado a Supabase y ejecutar los flujos autenticados siguientes:

- Crear solicitud Helpdesk con texto relacionado y no relacionado a Knowledge; validar sugerencias y “sin coincidencias”.
- Cambiar filtros de Helpdesk y validar orden “Ver todo”.
- Probar filtro de producto dentro de un sprint con varios productos.
- Cambiar contraseña de usuario y autenticar con la nueva contraseña.
- Configurar responsabilidades/capacidad de Staff y generar tickets hasta alcanzar límites.
- Aprobar vacaciones solo después de análisis; modificar un ticket/sprint y confirmar que obliga a reanalizar.
- Confirmar que una persona “Fuera hoy” no aparece como nueva asignación de Helpdesk.
- Probar roles de Knowledge: solo lectura, crear, editar/publicar y eliminar.
- Crear artículo Rich Text y validar persistencia/lectura/traducción de H1-H5 y estilos parciales.
- Validar responsive en desktop, tablet y móvil con sesión autenticada.

La versión está preparada para esos smoke tests de staging; no es correcto afirmar 100% de garantía en producción sin ejecutarlos contra el backend real y los roles reales.
