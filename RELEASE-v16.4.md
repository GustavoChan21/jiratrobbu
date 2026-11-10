# Jira Interno TROBBU v16.4

## Knowledge + Helpdesk
- Enlace directo al artículo sugerido desde el Asistente Knowledge en la creación de tickets/Helpdesk.
- El artículo sugerido abre en una nueva pestaña para conservar el formulario en curso.
- Mensaje explícito de recomendación: leer el recurso relacionado y regresar a crear el ticket si no resuelve la duda.

## ES / EN
- Selector global ES/EN en Topbar y autenticación.
- UI estática traducida con diccionario local: no consume API.
- Preferencia persistida en `profiles.locale` y `localStorage`.
- Contenido dinámico de Knowledge traducido por versión.
- Cache L1 local en navegador por `version_id + idioma`.
- Cache L2 persistente en Supabase `knowledge_version_translations` por `version_id + idioma + source_hash`.
- Solo un cache miss de una versión puede requerir OpenAI.

## Versionamiento de Knowledge
- Identidad estable del artículo + snapshots en `knowledge_article_versions`.
- Una versión pública permanece visible mientras se prepara un borrador nuevo.
- Solo un borrador activo por artículo.
- Motivo obligatorio para crear una nueva versión.
- Auditoría de creador, último editor, publicador y timestamps.
- Historial de eventos por versión.
- Publicación controlada y restauración de versiones históricas.
- Versiones publicadas/archivadas inmutables a nivel BD.
- El slug también es versionado y solo cambia públicamente al publicar.

## Traducción de artículos
- Edge Function `translate-knowledge-version` protegida con JWT.
- Traduce únicamente texto humano; conserva IDs, estructura, imágenes, videos y URLs.
- Usa `OPENAI_API_KEY` solo en cache miss.
- Modelo configurable con `TROBBU_TRANSLATION_MODEL`; fallback de implementación: `gpt-5.6-terra`.

## Base de datos
- `profiles.locale`
- `knowledge_articles.default_language`, `active_version_id`, `draft_version_id`
- `knowledge_article_versions`
- `knowledge_version_events`
- `knowledge_version_translations`
- índices de FK y publicación Realtime.

La migración `upgrade-v16.4.sql` queda incluida para otros entornos. En el Supabase actual los cambios ya fueron aplicados.
