# Jira Interno TROBBU v16.6

## Cambios principales

- Deep links dependientes del entorno actual: Vercel, GitHub Pages o servidor HTTP local. Los enlaces Knowledge ya no dependen de `config.js` mientras la app está abierta en un dominio web.
- Knowledge Assistant muestra solo un resumen limpio por artículo; normaliza saltos reales y secuencias literales `\n`. El contenido completo se consulta exclusivamente con **Leer artículo completo**.
- Vista principal de Knowledge incorpora **Vista previa lector** para cualquier versión disponible que el usuario tenga permiso de consultar, incluyendo borradores y archivadas para administradores.
- Auditoría ES/EN ampliada a todos los textos estáticos detectables de la interfaz, más patrones dinámicos de confirmación/versionamiento.
- Helpdesk agrega Producto opcional, filtro por producto, visualización en cards/detalle y persistencia en BD.
- Los requerimientos aprobados heredan el producto seleccionado; PM/Admin puede sustituirlo antes de convertir a Backlog.
- Usuarios de portal pueden leer el catálogo de productos para clasificación sin obtener acceso a tickets/tableros del producto.

## Backend

- `helpdesk_tickets.product_id` + FK/index.
- Trigger privado de validación cross-workspace.
- `list_helpdesk_products()` SECURITY INVOKER.
- Política RLS de catálogo de productos para miembros del workspace, independiente del acceso operativo.
- `decide_helpdesk_requirement()` reutiliza el producto sugerido cuando no se envía override.

## Compatibilidad

No se modifican los IDs ni los datos históricos de solicitudes existentes. `product_id` es nullable, por lo que solicitudes antiguas continúan funcionando.
