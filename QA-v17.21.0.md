# QA / Code Review v17.21.0

## Resultado focal
**40 PASS · 0 FAIL** (`qa-v17.21.0.mjs`).

Cobertura: parse JSX/TypeScript, integridad de componentes, recuperación Staff/Settings, CRUD Staff centralizado, tabs Bitácora, modal Fuera hoy, dark/responsive, migración PROD de correo, límites SMTP Test y asuntos por folio.

## Regresión heredada
La suite v17.19 conserva **51 comprobaciones funcionales PASS**. Los cuatro checks que no aplican son únicamente marcadores/nombres de versión anteriores y copia genérica contra 17.19.

## Hallazgos corregidos
1. El refactor anterior removió siete funciones completas de UI. Restauradas sin revertir los cambios nuevos.
2. Staff hacía update en dos fases y podía dejar estado parcial. Centralizado en `manage-member`.
3. Retiro de Staff hacía dos deletes; la BD ya dispone de FK `ON DELETE CASCADE`, por lo que se simplificó a una operación de membresía.
4. `Fuera hoy` reutilizaba una clase de footer de formularios que históricamente tuvo offsets/márgenes especiales. Migrado a `static-footer`.
5. Bitácora perdió la clase visual base `.tabs`; restaurada.

## Validación Supabase
- `manage-member` v14 ACTIVE.
- `process-notifications` v24 ACTIVE.
- Health Advisor: 0 lints.
- Persisten warnings de seguridad preexistentes sobre funciones `SECURITY DEFINER` de auditoría y leaked-password protection deshabilitado; no fueron introducidos por v17.21.
- Cola de correo accionable al activar PROD: 0.

## Nota de QA visual
El código JSX y ambos Edge Functions se compilaron mediante el parser TypeScript sin errores. La revisión visual se contrastó contra las capturas aportadas y las reglas CSS de light/dark/responsive; el entorno de navegador automatizado local de esta sesión bloqueó navegación local, por lo que no se atribuye una prueba E2E visual que no se pudo ejecutar.
