# QA v16.4

No se crearon tickets ni solicitudes Helpdesk de QA.

## Frontend
- TypeScript/JSX (`tsc --allowJs --jsx react --noEmit`): PASS.
- Importación CSV/XLS/XLSX/XLSM: 16/16 PASS.
- `csv-import-v15.2.js`: sintaxis PASS.
- `config.js`: sintaxis PASS.
- `speed-insights.js`: sintaxis PASS.
- CSS: llaves balanceadas.
- No se introducen `alert`, `confirm` ni `prompt` nativos.
- Selector global ES/EN presente.
- Diccionario local UI presente.
- Deep link Knowledge `?knowledge=<id>` presente.
- Guidance de Helpdesk + enlace a artículo completo presente.
- Cache local de traducciones por versión/idioma presente.
- RPC de creación/publicación de versiones integrado en frontend.
- Historial de versiones integrado.

## Versionamiento backend (transacciones + rollback)
- Motivo vacío: bloqueado.
- Crear v2: mantiene v1 pública.
- Segundo borrador concurrente: bloqueado.
- Editar v2: registra editor.
- Publicar v2: v2 activa, v1 archivada.
- Restaurar v1: v1 activa, v2 archivada.
- Edición directa de versión publicada: bloqueada.
- Cambio directo de estado fuera del RPC: bloqueado.
- Usuario sin `manage_settings`: no puede crear borrador.
- Creador / editor / publicador: auditados.
- Eventos created / updated / published: auditados.
- Residuos de QA después de rollback: 0.

## ES/EN y traducciones
- `profiles.locale`: actualización propia verificada con rollback.
- Miembro puede leer cache de traducción de versión publicada.
- Miembro normal no puede insertar directamente traducciones.
- Cache QA residual: 0.
- Edge Function `translate-knowledge-version`: ACTIVE, JWT obligatorio.
- `trobbu-knowledge-assistant`: ACTIVE, recibe idioma y usa traducciones cacheadas cuando existen.

## Supabase Advisors
- Health Advisor: 0 incidencias.
- Security Advisor: solo warning global preexistente `Leaked Password Protection Disabled`.
- Performance: las FK nuevas de v16.4 cuentan con índices. Los avisos restantes son deuda histórica o índices nuevos aún sin uso estadístico.

## Limitación de la sesión
No se ejecutó una llamada real de traducción OpenAI desde un navegador autenticado durante este QA. La Edge Function está desplegada y la ruta/cache/RLS fueron verificadas, pero la primera traducción real dependerá de que `OPENAI_API_KEY` esté configurada y un usuario solicite EN/ES para una versión sin cache.
