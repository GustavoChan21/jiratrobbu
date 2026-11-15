# QA v17.15.0 — Jira Interno TROBBU

## Objetivo

Cerrar tres regresiones críticas de UI/estado sin modificar la base de datos:

1. Los badges de **Comentarios / Seguimiento / Actividad** deben representar exactamente las filas que el detalle está mostrando.
2. El resumen del modal **Solicitar vacaciones / ausencia** debe cambiar dinámicamente según `vacation_types.deducts_from_balance`.
3. El preview de adjuntos debe permanecer dentro de Jira, centrado y ocupar 90% del viewport, con navegación tipo carrusel entre adjuntos.

## Resultado automatizado

- `npm run qa`: **455 PASS / 0 FAIL**.
- `app.js`: parser JSX/TypeScript **0 errores**.
- `app-v17.15.0.js`: parser JSX/TypeScript **0 errores**.
- `styles.css` y `styles-v17.15.0.css`: llaves balanceadas; **0 secuencias `\\n` literales**.
- Supabase Health Advisor: **0 lints**.

## Aceptación con producción / RLS

Consultas ejecutadas como usuario `authenticated` del workspace productivo:

- Helpdesk `HD-15`: **2 comentarios / 5 movimientos**.
- Helpdesk `HD-4`: **1 comentario / 3 movimientos**.
- Jira `ADM-64`: **1 comentario / 3 actividades**.
- Jira `ADM-73`: **1 comentario / 4 actividades**.

El frontend v17.15.0 usa las mismas colecciones cargadas para dibujar filas y badges (`comments.length`, `activity.length`), eliminando la segunda fuente de conteo que podía quedarse en cero. Las cargas de detalle además descartan respuestas async antiguas mediante un `loadSequence`.

## Vacaciones

Configuración productiva validada:

- Vacaciones: descuenta saldo.
- Compensación: **no descuenta saldo**.
- Medio día: descuenta saldo (0.5 día).
- Enfermedad: **no descuenta saldo**.

La selección conserva un snapshot del tipo elegido y el bloque resumen se remonta con una key que incluye ID, semántica de descuento y fracción. El label usa comparación booleana estricta.

## Preview de adjuntos

- Backdrop dedicado `modal-backdrop-preview` con `display:flex`, centrado horizontal/vertical.
- Modal: `90vw × 90dvh`, máximo 90% en ambos ejes.
- Imágenes: `object-fit: contain`.
- PDF/texto/CSV: preview interno cuando el navegador lo permite.
- Adjuntos no renderizables: permanecen en el modal y ofrecen apertura externa solo como alternativa.
- Navegación anterior/siguiente y teclado (`←`, `→`, `Esc`) sobre la colección completa de adjuntos del detalle.

El entorno de ejecución bloquea navegación de Chromium a `file://` y `localhost`, por lo que ese smoke visual no se contabiliza como PASS. La validación de geometría se sustenta en las reglas CSS explícitas y en QA estructural.

## Aislamiento de caché

Para impedir mezclar HTML nuevo con bundles anteriores, v17.15.0 carga archivos únicos por release:

- `app-v17.15.0.js`
- `styles-v17.15.0.css`

`index.html` apunta directamente a esos nombres y `vercel.json` permite cache immutable únicamente para esos assets versionados; HTML/config/legacy runtime permanecen `no-store`.
