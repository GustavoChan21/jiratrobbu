# HOTFIX v15.4.1

Esta versión restaura el `app.js` estable de v15.1 para recuperar la carga del sistema.

Se conservan:
- base Supabase migrada a v15.4;
- productos AUT y FIN;
- catálogo backend de tipos de solicitud;
- migraciones SQL v15.4;
- plantillas XLSX/CSV y parser CSV;
- estilos y documentación acumulada.

Temporalmente el frontend usa el flujo UI estable de v15.1 para evitar la regresión de carga detectada en v15.4.

## Despliegue
Extraer y copiar **los archivos de este ZIP directamente a la raíz** del repositorio `jiratrobbu`. No crear una subcarpeta adicional.
