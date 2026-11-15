# Jira Interno TROBBU v17.15.0

## Correcciones críticas

### Comentarios, Seguimiento y Actividad

Los badges de los modales de Ticket, Sprint y Helpdesk dejaron de depender de un contador paralelo. La cifra ahora deriva de la misma colección que renderiza las filas visibles. Se agregó además protección contra respuestas async fuera de orden en cargas concurrentes de Realtime, polling y mutaciones.

### Vacaciones / ausencias

El selector de Tipo de ausencia ahora mantiene un snapshot exacto del tipo seleccionado. El resumen **Este tipo** reacciona inmediatamente y muestra `Descuenta del saldo` o `No descuenta del saldo` según la configuración real de `vacation_types.deducts_from_balance`.

### Preview de adjuntos

El visor utiliza un modal dedicado centrado de `90vw × 90dvh` y navegación tipo Fancybox/carrusel sobre todos los adjuntos del detalle. Imágenes, PDF y formatos de texto compatibles se visualizan dentro de Jira; solo formatos no representables ofrecen apertura externa.

### Aislamiento de versión

El runtime principal se publica con nombres únicos (`app-v17.15.0.js`, `styles-v17.15.0.css`) para evitar combinaciones de caché entre releases en Vercel/navegador.

## Base de datos

No requiere migración nueva. La configuración de tipos de ausencia y las tablas de comentarios/actividad ya son correctas en producción.
