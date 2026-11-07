-- Jira Interno TROBBU v11
-- Ejecutar y confirmar este archivo ANTES de upgrade-v11.sql.
alter type public.app_role add value if not exists 'superadmin' before 'admin';
alter type public.app_role add value if not exists 'reporter' before 'viewer';
