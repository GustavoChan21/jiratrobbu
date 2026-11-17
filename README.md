# Jira Interno TROBBU

Versión actual: **v17.19.0**

## Cambios principales

- Realtime reforzado en toda la plataforma con reconciliación inmediata y recuperación por focus/online.
- Bitácora: métricas exactas por rango de fechas, sin límite falso de 1,000 acciones, traducciones y modal responsive/dark.
- Staff: actualización completa y sincronización de correo entre Auth y perfiles.
- Vacaciones: edición de solicitudes pendientes y cálculo exclusivo de días hábiles.
- Asistente de Vacaciones: errores descriptivos, fallback estable y compatibilidad con campos legados.
- Helpdesk: filtros multiopción combinables.
- Header: modal Fuera hoy.
- Menciones: acceso para Helpdesk y separación entre menciones y tickets solicitados.
- Revisión estructural BD/RLS/CRUD contra el proyecto Supabase real.

## QA

```bash
npm run qa
```

Resultado focal: **55 PASS · 0 FAIL**.

Consulta `RELEASE-v17.19.0.md` y `QA-v17.19.0.md` para el detalle completo.

## Actualización desde v17.18.1

Ejecuta `upgrade-v17.19.0.sql` y vuelve a desplegar `manage-member` y `vacation-impact-assistant`.
