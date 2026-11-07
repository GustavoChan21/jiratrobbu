# Jira Interno Trobbu · GitHub Pages

Esta variante está preparada para publicarse directamente desde la **raíz del repositorio**, sin `src/`, `public/`, `dist/`, `supabase/` ni ninguna otra subcarpeta.

## Estructura raíz

- `index.html` — entrada pública para GitHub Pages.
- `app.js` — aplicación React completa (JSX procesado en navegador con Babel Standalone).
- `styles.css` — todos los estilos.
- `config.js` — URL y publishable key pública de Supabase.
- `database.sql` — respaldo del esquema de base de datos.
- `invite-member.ts` — código fuente de la Edge Function para invitaciones.
- `process-notifications.ts` — código fuente de la Edge Function para correos operativos.
- `.nojekyll` — evita procesamiento Jekyll innecesario en GitHub Pages.
- `package.json` — opcional; únicamente ofrece un servidor local sencillo.

## Publicar en GitHub Pages

1. Sube **todos estos archivos directamente a la raíz** de la rama `main`.
2. En GitHub entra a **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Selecciona `main` y carpeta `/ (root)`.
5. Guarda los cambios.

No ejecutes `npm run build`: esta versión está hecha específicamente para que GitHub Pages sirva los archivos directamente.

## Supabase

La web apunta al proyecto existente `Jira Interno Trobbu` usando únicamente la publishable key, que puede vivir en frontend. No se incluye la contraseña de base de datos ni una service-role key.

Las Edge Functions `invite-member` y `process-notifications` ya fueron desplegadas en Supabase. Los archivos `.ts` de raíz son únicamente respaldo/versionado de su código fuente.

Para correos operativos personalizados, la función `process-notifications` necesita en Supabase los secretos:

- `RESEND_API_KEY`
- `EMAIL_FROM`

## Login y enlaces de correo en GitHub Pages

Cuando definas la URL final del repositorio, agrega esa URL en Supabase Authentication como URL permitida de redirección. Por ejemplo:

`https://USUARIO.github.io/REPOSITORIO/`

La aplicación usa `window.location.pathname`, por lo que conserva correctamente el subdirectorio del repositorio al crear enlaces de confirmación e invitación.


## URL productiva y autenticación

La URL canónica usada por el frontend para confirmaciones e invitaciones es:

`https://gustavochan21.github.io/jiratrobbu/`

En Supabase → Authentication → URL Configuration configura esa URL como **Site URL** y agrégala también en **Redirect URLs**. El frontend ya envía `emailRedirectTo`/`redirect_to` a esa dirección y limpia `access_token`, `refresh_token` y parámetros de callback de la barra del navegador después de establecer la sesión.

La cuenta administradora existente ya debe estar asociada al workspace `Trobbu Tecnología`; los colaboradores nuevos deben agregarse mediante la función de invitación para no otorgar acceso automático a registros públicos.

## UI TROBBU / Jira

La interfaz fue actualizada tomando como referencia visual Jira y Jira Clone, manteniendo la identidad TROBBU. Todo continúa en la raíz del repositorio.

Archivos principales de UI:

- `logo.svg` — logo TROBBU principal.
- `styles.css` — paleta TROBBU de 20 colores y estilos Jira-like.
- `app.js` — navegación, Dashboard, Mis tareas, Tabla/Kanban, filtros y modales.
- `index.html` — carga Inter + Iconify para iconografía Lucide.

La publicación en GitHub Pages sigue funcionando sin build y sin carpetas adicionales.
