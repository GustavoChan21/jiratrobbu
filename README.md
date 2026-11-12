# Jira Interno TROBBU v17.5.2

**Base:** v17.5.1 Final Completo → v17.5.2. El proyecto conserva exactamente **101 archivos**.

## Objetivo de esta entrega

v17.5.2 corrige el desfase de esquema del módulo **Vacaciones** detectado en producción (`date_blocks` / `return_date` inexistentes) y añade control anual de saldo, ajustes manuales, tipos de ausencia configurables y medio día sin perder los flujos estables de v17.5.1.

### Vacaciones

- La migración `upgrade-v17.5.sql` es autosuficiente desde el estado real de v17.5.1: crea `return_date` y `date_blocks` si faltan y migra las solicitudes existentes a un bloque compatible.
- Una solicitud admite **1 a 8 bloques**. El mínimo válido es **1 día** (`inicio = fin`).
- Cada bloque conserva Inicio, Fin y Fecha de reincorporación.
- Se mantiene el análisis IA previo a aprobación y la exclusión de integrantes ausentes de la autoasignación.
- Se elimina el aviso informativo redundante sobre cómo la IA interpreta los bloques.

### Saldo anual por integrante

Para cada usuario/año se controlan:

- **Vacaciones permitidas** (`allowed_days`).
- **Días ocupados**: calculados automáticamente con solicitudes `pending` + `approved` de tipos que descuentan saldo.
- **Ajuste de días usados** (`adjustment_used_days`): días ya disfrutados fuera del sistema, capturados manualmente por quien tenga `manage_vacations`.
- **Días disponibles** = permitidos - ocupados - ajuste.

La validación existe tanto en interfaz como en el trigger de base de datos; una inserción por API tampoco puede exceder el saldo disponible.

### Tipos de vacaciones / ausencias

Nuevo CRUD por workspace en `vacation_types`:

- **Vacaciones**: descuenta saldo.
- **Compensación**: no descuenta saldo, pero se contabiliza por tipo.
- **Medio día**: 0.5 día, descuenta saldo y obliga a elegir primera o segunda mitad.
- **Enfermedad**: no descuenta saldo por defecto.
- Se pueden crear tipos adicionales, activar/desactivar, definir color y decidir si descuentan o no del total disponible.
- Los tipos ya usados se desactivan en vez de eliminarse para preservar histórico.

### Proyección / Timeline

En escritorio, los controles **Desde + rango + anterior + Hoy + siguiente** quedan en una sola fila. En pantallas pequeñas se apilan en una sola columna.

## Actualización desde v17.5.1

1. Haz respaldo de la BD.
2. En Supabase SQL Editor ejecuta **todo** `upgrade-v17.5.sql` de esta entrega.
3. Despliega nuevamente `vacation-impact-assistant.ts`.
4. Publica los archivos estáticos v17.5.2 (`index.html`, `app.js`, `styles.css`, etc.).
5. Fuerza recarga; `index.html` usa cache-bust `?v=17.5.2`.
6. Ejecuta `npm run qa` antes de promover a producción.

> El SQL actualizado debe ejecutarse incluso si ya ejecutaste una versión anterior de `upgrade-v17.5.sql`: esta variante es re-ejecutable y contiene la reparación específica de Vacaciones que tu esquema actual no tenía.

## Verificación rápida post-deploy

- Abrir Vacaciones sin error `date_blocks ... schema cache`.
- Crear solicitud de 1 día.
- Crear dos bloques no consecutivos.
- Crear Medio día y seleccionar 1ª/2ª mitad.
- Confirmar que Compensación se contabiliza pero no reduce Disponibles.
- Confirmar que Vacaciones sí reduce Disponibles.
- Editar Permitidos/Ajuste de un usuario desde Control de vacaciones.
- Intentar superar el saldo y comprobar que la BD rechaza la solicitud.
- Crear/editar/desactivar un tipo de ausencia.
- Revisar Timeline en desktop y móvil.

## Esquema canónico

`database.sql` contiene el esquema completo consolidado y termina exactamente con el contenido de `upgrade-v17.5.sql` vigente.
