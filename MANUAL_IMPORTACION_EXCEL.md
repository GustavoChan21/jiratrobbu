# Manual de importación de tickets al Backlog · v15.4

## Formatos compatibles

Jira Interno TROBBU acepta:

- `plantilla-importacion-backlog-trobbu.xlsx`
- `plantilla-importacion-backlog-trobbu.csv`

El CSV puede exportarse directamente desde Google Sheets. Se soportan UTF-8/BOM, saltos CRLF/LF, campos entre comillas, comillas escapadas y detección de separador coma, punto y coma o tabulador.

## Columnas

| Columna | Obligatoria | Valores |
|---|---|---|
| `Titulo*` | Sí | Texto, máximo 220 caracteres |
| `Producto*` | Sí | `ADM`, `SOC`, `APP`, `AUT`, `FIN` |
| `Descripcion` | No | Texto |
| `Tipo` | No | Tarea, Bug, Historia, Mejora |
| `Prioridad` | No | Muy baja, Baja, Media, Alta, Muy alta, Bloqueante |
| `Story Points` | No | Entero de 1 a 5 |
| `Responsable Dev` | No | Nombre exacto del Staff o UUID |
| `Responsable QA` | No | Nombre exacto del Staff o UUID |
| `Fecha inicio` | No | `AAAA-MM-DD` |
| `Fecha limite` | No | `AAAA-MM-DD`, igual o posterior al inicio |

## Productos

- `ADM` = Web Administrativa
- `SOC` = Web Socios
- `APP` = App Socios
- `AUT` = Automatizaciones
- `FIN` = Panel Financiero

## Flujo

1. Entra al Workspace correcto.
2. Abre **Backlog / Sprints**.
3. Pulsa **Importar**.
4. Selecciona XLSX, XLS o CSV.
5. Revisa la vista previa.
6. Si existe cualquier error, el sistema bloquea la importación completa.
7. Cuando todas las filas sean válidas, pulsa **Importar al Backlog**.

Los tickets siempre se crean en Backlog y sin Sprint. La fila `EJEMPLO - ...` se ignora automáticamente.

## Validaciones

Se valida título, producto, tipo, prioridad, Story Points 1–5, responsables, permisos por producto, fechas, límite de 250 filas y consistencia del lote. El backend procesa la importación de forma atómica para evitar cargas parciales.
