# Jira Interno TROBBU v16.9

## Objetivo

Estabilizar contadores, privacidad durante la validación de permisos y carga documental en Ticket/Sprint/Helpdesk.

## Cambios

- Nuevo RPC `get_navigation_counts(workspace)` con `SECURITY INVOKER`; todos los conteos respetan RLS.
- Nuevo RPC `list_authorized_products(workspace)` para separar productos operativos autorizados del catálogo de clasificación Helpdesk.
- `products_select` ya no expone el catálogo completo a cualquier miembro por el solo hecho de tener Helpdesk habilitado.
- Badges del Sidebar únicamente donde aportan contexto:
  - Tablero: tickets visibles.
  - Backlog / Sprints: tickets visibles sin sprint y no cerrados.
  - Knowledge: artículos visibles.
  - Mis tareas: tickets reportados/asignados al usuario.
  - Helpdesk / Mis solicitudes: solicitudes visibles.
  - Productos autorizados: tickets visibles por producto.
- Sin badge en Resumen, Cronograma, Reportes/AI, Campos y módulos, Staff/Roles o Configuración.
- Si el usuario no tiene productos operativos autorizados, la sección `PRODUCTOS AUTORIZADOS` no se renderiza.
- Loader privado tipo skeleton/shimmer antes de resolver workspace/permisos y al cambiar de workspace.
- Durante esa validación no se muestran nombres de módulos, productos, workspace ni navegación del workspace anterior.
- Al cambiar de workspace se limpian estados sensibles antes de solicitar la nueva información.
- `loadWorkspaceData()` deja de ser todo-o-nada: un error en un recurso opcional no vacía tickets, artículos, solicitudes y contadores válidos.
- Ticket y Sprint permiten comentario vacío cuando existe al menos un archivo adjunto, igual que Helpdesk.
- Sprint usa el selector documental unificado: imágenes, PDF, CSV, Excel, Word, PowerPoint y OpenDocument.
- Imágenes se comprimen; documentos se conservan sin alterar.
- Mensajes de eliminación actualizados para hablar de archivos adjuntos, no solo imágenes.
- Traducciones EN añadidas para las nuevas superficies.

## Compatibilidad

- Basado en v16.8 completa.
- `database.sql` contiene v16.9 consolidado.
- `upgrade-v16.9.sql` contiene únicamente los cambios de BD de esta versión.
- Supabase del proyecto actual ya tiene aplicadas las modificaciones de v16.9.
