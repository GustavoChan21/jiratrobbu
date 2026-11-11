# QA · Jira Interno TROBBU v17.3

## Resultado automatizado

**114 / 114 verificaciones aprobadas · 0 fallos** mediante `node qa-v17.3.mjs`.

## Hallazgos de regresión corregidos

### 1. Pantalla en blanco en Knowledge

Causa reproducible en código: `KnowledgeRichTextEditor` utilizaba `useRef`, pero v17.2 no incluía `useRef` en la desestructuración de React. El flujo de nuevo artículo podía romper el render al montar el primer bloque Texto.

Corrección:

- `const { useEffect, useMemo, useState, useRef } = React`
- `KnowledgeModuleErrorBoundary` en listado y pantallas read/preview/edit/create.
- Check automatizado que exige la importación del hook y los Error Boundaries.

### 2. Fallo potencial de la RPC atómica

`create_knowledge_initial_draft` / `update_knowledge_draft_version` son `SECURITY INVOKER` y llaman a `private.normalize_knowledge_blocks_v3`. El normalizador había quedado revocado para `authenticated`; en PostgreSQL el invocador también necesita `EXECUTE` sobre el helper.

Corrección:

- `GRANT EXECUTE` a `authenticated` únicamente sobre los helpers puros de normalización/escape.
- Se mantienen las RPC públicas como `SECURITY INVOKER`.
- No se agregó `service_role` al navegador.

## Cobertura Knowledge v17.3

Las pruebas automatizadas comprueban:

- CRUD de categorías y validación server-side.
- General por workspace y protección contra eliminación.
- Reclasificación segura al eliminar categorías usadas.
- Artículo obligatorio dentro de categoría.
- Migración de artículos/versiones históricos sin categoría.
- Alta atómica artículo + versión v1.
- Guardado de borrador mediante RPC protegida.
- Nueva versión y publicación.
- Recuperación ante fallo de multimedia.
- `content_schema_version=3`.
- Migración de bloques legacy.
- Texto enriquecido Word-like completo.
- H1–H5, fuentes, tamaños, estilos, colores, listas, sangría, alineación, links, limpieza de formato e interlineado.
- Bloques lista, cita, destacado, código, imagen, video, separador y salto de página.
- Reordenamiento y eliminación de bloques.
- Sanitización de contenido y URLs.
- Un solo input visual en búsqueda Knowledge.
- Responsive de categorías/editor.
- Reglas semánticas del Knowledge Assistant.

## Regresión cruzada

También se comprueba que sigan presentes:

- Autoasignación manual Helpdesk.
- Counters Helpdesk basados en la misma fuente filtrada.
- Selector rápido compartido Kanban/Tabla.
- Buscador para relacionar tickets.
- Layout responsive del Timeline/Gantt.
- Solicitudes de vacaciones por múltiples bloques + reincorporación.
- Proyección de vacaciones.
- Exclusión de ausentes en autoasignación.

## Verificaciones de sintaxis/estructura ejecutadas

- `app.js`: parser TypeScript en modo JSX → **OK**.
- Edge Functions `.ts` relevantes: parser TypeScript → **OK**.
- `styles.css`: parser PostCSS → **OK**.
- `upgrade-v17.3.sql`: delimitadores `$$` balanceados → **OK**.
- `database.sql`: termina exactamente con el bloque de `upgrade-v17.3.sql` → **OK**.
- Merge markers → **0**.

## Smoke de navegador

Se preparó un harness aislado del editor con React local para ejecutar Chromium headless. Chromium del contenedor quedó bloqueado/time-out por las limitaciones del entorno gráfico/DBus, por lo que **este smoke no se contabiliza como aprobado**.

Esto no se sustituye con una afirmación artificial de “100% en producción”. La última validación debe hacerse contra la instancia Supabase de staging/producción porque RLS, Auth y Storage dependen de datos/roles reales.

## Checklist post-deploy obligatorio

1. Ejecutar `upgrade-v17.3.sql`.
2. Ingresar como editor Knowledge.
3. Crear categoría de prueba.
4. Entrar a esa categoría y crear artículo.
5. Agregar todos los tipos de bloque.
6. En Texto, probar fuente/tamaño/B/I/U/tachado/color/resaltado/lista/alineación/link/interlineado.
7. Guardar borrador y refrescar navegador.
8. Volver a editar y confirmar persistencia exacta.
9. Subir imagen y confirmar URL firmada al reabrir.
10. Publicar v1.
11. Crear v2, modificar bloques y confirmar que v1 siga pública hasta publicar v2.
12. Publicar v2 y revisar historial.
13. Eliminar una categoría usada eligiendo categoría destino y verificar artículo + versiones.
14. Probar un usuario con solo `view_knowledge` y uno con solo `create_knowledge`.
15. Abrir Helpdesk y validar que el Asistente Knowledge no sugiera artículos genéricos sin ancla semántica.

