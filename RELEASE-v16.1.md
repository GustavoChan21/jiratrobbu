# Jira Interno TROBBU v16.1

## Notificaciones
- Drawer con altura dinámica `100dvh`, scroll vertical interno y barra de scroll estable.
- Se removió el límite frontend de 100 notificaciones para consultar el historial disponible del workspace.
- Header y acciones permanecen fijos mientras se recorre la lista.

## Knowledge: editor avanzado por bloques
- Bloques: texto, título, subtítulo, lista, cita, destacado, código, separador, imagen y video.
- Reordenamiento de bloques y eliminación individual.
- Imágenes: JPG/PNG/WebP, máximo 15 MB original, redimensionado hasta 1920 px, WebP cuando reduce peso, máximo 10 MB procesado.
- Storage privado `jira-evidence` bajo `workspace/knowledge/article/...`.
- Tabla `knowledge_media` con metadatos, tamaño original/final y dimensiones.
- Videos mediante URL YouTube/Vimeo para evitar almacenar archivos pesados.
- Artículos publicados renderizan texto, listas, títulos, imágenes, citas, destacados, código y video.
- Compatibilidad con artículos anteriores: `content` se convierte visualmente a un bloque de texto cuando `content_blocks` está vacío.
- El campo plano `content` se sigue generando para búsqueda y asistente de IA.

## Helpdesk: comentarios
- Scroll interno en comentarios para evitar que se corte el modal.
- Botón Agregar comentario/evidencia permanece accesible.
- Snapshot histórico de autor: nombre y correo guardados en cada comentario.
- Los 5 comentarios existentes fueron retroalimentados con autor y correo.

## IA Knowledge
- Se verificó conectividad App -> `trobbu-knowledge-assistant` con múltiples POST 200 antes de esta release.
- La Edge Function ahora registra de forma segura `provider`, cantidad de candidatos y presencia booleana de secretos, sin registrar keys.
