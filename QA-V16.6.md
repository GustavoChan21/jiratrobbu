# QA v16.6

No se crearon tickets permanentes ni solicitudes Helpdesk de QA. Las pruebas de BD utilizaron transacciones con rollback.

## Frontend

- TypeScript/JSX: PASS (`tsc 5.8.3`, exit 0).
- Importación CSV/XLS/XLSX/XLSM: 16/16 PASS.
- `csv-import-v15.2.js`, `config.js`, `speed-insights.js`: sintaxis PASS.
- CSS: 1936 aperturas / 1936 cierres.
- `alert()`, `confirm()`, `prompt()` nativos: 0.
- Auditoría AST de textos JSX/atributos visibles sin traducción EN: 0 candidatos pendientes después de la ampliación del diccionario.

## Deep links

Simulación determinista PASS:
- `https://jiratrobbu.vercel.app/` -> `https://jiratrobbu.vercel.app/?knowledge=<id>`
- `https://gustavochan21.github.io/jiratrobbu/` -> `https://gustavochan21.github.io/jiratrobbu/?knowledge=<id>`
- `http://localhost:8080/jira/index.html` -> `http://localhost:8080/jira/?knowledge=<id>`

## Knowledge Assistant

- Secuencias `\n` literales y saltos reales se normalizan a espacios: PASS.
- Resumen limitado a 220 caracteres: PASS por código/helper.
- Edge Function `trobbu-knowledge-assistant`: desplegada ACTIVE v11, JWT obligatorio.
- Preview desde listado: integrado sin modificar estado del artículo.

## Helpdesk Producto

- Usuario portal lista 5 productos para clasificación: PASS.
- Producto opcional/null: PASS.
- Producto inválido: bloqueado.
- No-miembro: catálogo bloqueado.
- Producto solicitado se hereda al aprobar a Backlog: PASS.
- Override autorizado de producto por PM/Admin: PASS.
- Portal puede leer catálogo pero continúa viendo 0 tickets operativos: PASS.
- Residuos de solicitudes/tickets QA tras rollback: 0.

## Supabase

- Health Advisor: 0 incidencias en la última revisión previa al empaquetado.
- Security Advisor final: únicamente permanece el warning global preexistente de `Leaked Password Protection Disabled`. El RPC de catálogo quedó `SECURITY INVOKER`.
- Performance: `helpdesk_tickets.product_id` tiene índice; el Advisor puede marcarlo inicialmente como `unused` por ser recién creado. La política de catálogo se fusionó con `products_select` para no añadir políticas SELECT permisivas duplicadas.
