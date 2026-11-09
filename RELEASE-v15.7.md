# Jira Interno TROBBU v15.7

Base: v15.6 final completa.

## Cambios

- Fix responsive en Tablero y Mis tareas.
- Títulos largos limitados a 2 líneas con elipsis; 3 líneas en móvil.
- Columnas protegidas con `minmax()` y `min-width:0` para evitar solapamientos.
- Responsive progresivo: se prioriza información esencial y en <=820 px se usa layout tipo card.
- El título completo permanece disponible al abrir el ticket y como tooltip nativo (`title`).
- Alta de Staff: el modal de credenciales muestra la URL de la plataforma.
- “Copiar credenciales + enlace” copia:
  - Jira Interno TROBBU
  - https://jiratrobbu.vercel.app/
  - correo
  - contraseña inicial o temporal

## Base de datos

No requiere migración. No modifica tablas, datos, RLS ni funciones de Supabase.
