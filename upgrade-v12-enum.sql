-- Jira Interno TROBBU v12 — paso 1 de 2
-- Ejecutar y confirmar este archivo antes de upgrade-v12.sql.
-- PostgreSQL requiere confirmar el nuevo valor del enum antes de usarlo en políticas/funciones.

alter type public.app_role add value if not exists 'consulta' after 'qa';
