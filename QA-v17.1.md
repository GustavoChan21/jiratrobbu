# QA Jira Interno TROBBU v17.1

## Resultado

**71 verificaciones automatizadas aprobadas / 0 fallos.**

Además:

- Parser TypeScript/JSX del frontend: **PASS**.
- Compilación estática de las Edge Functions modificadas con stubs Deno/Supabase: **PASS**.
- `git diff --check` sobre los archivos modificados: **PASS**.
- Balance de llaves CSS: **PASS**.
- Balance de dollar-quotes SQL: **PASS**.
- Migración `upgrade-v17.1.sql` incorporada exactamente al final de `database.sql`: **PASS**.
- Marcadores de merge sin resolver: **0**.
- `service_role` agregado al frontend: **0**.

## Cobertura automatizada

### Knowledge

- Alta inicial mediante RPC atómico.
- RPC `SECURITY INVOKER` y permiso `create_knowledge`.
- Creación conjunta de artículo + versión inicial.
- Rollback de media ante fallo.
- Estado de guardado estable.
- Remount del editor después de cambiar identidad artículo/versión.
- H1–H5, fuente, tamaños, negrita, cursiva, subrayado, listas y alineación.
- Sanitización de familias de fuente.
- Traducción compatible con contenido enriquecido.
- Asistente Knowledge conserva la posibilidad de devolver cero coincidencias.

### Helpdesk

- Counters derivados de los mismos filtros no-status que la lista.
- Status/tipo/departamento/producto/responsable/prioridad cubiertos por una sola función de filtrado.
- Orden operativo de `Ver todo`.
- Botón de autoasignación manual de pendientes.
- Procesamiento únicamente de tickets activos sin responsable.
- Permiso `manage_helpdesk` para disparo manual.
- Motor conserva descripción/responsabilidades y límites de capacidad.
- Ausencias excluyen solo bloques aprobados que ocurren hoy.
- Pruebas de comportamiento del counter y status visibles ejecutadas sobre las funciones reales del frontend.

### Vacaciones

- Campos `return_date` y `date_blocks`.
- Backfill de solicitudes previas.
- 1–8 bloques y máximo acumulado de 61 días.
- Reincorporación posterior al final de cada bloque.
- Validación de solapamiento sobre bloques reales.
- Invalidación del análisis IA cuando cambian los bloques.
- Aprobación sigue requiriendo análisis vigente.
- Formulario agrega/elimina bloques y persiste reincorporación.
- Calendario y “fuera hoy” usan fechas exactas.
- Timeline de 1/4/6/8 semanas y 1/2/3/6 meses.
- Cada bloque se dibuja de manera independiente.
- Asistente IA suma únicamente días reales de ausencia.
- Ausencias simultáneas filtradas por solapamiento real.
- Prueba de comportamiento confirma que un hueco entre bloques no marca al integrante como ausente.

### Tableros y relaciones

- Selector de responsable compartido Kanban/Tabla.
- Toda el área del selector abre el control nativo.
- Buscador de ticket relacionado por clave/título/producto/estado.
- Tickets cerrados siguen disponibles para relación y se ordenan después de activos.
- Prevención de selección duplicada.
- Gantt con contexto en primer row y controles en segundo.
- Rangos temporales solicitados conservados.

## Verificaciones manuales recomendadas después del despliegue

1. **Knowledge**: crear un artículo, aplicar H1/H2, fuente distinta, tamaño, negrita/cursiva/subrayado; cargar media; guardar; reabrir; editar; publicar.
2. **Helpdesk**: comparar cada counter con su filtro; combinar status + producto/departamento/responsable; ejecutar `Autoasignar pendientes` con varios tickets sin responsable.
3. **Autoasignación**: comprobar un integrante saturado, uno de vacaciones hoy y uno disponible; validar que el motor elija únicamente al candidato elegible.
4. **Vacaciones**: solicitar dos bloques separados por días laborables; verificar reincorporaciones; confirmar que el hueco no aparece como ausencia; ejecutar análisis IA; aprobar; revisar calendario y timeline.
5. **Kanban/Tabla**: asignar y reasignar responsable desde ambos modos haciendo clic en distintas zonas del selector.
6. **Relaciones**: buscar un ticket cerrado por clave/título y relacionarlo con uno activo; reabrir detalle y verificar persistencia.
7. **Gantt**: probar 1/4/6/8 semanas y 1/2/3/6 meses en desktop y móvil.

## Limitaciones del entorno de QA

El contenedor de construcción no tiene acceso a la instancia Supabase de producción/staging del usuario. Por ello no se ejecutaron transacciones reales contra sus políticas RLS, Auth, Storage ni datos productivos.

Se intentó un smoke test con Chromium headless; el navegador del entorno no pudo iniciar correctamente por ausencia del bus DBus del sistema. Este intento **no se contabiliza como aprobado**.

Por lo anterior, el paquete pasa las verificaciones de código e integración disponibles, pero una garantía absoluta de producción requiere aplicar la migración en staging y completar el checklist manual anterior con la configuración real de Supabase.
