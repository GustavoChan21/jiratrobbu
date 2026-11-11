# QA v17.5.1 · Jira Interno TROBBU

## Resultado automatizado

- `npm run qa`: **163 / 163 PASS**.
- `app.js`: parser JSX/TypeScript **0 errores**.
- Edge Functions: **8 / 8** con parser TypeScript **0 errores**.
- CSS: llaves balanceadas.
- SQL v17.5: estructura consistente y migración vigente preservada.
- `database.sql`: mantiene integrado el bloque de `upgrade-v17.5.sql`.
- Marcadores de merge: ninguno.
- Cantidad de archivos del proyecto: **101**.
- Cache bust del frontend: **17.5.1**.

## Regresión crítica · escribir desde cero en Texto Knowledge

Se cubrió específicamente el caso reportado donde pegar texto funcionaba, pero un bloque Texto vacío solo permitía introducir una letra.

La corrección verifica que:

- el editor vacío arranca con un párrafo real `<p><br></p>` en lugar de un `contentEditable` totalmente vacío;
- al recibir foco se coloca un rango/cursor válido dentro del párrafo inicial;
- `beforeinput` valida el scaffold antes de la primera inserción;
- `input` actualiza únicamente refs/DOM y **no estado React**;
- el placeholder usa `data-empty` y no depende de `:empty`, por lo que no compite con el primer carácter;
- el HTML vivo entra a Guardar/Vista previa aunque el usuario siga dentro del editor;
- `blur` persiste contenido sanitizado;
- selección/rango se guarda y restaura al usar toolbar;
- existe **Escritura segura** como fallback de navegador: textarea estándar → `Pasar a modo formato`;
- lo escrito en Escritura segura también entra al borrador aunque se pulse Guardar antes de cambiar a modo formato.

## Pruebas reales de navegador

Además de los checks estáticos, se ejecutó Chromium headless mediante Chrome DevTools Protocol sobre el mismo patrón DOM usado por el bloque Texto.

### Escritura desde editor vacío — PASS

1. foco sobre `<p><br></p>` vacío;
2. escritura carácter por carácter de `Texto escrito desde cero funciona correctamente`;
3. foco se mantuvo en el editor;
4. HTML resultante: `<p>Texto escrito desde cero funciona correctamente</p>`;
5. selección parcial de `escrito`;
6. aplicación de negrita;
7. continuación de escritura después del formato.

Resultado: **PASS**.

### Selección + toolbar — PASS

Se probó pérdida/restauración de selección simulando que el foco pasa a un control de toolbar y vuelve al editor. Se verificó:

- negrita sobre `beta`;
- cursiva + subrayado sobre `gamma`;
- link sobre `delta`.

Resultado: **PASS**.

## Herramientas del bloque Texto

La suite mantiene cobertura de:

- Normal / H1-H5;
- Inter, Arial, Verdana, Georgia, Times New Roman y Courier New;
- 11/12/14/16/18/24/32 px;
- undo/redo;
- negrita, cursiva, subrayado y tachado;
- color y resaltado;
- listas ordenadas y con viñetas;
- sangría;
- izquierda/centro/derecha/justificado;
- link/unlink;
- limpiar formato;
- interlineado;
- pegado HTML/texto sanitizado;
- persistencia de estilos `span` emitidos por Safari/Chrome.

## UX de salida

- `Volver a Knowledge` se sustituye en autoría por **Salir**.
- **Salir** se ubica en el mismo grupo visual que Vista previa, Guardar borrador y Publicar artículo.
- Se mantiene la confirmación de cambios sin guardar con `Salir y descartar` / `Continuar editando`.
- Responsive: acciones en 2 columnas y luego 1 columna en pantallas pequeñas.

## Knowledge completo y compatibilidad

Se conservan CRUD de categorías, creación atómica artículo+v1, edición, nuevas versiones, publicación, multimedia, migración de bloques v3, portadas configurables, Knowledge Assistant y contenido histórico.

No hay cambios de esquema adicionales entre v17.5.0 y v17.5.1. Si `upgrade-v17.5.sql` ya fue ejecutado, **no es necesario volver a ejecutarlo** para este parche.

## Regresiones externas a Knowledge

Se mantienen los checks de Helpdesk, autoasignación, counters, Kanban/Tabla, relaciones, Gantt y Vacaciones multi-bloque.

## Límite de validación

Las pruebas reales de `contentEditable` sí se ejecutaron en Chromium y pasaron. La validación final de sesión, RLS/Auth y Storage contra datos reales sigue dependiendo del Supabase/staging del proyecto.
