# QA v17.17.0

Criterios de aceptación principales:

1. El runtime v17.17 debe tener hash distinto a v17.16.
2. El bundle activo no contiene `Escritura segura`, `safeWriting` ni `knowledge-safe-writing-area`.
3. Seleccionar texto y aplicar un link no modifica el texto visible ni duplica contenido.
4. Seguir escribiendo después del link conserva el anchor.
5. Editar el href de un link existente conserva exactamente un anchor y el mismo texto.
6. Los 12 tipos de bloque normalizan sin pérdida de tipo/campos.
7. Links, negrita, color y tamaño se conservan en richtext.
8. El esquema persistido `content_blocks[].html` se mantiene compatible con artículos actuales.

Prueba browser: `python3 qa-knowledge-editor-browser-v17.17.py`.
Suite estática/regresión: `npm run qa`.
