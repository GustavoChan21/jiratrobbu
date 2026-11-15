# Jira Interno TROBBU v17.18.1

## Bitácora y sesiones
- Homologación de márgenes, paddings y ritmo visual en Resumen, Sesiones y Actividad.
- Responsive reforzado para tablet, móvil y pantallas pequeñas.
- Adaptación completa de tarjetas, filtros, actividad y modal a modo oscuro.
- Cada evento de Actividad ahora es clicable y abre un detalle específico.
- El detalle muestra usuario, fecha/hora, origen, módulo, entidad, versión/estado, cambios antes/después y datos técnicos.
- Los campos sensibles se ocultan y el contenido extenso de Knowledge no se copia a la bitácora.

## Trazabilidad Knowledge
- Registra consulta de artículo, preview de versión, apertura de borrador y flujo de creación.
- La auditoría de BD diferencia borrador creado, nueva versión, borrador editado, publicación, archivado/restaurado y otros cambios.
- Se agregan metadatos de versión y cambios relevantes para explicar qué ocurrió.

## Instalación
1. Desplegar los archivos de v17.18.1.
2. Ejecutar `upgrade-v17.18.1.sql` en Supabase SQL Editor si la BD ya estaba en v17.18.0.
3. En instalaciones nuevas, `database.sql` ya incluye la actualización.
4. Ejecutar `node qa-v17.18.1.mjs`.

## QA
- 13 validaciones focalizadas: 13 PASS / 0 FAIL.
