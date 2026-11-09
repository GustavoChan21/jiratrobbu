# Manual de importación de tickets al Backlog · v15.6

## Formatos compatibles

Jira Interno TROBBU acepta:

- `.xlsx`
- `.xls`
- `.xlsm`
- `.csv` exportado desde Google Sheets

El sistema únicamente lee las celdas del archivo XLSM; no ejecuta macros. La importación no cambia la estructura de la tabla de tickets ni requiere cambios de base de datos.

## CSV exportado desde Google Sheets

El importador ya no requiere que los encabezados estén en la primera fila. Esto permite abrir la plantilla XLSX en Google Sheets y exportar la hoja completa como CSV aunque conserve:

1. título de la plantilla;
2. instrucciones;
3. una fila vacía;
4. y después los encabezados reales.

El sistema busca automáticamente `Titulo*` y `Producto*` dentro de las primeras 30 filas.

También reconoce variantes seguras como `Título*`, `Titulo *`, `Producto *` o encabezados sin el asterisco, sin modificar las columnas oficiales de destino.

El CSV soporta UTF-8/BOM, CRLF/LF, separadores coma/punto y coma/tabulador, campos entre comillas, comillas escapadas y campos multilínea.

## Columnas oficiales

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
3. Pulsa **Importar Excel / CSV / XLSM**.
4. Descarga la plantilla que prefieras o selecciona tu archivo.
5. Carga XLSX, XLS, XLSM o CSV.
6. Revisa la vista previa y los números de fila reales.
7. Si existe cualquier error, el sistema bloquea la importación completa.
8. Cuando todas las filas sean válidas, importa el lote.

Los tickets siempre se crean en Backlog y sin Sprint. La fila `EJEMPLO - ...` se ignora automáticamente.

## Validaciones

Se valida título, producto, tipo, prioridad, Story Points 1–5, responsables, permisos por producto, fechas, máximo de 250 tickets y consistencia del lote. El backend procesa la importación de forma atómica para evitar cargas parciales.
