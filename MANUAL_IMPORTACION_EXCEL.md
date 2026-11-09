# Manual de importación de tickets al Backlog

## Objetivo

Esta plantilla permite cargar múltiples actividades al **Backlog** de Jira Interno TROBBU desde un archivo Excel `.xlsx`.

Cada fila válida representa un ticket independiente. Los tickets importados:

- se crean con estado **Backlog**;
- **no** se asignan automáticamente a un Sprint;
- respetan el Workspace y los productos autorizados del usuario que importa;
- pueden incluir responsables, fechas y Story Points de forma opcional.

## Archivo que debes usar

Usa siempre:

`plantilla-importacion-backlog-trobbu.xlsx`

La plantilla incluye tres hojas:

- **Manual**: instrucciones de uso.
- **Tickets Backlog**: hoja donde se capturan las actividades.
- **Catalogos**: valores válidos para productos, tipos y prioridades.

No cambies los nombres de las hojas ni de las columnas.

## Cómo llenar la plantilla

Empieza a capturar tickets en la hoja **Tickets Backlog**, a partir de la fila 6.

La fila que comienza con `EJEMPLO -` sirve únicamente como referencia y el importador la ignora.

### Columnas

| Columna | Obligatoria | Valores / formato | Uso |
|---|---|---|---|
| `Titulo*` | Sí | Texto, máximo 220 caracteres | Nombre de la actividad |
| `Producto*` | Sí | `ADM`, `SOC`, `APP` | Producto donde se creará el ticket |
| `Descripcion` | No | Texto | Contexto, alcance o criterios |
| `Tipo` | No | Tarea, Bug, Historia, Mejora | Si está vacío usa Tarea |
| `Prioridad` | No | Muy baja, Baja, Media, Alta, Muy alta, Bloqueante | Si está vacío usa Media |
| `Story Points` | No | Entero de 0 a 100 | Estimación de esfuerzo |
| `Responsable Dev` | No | Nombre exacto del Staff o UUID | Debe tener acceso al producto |
| `Responsable QA` | No | Nombre exacto del Staff o UUID | Debe tener acceso al producto |
| `Fecha inicio` | No | `AAAA-MM-DD` | Fecha planeada de inicio |
| `Fecha limite` | No | `AAAA-MM-DD` | Debe ser igual o posterior a Fecha inicio |

### Productos

- `ADM` = Web Administrativa
- `SOC` = Web Socios
- `APP` = App Socios

Si posteriormente se agregan productos al Workspace, usa la clave del producto configurada en Jira Interno.

## Ejemplo

| Titulo* | Producto* | Descripcion | Tipo | Prioridad | Story Points |
|---|---|---|---|---|---:|
| Corregir validación de pago | ADM | Validar tarjeta y mensajes de error | Bug | Alta | 5 |
| Mejorar historial de reservas | SOC | Agregar filtros y paginación | Mejora | Media | 3 |
| Corregir cierre de sesión | APP | Revisar expiración de token | Bug | Bloqueante | 2 |

## Cómo importar

1. Inicia sesión en Jira Interno.
2. Entra al Workspace correcto.
3. Abre **Backlog / Sprints**.
4. Pulsa **Importar Excel**.
5. Selecciona `plantilla-importacion-backlog-trobbu.xlsx`.
6. El sistema analizará el archivo antes de escribir en la base de datos.
7. Revisa filas detectadas, tickets válidos, errores y vista previa.
8. Si existe algún error, corrige el Excel y vuelve a seleccionarlo.
9. Cuando todas las filas sean válidas, pulsa **Importar al Backlog**.

## Validaciones

La importación se bloquea si detecta, entre otros casos:

- título vacío;
- producto inexistente o no autorizado;
- tipo o prioridad inválidos;
- Story Points fuera de rango;
- responsable que no pertenece al Workspace;
- responsable sin acceso al producto;
- responsable con rol incompatible;
- fecha con formato incorrecto;
- fecha límite anterior a fecha de inicio.

La importación se procesa de forma atómica: si el lote no cumple las validaciones de backend, no se aplica parcialmente.

## Después de importar

Los tickets aparecerán en **Backlog / Sprints**.

Desde ahí PM/Admin/Superadmin podrá:

- priorizar las actividades;
- editar detalles;
- asignar o cambiar responsables;
- asignar el ticket a un Sprint;
- definir o ajustar fechas;
- moverlo posteriormente al flujo de desarrollo y QA;
- visualizarlo en Timeline/Gantt cuando tenga fechas.

La importación **no inicia automáticamente el desarrollo** ni modifica Sprints existentes.

## Recomendaciones

- Usa siempre las listas desplegables de Producto, Tipo y Prioridad.
- Evita copiar fórmulas o formatos de archivos externos sobre los encabezados.
- No agregues columnas entre las columnas oficiales.
- Si no conoces el responsable, déjalo vacío y asígnalo después desde Jira Interno.
- Para una carga inicial grande, prueba primero con 2 o 3 filas y valida el resultado.
- Conserva una copia del archivo importado como referencia de la carga.
