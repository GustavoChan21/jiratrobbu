# Jira Interno TROBBU v16.3

## Knowledge editor UX
- Header de edición reorganizado en dos niveles: navegación/título y descripción/acciones.
- Header sticky en desktop/tablet sin mezclar todas las acciones en una sola línea.
- Barra de tipos de bloques sticky independiente, siempre disponible durante artículos largos.
- El contenido se desplaza por debajo de la barra; cada bloque usa scroll-margin para no quedar oculto al navegar/reordenar.
- En móvil el header deja de ser sticky para ganar espacio, mientras la barra de bloques permanece sticky y horizontalmente desplazable.

## POV lector
- Nueva vista previa local "POV lector" sin necesidad de guardar/publicar.
- Renderiza título, resumen, estado, producto, módulo, etiquetas, texto, listas, citas, destacados, código, imágenes y video.
- Las imágenes seleccionadas pero todavía no subidas se previsualizan mediante Object URL y se liberan al desmontar.
- Botón para volver directamente a edición.

## QA
- TypeScript/JSX: exit code 0.
- Importación CSV/XLS/XLSX/XLSM: 16/16.
- Scripts auxiliares JS: sintaxis válida.
- CSS balanceado.
- Sin alert/confirm/prompt nativos.
- Sin cambios de esquema o migraciones en v16.3.
