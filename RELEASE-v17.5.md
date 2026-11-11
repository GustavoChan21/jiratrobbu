# RELEASE v17.5.1 · Jira Interno TROBBU

Base: **v17.5.0 Final Completo**. La distribución conserva exactamente **101 archivos**.

## Corrección prioritaria · Texto Knowledge desde vacío

El problema identificado no era el formato sobre contenido pegado: el fallo estaba al iniciar un bloque Texto completamente vacío.

v17.5.1 cambia el arranque del editor:

- el `contentEditable` inicia con `<p><br></p>`;
- al enfocar un bloque vacío se coloca explícitamente el cursor dentro del párrafo;
- `beforeinput` protege la primera inserción;
- el placeholder ya no depende de `:empty`;
- el primer carácter y los siguientes permanecen dentro del mismo nodo editable;
- `input` no actualiza estado React;
- Guardar/Vista previa consumen el HTML vivo incluso con foco activo.

### Fallback adicional

Se incorpora **Escritura segura** dentro del mismo bloque. Permite escribir en un textarea estándar y después pulsar **Pasar a modo formato** para aplicar todas las herramientas enriquecidas. El texto de este modo también entra al borrador aunque se pulse Guardar directamente.

El modo normal sigue siendo la opción principal: **escribir y dar formato en el trayecto**.

## Toolbar y formato parcial

Se preservan selección y cursor al usar:

- H1-H5;
- fuente y tamaño;
- negrita/cursiva/subrayado/tachado;
- color/resaltado;
- listas/sangría;
- alineación;
- links/unlink;
- limpiar formato;
- interlineado;
- undo/redo.

La sanitización sigue conservando estilos seguros generados por Safari/Chrome.

## UX de autoría

- `Volver a Knowledge` pasa a llamarse **Salir**.
- El botón Salir está alineado en el mismo grupo que **Vista previa · Guardar borrador · Publicar artículo**.
- Se conserva el modal de advertencia para cambios sin guardar.
- Responsive mantiene acciones apilables sin romper márgenes/paddings.

## Pruebas realizadas

- `npm run qa`: **163/163 PASS**.
- `app.js` + 8 Edge Functions: parser **0 errores**.
- Chromium real mediante CDP: escritura carácter por carácter desde vacío **PASS**.
- Chromium real: selección + negrita, cursiva, subrayado y link **PASS**.
- CSS balanceado.
- 101 archivos exactos.
- Sin marcadores de merge.

## Despliegue

### Si ya estás en v17.5.0

No hay cambios de BD. Sustituye los archivos estáticos de la v17.5.1. El cache bust `?v=17.5.1` obliga al navegador a descargar el nuevo editor.

### Si vienes desde v17.3.1

1. Ejecuta `upgrade-v17.5.sql` una vez.
2. Publica los archivos estáticos v17.5.1.
3. Ejecuta `npm run qa`.
