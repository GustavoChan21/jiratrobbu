# RELEASE v17.5.2 · Jira Interno TROBBU

## Base
v17.5.1 Final Completo.

## Corrección crítica
El frontend v17.5.1 ya intentaba escribir `return_date` y `date_blocks`, pero el esquema Supabase actualmente desplegado no contiene esas columnas. v17.5.2 repara ese desfase de forma re-ejecutable y migra las solicitudes históricas al modelo de bloques.

## Nuevas capacidades
- Solicitudes desde **1 día** y hasta 8 bloques no consecutivos.
- Fecha de reincorporación por bloque.
- CRUD de tipos de ausencia configurable por workspace.
- Tipos iniciales: Vacaciones, Compensación, Medio día y Enfermedad.
- Flag `deducts_from_balance` para decidir qué tipo consume saldo.
- Medio día = 0.5 y requiere primera/segunda mitad.
- Saldos anuales por integrante: Permitidos, Ocupados, Ajuste usado y Disponibles.
- Contador por tipo, incluidos tipos que no descuentan saldo.
- Validación de saldo en frontend y DB trigger.
- Timeline con controles en una sola fila en escritorio y responsive vertical en móvil.
- Eliminado el notice de IA solicitado.

## Compatibilidad
- Las solicitudes antiguas se convierten a un bloque `legacy` sin borrar datos.
- Los campos antiguos `decided_by` / `assistant_*` se copian a los campos canónicos cuando existen.
- Los tipos usados se desactivan en lugar de borrarse.
- Se conservan Knowledge, Helpdesk, Gantt, Kanban/Tabla, relaciones y autoasignación de v17.5.1.

## Deploy
1. Ejecutar `upgrade-v17.5.sql` completo en Supabase.
2. Desplegar `vacation-impact-assistant.ts`.
3. Publicar frontend v17.5.2.
4. Ejecutar `npm run qa` y smoke tests con roles solicitante/PM/Superadmin.

**Importante:** en el esquema real verificado previo a esta entrega faltaban `date_blocks` y `return_date`, por lo que el paso SQL es obligatorio para corregir el error mostrado por la UI.
