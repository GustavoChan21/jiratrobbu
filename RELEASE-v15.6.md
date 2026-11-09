# Jira Interno TROBBU v15.6

Base estable: v15.5 final.

## Cambios

- Importación Backlog desde XLSX, XLS, **XLSM** y CSV de Google Sheets.
- Nueva plantilla `plantilla-importacion-backlog-trobbu.xlsm`.
- Detector de encabezado común para Excel/XLSM/CSV.
- Solucionado el error falso `Falta la columna obligatoria "Titulo*" / "Producto*"` cuando Google Sheets conserva filas previas de título/instrucciones.
- Encabezado buscado dentro de las primeras 30 filas.
- Normalización de BOM, NBSP, zero-width, acentos y espacios alrededor del asterisco.
- Campos CSV multilínea conservados.
- Sin alteraciones al esquema de tickets, RPC o tablas de Supabase.
- QA automatizado y backend documentado en `QA-REPORT.md`.
