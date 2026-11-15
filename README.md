# Jira Interno TROBBU

Versión actual: **v17.18.0**

## Cambios principales

- Knowledge: editor enriquecido de bloque Texto aislado del DOM de React para estabilizar caret, selección, escritura y links.
- Superadmin: nueva Bitácora y sesiones con accesos, tiempo conectado, último login y actividad del sistema.
- Sesión de aplicación configurable entre 8 y 24 horas; valor por defecto 12h.
- Auditoría autoritativa por triggers de BD + eventos de navegación/sesión.
- RLS: solo Superadmin puede consultar la bitácora.

## QA

Ejecuta:

```bash
npm run qa
```

La suite incluye regresión integral y un test real de Chromium para el editor Knowledge.

Consulta `RELEASE-v17.18.md` y `QA-v17.18.md` para el detalle completo.
