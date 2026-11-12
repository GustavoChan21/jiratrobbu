/* Jira Interno TROBBU v17.9.2 · Dark-mode visual parity, resilient detail counters and Live Data */
const { useEffect, useMemo, useState, useRef } = React

const cfg = window.JIRA_CONFIG || {}
if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('Falta la configuración pública de Supabase en config.js')
const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)


const UI_TRANSLATIONS_EN = {
  'Resumen':'Summary','Tablero':'Board','Backlog / Sprints':'Backlog / Sprints','Cronograma':'Timeline','Reportes / AI':'Reports / AI','Knowledge':'Knowledge','Mis tareas':'My tasks','Helpdesk':'Helpdesk','Campos y módulos':'Fields & modules','Staff y Roles':'Staff & Roles','Configuración':'Settings',
  'Todos los autorizados':'All authorized','Productos autorizados':'Authorized products','Espacio de trabajo':'Workspace','Buscar tickets por clave, título o descripción':'Search tickets by key, title or description','Crear':'Create','Nuevo ticket':'New ticket','Notificaciones':'Notifications','Ayuda':'Help','Portal de solicitudes':'Request portal','Workspace interno':'Internal workspace',
  'Tabla':'Table','Kanban':'Kanban','Calendario':'Calendar','Filtros':'Filters','Nuevo':'New','Total':'Total','En desarrollo':'In development','En QA':'In QA','Cerrados':'Closed','Backlog':'Backlog','Por hacer':'To do','En curso':'In progress','Dev terminado':'Dev done','Revisión QA':'QA review','QA rechazado':'QA rejected','QA aprobado':'QA approved','Cerrado':'Closed',
  'Ticket':'Ticket','Proyecto':'Project','Responsable':'Assignee','Fecha límite':'Due date','Estado':'Status','Sin asignar':'Unassigned','Sin módulo':'No module','General':'General','Prioridad':'Priority','Muy baja':'Lowest','Baja':'Low','Media':'Medium','Alta':'High','Muy alta':'Highest','Bloqueante':'Blocker',
  'Nueva solicitud':'New request','Nueva solicitud de Helpdesk':'New Helpdesk request','Crear solicitud':'Create request','Asunto':'Subject','Descripción':'Description','Departamento solicitante':'Requesting department','Tipo de solicitud':'Request type','Evidencia fotográfica':'Photo evidence','Cancelar':'Cancel','Guardar':'Save','Editar':'Edit','Eliminar':'Delete','Cerrar':'Close','Volver':'Back',
  'Asistente Knowledge':'Knowledge Assistant','Buscando artículos relacionados…':'Searching related articles…','Recurso relacionado':'Related resource','Ver artículo completo':'Read full article','Leer artículo':'Read article','Continuar con el ticket':'Continue with ticket',
  'Artículos, guías y procedimientos para resolver dudas antes de abrir un ticket.':'Articles, guides and procedures to resolve questions before opening a ticket.','Nuevo artículo':'New article','Buscar por título, contenido o etiqueta…':'Search by title, content or tag…','Publicados':'Published','Borradores':'Drafts','Archivados':'Archived','Todos':'All','Sin artículos':'No articles','Todavía no hay recursos publicados.':'No published resources yet.','Crea el primer recurso para este workspace.':'Create the first resource for this workspace.',
  'Detalles del artículo':'Article details','Contenido del artículo':'Article content','Título':'Title','Slug':'Slug','Producto':'Product','Módulo':'Module','Resumen':'Summary','Etiquetas':'Tags','Separadas por coma':'Comma-separated','Texto':'Text','Lista':'List','Cita':'Quote','Destacado':'Callout','Código':'Code','Imagen':'Image','Video':'Video','Separador':'Divider','Vista previa':'Preview','Vista previa lector':'Reader preview','Editar contenido':'Edit content','Guardar borrador':'Save draft','Publicar artículo':'Publish article','Guardar cambios':'Save changes','Editar artículo':'Edit article','Volver a Knowledge':'Back to Knowledge','Borrador':'Draft','Publicado':'Published','Archivado':'Archived',
  'Historial de versiones':'Version history','Nueva versión':'New version','Crear nueva versión':'Create new version','Motivo de la nueva versión':'Reason for new version','Versión activa':'Active version','Versión en borrador':'Draft version','Publicar versión':'Publish version','Restaurar como pública':'Restore as public','Creada por':'Created by','Modificada por':'Modified by','Publicada por':'Published by','Fecha de creación':'Created at','Última modificación':'Last updated','Fecha de publicación':'Published at',
  'Comentarios':'Comments','Seguimiento':'Activity','Agregar comentario':'Add comment','Agregar evidencia':'Add evidence','Comentarios y evidencias':'Comments & evidence','Actividades del sprint':'Sprint activities','Editar sprint':'Edit sprint','Cerrar / trasladar':'Close / move','Tickets':'Tickets','No resueltos':'Unresolved','Story points':'Story points',
  'Workspace':'Workspace','Productos':'Products','Sprints':'Sprints','Canales de notificación':'Notification channels','In-app':'In-app','Email':'Email','Pendientes':'Pending','Enviados':'Sent','Fallidos':'Failed','Activo':'Active','Marcar todas como leídas':'Mark all as read','Eliminar leídas':'Delete read',
  'Crear cuenta':'Create account','Iniciar sesión':'Sign in','Correo':'Email','Contraseña':'Password','Confirmar contraseña':'Confirm password','Nombre completo':'Full name','Bienvenido de nuevo':'Welcome back','Crea tu cuenta':'Create your account','Procesando…':'Processing…','Crear una cuenta':'Create an account','Ya tengo una cuenta':'I already have an account',
  'Datos y accesos':'Profile & access','Guardar datos y accesos':'Save profile & access','Contraseña temporal':'Temporary password','Copiar acceso':'Copy access','Plataforma':'Platform','Rol':'Role','Productos':'Products','Estado':'Status','Activo':'Active','Desactivado':'Disabled',
  'Cargando Jira Interno…':'Loading Jira Interno…','Sin descripción':'No description','Sin descripción.':'No description.','Sin detalles adicionales.':'No additional details.','Selecciona un responsable.':'Select an assignee.','Selecciona al menos un ticket.':'Select at least one ticket.','Selecciona el sprint destino.':'Select the destination sprint.'
}
Object.assign(UI_TRANSLATIONS_EN,{
  'ESPACIO DE TRABAJO':'WORKSPACE','PRODUCTOS AUTORIZADOS':'AUTHORIZED PRODUCTS','Cerrar sesión':'Sign out','Cambiar workspace':'Switch workspace','Cambiar o crear workspace':'Switch or create workspace','Ajustes':'Settings','Reportes':'Reports','Gantt':'Gantt','Solicitudes':'Requests',
  'Creado':'Created','En revisión':'In review','Atendido':'Attended','Cerrado':'Closed','Pendiente de decisión':'Pending decision','Aceptado a Backlog':'Accepted to Backlog','Sugerencia rechazada':'Suggestion rejected','Acceso a panel / permisos':'Panel access / permissions','Error / incidente':'Error / incident','Solicitud general':'General request','Nuevo módulo':'New module','Nueva funcionalidad':'New feature','Nuevo requerimiento':'New requirement','Datos / reporte':'Data / report','Otro / General':'Other / General',
  'Tarea':'Task','Historia':'Story','Mejora':'Improvement','Bloquea a':'Blocks','Está bloqueado por':'Is blocked by','Relacionado con':'Related to','Da seguimiento a':'Follows','Texto corto':'Short text','Texto largo':'Long text','Número':'Number','Fecha':'Date','Sí / No':'Yes / No','Selección':'Select','Selección múltiple':'Multi-select','URL':'URL',
  'Dashboards y estadísticas':'Dashboards & analytics','Ver tickets y tableros':'View tickets & boards','Crear tickets':'Create tickets','Editar y mover tickets':'Edit & move tickets','Eliminar tickets':'Delete tickets','Backlog y sprints':'Backlog & sprints','Mesa de Helpdesk':'Helpdesk desk','Administrar productos':'Manage products','Campos, módulos y tags':'Fields, modules & tags',
  'Solicitudes internas':'Internal requests','Solicitudes por tipo':'Requests by type','Área':'Area','Asignado':'Assigned','Estado / decisión':'Status / decision','Asignar':'Assign','Asignar ahora':'Assign now','Reasignar solicitud':'Reassign request','Evaluar requerimiento':'Evaluate requirement','Ver solicitud':'View request','Editar solicitud':'Edit request','Eliminar solicitud':'Delete request',
  'Centro de actividad':'Activity center','Marcar como leída':'Mark as read','Marcar como no leída':'Mark as unread','Eliminar notificación':'Delete notification','Eliminar notificaciones leídas':'Delete read notifications','Correo operativo':'Operational email','Procesar cola de correo':'Process email queue',
  'Cobertura de eventos':'Event coverage','Creación, asignación, estados, comentarios, evidencias y movimientos de sprint.':'Creation, assignment, status, comments, evidence, and sprint moves.','Solicitudes, asignaciones, estados, comentarios, evidencias y decisiones.':'Requests, assignments, status, comments, evidence, and decisions.','Creación, cambios de planeación, comentarios y evidencias.':'Creation, planning changes, comments, and evidence.','Borradores, publicaciones y restauraciones de artículos.':'Drafts, publications, and article restorations.','Altas y cambios de rol, permisos o alcance.':'New members and role, permission, or scope changes.',
  'Nuevo sprint':'New sprint','Editar sprint':'Edit sprint','Planificar':'Plan','Planificación':'Planning','Mover a Backlog':'Move to Backlog','Cerrar sprint y trasladar':'Close sprint & move','Objetivo':'Goal','Fecha inicio':'Start date','Fecha limite':'Due date','Fecha inicial del Gantt':'Gantt start date','Duración de sprint':'Sprint duration',
  'Nuevo producto':'New product','Editar producto':'Edit product','Eliminar producto':'Delete product','Nuevo campo personalizado':'New custom field','Nueva tag':'New tag','Nuevo módulo / grupo':'New module / group','Nueva área de Helpdesk':'New Helpdesk area','Nuevo tipo de solicitud':'New request type',
  'Información principal':'Main information','Descripción opcional':'Optional description','Texto alternativo':'Alt text','Pie de imagen':'Image caption','Compresión automática':'Automatic compression','Separador visual':'Visual divider','URL de YouTube o Vimeo':'YouTube or Vimeo URL','Pie del video':'Video caption',
  'Por favor, te sugerimos leer esta información relacionada con el ticket que deseas crear para verificar si este artículo puede ayudarte a resolver tus dudas. Si la información no fue de ayuda, podrás regresar y continuar creando tu ticket.':'Please read this information related to the ticket you are about to create and check whether this article can answer your question. If it does not help, you can return and continue creating your ticket.',
  'Leer artículo completo':'Read full article','El artículo se abrirá en una nueva pestaña para conservar lo que ya escribiste en este ticket.':'The article will open in a new tab so everything you already typed in this ticket remains intact.',
  'Idioma fuente':'Source language','Español (ES)':'Spanish (ES)','Motivo de la versión':'Version reason','Crear nueva versión':'Create new version','Nueva versión en borrador':'New draft version','Los lectores seguirán viendo la versión activa hasta que publiques este borrador.':'Readers will continue seeing the active version until you publish this draft.','Crear borrador':'Create draft','Creando…':'Creating…','Con borrador':'With draft','Versiones':'Versions','Editar borrador':'Edit draft','Nueva versión':'New version','Restaurar como pública':'Restore as public','Actividad':'Activity','Activa':'Active','Histórico':'History','Creada':'Created','Publicada':'Published','Restaurada':'Restored','Archivada':'Archived','Actualizada':'Updated'
})

Object.assign(UI_TRANSLATIONS_EN,{
  'Agregar revisión / evidencia':'Add review / evidence','Cerrar / trasladar':'Close / move','Crear otro workspace':'Create another workspace','Crear workspace':'Create workspace','Editar configuración':'Edit settings','Editar nombre':'Edit name','Editar ticket':'Edit ticket','Eliminar workspace':'Delete workspace','En ejecución':'Running','Mis estadísticas':'My statistics','Nueva área':'New area','Nuevo campo':'New field','Nuevo módulo':'New module','Nuevo rol':'New role','Nuevo tipo':'New type','Todos los productos':'All products','Todos por rol':'All by role','Tú':'You','Volver a editar':'Back to editing',
  'Sprints · activos, planeados e históricos':'Sprints · active, planned and historical','sprints históricos':'historical sprints','Actualizando información…':'Updating information…','Actívalo desde Configuración para recibir solicitudes internas.':'Enable it from Settings to receive internal requests.','Agrupar por módulo':'Group by module','Al continuar aceptas las políticas internas de acceso y uso de la plataforma.':'By continuing, you accept the platform internal access and usage policies.','Atajo de búsqueda':'Search shortcut','Atención interna':'Internal support','Atención interna pendiente en el mismo workspace.':'Pending internal support in the same workspace.','Aún no hay módulos. Crea uno para agrupar trabajo transversal.':'There are no modules yet. Create one to group cross-functional work.','Backlog vacío para este filtro':'No backlog items for this filter','Buscando artículos relacionados…':'Searching related articles…','Cada línea se publicará como un elemento de lista.':'Each line will be published as a list item.','Campos estructurados que se solicitan en el ticket según producto.':'Structured fields requested on the ticket based on product.','Canales de notificación':'Notification channels','Cancelar selección':'Cancel selection','Clasificación flexible y múltiple para filtros y búsqueda.':'Flexible multi-classification for filters and search.','Clasificación y agrupación':'Classification and grouping','Comentarios y evidencias':'Comments and evidence','Comparación rápida de las seis plantillas estándar del workspace.':'Quick comparison of the six standard workspace templates.','Complejidad relativa 1–5; no representa horas.':'Relative complexity 1–5; it does not represent hours.','Compresión automática':'Automatic compression','Configuración de Helpdesk':'Helpdesk settings','Contraseña inicial':'Initial password','Crear con contraseña':'Create with password','Cuánto trabajo consumió cada iniciativa agrupada.':'How much work each grouped initiative consumed.','Datos del usuario':'User details','Define qué productos puede consultar y operar dentro de este workspace.':'Define which products can be viewed and operated in this workspace.','Definición':'Definition','Descartar por alcance, prioridad o porque no corresponde al proyecto.':'Reject due to scope, priority, or because it does not belong to the project.','Descripción de la solicitud':'Request description','Distribución personal de lo que has solicitado.':'Personal distribution of what you requested.','Distribución por estado':'Distribution by status','Documenta revisión, rechazo, fixes y cierre del sprint.':'Document sprint review, rejection, fixes, and closure.','Documentación específica configurada para este workspace/producto.':'Specific documentation configured for this workspace/product.','Duración de sprint (días)':'Sprint duration (days)','ESTADO / DECISIÓN':'STATUS / DECISION','El rol define la base. Puedes ajustar excepciones por usuario.':'The role defines the baseline. You can adjust exceptions per user.','El ticket se creará en':'The ticket will be created in','El usuario configura su acceso desde el correo.':'The user configures access from the email.','Enviar invitación':'Send invitation','Estado de notificaciones dentro de la plataforma y cola de correo.':'Status of in-app notifications and the email queue.','Este sprint todavía no tiene tickets.':'This sprint does not have tickets yet.','Este ticket todavía no tiene relaciones.':'This ticket does not have relationships yet.','Estos accesos aplican únicamente dentro de este espacio de trabajo.':'These permissions apply only within this workspace.','Evidencia en imágenes':'Image evidence','Excepción administrativa':'Administrative exception','FECHA LÍMITE':'DUE DATE','Fix / Corrección':'Fix / Correction','Incluye productos nuevos automáticamente':'Automatically include new products','Infografía':'Infographic','Inicio planificado, duración y fecha de entrega.':'Planned start, duration, and delivery date.','Imágenes hasta 15 MB y documentos hasta 25 MB · las imágenes se comprimen antes de subir.':'Images up to 15 MB and documents up to 25 MB · images are compressed before upload.','La versión pública permanece visible hasta que publiques este borrador.':'The public version remains visible until you publish this draft.','Las asignaciones, revisiones y solicitudes aparecerán aquí.':'Assignments, reviews, and requests will appear here.','Las dependencias Bloquea / Está bloqueado por son funcionales.':'Blocks / Is blocked by dependencies are functional.','Los productos base y la configuración se crearán automáticamente.':'Base products and settings will be created automatically.','Los tipos desactivados se conservan en el histórico.':'Disabled types are preserved in history.','Límite':'Limit','Módulo / Grupo':'Module / Group','Módulos':'Modules','Módulos / Grupos':'Modules / Groups','Módulos con trabajo':'Modules with work','No hay campos adicionales todavía.':'There are no additional fields yet.','No hay fechas próximas.':'There are no upcoming dates.','Nombre del área':'Area name','Nota de decisión':'Decision note','Nota de relación':'Relationship note','Opciones · una por línea':'Options · one per line','Operación':'Operation','Optimización automática':'Automatic optimization','Optimización automática antes de guardar':'Automatic optimization before saving','Planeación':'Planning','Pregunta por avance, sprint, entregas, riesgos o módulos.':'Ask about progress, sprint, deliveries, risks, or modules.','Producto destino':'Destination product','Promedio ponderado por Story Points; si un ticket no está estimado usa peso 1.':'Weighted average by Story Points; unestimated tickets use weight 1.','Proveedor de correo no configurado.':'Email provider is not configured.','Proyección semanal':'Weekly projection','Próximas entregas':'Upcoming deliveries','Registra o atiende solicitudes internas de otras áreas.':'Register or handle internal requests from other areas.','Relación':'Relationship','Revisión':'Review','Revisión y evidencias':'Review and evidence','Rol y estado':'Role and status','SLA resolución (hrs)':'Resolution SLA (hrs)','Se trasladarán de forma atómica para no perder seguimiento.':'They will be moved atomically to preserve tracking.','Segmentación usando el catálogo configurable de Helpdesk.':'Segmentation using the configurable Helpdesk catalog.','Sin registros todavía.':'No records yet.','Sin áreas configuradas.':'No configured areas.','Solicita a un administrador que habilite el módulo.':'Ask an administrator to enable the module.','Sprint y proyección de cierre':'Sprint and completion forecast','Sprints completados':'Completed sprints','Sí':'Yes','Tableros, tickets, QA, sprints o administración según rol.':'Boards, tickets, QA, sprints, or administration based on role.','Teléfono':'Phone','Tickets aún no comprometidos en un sprint.':'Tickets not yet committed to a sprint.','Todavía no hay comentarios ni evidencias.':'There are no comments or evidence yet.','Todavía no hay módulos con tickets.':'There are no modules with tickets yet.','Todos los módulos':'All modules','Todos los sprints':'All sprints',
  'Versión':'Version','Versiones del artículo':'Article versions','Historial':'History','Motivo del cambio':'Change reason','Versión pública':'Public version','Publicar esta versión':'Publish this version','Descartar borrador':'Discard draft','Traducción':'Translation','Traducción guardada':'Cached translation','Idioma':'Language','Idioma del sistema':'System language','La interfaz se traduce localmente sin consumir API.':'The interface is translated locally without API usage.'
})

Object.assign(UI_TRANSLATIONS_EN,{
  "Nueva solicitud de Helpdesk":"New Helpdesk request",
  "Registra la solicitud y, si aplica, adjunta fotos de evidencia. Las imágenes se optimizan antes de almacenarse.":"Register the request and, if applicable, attach evidence photos. Images are optimized before storage.",
  "Solicitud":"Request",
  "Selecciona un departamento":"Select a department",
  "Selecciona un tipo":"Select a type",
  "Producto específico":"Specific product",
  "Sin producto específico":"No specific product",
  "Opcional":"Optional",
  "Origen":"Source",
  "Interno":"Internal",
  "Portal":"Portal",
  "Teléfono":"Phone",
  "Solicitante":"Requester",
  "Se toma de la sesión actual para conservar la trazabilidad de quién realizó la solicitud.":"Taken from the current session to preserve who submitted the request.",
  "Evidencia fotográfica":"Photo evidence",
  "Opcional · agrega hasta 5 fotos que ayuden a documentar el reporte desde su creación.":"Optional · attach up to 5 photos to document the report from creation.",
  "Cambiar imágenes":"Change images",
  "Seleccionar fotos de evidencia":"Select evidence photos",
  "Quitar imagen":"Remove image",
  "seleccionados. Las imágenes se redimensionan hasta 1920 px y usan WebP cuando reduce el peso; los documentos se conservan intactos.":"before compression. The system resizes up to 1920 px and uses WebP when it actually reduces size.",
  "Optimización automática antes de guardar":"Automatic optimization before saving",
  "La base de datos almacena solo metadatos; el archivo optimizado se guarda en Storage privado y se consulta mediante URL firmada.":"The database stores metadata only; the optimized file is stored in private Storage and accessed through a signed URL.",
  "Propuesta de producto · sin SLA operativo.":"Product proposal · no operational SLA.",
  "PM/Admin/Superadmin decidirá posteriormente si pasa a Backlog o si se rechaza con una nota para el solicitante.":"PM/Admin/Superadmin will later decide whether it moves to Backlog or is rejected with a note to the requester.",
  "Atención interna":"Internal handling",
  "Asignado a":"Assigned to",
  "Fecha objetivo":"Target date",
  "Se enviará sin asignar para canalización.":"It will be submitted unassigned for routing.",
  "Canalización administrada por la mesa.":"Routing is managed by the Helpdesk desk.",
  "PM/Admin/Superadmin define responsable, estado y fecha objetivo después de revisar la solicitud.":"PM/Admin/Superadmin defines assignee, status, and target date after reviewing the request.",
  "Portal administrativo":"Administrative portal",
  "Mis solicitudes":"My requests",
  "Crea solicitudes, consulta únicamente las tuyas y sigue su resolución o decisión.":"Create requests, view only your own, and follow their resolution or decision.",
  "En seguimiento":"In progress",
  "Cerradas":"Closed",
  "Requerimientos pendientes":"Pending requirements",
  "Aceptados a Backlog":"Accepted to Backlog",
  "Sugerencias rechazadas":"Rejected suggestions",
  "Portal privado de solicitudes.":"Private request portal.",
  "No tienes acceso operativo a tableros ni Gantt. El producto se usa solo para clasificar tu solicitud; aquí ves lo que tú creaste, sus comentarios y su seguimiento.":"You do not have operational access to boards or Gantt. Product is used only to classify your request; here you see what you created, its comments, and activity.",
  "No tienes solicitudes":"You have no requests",
  "Cuando necesites acceso, reportar un error o proponer un requerimiento, créalo desde aquí.":"When you need access, want to report an issue, or propose a requirement, create it here.",
  "Solicitado":"Submitted",
  "Objetivo":"Target",
  "Actualizado":"Updated",
  "Servicio interno":"Internal service",
  "Atiende solicitudes operativas y decide qué nuevos requerimientos pasan al Backlog.":"Handle operational requests and decide which new requirements move to Backlog.",
  "Abiertas":"Open",
  "Requerimientos por decidir":"Requirements to decide",
  "Vencidas":"Overdue",
  "SLA cumplido":"SLA met",
  "Los nuevos requerimientos no usan SLA: PM/Admin/Superadmin decide si se aceptan a Backlog o se rechazan.":"New requirements do not use SLA: PM/Admin/Superadmin decides whether they are accepted into Backlog or rejected.",
  "No hay solicitudes con estos filtros.":"There are no requests matching these filters.",
  "Decisión PM":"PM decision",
  "Acciones":"Actions",
  "Vista previa lector":"Reader preview",
  "Vista previa POV lector":"Reader POV preview",
  "Visualizando":"Previewing",
  "No se modifica ningún contenido.":"No content is changed.",
  "Recurso relacionado":"Related resource",
  "Abre el artículo completo para revisar todos los detalles.":"Open the full article to review all details.",
  "El artículo se abrirá en una nueva pestaña para conservar lo que ya escribiste en este ticket.":"The article opens in a new tab so what you already wrote in this ticket remains intact.",
  "Encontré recursos relacionados que vale la pena revisar antes de crear el ticket.":"I found related resources worth reviewing before creating the ticket.",
  "Por favor, te sugerimos leer esta información relacionada con el ticket que deseas crear para verificar si este artículo puede ayudarte a resolver tus dudas. Si la información no fue de ayuda, podrás regresar y continuar creando tu ticket.":"Please review this information related to the ticket you want to create and check whether the article resolves your question. If it does not help, return and continue creating your ticket.",
  "Filtros de Helpdesk":"Helpdesk filters",
  "Aplicar filtros":"Apply filters",
  "Todos":"All",
  "Todas":"All",
  "Producto destino":"Destination product",
  "sugerido desde Helpdesk":"suggested from Helpdesk",
  "Aceptar a Backlog":"Accept into Backlog",
  "Crear un ticket de mejora para desarrollo futuro.":"Create an improvement ticket for future development.",
  "Descartar por alcance, prioridad o porque no corresponde al proyecto.":"Reject due to scope, priority, or because it does not belong to the project.",
  "Nota de decisión (opcional)":"Decision note (optional)",
  "Motivo del rechazo":"Rejection reason",
  "Contexto para el equipo de producto…":"Context for the product team…",
  "Explica al solicitante por qué no se incorporará…":"Explain to the requester why it will not be included…",
  "Rechazar sugerencia":"Reject suggestion",
  "Datos del usuario":"User details",
  "Datos y accesos del colaborador":"Member profile & access",
  "Agregar Staff":"Add Staff",
  "Colaborador del workspace":"Workspace member",
  "Responsable Dev":"Dev assignee",
  "Responsable QA":"QA assignee",
  "Mostrar contraseña":"Show password",
  "Ocultar contraseña":"Hide password",
  "Regenerar y copiar acceso":"Regenerate and copy access",
  "Mínimo 10 caracteres":"Minimum 10 characters",
  "Selecciona un rol.":"Select a role.",
  "Selecciona un rol válido.":"Select a valid role.",
  "Selecciona al menos un producto.":"Select at least one product.",
  "Rol base":"Base role",
  "Rol activo":"Active role",
  "Permisos del rol":"Role permissions",
  "Estos permisos serán la base para todos los colaboradores que utilicen este rol.":"These permissions are the baseline for all members using this role.",
  "Centro de ayuda":"Help center",
  "Accesos rápidos y guía del Jira Interno TROBBU.":"Quick access and Jira Interno TROBBU guide.",
  "Abrir Helpdesk":"Open Helpdesk",
  "Helpdesk deshabilitado":"Helpdesk disabled",
  "Atajo de búsqueda":"Search shortcut",
  "Usa ⌘ K o Ctrl K para enfocar el buscador global.":"Use ⌘ K or Ctrl K to focus global search.",
  "Nuevo sprint":"New sprint",
  "Define objetivo, alcance y ventana de trabajo del sprint.":"Define the sprint goal, scope, and work window.",
  "Detalles y criterios":"Details and criteria",
  "Resultado que debe lograr el ciclo.":"Outcome the cycle must achieve.",
  "Alcance, dependencias, criterios de salida, notas de planeación…":"Scope, dependencies, exit criteria, planning notes…",
  "Inicio":"Start",
  "Fin":"End",
  "Planeado":"Planned",
  "Completado":"Completed",
  "Guardar sprint":"Save sprint",
  "Nuevo producto":"New product",
  "Guardar producto":"Save product",
  "Clave":"Key",
  "Nuevo campo personalizado":"New custom field",
  "Guardar campo":"Save field",
  "Nuevo módulo / grupo":"New module / group",
  "Guardar módulo":"Save module",
  "Nueva área de Helpdesk":"New Helpdesk area",
  "Guardar área":"Save area",
  "Nuevo tipo de solicitud":"New request type",
  "Guardar tipo":"Save type",
  "Nombre del área":"Area name",
  "Área activa":"Active area",
  "Tipo activo":"Active type",
  "Vista previa":"Preview",
  "Filtros del dashboard":"Dashboard filters",
  "Segmenta las métricas por producto y sprint.":"Segment metrics by product and sprint.",
  "Todos los productos":"All products",
  "Todos los sprints":"All sprints",
  "Restablecer":"Reset",
  "Filtros de tickets":"Ticket filters",
  "No hay tickets con estos criterios.":"There are no tickets matching these criteria.",
  "Comentario agregado.":"Comment added.",
  "Comentario actualizado.":"Comment updated.",
  "Comentario eliminado.":"Comment deleted.",
  "Evidencia eliminada.":"Evidence deleted.",
  "Solicitud actualizada.":"Request updated.",
  "Solicitud eliminada.":"Request deleted.",
  "Solicitud asignada correctamente.":"Request assigned successfully.",
  "Requerimiento y evidencias enviados.":"Requirement and evidence submitted.",
  "Solicitud y evidencias enviadas.":"Request and evidence submitted.",
  "Nuevo requerimiento enviado para decisión.":"New requirement submitted for decision.",
  "Solicitud de soporte creada.":"Support request created.",
  "Requerimiento aceptado a Backlog":"Requirement accepted into Backlog",
  "Sugerencia rechazada y notificada al solicitante.":"Suggestion rejected and requester notified.",
  "El título es obligatorio.":"Title is required.",
  "El correo es obligatorio.":"Email is required.",
  "Las contraseñas no coinciden.":"Passwords do not match.",
  "La zona horaria es obligatoria.":"Timezone is required.",
  "Fecha límite no puede ser anterior a Fecha inicio.":"Due date cannot be earlier than start date.",
  "La duración del sprint debe estar entre 1 y 90 días.":"Sprint duration must be between 1 and 90 days.",
  "El SLA de resolución debe estar entre 1 y 2160 horas.":"Resolution SLA must be between 1 and 2160 hours.",
  "La función no pudo completar la operación.":"The function could not complete the operation."
})

Object.assign(UI_TRANSLATIONS_EN,{
  "Usuario":"User",
  "Artículo":"Article",
  "Subtítulo":"Subtitle",
  "Comentario":"Comment",
  "Asignación":"Assignment",
  "Sin área":"No area",
  "Crear rol":"Create role",
  "Editar rol":"Edit role",
  "Guardar tag":"Save tag",
  "Rol creado.":"Role created.",
  "Área creada.":"Area created.",
  "Acceso activo":"Active access",
  "Eliminar área":"Delete area",
  "Crear relación":"Create relationship",
  "Editar espacio":"Edit workspace",
  "Es seguido por":"Is followed by",
  "Módulo creado.":"Module created.",
  "Rol eliminado.":"Role deleted.",
  "SLA resolución":"Resolution SLA",
  "Sin configurar":"Not configured",
  "Sprint creado.":"Sprint created.",
  "Ticket Backlog":"Backlog ticket",
  "Usuario creado":"User created",
  "Eliminar bloque":"Delete block",
  "Eliminar sprint":"Delete sprint",
  "Eliminar ticket":"Delete ticket",
  "Sprints activos":"Active sprints",
  "Tickets Backlog":"Backlog tickets",
  "Tickets creados":"Created tickets",
  "Versión inicial":"Initial version",
  "Área eliminada.":"Area deleted.",
  "Acceso correcto.":"Access confirmed.",
  "Generar análisis":"Generate analysis",
  "Navegación móvil":"Mobile navigation",
  "Producto creado.":"Product created.",
  "Relación creada.":"Relationship created.",
  "Rol actualizado.":"Role updated.",
  "Backlog y Sprints":"Backlog & Sprints",
  "Correo de soporte":"Support email",
  "Editar comentario":"Edit comment",
  "Eliminar artículo":"Delete article",
  "Eliminar relación":"Delete relationship",
  "Guardar evidencia":"Save evidence",
  "Guardar workspace":"Save workspace",
  "Módulo eliminado.":"Module deleted.",
  "Nombre y apellido":"First and last name",
  "Portal de tickets":"Ticket portal",
  "Rol personalizado":"Custom role",
  "Sprint eliminado.":"Sprint deleted.",
  "Ticket eliminado.":"Ticket deleted.",
  "Área actualizada.":"Area updated.",
  "Describe la imagen":"Describe the image",
  "Eliminar evidencia":"Delete evidence",
  "Guardar comentario":"Save comment",
  "Sin notificaciones":"No notifications",
  "Última edición por":"Last edited by",
  "CENTRO DE ACTIVIDAD":"ACTIVITY CENTER",
  "Ej. Soporte técnico":"E.g. Technical support",
  "Eliminar comentario":"Delete comment",
  "Módulo actualizado.":"Module updated.",
  "Producto eliminado.":"Product deleted.",
  "Relación eliminada.":"Relationship deleted.",
  "Sin fecha de cierre":"No closing date",
  "Sprint actualizado.":"Sprint updated.",
  "Título del artículo":"Article title",
  "Evidencia del sprint":"Sprint evidence",
  "Mis tickets enviados":"My submitted tickets",
  "Workspace eliminado.":"Workspace deleted.",
  "Artículo de Knowledge":"Knowledge article",
  "Comentario del sprint":"Sprint comment",
  "Escribe el contenido…":"Write the content…",
  "Guardar configuración":"Save settings",
  "Guardar planificación":"Save planning",
  "Producto actualizado.":"Product updated.",
  "Selecciona una acción":"Select an action",
  "Sin objetivo definido":"No goal defined",
  "Ej. usuario@trobbu.com":"E.g. user@trobbu.com",
  "Sin resolver en sprint":"Unresolved in sprint",
  "Workspace actualizado.":"Workspace updated.",
  "Configuración guardada.":"Settings saved.",
  "Editar área de Helpdesk":"Edit Helpdesk area",
  "Productos seleccionados":"Selected products",
  "Selecciona el producto.":"Select the product.",
  "Configuración de tickets":"Ticket settings",
  "Crear espacio de trabajo":"Create workspace",
  "Editar tipo de solicitud":"Edit request type",
  "Se creó un nuevo sprint.":"A new sprint was created.",
  "Notificaciones por correo":"Email notifications",
  "Ticket enviado a Backlog.":"Ticket sent to Backlog.",
  "Tipo de solicitud creado.":"Request type created.",
  "Cambiar espacio de trabajo":"Switch workspace",
  "Eliminar tipo de solicitud":"Delete request type",
  "Espacio de trabajo creado.":"Workspace created.",
  "Se agregó nueva evidencia.":"New evidence added.",
  "Agrega al menos una opción.":"Add at least one option.",
  "Importar tickets al Backlog":"Import tickets to Backlog",
  "Planificar / cambiar sprint":"Plan / change sprint",
  "Categorías de notificaciones":"Notification categories",
  "Desactivar tipo de solicitud":"Disable request type",
  "La revisión QA fue aprobada.":"QA review was approved.",
  "Tipo de solicitud eliminado.":"Request type deleted.",
  "Agrega contenido al artículo.":"Add content to the article.",
  "Indica el motivo del rechazo.":"Provide the rejection reason.",
  "Seleccionar Excel, CSV o XLSM":"Select Excel, CSV, or XLSM",
  "Acceso al workspace habilitado":"Workspace access enabled",
  "Agregar comentario / evidencia":"Add comment / evidence",
  "Evidencia del sprint agregada.":"Sprint evidence added.",
  "Indica el motivo del override.":"Provide the override reason.",
  "Se agregó evidencia al sprint.":"Evidence added to sprint.",
  "Se agregó un nuevo comentario.":"A new comment was added.",
  "Seleccionar para mover en lote":"Select for bulk move",
  "Tipo de solicitud actualizado.":"Request type updated.",
  "Superadmin es un rol protegido.":"Superadmin is a protected role.",
  "Tipo de evidencia no soportado.":"Unsupported evidence type.",
  "Tus accesos fueron actualizados":"Your access was updated",
  "Usuario y accesos configurados.":"User and access configured.",
  "Describe el trabajo en una frase":"Describe the work in one sentence",
  "Artículo y multimedia eliminados.":"Article and media deleted.",
  "Comentario y evidencia agregados.":"Comment and evidence added.",
  "Forzar avance de ticket bloqueado":"Force blocked ticket transition",
  "Indica el motivo de esta versión.":"Provide the reason for this version.",
  "Planeación y periodos de trabajo.":"Planning and work periods.",
  "Selecciona el ticket relacionado.":"Select the related ticket.",
  "Tu rol no permite cerrar sprints.":"Your role does not allow closing sprints.",
  "Tu rol no permite editar tickets.":"Your role does not allow editing tickets.",
  "Se agregó un comentario al sprint.":"A sprint comment was added.",
  "Tu rol no permite cambiar estados.":"Your role does not allow changing statuses.",
  "Artículo guardado como borrador v1.":"Article saved as draft v1.",
  "Colaborador retirado del workspace.":"Member removed from workspace.",
  "Versión inicial / motivo del cambio":"Initial version / change reason",
  "Ej. Cómo configurar pagos con Stripe":"E.g. How to configure Stripe payments",
  "El ticket fue cerrado completamente.":"The ticket was completely closed.",
  "Tu rol no permite planificar tickets.":"Your role does not allow planning tickets.",
  "Se creó una nueva versión en borrador.":"A new draft version was created.",
  "Tableros separados para cada producto.":"Separate boards for each product.",
  "¿Qué necesitas o qué quieres proponer?":"What do you need or want to propose?",
  "Agrega al menos un bloque de contenido.":"Add at least one content block.",
  "El archivo no contiene una hoja válida.":"The file does not contain a valid sheet.",
  "Rol, permisos y productos actualizados.":"Role, permissions, and products updated.",
  "Solo se permiten imágenes como evidencia.":"Only images are allowed as evidence.",
  "Tipo desactivado; el histórico se conserva.":"Type disabled; history is preserved.",
  "El sprint relacionado ya no está disponible.":"The related sprint is no longer available.",
  "El ticket relacionado ya no está disponible.":"The related ticket is no longer available.",
  "Cada imagen original debe pesar máximo 15 MB.":"Each original image must be at most 15 MB.",
  "Hay correos fallidos pendientes de reintento.":"There are failed emails pending retry.",
  "El artículo relacionado ya no está disponible.":"The related article is no longer available.",
  "La imagen procesada supera el máximo de 10 MB.":"The processed image exceeds the 10 MB maximum.",
  "Selecciona el contexto que deseas administrar.":"Select the context you want to manage.",
  "Tickets que reportaste o que tienes asignados.":"Tickets you reported or are assigned to.",
  "Consulta, filtra y gestiona tickets del equipo.":"View, filter, and manage team tickets.",
  "La solicitud relacionada ya no está disponible.":"The related request is no longer available.",
  "Se actualizó la planeación o estado del sprint.":"Sprint planning or status was updated.",
  "Solo se admiten URLs válidas de YouTube o Vimeo.":"Only valid YouTube or Vimeo URLs are supported.",
  "Tu rol no permite decidir nuevos requerimientos.":"Your role does not allow deciding new requirements.",
  "Requiere correcciones antes de volver a revisión.":"Requires corrections before review again.",
  "Selecciona al menos un producto o habilita Todos.":"Select at least one product or enable All.",
  "Todavía no has enviado tickets en este workspace.":"You have not submitted tickets in this workspace yet.",
  "Corrige los errores del archivo antes de importar.":"Fix the file errors before importing.",
  "No puedes retirarte a ti mismo desde esta pantalla.":"You cannot remove yourself from this screen.",
  "Ticket regresado al Backlog y retirado del Timeline.":"Ticket returned to Backlog and removed from Timeline.",
  "Canaliza la solicitud y actualiza su atención interna.":"Route the request and update its internal handling.",
  "Describe por qué se crea esta nueva versión.":"Describe why this new version is being created.",
  "Nueva versión en borrador":"New draft version",
  "Los lectores seguirán viendo la versión activa hasta que publiques este borrador.":"Readers will continue seeing the active version until you publish this draft.",
  "Crear borrador":"Create draft",
  "Creando…":"Creating…",
  "Selecciona una imagen o elimina el bloque de imagen vacío.":"Select an image or remove the empty image block."
})

Object.assign(UI_TRANSLATIONS_EN,{
  "Mínimo 6 caracteres":"Minimum 6 characters",
  "Repite tu contraseña":"Repeat your password",
  "Crea tu primer espacio de trabajo":"Create your first workspace",
  "Avance del alcance":"Scope progress",
  "Story points cerrados frente al total del filtro actual.":"Closed story points versus the current filtered total.",
  "solicitudes de Helpdesk abiertas":"open Helpdesk requests",
  "Flujo de los tickets filtrados.":"Flow of filtered tickets.",
  "Avance por producto":"Progress by product",
  "Cerrados frente al total en el contexto seleccionado.":"Closed versus total in the selected context.",
  "ESTADO":"STATUS",
  "Sin resultados":"No results",
  "más":"more",
  "Sin programar":"Unscheduled",
  "Tickets sin fecha de inicio ni entrega.":"Tickets without start or due dates.",
  "· histórico, proyección y progreso":"· history, forecast and progress",
  "Sin agrupar":"Ungrouped",
  "en Backlog / sin fechas":"in Backlog / no dates",
  "No hay tickets programados dentro del periodo visible. Cambia la fecha, el periodo o selecciona un sprint histórico.":"There are no scheduled tickets in the visible period. Change the date, period, or select a historical sprint.",
  "Ver detalle":"View details",
  "actividades en Backlog / sin programar":"activities in Backlog / unscheduled",
  "Asigna sprint y fechas para incorporarlas al Timeline.":"Assign a sprint and dates to include them in the Timeline.",
  "Todas las tags":"All tags",
  "Mover seleccionados a…":"Move selected to…",
  "Mover":"Move",
  "COLA DE TRABAJO":"WORK QUEUE",
  "Trabajo comprometido y proyección de entregas.":"Committed work and delivery forecast.",
  "Detalle":"Details",
  "Plantilla controlada para Backlog":"Controlled Backlog template",
  "Título y producto son obligatorios. Sprint siempre queda vacío; estado siempre será Backlog.":"Title and product are required. Sprint always remains empty; status will always be Backlog.",
  "listos para importar":"ready to import",
  "Corrige antes de importar":"Fix before importing",
  "Tipo":"Type",
  "Decisión":"Decision",
  "SOLICITUD":"REQUEST",
  "ÁREA":"AREA",
  "PRIORIDAD":"PRIORITY",
  "Borrador v":"Draft v",
  "antes de compresión":"before compression",
  "Máximo 15 MB original. Se redimensiona a 1920 px y se convierte a WebP cuando reduce el peso.":"Maximum 15 MB original. It is resized to 1920 px and converted to WebP when it reduces file size.",
  "Los videos se insertan por URL para no consumir Storage ni ancho de banda del sistema.":"Videos are embedded by URL to avoid consuming system Storage or bandwidth.",
  "Respuesta corta que verá el asistente y el lector.":"Short answer shown to the assistant and reader.",
  "Vista previa local · los cambios aún no se han publicado.":"Local preview · changes have not been published yet.",
  "· Borrador":"· Draft",
  "Clasificación, resumen y metadatos que usarán los lectores y el asistente de Knowledge.":"Classification, summary, and metadata used by readers and the Knowledge assistant.",
  "Explica en pocas líneas qué resolverá este artículo.":"Explain in a few lines what this article will solve.",
  "Combina portada ejecutiva, títulos H1–H5 (32/28/24/20/16 px), texto enriquecido por selección, listas, destacados, multimedia, separadores y saltos de página. Los bloques se publican en el mismo orden.":"Combine text, lists, callouts, compressed images, code, and embedded videos. Blocks are published in the same order.",
  "Workspace activo:":"Active workspace:",
  "Cada colaborador, rol y producto de esta vista pertenece únicamente a este workspace.":"Every member, role, and product in this view belongs only to this workspace.",
  "PRODUCTOS":"PRODUCTS",
  "Portal Helpdesk · sin productos":"Helpdesk portal · no products",
  "Sin productos":"No products",
  "Roles del workspace":"Workspace roles",
  "Edita permisos base, crea roles personalizados o elimina roles que ya no estén asignados.":"Edit base permissions, create custom roles, or delete roles that are no longer assigned.",
  "permisos activos":"active permissions",
  "Matriz de roles base":"Base role matrix",
  "Permiso":"Permission",
  "siempre conserva todos los accesos y no puede eliminarse. Los demás roles pueden ajustarse en este workspace.":"always keeps full access and cannot be deleted. Other roles can be adjusted in this workspace.",
  "Datos generales, SLA y funciones habilitadas del espacio.":"General settings, SLA, and enabled workspace features.",
  "días":"days",
  "h resolución.":"h resolution.",
  "Tipos de solicitudes":"Request types",
  "Áreas disponibles para clasificar y canalizar solicitudes.":"Available areas to classify and route requests.",
  "Catálogo escalable para segmentar soporte, incidencias, requerimientos y cualquier clasificación futura.":"Scalable catalog to segment support, incidents, requirements, and future classifications.",
  "Sin tipos configurados.":"No request types configured.",
  "Solo los tipos activos pueden seleccionarse en nuevas solicitudes.":"Only active types can be selected in new requests.",
  "Las notificaciones dentro de la plataforma funcionan; para enviar emails configura Resend o Mailgun como secretos de Supabase.":"In-app notifications work; to send emails configure Resend or Mailgun as Supabase secrets.",
  "Ej. Se actualiza el flujo de pagos y se agregan nuevas capturas.":"E.g. The payment flow is updated and new screenshots are added.",
  "Crear ticket":"Create ticket",
  "Cerrar modal":"Close modal",
  "Nombre del workspace":"Workspace name",
  "Contexto, criterios de aceptación, pasos para reproducir…":"Context, acceptance criteria, steps to reproduce…",
  ", sin responsables, sprint ni fechas. Módulo, tags y campos documentales sí se conservarán.":", without assignees, sprint, or dates. Module, tags, and documentation fields will be preserved.",
  "Sin sprint / Backlog":"No sprint / Backlog",
  "Sin estimar":"Unestimated",
  "Ver escala y ejemplos":"View scale and examples",
  "Fecha de inicio":"Start date",
  "Fecha de entrega":"Due date",
  "Campos adicionales":"Additional fields",
  "Comentario general":"General comment",
  "Describe la revisión, hallazgo, corrección o criterio de cierre…":"Describe the review, finding, fix, or closure criteria…",
  "antes de continuar.":"before continuing.",
  "Sin tags":"No tags",
  "Evidencias conservadas":"Preserved evidence",
  "Tu rol tiene acceso de solo lectura a la revisión del ticket.":"Your role has read-only access to ticket review.",
  "Selecciona…":"Select…",
  "El ticket dependiente no puede avanzar hasta que el bloqueador llegue a QA aprobado o Cerrado.":"The dependent ticket cannot move forward until the blocker reaches QA approved or Closed.",
  "Ej. La API debe estar liberada antes de iniciar esta vista.":"E.g. The API must be released before starting this view.",
  "Solo Admin/Superadmin puede continuar sin liberar todos los bloqueadores.":"Only Admin/Superadmin can continue without releasing all blockers.",
  "Explica por qué puede continuar…":"Explain why it can continue…",
  "Nombre":"Name",
  "Objetivo y alcance del módulo…":"Module goal and scope…",
  "Agrupan varios tickets bajo una iniciativa medible. Un ticket puede tener un módulo principal.":"Group multiple tickets under a measurable initiative. A ticket can have one main module.",
  "Sin tags configuradas.":"No tags configured.",
  "Compromiso actual, pendientes y actividades con fecha objetivo antes del cierre.":"Current commitment, pending work, and activities with target dates before close.",
  "Estado de productos":"Product status",
  "Ej. ¿Cómo vamos con Web Administrativa y qué riesgo existe para cerrar el sprint?":"E.g. How are we doing with Web Administrativa and what risk exists for closing the sprint?",
  "Los porcentajes y KPIs los calcula Supabase. La IA solo interpreta esos datos y no puede inventar métricas.":"Percentages and KPIs are calculated by Supabase. AI only interprets those data and cannot invent metrics.",
  "Backlog · Sin sprint":"Backlog · No sprint",
  "Destino de pendientes":"Pending work destination",
  "Sin comentarios ni evidencias del sprint.":"No sprint comments or evidence.",
  "Contexto, impacto, pasos, evidencia y resultado esperado…":"Context, impact, steps, evidence, and expected result…",
  "NUEVO REQUERIMIENTO":"NEW REQUIREMENT",
  "Sin movimientos registrados.":"No activity recorded.",
  "Selecciona un responsable":"Select an assignee",
  "Contexto, instrucción o nota para quien atenderá la solicitud…":"Context, instruction, or note for the person handling the request…",
  "El responsable recibirá la notificación de asignación. El comentario, si lo agregas, quedará en el historial de la solicitud.":"The assignee will receive an assignment notification. If you add a comment, it will remain in the request history.",
  "Describe el hallazgo, seguimiento o evidencia…":"Describe the finding, follow-up, or evidence…",
  "Fotos de evidencia":"Evidence photos",
  "antes de compresión. Se redimensionan hasta 1920 px y se convierten a WebP cuando reduce el peso.":"before compression. They are resized to 1920 px and converted to WebP when it reduces file size.",
  "La imagen se comprime en el navegador antes de subir; la base solo guarda metadatos y Storage conserva el archivo optimizado.":"The image is compressed in the browser before upload; the database stores only metadata and Storage keeps the optimized file.",
  "Selecciona un producto":"Select a product",
  "Limita el acceso a productos concretos":"Limit access to specific products",
  "Permisos efectivos":"Effective permissions",
  "Acceso total":"Full access",
  "Tipo de acceso":"Access type",
  "Equipo de producto":"Product team",
  "Solo crea y consulta sus solicitudes. Sin productos ni tableros.":"Can only create and view own requests. No products or boards.",
  "Acceso inmediato y claves visibles al finalizar.":"Immediate access with credentials shown when finished.",
  "Se mostrará nuevamente al terminar para que puedas copiar correo y contraseña. No se almacena en el perfil del workspace.":"It will be shown again when finished so you can copy email and password. It is not stored in the workspace profile.",
  "Se enviará un enlace de invitación. Si el proveedor de correo de Auth no puede enviarlo, el sistema generará una contraseña temporal como respaldo.":"An invitation link will be sent. If the Auth email provider cannot send it, the system will generate a temporary fallback password.",
  "Acceso sin productos":"Access without products",
  "Podrá crear accesos, incidentes, nuevos módulos, funcionalidades y requerimientos; consultar solo sus propias solicitudes, comentarios, decisiones y estadísticas personales.":"Can create access requests, incidents, modules, features, and requirements; can only view own requests, comments, decisions, and personal statistics.",
  "Sin tableros/productos":"No boards/products",
  "usuario@trobbu.com":"user@trobbu.com",
  "Acceso a la plataforma":"Platform access",
  "Por seguridad la contraseña actual no puede recuperarse. Puedes generar una nueva contraseña temporal para compartirla.":"For security, the current password cannot be recovered. You can generate a new temporary password to share.",
  "Tu Superadmin conserva siempre acceso total.":"Your Superadmin always keeps full access.",
  "Este colaborador no requiere productos. Solo verá sus propias solicitudes y estadísticas personales.":"This member does not require products. They will only see their own requests and personal statistics.",
  "Retirar del workspace":"Remove from workspace",
  "Al copiar se incluyen enlace, correo y contraseña. Compártelos de forma segura y pide al colaborador cambiar su contraseña después de iniciar sesión.":"The copied access includes link, email, and password. Share it securely and ask the member to change their password after signing in.",
  "Cuándo debe utilizarse este tipo de solicitud.":"When this request type should be used.",
  "Administra workspace, productos y notificaciones.":"Manage workspace, products, and notifications.",
  "para enfocar el buscador global.":"to focus the global search."
})


Object.assign(UI_TRANSLATIONS_EN,{
  'Archivos adjuntos':'Attachments','Seleccionar archivos':'Select files','Cambiar archivos':'Change files','Quitar archivo':'Remove file','Abrir archivo':'Open file',
  'Opcional · imágenes, PDF, CSV, Excel, Word, PowerPoint y formatos OpenDocument.':'Optional · images, PDF, CSV, Excel, Word, PowerPoint, and OpenDocument formats.',
  'Imágenes hasta 15 MB y documentos hasta 25 MB · máximo 5 archivos.':'Images up to 15 MB and documents up to 25 MB · maximum 5 files.',
  'Storage privado y optimización automática':'Private storage and automatic optimization','La base de datos almacena solo metadatos; las imágenes se optimizan y los documentos se conservan en Storage privado mediante URL firmada.':'The database stores metadata only; images are optimized and documents remain in private Storage through signed URLs.',
  'actividades':'activities','artículos':'articles','avance':'progress','Responsable Dev':'Dev assignee','Responsable QA':'QA assignee','Asignarme':'Assign to me',
  'No tienes espacios de trabajo asignados.':'You do not have any assigned workspaces.','Solicita acceso a un Admin, PM o Superadmin.':'Ask an Admin, PM, or Superadmin for access.',
  'Solo Admin, PM o Superadmin pueden crear espacios de trabajo':'Only Admin, PM, or Superadmin can create workspaces',
  'Opcional · agrega hasta 5 imágenes o documentos que ayuden a documentar el reporte.':'Optional · add up to 5 images or documents to support the report.',
  'seleccionados. Las imágenes se comprimen y los documentos se conservan sin alterar.':'selected. Images are compressed and documents are preserved without modification.',
  'Archivo adjunto':'Attached file','Opcional si adjuntas archivo':'Optional when attaching a file','Escribe un comentario o adjunta al menos un archivo.':'Write a comment or attach at least one file.','tickets':'tickets'
})

Object.assign(UI_TRANSLATIONS_EN,{
  'Perfil para asignación Helpdesk':'Helpdesk assignment profile',
  'Esta descripción ayuda al asistente a identificar qué tipo de solicitudes atiende esta persona.':'This description helps the assistant identify the types of requests this person handles.',
  'Elegible para autoasignación':'Eligible for automatic assignment',
  'Descripción / nota de referencia':'Description / reference note',
  'Incluye sistemas, módulos, solicitudes y temas que normalmente resuelve. El asistente usa este texto como contexto.':'Include systems, modules, requests, and topics this person normally handles. The assistant uses this text as routing context.',
  'Límite diario':'Daily limit','Vacío = regla del workspace':'Blank = workspace rule','0 = sin límite diario.':'0 = no daily limit.',
  'Límite de tickets activos':'Active ticket limit','Al resolver o redirigir trabajo se libera capacidad activa.':'Resolving or redirecting work frees active capacity.',
  'Al alcanzar el límite':'When the limit is reached','Usar regla del workspace':'Use workspace rule','Asignar a respaldo':'Assign to fallback','Siguiente disponible':'Next available','Dejar en cola':'Leave in queue',
  'Responsable de respaldo':'Fallback assignee','Usar respaldo del workspace':'Use workspace fallback','Capacidad actual':'Current capacity',
  'Si una autoasignación no corresponde, el responsable puede usar Redirigir solicitud para enviarla a la persona correcta.':'If an automatic assignment is not appropriate, the assignee can use Redirect request to send it to the correct person.',
  'Asignación automática Helpdesk':'Automatic Helpdesk assignment','Reglas base usadas cuando un colaborador no define límites o respaldo propios.':'Base rules used when a team member has no personal limits or fallback configured.',
  'Autoasignación activa':'Automatic assignment enabled','Máximo de asignaciones por día':'Maximum assignments per day','Máximo de tickets activos':'Maximum active tickets',
  'Se libera al cerrar o redirigir.':'Capacity is freed when work is closed or redirected.','Cuando se alcanza el límite':'When the limit is reached','Sin respaldo':'No fallback',
  'El asistente analiza asunto, descripción, tipo, departamento y producto contra la descripción de responsabilidades de Staff. Si falla la IA, se usa un enrutamiento local y la cola automática.':'The assistant compares subject, description, type, department, and product with Staff responsibility descriptions. If AI is unavailable, local routing and the automatic queue are used.',
  'Redirigir solicitud':'Redirect request','Reasignar solicitud':'Reassign request','Asignar ahora':'Assign now','Selecciona quién atenderá la solicitud. Puedes agregar contexto para el responsable.':'Select who will handle the request. You can add context for the assignee.',
  'Si la asignación automática no corresponde contigo, redirige la solicitud a la persona adecuada.':'If the automatic assignment is not appropriate for you, redirect the request to the correct person.',
  'La redirección quedará registrada en el historial. El nuevo responsable recibirá la notificación correspondiente.':'The redirect will be recorded in history. The new assignee will receive the corresponding notification.',
  'El responsable recibirá la notificación de asignación. El comentario, si lo agregas, quedará en el historial de la solicitud.':'The assignee will receive an assignment notification. Any comment you add will remain in the request history.',
  'solicitud en cola':'request in queue','solicitudes en cola':'requests in queue','Se asignarán automáticamente en cuanto exista capacidad según las reglas configuradas.':'They will be assigned automatically as soon as capacity is available according to the configured rules.',
  'En cola':'Queued','Reglas automáticas':'Automatic rules','Redirección':'Redirect','Origen asignación':'Assignment source','Motivo asignación':'Assignment reason','Esperando capacidad':'Waiting for capacity',
  'Descripción / nota de referencia Opcional':'Description / reference note Optional',
  '0 = sin límite.':'0 = unlimited.','Portal administrativo Helpdesk':'Helpdesk administrative portal',
  'Este colaborador no recibe autoasignaciones y solo verá sus propias solicitudes.':'This team member does not receive automatic assignments and will only see their own requests.',
  'El asistente usa este texto como contexto.':'The assistant uses this text as context.',
  'Asignado por IA':'Assigned by AI','Asignación automática':'Automatic assignment','Responsable principal alcanzó su límite; enviado al responsable de respaldo.':'Primary assignee reached capacity; sent to the fallback assignee.'
})

const UI_REPLACEMENTS_EN = [
  [/^Nuevo ticket (.+)$/,'New ticket $1'],[/^Editar (.+)$/,'Edit $1'],[/^Eliminar (.+)$/,'Delete $1'],[/^Nuevo (.+)$/,'New $1'],[/^Nueva (.+)$/,'New $1'],[/^Guardar (.+)$/,'Save $1'],[/^Crear (.+)$/,'Create $1'],[/^Ver (.+)$/,'View $1'],[/^Sin (.+)$/,'No $1'],
  [/^Creado (.+)$/,'Created $1'],[/^Actualizado (.+)$/,'Updated $1'],[/^Objetivo (.+)$/,'Target $1'],[/^Decisión (.+)$/,'Decision $1'],[/^(\d+) abiertas · (\d+) cerradas$/,'$1 open · $2 closed'],[/^(.+) tickets movidos a (.+)\.$/,'$1 tickets moved to $2.'],[/^Versión (\d+)$/,'Version $1'],
  [/^Se eliminarán (\d+) notificaciones leídas\. Esta acción no se puede deshacer\.$/,'$1 read notifications will be deleted. This action cannot be undone.'],
  [/^La versión pública de “(.+)” seguirá visible mientras trabajas este borrador\.$/,'The public version of “$1” will remain visible while you work on this draft.'],
  [/^¿Deseas eliminar “(.+)”\? También se eliminarán comentarios, evidencias e historial asociado\.$/,'Delete “$1”? Comments, evidence, and associated history will also be deleted.'],
  [/^¿Deseas retirar a (.+) de (.+)\? Perderá acceso a este workspace, pero sus tickets e historial se conservarán\.$/,'Remove $1 from $2? They will lose access to this workspace, but their tickets and history will be preserved.'],
  [/^“(.+)” tiene (\d+) solicitud(?:es)? asociada(?:s)?\. Para conservar el histórico se desactivará en lugar de eliminarse\.$/,'“$1” has $2 associated request(s). To preserve history it will be deactivated instead of deleted.'],
  [/^Se eliminará “(.+)”\. Esta acción solo está disponible porque todavía no tiene solicitudes asociadas\.$/,'“$1” will be deleted. This action is only available because it has no associated requests yet.'],
  [/^¿Deseas eliminar “(.+)”\? También se eliminarán las imágenes almacenadas para este artículo\.$/,'Delete “$1”? Stored images for this article will also be deleted.'],
  [/^Preferencias operativas de (.+)\.$/,'Operational preferences for $1.'],
  [/^Completa el campo obligatorio: (.+)\.$/,'Complete the required field: $1.'],
  [/^Se eliminará “(.+)” de forma permanente\.$/,'“$1” will be permanently deleted.'],
  [/^“(.+)” no es un formato permitido\.$/,'“$1” is not an allowed format.'],
  [/^“(.+)” supera el máximo de (15|25) MB\.$/,'“$1” exceeds the $2 MB maximum.'],
  [/^Producto “(.+)” no existe o no está autorizado\.$/,'Product “$1” does not exist or is not authorized.'],
  [/^(.+): “(.+)” no coincide con Staff autorizado\.$/,'$1: “$2” does not match authorized Staff.'],
  [/^Borrador v(\d+) creado\. La versión pública permanece sin cambios\.$/,'Draft v$1 created. The public version remains unchanged.'],
  [/^Versión v(\d+) publicada\.$/,'Version v$1 published.'],
  [/^Borrador v(\d+) guardado\. La versión pública sigue activa\.$/,'Draft v$1 saved. The public version remains active.']
]
Object.assign(UI_TRANSLATIONS_EN,{
  'Validando acceso y permisos…':'Validating access and permissions…',
  'Preparando únicamente los recursos autorizados para tu usuario.':'Preparing only the resources authorized for your user.',
  'No se pudo validar el acceso':'Access could not be validated',
  'No se mostrará ningún módulo hasta confirmar tus permisos.':'No module will be shown until your permissions are confirmed.',
  'Reintentar':'Retry',
  'Comentario / evidencia del sprint':'Sprint comment / evidence',
  'Agregar comentario / archivo':'Add comment / file',
  'Imágenes, PDF, CSV, Excel, Word, PowerPoint y formatos OpenDocument.':'Images, PDF, CSV, Excel, Word, PowerPoint, and OpenDocument formats.',
  'Las imágenes se comprimen automáticamente; los documentos se conservan sin alterar.':'Images are compressed automatically; documents are preserved unchanged.',
  'Comentario y archivos del sprint agregados.':'Sprint comment and files added.',
  'Comentario del sprint agregado.':'Sprint comment added.',
  'El comentario se eliminará; sus archivos adjuntos quedarán conservados en el historial del sprint.':'The comment will be deleted; its attachments will remain in the sprint history.',
  'El texto se eliminará. Los archivos adjuntos se conservarán en el historial del ticket.':'The text will be deleted. Attachments will remain in the ticket history.',
  'El texto se eliminará. Los archivos adjuntos quedarán conservados en el historial de la solicitud.':'The text will be deleted. Attachments will remain in the request history.'
})

const I18N_TEXT_ORIGINAL = new WeakMap()
const I18N_ATTR_ORIGINAL = new WeakMap()
function uiTranslate(value,locale){
  if(locale!=='en')return value
  const raw=String(value||''),trim=raw.trim();if(!trim)return raw
  let out=UI_TRANSLATIONS_EN[trim]
  if(!out){for(const [rx,repl] of UI_REPLACEMENTS_EN){if(rx.test(trim)){out=trim.replace(rx,repl);break}}}
  if(!out)return raw
  const lead=raw.match(/^\s*/)?.[0]||'',trail=raw.match(/\s*$/)?.[0]||''
  return lead+out+trail
}
function useDomI18n(locale){
  useEffect(()=>{
    document.documentElement.lang=locale
    const skip=node=>node?.parentElement?.closest?.('[data-i18n-skip],.knowledge-rendered,pre,code,.dynamic-user-content')
    const apply=()=>{
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
      let n;while((n=walker.nextNode())){if(skip(n))continue;if(!I18N_TEXT_ORIGINAL.has(n))I18N_TEXT_ORIGINAL.set(n,n.nodeValue);const original=I18N_TEXT_ORIGINAL.get(n);const next=locale==='en'?uiTranslate(original,'en'):original;if(n.nodeValue!==next)n.nodeValue=next}
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{if(el.closest('[data-i18n-skip],.knowledge-rendered,pre,code,.dynamic-user-content'))return;let store=I18N_ATTR_ORIGINAL.get(el);if(!store){store={};I18N_ATTR_ORIGINAL.set(el,store)};['placeholder','title','aria-label'].forEach(attr=>{if(!el.hasAttribute(attr))return;if(!(attr in store))store[attr]=el.getAttribute(attr);const original=store[attr];const next=locale==='en'?uiTranslate(original,'en'):original;if(el.getAttribute(attr)!==next)el.setAttribute(attr,next)})})
    }
    let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;observer.disconnect();apply();observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']})})}
    const observer=new MutationObserver(schedule);apply();observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']})
    return()=>observer.disconnect()
  },[locale])
}

const getAppUrl = () => {
  try{
    const current=new URL(window.location.href)
    if(/^https?:$/.test(current.protocol)){
      current.search='';current.hash=''
      const path=current.pathname||'/'
      if(!path.endsWith('/')) current.pathname=path.replace(/[^/]*$/,'')
      return current.toString()
    }
  }catch{}
  const configured=String(cfg.appUrl||'').trim()
  return configured?(configured.endsWith('/')?configured:configured+'/'):'/'
}
const appDeepLink=(params={})=>{const u=new URL(getAppUrl(),window.location.href);Object.entries(params).forEach(([k,v])=>{if(v!==null&&v!==undefined&&String(v)!=='')u.searchParams.set(k,String(v))});return u.toString()}
const knowledgeArticleUrl=id=>appDeepLink({view:'knowledge',knowledge:id})

const knowledgeTranslationLocalKey=(versionId,language)=>`jira_knowledge_translation:${versionId}:${language}`
const knowledgeTranslationLocalGet=(versionId,language)=>{try{const raw=localStorage.getItem(knowledgeTranslationLocalKey(versionId,language));return raw?JSON.parse(raw):null}catch{return null}}
const knowledgeTranslationLocalSet=(versionId,language,translation)=>{try{localStorage.setItem(knowledgeTranslationLocalKey(versionId,language),JSON.stringify(translation))}catch{}}
const cleanKnowledgeSnippet=(value,max=220)=>{const text=String(value||'').replace(/\\n/g,' ').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim();return text.length>max?text.slice(0,max-1).trimEnd()+'…':text}

const generateAccessPassword = () => {
  const upper='ABCDEFGHJKLMNPQRSTUVWXYZ',lower='abcdefghijkmnopqrstuvwxyz',digits='23456789',symbols='!@#$%&*?'
  const all=upper+lower+digits+symbols,bytes=new Uint32Array(18);crypto.getRandomValues(bytes)
  const chars=[upper[bytes[0]%upper.length],lower[bytes[1]%lower.length],digits[bytes[2]%digits.length],symbols[bytes[3]%symbols.length]]
  for(let i=4;i<bytes.length;i++)chars.push(all[bytes[i]%all.length])
  for(let i=chars.length-1;i>0;i--){const j=bytes[i]% (i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}
  return chars.join('')
}

const cleanupAuthUrl = () => {
  const authHash = /(?:access_token|refresh_token|error|error_description)=/.test(window.location.hash)
  const authQuery = /(?:code|token_hash|type)=/.test(window.location.search)
  if (authHash || authQuery) window.history.replaceState({}, document.title, getAppUrl())
}

const STATUS = [
  ['backlog','Backlog','lucide:circle-dashed'],
  ['todo','Por hacer','lucide:circle'],
  ['in_progress','En curso','lucide:loader-circle'],
  ['dev_done','Dev terminado','lucide:code-2'],
  ['qa_review','Revisión QA','lucide:scan-search'],
  ['qa_rejected','QA rechazado','lucide:circle-x'],
  ['qa_passed','QA aprobado','lucide:circle-check-big'],
  ['closed','Cerrado','lucide:badge-check']
]
const HELP_STATUS = [
  ['created','Nuevo','lucide:sparkles'],
  ['review','En revisión','lucide:search-check'],
  ['attended','Atendido','lucide:headset'],
  ['closed','Cerrado','lucide:badge-check']
]
const normalizeHelpdeskStatus=value=>value==='resolved'?'closed':value
const HELP_CATEGORY_LABELS = {
  general:'Otro / General',
  access:'Acceso a panel / permisos',
  incident:'Error / incidente',
  request:'Solicitud general',
  module:'Nuevo módulo',
  feature:'Nueva funcionalidad',
  new_requirement:'Nuevo requerimiento',
  data:'Datos / reporte',
  configuration:'Configuración'
}
const REQUIREMENT_STATUS_LABELS = {
  pending:'Pendiente de decisión',
  accepted_backlog:'Aceptado a Backlog',
  rejected:'Sugerencia rechazada'
}
const helpCategoryLabel = value => HELP_CATEGORY_LABELS[value] || value || 'General'
const requirementStatusLabel = value => REQUIREMENT_STATUS_LABELS[value] || value || 'Pendiente de decisión'
const isProposalCategory = value => ['module','feature','new_requirement'].includes(value)
const PRIORITIES = ['lowest','low','medium','high','highest','blocker']
const PRIORITY_LABELS = {lowest:'Muy baja',low:'Baja',medium:'Media',high:'Alta',highest:'Muy alta',blocker:'Bloqueante'}
const TYPES = ['task','bug','story','improvement']
const TYPE_LABELS = {task:'Tarea',bug:'Bug',story:'Historia',improvement:'Mejora'}
const LINK_TYPES = [['blocks','Bloquea a'],['blocked_by','Está bloqueado por'],['relates','Relacionado con'],['follows','Da seguimiento a']]
const LINK_LABELS = {blocks:'Bloquea a',blocked_by:'Está bloqueado por',relates:'Relacionado con',follows:'Da seguimiento a',followed_by:'Es seguido por'}
const CUSTOM_FIELD_TYPES = [['text','Texto corto'],['textarea','Texto largo'],['number','Número'],['date','Fecha'],['boolean','Sí / No'],['select','Selección'],['multiselect','Selección múltiple'],['url','URL']]
const CUSTOM_FIELD_TYPE_LABELS = Object.fromEntries(CUSTOM_FIELD_TYPES)
const STORY_POINTS = [1,2,3,4,5]
const STORY_POINT_LABELS = {1:'Muy simple',2:'Simple',3:'Intermedio',4:'Complejo',5:'Muy complejo'}
const ROLE_LABELS = {superadmin:'Superadmin',admin:'Admin',pm:'PM',dev:'Dev',qa:'QA',consulta:'Consulta'}
const ROLE_DESCRIPTIONS = {
  superadmin:'Control total del workspace. Siempre accede a todos los productos, módulos, configuración y pruebas.',
  admin:'Administra Staff, productos, configuración y toda la operación del workspace.',
  pm:'Gestiona planeación, Backlog, sprints, tickets, cronograma y seguimiento.',
  dev:'Trabaja tickets de desarrollo dentro de los productos asignados.',
  qa:'Trabaja revisión, rechazo, aprobación y evidencias dentro de los productos asignados.',
  consulta:'Acceso de solo lectura a dashboards, tableros, Backlog y cronograma de los productos autorizados.'
}
const PERMISSION_DEFS = [
  ['view_dashboard','Dashboards y estadísticas','lucide:chart-no-axes-combined'],
  ['view_tickets','Ver tickets y tableros','lucide:columns-3'],
  ['create_tickets','Crear tickets','lucide:ticket-plus'],
  ['edit_tickets','Editar y mover tickets','lucide:pencil'],
  ['delete_tickets','Eliminar tickets','lucide:trash-2'],
  ['manage_sprints','Backlog y sprints','lucide:list-todo'],
  ['qa_review','Revisión QA','lucide:scan-search'],
  ['manage_helpdesk','Mesa de Helpdesk','lucide:life-buoy'],
  ['view_knowledge','Ver Knowledge','lucide:book-open-text'],
  ['create_knowledge','Crear artículos Knowledge','lucide:file-plus-2'],
  ['edit_knowledge','Editar y publicar Knowledge','lucide:file-pen-line'],
  ['delete_knowledge','Eliminar artículos Knowledge','lucide:file-x-2'],
  ['view_vacations','Ver mis vacaciones','lucide:calendar-days'],
  ['request_vacations','Solicitar vacaciones','lucide:calendar-plus-2'],
  ['view_vacation_projection','Ver proyección del equipo','lucide:gantt-chart-square'],
  ['manage_vacations','Aprobar y administrar vacaciones','lucide:calendar-check-2'],
  ['manage_staff','Staff y Roles','lucide:users'],
  ['manage_products','Administrar productos','lucide:boxes'],
  ['manage_ticket_fields','Campos, módulos y tags','lucide:tags'],
  ['manage_settings','Configuración','lucide:settings']
]
const ROLE_DEFAULTS = {
  superadmin:Object.fromEntries(PERMISSION_DEFS.map(([k])=>[k,true])),
  admin:Object.fromEntries(PERMISSION_DEFS.map(([k])=>[k,true])),
  pm:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:true,manage_sprints:true,qa_review:true,manage_helpdesk:true,view_knowledge:true,create_knowledge:true,edit_knowledge:true,delete_knowledge:false,view_vacations:true,request_vacations:true,view_vacation_projection:true,manage_vacations:true,manage_staff:false,manage_products:false,manage_ticket_fields:true,manage_settings:false},
  dev:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,view_knowledge:true,create_knowledge:false,edit_knowledge:false,delete_knowledge:false,view_vacations:true,request_vacations:true,manage_vacations:false,manage_staff:false,manage_products:false,manage_ticket_fields:false,manage_settings:false},
  qa:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:true,manage_helpdesk:false,view_knowledge:true,create_knowledge:false,edit_knowledge:false,delete_knowledge:false,view_vacations:true,request_vacations:true,manage_vacations:false,manage_staff:false,manage_products:false,manage_ticket_fields:false,manage_settings:false},
  consulta:{view_dashboard:true,view_tickets:true,create_tickets:false,edit_tickets:false,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,view_knowledge:true,create_knowledge:false,edit_knowledge:false,delete_knowledge:false,view_vacations:true,request_vacations:false,manage_vacations:false,manage_staff:false,manage_products:false,manage_ticket_fields:false,manage_settings:false}
}
const roleDefinitionPermissions = roleDef => {
  const baseRole=roleDef?.base_role||roleDef?.code||'consulta'
  const base={...(ROLE_DEFAULTS[baseRole]||ROLE_DEFAULTS.consulta)}
  if(roleDef?.code==='superadmin'||baseRole==='superadmin') return {...ROLE_DEFAULTS.superadmin}
  const overrides=roleDef?.permissions||{}
  Object.keys(overrides).forEach(k=>{if(typeof overrides[k]==='boolean')base[k]=overrides[k]})
  return base
}
const effectivePermissions = (member,roleDef=null) => {
  const base=roleDefinitionPermissions(roleDef||{base_role:member?.role,code:member?.role})
  if(member?.role==='superadmin'||roleDef?.code==='superadmin') return {...ROLE_DEFAULTS.superadmin}
  const overrides=member?.permissions||{}
  Object.keys(overrides).forEach(k=>{if(typeof overrides[k]==='boolean')base[k]=overrides[k]})
  return base
}
const roleDisplayName = member => member?.role_template?.name || ROLE_LABELS[member?.role] || member?.role || 'Consulta'
const roleIsHelpdeskRequester = roleDef => roleDef?.code==='helpdesk_requester'
const roleNeedsProducts = (roleDef,memberOverrides={}) => {
  if(!roleDef)return true
  if(roleDef.code==='superadmin')return true
  const effective={...roleDefinitionPermissions(roleDef),...(memberOverrides||{})}
  return ['view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets','manage_sprints','qa_review','manage_products'].some(k=>!!effective[k])
}

const EVIDENCE_TYPES = [['general','General'],['review','Revisión'],['rejection','Rechazo'],['fix','Fix / Corrección'],['closure','Cierre']]
const evidenceLabel = value => EVIDENCE_TYPES.find(x=>x[0]===value)?.[1] || value
const Icon = ({name,size=18}) => <iconify-icon icon={name} width={size} height={size}></iconify-icon>
const ThemeToggle=({theme='light',setTheme,compact=false})=><button type="button" className={`theme-toggle ${compact?'compact':''}`} onClick={()=>setTheme?.(theme==='dark'?'light':'dark')} title={theme==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro'} aria-label={theme==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro'}><Icon name={theme==='dark'?'lucide:sun':'lucide:moon'} size={18}/>{!compact&&<span>{theme==='dark'?'Claro':'Oscuro'}</span>}</button>
function useResilientLiveRefresh(load,key,interval=30000){
  const loadRef=useRef(load);loadRef.current=load
  useEffect(()=>{
    let disposed=false
    const run=()=>{if(!disposed&&document.visibilityState!=='hidden')Promise.resolve(loadRef.current?.()).catch(()=>{})}
    const timer=setInterval(run,interval)
    const resume=()=>run()
    window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume)
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume)}
  },[key,interval])
}

async function exactRelationCount(table,column,id){
  const {count,error}=await db.from(table).select('*',{count:'exact',head:true}).eq(column,id)
  if(error)return {count:null,error}
  return {count:Number(count||0),error:null}
}

const initials = value => String(value || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
const statusLabel = value => STATUS.find(x=>x[0]===value)?.[1] || value
const statusIcon = value => STATUS.find(x=>x[0]===value)?.[2] || 'lucide:circle'
const helpStatusLabel = value => {const status=normalizeHelpdeskStatus(value);return HELP_STATUS.find(x=>x[0]===status)?.[1] || status}
const helpStatusIcon = value => {const status=normalizeHelpdeskStatus(value);return HELP_STATUS.find(x=>x[0]===status)?.[2] || 'lucide:circle'}
const helpdeskWorkflowOptions=value=>{const status=normalizeHelpdeskStatus(value),order=['created','review','attended','closed'],idx=order.indexOf(status);const allowed=idx<0?order:idx>=order.length-1?[status]:[status,order[idx+1]];return HELP_STATUS.filter(([key])=>allowed.includes(key))}
const helpdeskQuickMatches=(h,quick='all')=>{
  const mode=quick||'all',proposal=isProposalCategory(h.category),status=normalizeHelpdeskStatus(h.status),done=status==='closed'
  if(mode==='all')return true
  if(mode==='open')return !proposal&&['created','review','attended'].includes(status)
  if(mode==='pending_requirements')return proposal&&(h.proposal_status||'pending')==='pending'
  if(mode==='overdue')return !proposal&&!!h.due_at&&!done&&new Date(h.due_at)<new Date()
  if(mode==='closed')return !proposal&&done
  return true
}
const helpdeskMatchesFilters=(h,filters={},includeStatus=true)=>{
  const f=filters||{}
  return helpdeskQuickMatches(h,f.quick||'all')
    &&(!includeStatus||f.status==='all'||!f.status||h.status===f.status)
    &&((f.requestType||'all')==='all'||h.request_type_id===f.requestType)
    &&((f.department||'all')==='all'||h.department_id===f.department)
    &&((f.product||'all')==='all'||h.product_id===f.product)
    &&((f.assignee||'all')==='all'||h.assigned_to===f.assignee)
    &&((f.priority||'all')==='all'||h.priority===f.priority)
}
const formatDate = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`)) : '—'
const formatDateTime = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—'
const formatDateTimeLocale = (value,locale='es') => value ? new Intl.DateTimeFormat(locale==='en'?'en-US':'es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—'
const dateKeyAtZone=(date=new Date(),timeZone='America/Merida')=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),map=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${map.year}-${map.month}-${map.day}`}
const addDaysKey=(value,days=1)=>{if(!value)return '';const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return dateKey(d)}
const vacationBlocks=request=>{const raw=Array.isArray(request?.date_blocks)?request.date_blocks:[];const normalized=raw.map((b,i)=>({id:b?.id||`block-${i}`,start_date:String(b?.start_date||'').slice(0,10),end_date:String(b?.end_date||'').slice(0,10),return_date:String(b?.return_date||'').slice(0,10)})).filter(b=>b.start_date&&b.end_date&&b.end_date>=b.start_date).map(b=>({...b,return_date:b.return_date&&b.return_date>b.end_date?b.return_date:addDaysKey(b.end_date,1)}));if(normalized.length)return normalized;const start=String(request?.start_date||'').slice(0,10),end=String(request?.end_date||'').slice(0,10);return start&&end?[{id:'legacy',start_date:start,end_date:end,return_date:String(request?.return_date||'').slice(0,10)||addDaysKey(end,1)}]:[]}
const vacationStart=request=>vacationBlocks(request).map(b=>b.start_date).sort()[0]||String(request?.start_date||'').slice(0,10)
const vacationEnd=request=>vacationBlocks(request).map(b=>b.end_date).sort().at(-1)||String(request?.end_date||'').slice(0,10)
const vacationReturn=request=>vacationBlocks(request).map(b=>b.return_date).filter(Boolean).sort().at(-1)||String(request?.return_date||'').slice(0,10)||addDaysKey(vacationEnd(request),1)
const vacationOccursOn=(request,key)=>vacationBlocks(request).some(b=>b.start_date<=key&&b.end_date>=key)
const vacationRangesOverlap=(a,b)=>vacationBlocks(a).some(x=>vacationBlocks(b).some(y=>x.start_date<=y.end_date&&x.end_date>=y.start_date))
const vacationBlocksLabel=request=>vacationBlocks(request).map((b,i)=>`${vacationBlocks(request).length>1?`Bloque ${i+1}: `:''}${formatDate(b.start_date)} → ${formatDate(b.end_date)} · Reincorporación ${formatDate(b.return_date)}`).join(' · ')
const vacationUserIsOutToday=(requests,userId,timeZone='America/Merida')=>{const today=dateKeyAtZone(new Date(),timeZone);return (requests||[]).some(r=>r.user_id===userId&&r.status==='approved'&&vacationOccursOn(r,today))}
const notificationCategory = n => n?.category || n?.metadata?.category || (String(n?.type||'').startsWith('helpdesk')?'helpdesk':String(n?.type||'').startsWith('sprint')||n?.type==='ticket_sprint'?'sprints':String(n?.type||'').startsWith('knowledge')?'knowledge':String(n?.type||'').startsWith('vacation')?'vacations':String(n?.type||'').startsWith('member_')?'staff':String(n?.type||'').startsWith('ticket')||String(n?.type||'').startsWith('assigned_')||String(n?.type||'').startsWith('qa_')?'tickets':'system')
const notificationIcon = n => ({tickets:'lucide:ticket',helpdesk:'lucide:life-buoy',sprints:'lucide:calendar-range',knowledge:'lucide:book-open-text',vacations:'lucide:calendar-off',staff:'lucide:users-round',system:'lucide:sparkles'}[notificationCategory(n)]||'lucide:bell')
const notificationCopy=(n,locale='es')=>{
  const en=locale==='en',m=n?.metadata||{},type=n?.type||'',key=m.ticket_key||m.helpdesk_key||'',name=m.ticket_title||m.subject||m.sprint_name||m.article_title||n?.title||'',from=m.from_status?statusLabel(m.from_status):'',to=m.to_status?statusLabel(m.to_status):'',version=m.version_number?`v${m.version_number}`:''
  const copies={
    ticket_created:en?{title:`New ticket ${key}`,body:name}:{title:`Nuevo ticket ${key}`,body:name},
    assigned_dev:en?{title:`${key} assigned to Development`,body:name}:{title:`${key} asignado a Desarrollo`,body:name},
    assigned_qa:en?{title:`${key} assigned to QA`,body:name}:{title:`${key} asignado a QA`,body:name},
    ticket_status:en?{title:`${key} updated`,body:`Status changed from ${from} to ${to}.`}:{title:`${key} actualizado`,body:`El estado cambió de ${from} a ${to}.`},
    qa_rejected:en?{title:`${key} returned by QA`,body:'Corrections are required before the next QA review.'}:{title:`${key} regresado por QA`,body:'Requiere correcciones antes de volver a revisión.'},
    qa_passed:en?{title:`${key} approved by QA`,body:'The QA review was approved.'}:{title:`${key} aprobado por QA`,body:'La revisión QA fue aprobada.'},
    ticket_closed:en?{title:`${key} closed`,body:'The ticket was completely closed.'}:{title:`${key} cerrado`,body:'El ticket fue cerrado completamente.'},
    ticket_comment:en?{title:`${key} · new comment`,body:m.comment_preview||n?.body||'A new comment was added.'}:{title:`${key} · nuevo comentario`,body:m.comment_preview||n?.body||'Se agregó un nuevo comentario.'},
    ticket_evidence:en?{title:`${key} · new evidence`,body:m.file_name||'New evidence was attached.'}:{title:`${key} · nueva evidencia`,body:m.file_name||'Se agregó nueva evidencia.'},
    ticket_sprint:en?{title:`${key} · sprint updated`,body:m.sprint_id?`Moved to ${m.sprint_name||'sprint'}.`:`Moved back to Backlog from ${m.old_sprint_name||'sprint'}.`}:{title:`${key} · sprint actualizado`,body:m.sprint_id?`Movido a ${m.sprint_name||'sprint'}.`:`Regresó a Backlog desde ${m.old_sprint_name||'sprint'}.`},
    helpdesk_created:en?{title:`Request created ${key}`,body:name}:{title:`Solicitud creada ${key}`,body:name},
    helpdesk_new:en?{title:`New Helpdesk request ${key}`,body:name}:{title:`Nueva solicitud Helpdesk ${key}`,body:name},
    helpdesk_status:en?{title:`${key} updated`,body:`Request status changed to ${to||m.to_status||''}.`}:{title:`${key} actualizado`,body:`El estado de la solicitud cambió a ${to||m.to_status||''}.`},
    helpdesk_assigned:en?{title:`${key} assigned to you`,body:name}:{title:`${key} asignado`,body:name},
    helpdesk_comment:en?{title:`${key} · new comment`,body:m.comment_preview||n?.body||'A new comment was added.'}:{title:`${key} · nuevo comentario`,body:m.comment_preview||n?.body||'Se agregó un nuevo comentario.'},
    helpdesk_evidence:en?{title:`${key} · new evidence`,body:m.file_name||'New evidence was attached.'}:{title:`${key} · nueva evidencia`,body:m.file_name||'Se agregó nueva evidencia.'},
    helpdesk_requirement_decision:en?{title:`${key} · requirement decision`,body:m.decision==='accepted_backlog'?`Accepted into Backlog as ${m.converted_ticket_key||'a ticket'}.`:`The proposal was rejected. ${m.note||''}`}:{title:`${key} · decisión de requerimiento`,body:m.decision==='accepted_backlog'?`Aceptado a Backlog como ${m.converted_ticket_key||'ticket'}.`:`La propuesta fue rechazada. ${m.note||''}`},
    sprint_created:en?{title:`New sprint · ${m.sprint_name||name}`,body:'A new sprint was created.'}:{title:`Nuevo sprint · ${m.sprint_name||name}`,body:'Se creó un nuevo sprint.'},
    sprint_updated:en?{title:`${m.sprint_name||name} updated`,body:'Sprint planning or status was updated.'}:{title:`${m.sprint_name||name} actualizado`,body:'Se actualizó la planeación o estado del sprint.'},
    sprint_comment:en?{title:`${m.sprint_name||name} · new comment`,body:m.comment_preview||n?.body||'A new sprint comment was added.'}:{title:`${m.sprint_name||name} · nuevo comentario`,body:m.comment_preview||n?.body||'Se agregó un comentario al sprint.'},
    sprint_evidence:en?{title:`${m.sprint_name||name} · new evidence`,body:m.file_name||'New sprint evidence was attached.'}:{title:`${m.sprint_name||name} · nueva evidencia`,body:m.file_name||'Se agregó evidencia al sprint.'},
    knowledge_draft:en?{title:`New Knowledge draft · ${m.article_title||name}`,body:`${version} · ${n?.body||'A new draft version was created.'}`}:{title:`Nuevo borrador Knowledge · ${m.article_title||name}`,body:`${version} · ${n?.body||'Se creó una nueva versión en borrador.'}`},
    knowledge_published:en?{title:`New article published · ${m.article_title||name}`,body:`${version} is now the active public version.`}:{title:`Nuevo artículo publicado · ${m.article_title||name}`,body:`${version} ahora es la versión pública activa.`},
    knowledge_restored:en?{title:`Article version restored · ${m.article_title||name}`,body:`${version} is public again.`}:{title:`Versión de artículo restaurada · ${m.article_title||name}`,body:`${version} vuelve a ser pública.`},
    vacation_requested:en?{title:'New vacation request',body:n?.body||'A team member submitted a vacation request.'}:{title:'Nueva solicitud de vacaciones',body:n?.body||'Un integrante envió una solicitud de vacaciones.'},
    vacation_status:en?{title:n?.title||'Vacation request updated',body:n?.body||'The status of your vacation request changed.'}:{title:n?.title||'Solicitud de vacaciones actualizada',body:n?.body||'Cambió el estado de tu solicitud de vacaciones.'},
    member_added:en?{title:'Workspace access enabled',body:`You were added with role ${m.role||'member'}.`}:{title:'Acceso al workspace habilitado',body:`Fuiste agregado con rol ${m.role||'miembro'}.`},
    member_access_updated:en?{title:'Your access was updated',body:m.active===false?'Your workspace access was disabled.':'Your role, permissions, or product scope was updated.'}:{title:'Tus accesos fueron actualizados',body:m.active===false?'Tu acceso al workspace fue desactivado.':'Tu rol, permisos o alcance de productos fue actualizado.'}
  }
  return copies[type]||{title:n?.title||type,body:n?.body||''}
}
const toLocalDateTimeInput = value => {if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)}
const localDateTimeToIso = value => value ? new Date(value).toISOString() : null
const slugify = value => String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
const safeFileName = value => String(value||'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90)
const dateKey = d => {const x=new Date(d);const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
const sameDate = (a,b) => a && b && String(a).slice(0,10)===String(b).slice(0,10)
const roleCanDashboard = role => !!ROLE_DEFAULTS[role]?.view_dashboard
const roleCanWork = role => !!ROLE_DEFAULTS[role]?.edit_tickets
const roleCanPlan = role => !!ROLE_DEFAULTS[role]?.manage_sprints
const roleCanAdmin = role => ['superadmin','admin'].includes(role)
const ticketProgress = status => ({backlog:0,todo:10,in_progress:45,dev_done:65,qa_review:78,qa_rejected:58,qa_passed:92,closed:100}[status]??0)
const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)
const importNorm = value => String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
const IMPORT_TYPE_MAP = {tarea:'task',task:'task',bug:'bug',historia:'story',story:'story',mejora:'improvement',improvement:'improvement'}
const IMPORT_PRIORITY_MAP = {'muy baja':'lowest',lowest:'lowest',baja:'low',low:'low',media:'medium',medium:'medium',alta:'high',high:'high','muy alta':'highest',highest:'highest',bloqueante:'blocker',blocker:'blocker',critica:'blocker',critical:'blocker'}
const importDateValue = value => {
  const raw=String(value??'').trim(); if(!raw)return ''
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw
  const slash=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(slash)return `${slash[3]}-${String(slash[2]).padStart(2,'0')}-${String(slash[1]).padStart(2,'0')}`
  const n=Number(raw);if(Number.isFinite(n)&&n>20000&&n<70000){const d=new Date(Date.UTC(1899,11,30)+n*86400000);return d.toISOString().slice(0,10)}
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:dateKey(d)
}
const importCell = (row,...names) => {
  const entries=Object.entries(row||{});for(const name of names){const n=importNorm(name).replace(/\*/g,'');const hit=entries.find(([k])=>importNorm(k).replace(/\*/g,'')===n);if(hit)return hit[1]}
  return ''
}


async function signedEvidenceRows(rows){
  return Promise.all((rows||[]).map(async row=>{
    const {data,error}=await db.storage.from('jira-evidence').createSignedUrl(row.storage_path,3600)
    return {...row,signed_url:error?null:data?.signedUrl||null}
  }))
}

const fileSizeLabel=bytes=>{const n=Number(bytes||0);if(!n)return '—';if(n<1024)return `${n} B`;if(n<1024*1024)return `${Math.round(n/1024)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
const ATTACHMENT_ACCEPT='.jpg,.jpeg,.png,.webp,.gif,.pdf,.csv,.xls,.xlsx,.xlsm,.xlsb,.xlt,.xltx,.xltm,.doc,.docx,.docm,.dot,.dotx,.dotm,.rtf,.ppt,.pptx,.pptm,.pps,.ppsx,.ppsm,.pot,.potx,.potm,.odt,.ods,.odp,.txt,image/jpeg,image/png,image/webp,image/gif,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'
const IMAGE_EXTENSIONS=new Set(['jpg','jpeg','png','webp','gif'])
const DOCUMENT_EXTENSIONS=new Set(['pdf','csv','xls','xlsx','xlsm','xlsb','xlt','xltx','xltm','doc','docx','docm','dot','dotx','dotm','rtf','ppt','pptx','pptm','pps','ppsx','ppsm','pot','potx','potm','odt','ods','odp','txt'])
const fileExtension=name=>String(name||'').toLowerCase().split('.').pop()||''
const isImageAttachment=file=>String(file?.type||'').startsWith('image/')||IMAGE_EXTENSIONS.has(fileExtension(file?.name||file?.file_name))
const attachmentMime=file=>{if(file?.type&&file.type!=='application/octet-stream')return file.type;const ext=fileExtension(file?.name);return ({pdf:'application/pdf',csv:'text/csv',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xlsm:'application/vnd.ms-excel.sheet.macroEnabled.12',xlsb:'application/vnd.ms-excel.sheet.binary.macroEnabled.12',xlt:'application/vnd.ms-excel',xltx:'application/vnd.openxmlformats-officedocument.spreadsheetml.template',xltm:'application/vnd.ms-excel.template.macroEnabled.12',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',docm:'application/vnd.ms-word.document.macroEnabled.12',dot:'application/msword',dotx:'application/vnd.openxmlformats-officedocument.wordprocessingml.template',dotm:'application/vnd.ms-word.template.macroEnabled.12',rtf:'application/rtf',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',pptm:'application/vnd.ms-powerpoint.presentation.macroEnabled.12',pps:'application/vnd.ms-powerpoint',ppsx:'application/vnd.openxmlformats-officedocument.presentationml.slideshow',ppsm:'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',pot:'application/vnd.ms-powerpoint',potx:'application/vnd.openxmlformats-officedocument.presentationml.template',potm:'application/vnd.ms-powerpoint.template.macroEnabled.12',odt:'application/vnd.oasis.opendocument.text',ods:'application/vnd.oasis.opendocument.spreadsheet',odp:'application/vnd.oasis.opendocument.presentation',txt:'text/plain'})[ext]||'application/octet-stream'}
const attachmentIcon=row=>{const ext=fileExtension(row?.file_name||row?.name);if(IMAGE_EXTENSIONS.has(ext)||String(row?.mime_type||row?.type||'').startsWith('image/'))return 'lucide:image';if(ext==='pdf')return 'lucide:file-text';if(['xls','xlsx','xlsm','xlsb','xlt','xltx','xltm','csv','ods'].includes(ext))return 'lucide:sheet';if(['ppt','pptx','pptm','pps','ppsx','ppsm','pot','potx','potm','odp'].includes(ext))return 'lucide:presentation';if(['doc','docx','docm','dot','dotx','dotm','odt','rtf'].includes(ext))return 'lucide:file-type-2';return 'lucide:file'}
function validateAttachmentSelection(files,{maxFiles=5}={}){const list=Array.from(files||[]);if(list.length>maxFiles)throw new Error(`Puedes adjuntar máximo ${maxFiles} archivos.`);for(const file of list){const ext=fileExtension(file.name);if(!IMAGE_EXTENSIONS.has(ext)&&!DOCUMENT_EXTENSIONS.has(ext))throw new Error(`“${file.name}” no es un formato permitido.`);const limit=isImageAttachment(file)?15*1024*1024:25*1024*1024;if(file.size>limit)throw new Error(`“${file.name}” supera el máximo de ${isImageAttachment(file)?15:25} MB.`)}return list}

async function compressEvidenceImage(file){
  if(!isImageAttachment(file))throw new Error('Solo se permiten imágenes como evidencia.')
  if(file.size>15*1024*1024)throw new Error('Cada imagen original debe pesar máximo 15 MB.')
  if(file.type==='image/gif'||fileExtension(file.name)==='gif'||file.size<=300*1024)return {file,originalSize:file.size,compressed:false}
  const url=URL.createObjectURL(file)
  try{
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`No se pudo procesar ${file.name}.`));img.src=url})
    const maxSide=1920,scale=Math.min(1,maxSide/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height))
    const width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale)),height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale))
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('El navegador no pudo preparar la compresión de imagen.')
    ctx.drawImage(image,0,0,width,height)
    const encode=quality=>new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality))
    let blob=await encode(.82)
    if(blob&&blob.size>1600*1024)blob=await encode(.72)
    if(blob&&blob.size>1600*1024)blob=await encode(.62)
    if(!blob||blob.size>=file.size*.97)return {file,originalSize:file.size,compressed:false}
    const base=file.name.replace(/\.[^.]+$/,'')||'evidencia'
    return {file:new File([blob],`${base}.webp`,{type:'image/webp',lastModified:Date.now()}),originalSize:file.size,compressed:true}
  }finally{URL.revokeObjectURL(url)}
}

async function uploadEvidenceFiles({workspaceId,scope,parentId,commentId,files,evidenceType='general',userId,compress=true}){
  const list=validateAttachmentSelection(files,{maxFiles:5})
  if(!list.length)return []
  const config={tickets:['ticket_attachments','ticket_id'],sprints:['sprint_attachments','sprint_id'],helpdesk:['helpdesk_attachments','helpdesk_ticket_id']}[scope]
  if(!config)throw new Error('Tipo de adjunto no soportado.')
  const [table,parentKey]=config,inserted=[]
  try{
    for(const original of list){
      const imageFile=isImageAttachment(original)
      const processed=imageFile&&compress?await compressEvidenceImage(original):{file:original,originalSize:original.size,compressed:false}
      const file=processed.file
      if(imageFile&&file.size>10*1024*1024)throw new Error('La imagen procesada supera el máximo de 10 MB.')
      if(!imageFile&&file.size>25*1024*1024)throw new Error('El documento supera el máximo de 25 MB.')
      const path=`${workspaceId}/${scope}/${parentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const contentType=attachmentMime(file)
      const {error:uploadError}=await db.storage.from('jira-evidence').upload(path,file,{contentType,upsert:false,cacheControl:'3600'})
      if(uploadError)throw uploadError
      const payload={workspace_id:workspaceId,[parentKey]:parentId,comment_id:commentId||null,uploaded_by:userId,storage_path:path,file_name:file.name,mime_type:contentType,size_bytes:file.size,original_size_bytes:processed.originalSize,evidence_type:evidenceType}
      const {data,error}=await db.from(table).insert(payload).select('*').single()
      if(error){await db.storage.from('jira-evidence').remove([path]);throw error}
      inserted.push({...data,compression_saved_bytes:Math.max(0,processed.originalSize-file.size)})
    }
    return inserted
  }catch(err){
    const paths=inserted.map(x=>x.storage_path).filter(Boolean)
    if(paths.length)await db.storage.from('jira-evidence').remove(paths)
    const ids=inserted.map(x=>x.id).filter(Boolean)
    if(ids.length)await db.from(table).delete().in('id',ids)
    throw err
  }
}

const KNOWLEDGE_HEADING_PRESETS=[
  {type:'heading1',tag:'h1',label:'H1',size:32},
  {type:'heading2',tag:'h2',label:'H2',size:28},
  {type:'heading3',tag:'h3',label:'H3',size:24},
  {type:'heading4',tag:'h4',label:'H4',size:20},
  {type:'heading5',tag:'h5',label:'H5',size:16}
]
const KNOWLEDGE_COVER_TEMPLATES=[
  {value:'forest',label:'TROBBU Verde',description:'Editorial luxury en verde profundo'},
  {value:'ivory',label:'Marfil',description:'Documento ejecutivo claro y cálido'},
  {value:'midnight',label:'Azul Ejecutivo',description:'Portada corporativa de alto contraste'}
]
const KNOWLEDGE_COVER_FONTS=['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New']
const DEFAULT_KNOWLEDGE_COVER_SETTINGS={
  forest:{background:'#0C2B2A',background_alt:'#4D5A51',text:'#F8F2E8',accent:'#D1AA87',border:'#354A40',title_font:'Inter',body_font:'Inter'},
  ivory:{background:'#FFFDF9',background_alt:'#F1E4CD',text:'#26362F',accent:'#8A6345',border:'#E7D9C4',title_font:'Georgia',body_font:'Inter'},
  midnight:{background:'#07172E',background_alt:'#02488D',text:'#F7FAFF',accent:'#D1AA87',border:'#0B315A',title_font:'Inter',body_font:'Inter'}
}
function normalizeKnowledgeCoverSettings(value){
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{}
  const hex=(v,fallback)=>/^#[0-9A-F]{6}$/i.test(String(v||''))?String(v).toUpperCase():fallback
  return Object.fromEntries(KNOWLEDGE_COVER_TEMPLATES.map(t=>{const d=DEFAULT_KNOWLEDGE_COVER_SETTINGS[t.value],r=raw[t.value]&&typeof raw[t.value]==='object'?raw[t.value]:{};return [t.value,{background:hex(r.background,d.background),background_alt:hex(r.background_alt,d.background_alt),text:hex(r.text,d.text),accent:hex(r.accent,d.accent),border:hex(r.border,d.border),title_font:KNOWLEDGE_COVER_FONTS.includes(r.title_font)?r.title_font:d.title_font,body_font:KNOWLEDGE_COVER_FONTS.includes(r.body_font)?r.body_font:d.body_font}] }))
}
function knowledgeFontStack(name){return name==='Georgia'?'Georgia, serif':name==='Times New Roman'?'\"Times New Roman\", serif':name==='Courier New'?'\"Courier New\", monospace':`${name||'Inter'}, Arial, sans-serif`}
function knowledgeCoverStyle(settings,template='forest'){
  const all=normalizeKnowledgeCoverSettings(settings),x=all[template]||all.forest
  return {'--cover-bg-start':x.background,'--cover-bg-end':x.background_alt,'--cover-text':x.text,'--cover-accent':x.accent,'--cover-border':x.border,'--cover-title-font':knowledgeFontStack(x.title_font),'--cover-body-font':knowledgeFontStack(x.body_font)}
}
const knowledgeHeadingLabel=type=>{const row=KNOWLEDGE_HEADING_PRESETS.find(x=>x.type===type||x.tag===type);return row?`${row.label} · ${row.size} px`:String(type||'')}
function knowledgeBlockId(){return crypto.randomUUID()}
function sanitizeKnowledgeHtml(value){
  const raw=String(value||'')
  if(typeof document==='undefined')return raw.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/\son\w+\s*=\s*(["']).*?\1/gi,'')
  const doc=new DOMParser().parseFromString(`<div>${raw}</div>`,'text/html'),root=doc.body.firstElementChild
  if(!root)return ''
  const allowed=new Set(['P','DIV','BR','STRONG','B','EM','I','U','S','STRIKE','DEL','SUB','SUP','H1','H2','H3','H4','H5','UL','OL','LI','CODE','A','SPAN','FONT'])
  const allowedFonts=new Set(['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New'])
  const safeColor=v=>{const raw=String(v||'').trim();if(/^#[0-9a-f]{6}$/i.test(raw))return raw.toUpperCase();const m=raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);if(!m)return '';const hex=n=>Math.max(0,Math.min(255,Number(n)||0)).toString(16).padStart(2,'0').toUpperCase();return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`}
  const walk=node=>{[...node.children].forEach(child=>{
    if(!allowed.has(child.tagName)){walk(child);child.replaceWith(...child.childNodes);return}
    const attrs=[...child.attributes];attrs.forEach(a=>child.removeAttribute(a.name))
    if(child.tagName==='A'){
      const href=String(attrs.find(a=>a.name==='href')?.value||'').trim()
      if(/^(https?:|mailto:|tel:)/i.test(href)){child.setAttribute('href',href);child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer')}
    }
    if(child.tagName==='FONT'){
      const size=String(attrs.find(a=>a.name==='size')?.value||'3'),face=String(attrs.find(a=>a.name==='face')?.value||'Inter').replace(/["']/g,'').trim(),color=safeColor(attrs.find(a=>a.name==='color')?.value)
      child.setAttribute('size',/^[1-7]$/.test(size)?size:'3');child.setAttribute('face',allowedFonts.has(face)?face:'Inter');if(color)child.setAttribute('color',color)
    }
    const style=String(attrs.find(a=>a.name==='style')?.value||''),parts=[]
    if(['P','DIV','H1','H2','H3','H4','H5'].includes(child.tagName)){
      const legacy=String(attrs.find(a=>a.name==='align')?.value||''),align=style.match(/text-align\s*:\s*(left|center|right|justify)/i)?.[1]||(/^(left|center|right|justify)$/i.test(legacy)?legacy:'')
      if(align)parts.push(`text-align:${align.toLowerCase()}`)
    }
    if(child.tagName==='SPAN'){
      const size=style.match(/font-size\s*:\s*(11|12|14|16|18|24|32)px/i),family=style.match(/font-family\s*:\s*([^;]+)/i),color=safeColor(style.match(/(?:^|;)\s*color\s*:\s*((?:#[0-9a-f]{6})|(?:rgba?\([^)]+\)))/i)?.[1]),bg=safeColor(style.match(/background-color\s*:\s*((?:#[0-9a-f]{6})|(?:rgba?\([^)]+\)))/i)?.[1])
      const weight=style.match(/font-weight\s*:\s*(bold|[5-9]00)/i)?.[1],fontStyle=style.match(/font-style\s*:\s*(italic)/i)?.[1],decoration=style.match(/text-decoration(?:-line)?\s*:\s*([^;]+)/i)?.[1]||''
      if(size)parts.push(`font-size:${size[1]}px`);if(family){const face=family[1].replace(/["']/g,'').trim();if(allowedFonts.has(face))parts.push(`font-family:${face}`)}if(color)parts.push(`color:${color}`);if(bg)parts.push(`background-color:${bg}`);if(weight)parts.push(`font-weight:${weight.toLowerCase()}`);if(fontStyle)parts.push('font-style:italic');if(/underline/i.test(decoration))parts.push('text-decoration:underline');if(/line-through/i.test(decoration))parts.push('text-decoration:line-through')
    }
    if(parts.length)child.setAttribute('style',parts.join(';'))
    walk(child)
  })}
  walk(root)
  return root.innerHTML
}
function escapeKnowledgeText(value){return String(value||'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]||ch)).replace(/\n/g,'<br>')}
function stripKnowledgeHtml(value){
  const raw=String(value||'')
  if(typeof document==='undefined')return raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  const div=document.createElement('div');div.innerHTML=sanitizeKnowledgeHtml(raw);return (div.textContent||'').replace(/\s+/g,' ').trim()
}
function normalizeKnowledgeBlockRuntime(block){
  const b={...(block||{})},type=String(b.type||'richtext').toLowerCase(),id=b.id||knowledgeBlockId()
  if(type==='paragraph'||type==='text')return {id,type:'richtext',html:b.html||`<p>${escapeKnowledgeText(b.text||'')}</p>`,line_height:String(b.line_height||'1.5')}
  if(type==='richtext')return {id,type,html:sanitizeKnowledgeHtml(b.html||'<p></p>'),line_height:String(b.line_height||'1.5')}
  if(type==='heading')return {id,type:'heading2',text:String(b.text||'')}
  if(['heading1','heading2','heading3','heading4','heading5'].includes(type))return {id,type,text:String(b.text||'')}
  if(type==='list')return {id,type,text:String(b.text||''),list_style:b.list_style==='ordered'?'ordered':'unordered'}
  if(type==='quote')return {id,type,text:String(b.text||''),author:String(b.author||'')}
  if(type==='callout')return {id,type,text:String(b.text||''),title:String(b.title||''),tone:['info','success','warning','danger'].includes(b.tone)?b.tone:'info'}
  if(type==='code')return {id,type,text:String(b.text||''),language:String(b.language||'text')}
  if(type==='image')return {id,type,media_id:b.media_id||null,alt:String(b.alt||''),caption:String(b.caption||''),align:['left','center','right','wide'].includes(b.align)?b.align:'center',pending_file:b.pending_file||null}
  if(type==='video')return {id,type,url:String(b.url||''),caption:String(b.caption||'')}
  if(type==='cover')return {id,type,template:['forest','ivory','midnight'].includes(b.template)?b.template:'forest',eyebrow:String(b.eyebrow||'TROBBU · KNOWLEDGE'),title:String(b.title||''),subtitle:String(b.subtitle||''),meta:String(b.meta||'Documento interno'),show_logo:b.show_logo!==false,page_break:b.page_break!==false}
  if(['divider','pagebreak'].includes(type))return {id,type}
  return {id,type:'richtext',html:`<p>${escapeKnowledgeText(b.text||'')}</p>`,line_height:'1.5'}
}
function knowledgeDefaultBlocks(article){
  const blocks=Array.isArray(article?.content_blocks)?article.content_blocks:[]
  if(blocks.length)return blocks.map(normalizeKnowledgeBlockRuntime)
  if(article?.content)return [{id:knowledgeBlockId(),type:'richtext',html:`<p>${escapeKnowledgeText(String(article.content))}</p>`,line_height:'1.5'}]
  return [{id:knowledgeBlockId(),type:'richtext',html:'<p></p>',line_height:'1.5'}]
}
function knowledgePlainText(blocks){
  return (blocks||[]).map(raw=>{const b=normalizeKnowledgeBlockRuntime(raw)
    if(['heading1','heading2','heading3','heading4','heading5','quote','callout','code'].includes(b.type))return String(b.text||'')
    if(b.type==='richtext')return stripKnowledgeHtml(b.html||'')
    if(b.type==='list')return String(b.text||'').split('\n').filter(Boolean).map(x=>`${b.list_style==='ordered'?'#':'•'} ${x}`).join('\n')
    if(b.type==='image')return [b.alt,b.caption].filter(Boolean).join(' ')
    if(b.type==='video')return [b.caption,b.url].filter(Boolean).join(' ')
    if(b.type==='cover')return [b.eyebrow,b.title,b.subtitle,b.meta].filter(Boolean).join(' ')
    return ''
  }).filter(Boolean).join('\n\n').trim()
}
function normalizeKnowledgeBlocks(blocks){
  return (blocks||[]).map(raw=>{const b=normalizeKnowledgeBlockRuntime(raw),base={id:b.id||knowledgeBlockId(),type:b.type}
    if(b.type==='richtext')return {...base,html:sanitizeKnowledgeHtml(b.html||''),line_height:['1','1.15','1.3','1.5','1.75','2'].includes(String(b.line_height))?String(b.line_height):'1.5'}
    if(['heading1','heading2','heading3','heading4','heading5'].includes(b.type))return {...base,text:String(b.text||'')}
    if(b.type==='list')return {...base,text:String(b.text||''),list_style:b.list_style==='ordered'?'ordered':'unordered'}
    if(b.type==='quote')return {...base,text:String(b.text||''),author:String(b.author||'')}
    if(b.type==='callout')return {...base,text:String(b.text||''),title:String(b.title||''),tone:['info','success','warning','danger'].includes(b.tone)?b.tone:'info'}
    if(b.type==='code')return {...base,text:String(b.text||''),language:String(b.language||'text').slice(0,30)}
    if(b.type==='image')return {...base,media_id:b.media_id||null,alt:String(b.alt||''),caption:String(b.caption||''),align:['left','center','right','wide'].includes(b.align)?b.align:'center'}
    if(b.type==='video')return {...base,url:String(b.url||''),caption:String(b.caption||'')}
    if(b.type==='cover')return {...base,template:['forest','ivory','midnight'].includes(b.template)?b.template:'forest',eyebrow:String(b.eyebrow||'TROBBU · KNOWLEDGE').slice(0,80),title:String(b.title||'').slice(0,180),subtitle:String(b.subtitle||'').slice(0,360),meta:String(b.meta||'Documento interno').slice(0,140),show_logo:b.show_logo!==false,page_break:b.page_break!==false}
    if(['divider','pagebreak'].includes(b.type))return base
    return {...base,type:'richtext',html:`<p>${escapeKnowledgeText(b.text||'')}</p>`,line_height:'1.5'}
  })
}
function knowledgeEditorSnapshot(form,changeNote,blocks){
  const pending=(blocks||[]).map(raw=>{const b=normalizeKnowledgeBlockRuntime(raw),file=b.pending_file;return b.type==='image'&&file?{id:b.id,name:file.name||'',size:Number(file.size)||0,lastModified:Number(file.lastModified)||0}:null}).filter(Boolean)
  return JSON.stringify({form:{title:form?.title||'',slug:form?.slug||'',summary:form?.summary||'',tags:form?.tags||'',product_id:form?.product_id||'',module_id:form?.module_id||'',category_id:form?.category_id||'',source_language:form?.source_language||'es'},change_note:changeNote||'',blocks:normalizeKnowledgeBlocks(blocks||[]),pending})
}

async function signedKnowledgeMedia(rows){
  return Promise.all((rows||[]).map(async row=>{
    const {data,error}=await db.storage.from('jira-evidence').createSignedUrl(row.storage_path,3600)
    return {...row,signed_url:error?null:data?.signedUrl||null}
  }))
}
async function uploadKnowledgeImage({workspaceId,articleId,userId,file}){
  const processed=await compressEvidenceImage(file)
  const image=processed.file
  if(image.size>10*1024*1024)throw new Error('La imagen procesada supera el máximo de 10 MB.')
  const path=`${workspaceId}/knowledge/${articleId}/${crypto.randomUUID()}-${safeFileName(image.name)}`
  const url=URL.createObjectURL(image)
  let width=null,height=null
  try{
    try{
      const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=url})
      width=img.naturalWidth||img.width||null;height=img.naturalHeight||img.height||null
    }catch{}
  }finally{URL.revokeObjectURL(url)}
  const {error:upErr}=await db.storage.from('jira-evidence').upload(path,image,{contentType:image.type,upsert:false,cacheControl:'3600'})
  if(upErr)throw upErr
  const {data,error}=await db.from('knowledge_media').insert({
    workspace_id:workspaceId,article_id:articleId,uploaded_by:userId,storage_path:path,file_name:image.name,
    mime_type:image.type,size_bytes:image.size,original_size_bytes:processed.originalSize,width,height
  }).select('*').single()
  if(error){await db.storage.from('jira-evidence').remove([path]);throw error}
  return {...data,compression_saved_bytes:Math.max(0,processed.originalSize-image.size)}
}
async function deleteKnowledgeMediaRows(rows){
  const list=(rows||[]).filter(Boolean)
  const paths=list.map(x=>x.storage_path).filter(Boolean)
  if(paths.length)await db.storage.from('jira-evidence').remove(paths)
  const ids=list.map(x=>x.id).filter(Boolean)
  if(ids.length)await db.from('knowledge_media').delete().in('id',ids)
}
function knowledgeVideoEmbed(url){
  const raw=String(url||'').trim();if(!raw)return null
  try{
    const u=new URL(raw)
    if(u.hostname.includes('youtube.com')){const id=u.searchParams.get('v');return id?`https://www.youtube.com/embed/${id}`:null}
    if(u.hostname==='youtu.be'){const id=u.pathname.replace('/','');return id?`https://www.youtube.com/embed/${id}`:null}
    if(u.hostname.includes('vimeo.com')){const id=u.pathname.split('/').filter(Boolean).pop();return id?`https://player.vimeo.com/video/${id}`:null}
  }catch{}
  return null
}

async function functionErrorMessage(error,data){
  if(data?.error)return data.error
  if(error?.context){
    try{const payload=await error.context.clone().json();if(payload?.error)return payload.error}catch{}
    try{const text=await error.context.clone().text();if(text)return text}catch{}
  }
  return error?.message||'La función no pudo completar la operación.'
}

function useSession(){
  const [session,setSession]=useState(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    db.auth.getSession().then(({data})=>{setSession(data.session); if(data.session) cleanupAuthUrl(); setLoading(false)})
    const {data:{subscription}}=db.auth.onAuthStateChange((event,s)=>{setSession(s); if(s && ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) cleanupAuthUrl()})
    return ()=>subscription.unsubscribe()
  },[])
  return {session,loading}
}

function Auth(){
  const [mode,setMode]=useState('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [name,setName]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [showConfirm,setShowConfirm]=useState(false)
  const [msg,setMsg]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const signup=mode==='signup'
  const changeMode=next=>{setMode(next);setMsg('');setPassword('');setConfirmPassword('');setShowPassword(false);setShowConfirm(false)}
  const submit=async e=>{
    e.preventDefault();setSubmitting(true);setMsg('')
    try{
      if(signup&&password!==confirmPassword)throw new Error('Las contraseñas no coinciden.')
      const result=signup
        ? await db.auth.signUp({email,password,options:{data:{full_name:name.trim()},emailRedirectTo:getAppUrl()}})
        : await db.auth.signInWithPassword({email,password})
      if(result.error)throw result.error
      setMsg(signup?'Cuenta creada. Revisa tu correo para confirmar el acceso.':'Acceso correcto.')
    }catch(err){setMsg(err.message||String(err))}
    finally{setSubmitting(false)}
  }
  return <div className="auth-shell">
    <div className="auth-visual-copy" aria-hidden="true">
      <span className="auth-collection">TROBBU</span>
      <small>BOUTIQUE COLLECTION</small>
    </div>
    <div className={`auth-card luxury-auth-card ${signup?'signup':''}`}>
      <div className="auth-brand">
        <img src="./logo.svg" className="auth-logo" alt="TROBBU"/>
        <div className="auth-eyebrow-row"><i></i><span>JIRA INTERNO</span><i></i></div>
        <h1>{signup?'Crea tu cuenta':'Bienvenido de nuevo'}</h1>
        <p>{signup?'Solicita acceso para colaborar en tickets, sprints, QA y Helpdesk del equipo.':'Gestión de tickets, sprints, QA, Helpdesk y operación del equipo.'}</p>
      </div>
      <form onSubmit={submit} className="form auth-form">
        {signup&&<label>Nombre completo<div className="auth-input"><Icon name="lucide:user" size={18}/><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Gustavo A. Mendoza" autoComplete="name"/></div></label>}
        <label>Correo<div className="auth-input"><Icon name="lucide:mail" size={18}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="Ej. usuario@trobbu.com"/></div></label>
        <label>Contraseña<div className="auth-input"><Icon name="lucide:lock-keyhole" size={18}/><input type={showPassword?'text':'password'} autoComplete={signup?'new-password':'current-password'} minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres"/><button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}><Icon name={showPassword?'lucide:eye-off':'lucide:eye'} size={18}/></button></div></label>
        {signup&&<label>Confirmar contraseña<div className="auth-input"><Icon name="lucide:lock-keyhole" size={18}/><input type={showConfirm?'text':'password'} autoComplete="new-password" minLength="6" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required placeholder="Repite tu contraseña"/><button type="button" className="auth-eye" onClick={()=>setShowConfirm(v=>!v)} aria-label={showConfirm?'Ocultar contraseña':'Mostrar contraseña'}><Icon name={showConfirm?'lucide:eye-off':'lucide:eye'} size={18}/></button></div></label>}
        {signup&&<p className="auth-legal">Al continuar aceptas las políticas internas de acceso y uso de la plataforma.</p>}
        <button type="submit" className="primary full auth-submit" disabled={submitting}>{submitting?'Procesando…':signup?'Crear cuenta':'Iniciar sesión'}<Icon name="lucide:arrow-right" size={18}/></button>
      </form>
      <div className="auth-divider"><i></i><Icon name="lucide:sun-medium" size={18}/><i></i></div>
      <button type="button" className="auth-switch" onClick={()=>changeMode(signup?'login':'signup')}>{signup?'Ya tengo una cuenta':'Crear una cuenta'}</button>
      {msg&&<div className="notice auth-message">{msg}</div>}
    </div>
  </div>
}
function App(){
  const {session,loading}=useSession()
  const [locale,setLocale]=useState(()=>localStorage.getItem('jira_locale')||'es')
  const [theme,setThemeState]=useState(()=>localStorage.getItem('jira_theme')||'light')
  useDomI18n(locale)
  const applyTheme=next=>{const value=next==='dark'?'dark':'light';localStorage.setItem('jira_theme',value);document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=value;setThemeState(value);return value}
  const changeTheme=next=>{const value=applyTheme(next);if(session?.user?.id)db.from('profiles').update({theme_preference:value,updated_at:new Date().toISOString()}).eq('id',session.user.id).then(()=>{})}
  const changeLocale=next=>{const value=next==='en'?'en':'es';localStorage.setItem('jira_locale',value);setLocale(value);if(session?.user?.id)db.from('profiles').update({locale:value,updated_at:new Date().toISOString()}).eq('id',session.user.id).then(()=>{})}
  useEffect(()=>{applyTheme(theme)},[])
  useEffect(()=>{if(!session?.user?.id)return;let cancelled=false;(async()=>{const {data}=await db.from('profiles').select('locale,theme_preference').eq('id',session.user.id).maybeSingle();if(cancelled||!data)return;if(data.locale&&data.locale!==locale){localStorage.setItem('jira_locale',data.locale);setLocale(data.locale)}if(data.theme_preference&&data.theme_preference!==theme)applyTheme(data.theme_preference)})();return()=>{cancelled=true}},[session?.user?.id])
  if(loading) return <div className="center loading-screen"><span className="loader"></span><span>Cargando Jira Interno…</span></div>
  if(!session) return <><div className="auth-preferences"><ThemeToggle theme={theme} setTheme={changeTheme} compact/><select value={locale} onChange={e=>changeLocale(e.target.value)} aria-label="Idioma / Language"><option value="es">ES</option><option value="en">EN</option></select></div><Auth /></>
  return <WorkspaceApp session={session} locale={locale} setLocale={changeLocale} theme={theme} setTheme={changeTheme}/>
}

function WorkspaceApp({session,locale,setLocale,theme='light',setTheme}){
  const [memberships,setMemberships]=useState([])
  const [workspace,setWorkspace]=useState(null)
  const [products,setProducts]=useState([])
  const [sprints,setSprints]=useState([])
  const [tickets,setTickets]=useState([])
  const [members,setMembers]=useState([])
  const [memberProductAccess,setMemberProductAccess]=useState([])
  const [roleTemplates,setRoleTemplates]=useState([])
  const [settings,setSettings]=useState(null)
  const [departments,setDepartments]=useState([])
  const [requestTypes,setRequestTypes]=useState([])
  const [helpdesk,setHelpdesk]=useState([])
  const [helpdeskProducts,setHelpdeskProducts]=useState([])
  const [notifications,setNotifications]=useState([])
  const [emailQueue,setEmailQueue]=useState([])
  const [emailProviderStatus,setEmailProviderStatus]=useState(null)
  const [modules,setModules]=useState([])
  const [moduleStats,setModuleStats]=useState([])
  const [tags,setTags]=useState([])
  const [ticketTagLinks,setTicketTagLinks]=useState([])
  const [ticketLinks,setTicketLinks]=useState([])
  const [customFields,setCustomFields]=useState([])
  const [customFieldProducts,setCustomFieldProducts]=useState([])
  const [customValues,setCustomValues]=useState([])
  const [knowledgeArticles,setKnowledgeArticles]=useState([])
  const [knowledgeVersions,setKnowledgeVersions]=useState([])
  const [knowledgeVersionEvents,setKnowledgeVersionEvents]=useState([])
  const [knowledgeCategories,setKnowledgeCategories]=useState([])
  const [vacationRequests,setVacationRequests]=useState([])
  const [knowledgeScreen,setKnowledgeScreen]=useState(null)
  const [view,setView]=useState(()=>{try{return new URL(window.location.href).searchParams.get('view')||'board'}catch{return 'board'}})
  const [boardMode,setBoardMode]=useState(()=>{try{const mode=new URL(window.location.href).searchParams.get('mode');return ['table','kanban','calendar','gantt'].includes(mode)?mode:'table'}catch{return 'table'}})
  const [productId,setProductId]=useState('all')
  const [search,setSearch]=useState('')
  const [filters,setFilters]=useState({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})
  const [helpFilters,setHelpFilters]=useState({status:'all',requestType:'all',department:'all',product:'all',assignee:'all',priority:'all',quick:'all'})
  const [helpdeskAutoAssigning,setHelpdeskAutoAssigning]=useState(false)
  const [busy,setBusy]=useState(true)
  const [accessReady,setAccessReady]=useState(false)
  const [workspaceLoadError,setWorkspaceLoadError]=useState('')
  const [navCounts,setNavCounts]=useState(null)
  const [liveCounters,setLiveCounters]=useState(null)
  const [modal,setModal]=useState(null)
  const [drawer,setDrawer]=useState(null)
  const [toast,setToast]=useState(null)
  const [liveStatus,setLiveStatus]=useState('connecting')
  const [liveRevision,setLiveRevision]=useState({tickets:0,sprints:0,helpdesk:0,knowledge:0,vacations:0,staff:0,settings:0,notifications:0})
  const workspaceRef=useRef(workspace)
  const workspaceLoadSeqRef=useRef(0)
  const liveLastSyncRef=useRef(0)
  const liveRefreshTimerRef=useRef(null)
  const liveDerivedTimerRef=useRef(null)
  useEffect(()=>{workspaceRef.current=workspace},[workspace?.id])

  const showToast=(type,message)=>{setToast({type,message,id:Date.now()}); setTimeout(()=>setToast(null),3500)}
  const bumpLiveRevision=domain=>setLiveRevision(prev=>({...prev,[domain]:(prev[domain]||0)+1}))
  const liveSorters={
    tickets:(a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')),
    sprints:(a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')),
    products:(a,b)=>Number(a.board_order||0)-Number(b.board_order||0)||String(a.name||'').localeCompare(String(b.name||'')),
    helpdesk:(a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')),
    notifications:(a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')),
    modules:(a,b)=>String(a.name||'').localeCompare(String(b.name||'')),
    tags:(a,b)=>String(a.name||'').localeCompare(String(b.name||'')),
    knowledgeArticles:(a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')),
    knowledgeVersions:(a,b)=>Number(b.version_number||0)-Number(a.version_number||0),
    knowledgeEvents:(a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')),
    knowledgeCategories:(a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||'')),
    vacationRequests:(a,b)=>String(a.start_date||'').localeCompare(String(b.start_date||'')),
    departments:(a,b)=>String(a.name||'').localeCompare(String(b.name||'')),
    requestTypes:(a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||''))
  }
  const reconcileLiveArray=(setter,payload,sorter=null,keyOf=row=>row?.id)=>{
    const event=payload?.eventType||payload?.type
    const incoming=event==='DELETE'?(payload?.old||{}):(payload?.new||{})
    const key=keyOf(incoming)
    if(key===undefined||key===null)return
    setter(prev=>{
      const current=Array.isArray(prev)?prev:[]
      if(event==='DELETE')return current.filter(row=>keyOf(row)!==key)
      const index=current.findIndex(row=>keyOf(row)===key)
      const next=index>=0?current.map((row,i)=>i===index?{...row,...incoming}:row):[incoming,...current]
      return sorter?[...next].sort(sorter):next
    })
  }
  const runWithKnowledgeGuard=action=>{const guard=window.__jiraKnowledgeEditorGuard;if(guard?.isDirty?.()){guard.requestExit(action);return false}action();return true}
  const writeViewUrl=(next,{replace=false,keepTab=false}={})=>{try{const url=new URL(window.location.href);url.searchParams.set('view',next);if(!keepTab)url.searchParams.delete('tab');if(!['board','mytasks'].includes(next))url.searchParams.delete('mode');const method=replace?'replaceState':'pushState';window.history[method]({view:next},document.title,url.toString())}catch{}}
  const navigateView=next=>runWithKnowledgeGuard(()=>{writeViewUrl(next);setView(next)})
  useEffect(()=>{if(view!=='knowledge')setKnowledgeScreen(null)},[view])
  useEffect(()=>{if(!workspace?.id)return;try{const url=new URL(window.location.href);let changed=false;if(url.searchParams.get('view')!==view){url.searchParams.set('view',view);changed=true}if(!['team','settings','vacations'].includes(view)&&url.searchParams.has('tab')){url.searchParams.delete('tab');changed=true}if(!['board','mytasks'].includes(view)&&url.searchParams.has('mode')){url.searchParams.delete('mode');changed=true}if(changed)window.history.replaceState({view},document.title,url.toString())}catch{}},[view,workspace?.id])
  useEffect(()=>{if(!workspace?.id||!['board','mytasks'].includes(view))return;try{const url=new URL(window.location.href);if(url.searchParams.get('mode')!==boardMode){url.searchParams.set('mode',boardMode);window.history.replaceState({view,mode:boardMode},document.title,url.toString())}}catch{}},[boardMode,view,workspace?.id])
  useEffect(()=>{const onPop=()=>{try{const url=new URL(window.location.href),next=url.searchParams.get('view')||'board',mode=url.searchParams.get('mode');runWithKnowledgeGuard(()=>{setView(next);setBoardMode(['table','kanban','calendar','gantt'].includes(mode||'')?mode:'table')})}catch{}};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[])
  useEffect(()=>{const id=new URL(window.location.href).searchParams.get('knowledge');if(!id||!knowledgeArticles.length)return;const article=knowledgeArticles.find(a=>a.id===id);if(article){setView('knowledge');setKnowledgeScreen({mode:'read',article})}},[knowledgeArticles.length,workspace?.id])
  useEffect(()=>{const url=new URL(window.location.href);const ticketId=url.searchParams.get('ticket'),helpId=url.searchParams.get('helpdesk'),sprintId=url.searchParams.get('sprint');let handled=false;if(ticketId&&tickets.length){const t=tickets.find(x=>x.id===ticketId);if(t){setModal({type:'ticket-detail',ticket:t});url.searchParams.delete('ticket');handled=true}}else if(helpId&&helpdesk.length){const h=helpdesk.find(x=>x.id===helpId);if(h){setView('helpdesk');setModal({type:'help-detail',item:h});url.searchParams.delete('helpdesk');handled=true}}else if(sprintId&&sprints.length){const sp=sprints.find(x=>x.id===sprintId);if(sp){setModal({type:'sprint-detail',sprint:sp});url.searchParams.delete('sprint');handled=true}}if(handled)window.history.replaceState({},document.title,url.toString())},[tickets.length,helpdesk.length,sprints.length,workspace?.id])

  useEffect(()=>{
    setModal(current=>{
      if(!current)return current
      if(current.ticket?.id){
        const fresh=tickets.find(row=>row.id===current.ticket.id)
        if(fresh&&fresh!==current.ticket)return {...current,ticket:fresh}
      }
      if(current.item?.id){
        const fresh=helpdesk.find(row=>row.id===current.item.id)
        if(fresh&&fresh!==current.item)return {...current,item:fresh}
      }
      if(current.sprint?.id){
        const fresh=sprints.find(row=>row.id===current.sprint.id)
        if(fresh&&fresh!==current.sprint)return {...current,sprint:fresh}
      }
      return current
    })
  },[tickets,helpdesk,sprints])
  useEffect(()=>{
    if(!knowledgeScreen?.article?.id||knowledgeScreen.mode==='edit')return
    const fresh=knowledgeArticles.find(row=>row.id===knowledgeScreen.article.id)
    const freshVersion=knowledgeScreen.mode==='preview'&&knowledgeScreen.version?.id?knowledgeVersions.find(row=>row.id===knowledgeScreen.version.id):null
    if((fresh&&fresh!==knowledgeScreen.article)||(freshVersion&&freshVersion!==knowledgeScreen.version))setKnowledgeScreen(current=>current?{...current,...(fresh?{article:fresh}:{}),...(freshVersion?{version:freshVersion}:{})}:current)
  },[knowledgeArticles,knowledgeVersions,knowledgeScreen?.article?.id,knowledgeScreen?.version?.id,knowledgeScreen?.mode])

  const loadMemberships=async(preferredId=null)=>{
    const {data,error}=await db.from('workspace_members').select('workspace_id,role,role_id,active,permissions,all_products,workspaces(id,name,slug,created_by)').eq('user_id',session.user.id).eq('active',true)
    if(error){showToast('error',error.message);setBusy(false);return []}
    const rows=data||[]; setMemberships(rows)
    const id=preferredId || workspace?.id
    const selected=rows.find(x=>x.workspace_id===id)?.workspaces || rows[0]?.workspaces || null
    setWorkspace(selected)
    return rows
  }

  const loadWorkspaceData=async(silent=false)=>{
    const workspaceId=workspace?.id
    if(!workspaceId){if(!silent)setBusy(false);return}
    const loadSeq=++workspaceLoadSeqRef.current
    if(!silent)setBusy(true)
    const [p,s,t,m,mp,wr,ws,d,rt,h,n,q,mods,tagsQ,tagLinks,links,fields,fieldProducts,values,ka,kv,ke,kc,vr,hp,lc]=await Promise.all([
      db.rpc('list_authorized_products',{p_workspace:workspaceId}),
      db.from('sprints').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      db.from('tickets').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
      db.from('workspace_members').select('user_id,role,role_id,active,joined_at,permissions,all_products,helpdesk_routing_description,helpdesk_auto_assign_enabled,helpdesk_daily_limit,helpdesk_active_limit,helpdesk_overflow_mode,helpdesk_overflow_user_id').eq('workspace_id',workspaceId).order('joined_at'),
      db.from('workspace_member_products').select('user_id,product_id').eq('workspace_id',workspaceId),
      db.from('workspace_roles').select('*').eq('workspace_id',workspaceId).order('created_at'),
      db.from('workspace_settings').select('*').eq('workspace_id',workspaceId).maybeSingle(),
      db.from('helpdesk_departments').select('*').eq('workspace_id',workspaceId).order('name'),
      db.from('helpdesk_request_types').select('*').eq('workspace_id',workspaceId).order('sort_order').order('name'),
      db.from('helpdesk_tickets').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
      db.from('notifications').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      db.from('notification_outbox').select('id,event_type,status,attempts,last_error,created_at,sent_at,recipient_user_id').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100),
      db.from('ticket_modules').select('*').eq('workspace_id',workspaceId).order('name'),
      db.from('ticket_tags').select('*').eq('workspace_id',workspaceId).order('name'),
      db.from('ticket_tag_links').select('*').eq('workspace_id',workspaceId),
      db.from('ticket_links').select('*').eq('workspace_id',workspaceId).order('created_at'),
      db.from('custom_ticket_fields').select('*').eq('workspace_id',workspaceId).order('sort_order').order('name'),
      db.from('custom_ticket_field_products').select('*').eq('workspace_id',workspaceId),
      db.from('ticket_custom_field_values').select('*').eq('workspace_id',workspaceId),
      db.from('knowledge_articles').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
      db.from('knowledge_article_versions').select('*').eq('workspace_id',workspaceId).order('version_number',{ascending:false}),
      db.from('knowledge_version_events').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      db.from('knowledge_categories').select('*').eq('workspace_id',workspaceId).eq('active',true).order('sort_order').order('name'),
      db.from('vacation_requests').select('*').eq('workspace_id',workspaceId).order('start_date',{ascending:true}),
      db.rpc('list_helpdesk_products',{p_workspace:workspaceId}),
      db.rpc('get_live_counters',{p_workspace:workspaceId})
    ])

    if(loadSeq!==workspaceLoadSeqRef.current||workspaceRef.current?.id!==workspaceId){if(!silent)setBusy(false);return}
    const permissionError=wr.error||ws.error
    if(permissionError){
      if(silent){console.warn('No se pudo revalidar el acceso del workspace:',permissionError.message);return}
      setWorkspaceLoadError(permissionError.message||'No se pudo validar el acceso al workspace.')
      setAccessReady(false)
      setBusy(false)
      return
    }
    const initial=result=>result?.error?[]:(result?.data||[])
    const row=result=>result?.error?null:(result?.data||null)
    const apply=(result,setter,fallback=[])=>{if(result?.error){if(!silent)setter(fallback)}else setter(result?.data??fallback)}
    const ids=initial(m).map(x=>x.user_id)
    const profileMap={}
    if(ids.length){
      const pr=await db.from('profiles').select('*').in('id',ids)
      if(!pr.error)(pr.data||[]).forEach(x=>profileMap[x.id]=x)
    }
    if(loadSeq!==workspaceLoadSeqRef.current||workspaceRef.current?.id!==workspaceId){if(!silent)setBusy(false);return}
    const roles=initial(wr)
    apply(p,setProducts,[]);apply(s,setSprints,[]);apply(t,setTickets,[]);setRoleTemplates(roles);setSettings(row(ws))
    apply(d,setDepartments,[]);apply(rt,setRequestTypes,[]);apply(h,setHelpdesk,[]);apply(hp,setHelpdeskProducts,[]);apply(n,setNotifications,[]);apply(q,setEmailQueue,[]);apply(mp,setMemberProductAccess,[])
    apply(mods,setModules,[]);if(!lc.error)setModuleStats(lc.data?.modules||[]);else if(!silent)setModuleStats([]);apply(tagsQ,setTags,[]);apply(tagLinks,setTicketTagLinks,[]);apply(links,setTicketLinks,[]);apply(fields,setCustomFields,[]);apply(fieldProducts,setCustomFieldProducts,[]);apply(values,setCustomValues,[]);apply(ka,setKnowledgeArticles,[]);apply(kv,setKnowledgeVersions,[]);apply(ke,setKnowledgeVersionEvents,[]);apply(kc,setKnowledgeCategories,[]);apply(vr,setVacationRequests,[])
    if(!m.error)setMembers(initial(m).map(x=>({...x,profile:profileMap[x.user_id],role_template:roles.find(r=>r.id===x.role_id)||roles.find(r=>r.code===x.role),product_ids:initial(mp).filter(a=>a.user_id===x.user_id).map(a=>a.product_id)})))
    else if(!silent)setMembers([])
    if(!lc.error){setNavCounts(lc.data?.navigation||null);setLiveCounters(lc.data||null)}else if(!silent){setNavCounts(null);setLiveCounters(null)}

    const nonCritical=[p,s,t,m,mp,d,rt,h,n,q,mods,tagsQ,tagLinks,links,fields,fieldProducts,values,ka,kv,ke,kc,vr,hp,lc].filter(x=>x?.error)
    if(nonCritical.length&&!silent)console.warn('Carga parcial del workspace:',nonCritical.map(x=>x.error?.message).filter(Boolean))
    setWorkspaceLoadError('')
    setAccessReady(true)
    if(!silent)setBusy(false)
  }

  const myMembership=memberships.find(m=>m.workspace_id===workspace?.id)||null
  const myRole=myMembership?.role || 'consulta'
  const myRoleTemplate=roleTemplates.find(r=>r.id===myMembership?.role_id)||roleTemplates.find(r=>r.code===myRole)||null
  const myPermissions=effectivePermissions(myMembership,myRoleTemplate)
  const hasPermission=key=>myRole==='superadmin'||!!myPermissions[key]
  const isSuperadmin=myRole==='superadmin'
  const canViewDashboard=hasPermission('view_dashboard')
  const canViewTickets=hasPermission('view_tickets')
  const canCreateTicket=hasPermission('create_tickets')
  const canWork=hasPermission('edit_tickets')
  const canDeleteTicket=hasPermission('delete_tickets')
  const canPlan=hasPermission('manage_sprints')
  const canManageHelpdesk=hasPermission('manage_helpdesk')
  const canManageStaff=hasPermission('manage_staff')
  const canManageProducts=hasPermission('manage_products')
  const canManageSettings=hasPermission('manage_settings')
  const canManageTicketFields=hasPermission('manage_ticket_fields')
  const canViewKnowledge=hasPermission('view_knowledge')
  const canCreateKnowledge=hasPermission('create_knowledge')
  const canEditKnowledge=hasPermission('edit_knowledge')
  const canDeleteKnowledge=hasPermission('delete_knowledge')
  const canViewVacations=hasPermission('view_vacations')
  const canRequestVacations=hasPermission('request_vacations')
  const canViewVacationProjection=hasPermission('view_vacation_projection')
  const canManageVacations=hasPermission('manage_vacations')
  const canAdminWorkspace=canManageStaff||canManageProducts||canManageSettings
  const dashboardOnly=!canWork
  const helpdeskStaff=canManageHelpdesk
  const canManage=canPlan
  const isAdmin=canAdminWorkspace
  const helpdeskEnabled=settings?.helpdesk_enabled!==false
  const helpdeskOnly=helpdeskEnabled && roleIsHelpdeskRequester(myRoleTemplate)
  const myRoleName=myRoleTemplate?.name||ROLE_LABELS[myRole]||myRole
  const canCreateWorkspace=memberships.some(m=>['admin','pm','superadmin'].includes(String(m.role||'')))
  const workspaces=memberships.map(m=>({...m.workspaces,role:m.role,role_id:m.role_id})).filter(Boolean)
  const unread=notifications.filter(n=>!n.read_at).length
  const currentDateKey=dateKeyAtZone(new Date(),settings?.timezone||'America/Merida')
  const outTodayPeople=canViewVacations?vacationRequests.filter(r=>r.status==='approved'&&vacationOccursOn(r,currentDateKey)).map(r=>({id:r.user_id,name:members.find(m=>m.user_id===r.user_id)?.profile?.full_name||members.find(m=>m.user_id===r.user_id)?.profile?.email||'Colaborador'})):[]

  useEffect(()=>{loadMemberships().then(rows=>{if(!rows.length){setBusy(false);setAccessReady(true)}})},[])
  useEffect(()=>{
    if(!workspace?.id)return
    setAccessReady(false);setWorkspaceLoadError('');setNavCounts(null);setLiveCounters(null);setBusy(true)
    setProducts([]);setSprints([]);setTickets([]);setMembers([]);setMemberProductAccess([]);setRoleTemplates([]);setSettings(null);setDepartments([]);setRequestTypes([]);setHelpdesk([]);setHelpdeskProducts([]);setNotifications([]);setEmailQueue([]);setModules([]);setModuleStats([]);setTags([]);setTicketTagLinks([]);setTicketLinks([]);setCustomFields([]);setCustomFieldProducts([]);setCustomValues([]);setKnowledgeArticles([]);setKnowledgeVersions([]);setKnowledgeVersionEvents([]);setKnowledgeCategories([]);setVacationRequests([])
    loadWorkspaceData()
  },[workspace?.id])
  useEffect(()=>{
    if(!workspace?.id) return
    setProductId('all')
    setSearch('')
    setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})
    setHelpFilters({status:'all',requestType:'all',department:'all',product:'all',assignee:'all',priority:'all',quick:'all'})
    setDrawer(null)
    setModal(null)
  },[workspace?.id])
  useEffect(()=>{
    if(!workspace?.id)return
    const workspaceId=workspace.id
    setLiveStatus('connecting')
    liveLastSyncRef.current=Date.now()
    let realtimeHealthy=false,realtimeWarned=false,disposed=false,subscribedOnce=false
    const scheduleRevalidate=(delay=320)=>{
      clearTimeout(liveRefreshTimerRef.current)
      liveRefreshTimerRef.current=setTimeout(async()=>{
        if(disposed||workspaceRef.current?.id!==workspaceId)return
        await loadWorkspaceData(true)
        liveLastSyncRef.current=Date.now()
      },delay)
    }
    const scheduleDerived=(delay=180)=>{
      clearTimeout(liveDerivedTimerRef.current)
      liveDerivedTimerRef.current=setTimeout(async()=>{
        if(disposed||workspaceRef.current?.id!==workspaceId)return
        const snapshot=await db.rpc('get_live_counters',{p_workspace:workspaceId})
        if(disposed||workspaceRef.current?.id!==workspaceId)return
        if(!snapshot.error){
          setModuleStats(snapshot.data?.modules||[])
          setNavCounts(snapshot.data?.navigation||null)
          setLiveCounters(snapshot.data||null)
        }
      },delay)
    }
    const fullRevalidateTables=new Set(['workspace_members','workspace_member_products','workspace_roles','profiles','products','workspaces'])
    const patch=(table,payload)=>{
      if(disposed||workspaceRef.current?.id!==workspaceId)return
      liveLastSyncRef.current=Date.now()
      if(table==='tickets'){reconcileLiveArray(setTickets,payload,liveSorters.tickets);bumpLiveRevision('tickets')}
      else if(table==='sprints'){reconcileLiveArray(setSprints,payload,liveSorters.sprints);bumpLiveRevision('sprints')}
      else if(table==='products')reconcileLiveArray(setProducts,payload,liveSorters.products)
      else if(table==='ticket_modules')reconcileLiveArray(setModules,payload,liveSorters.modules)
      else if(table==='ticket_tags')reconcileLiveArray(setTags,payload,liveSorters.tags)
      else if(table==='ticket_tag_links')reconcileLiveArray(setTicketTagLinks,payload,null,row=>`${row?.ticket_id||''}:${row?.tag_id||''}`)
      else if(table==='ticket_links')reconcileLiveArray(setTicketLinks,payload)
      else if(table==='custom_ticket_fields')reconcileLiveArray(setCustomFields,payload,(a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||'')))
      else if(table==='custom_ticket_field_products')reconcileLiveArray(setCustomFieldProducts,payload,null,row=>`${row?.field_id||''}:${row?.product_id||''}`)
      else if(table==='ticket_custom_field_values')reconcileLiveArray(setCustomValues,payload,null,row=>`${row?.ticket_id||''}:${row?.field_id||''}`)
      else if(table==='workspace_roles'){reconcileLiveArray(setRoleTemplates,payload,(a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));bumpLiveRevision('staff')}
      else if(table==='helpdesk_tickets'){reconcileLiveArray(setHelpdesk,payload,liveSorters.helpdesk);bumpLiveRevision('helpdesk')}
      else if(table==='notifications'){reconcileLiveArray(setNotifications,payload,liveSorters.notifications);bumpLiveRevision('notifications')}
      else if(table==='notification_outbox')reconcileLiveArray(setEmailQueue,payload,liveSorters.notifications)
      else if(table==='knowledge_articles'){reconcileLiveArray(setKnowledgeArticles,payload,liveSorters.knowledgeArticles);bumpLiveRevision('knowledge')}
      else if(table==='knowledge_article_versions'){reconcileLiveArray(setKnowledgeVersions,payload,liveSorters.knowledgeVersions);bumpLiveRevision('knowledge')}
      else if(table==='knowledge_version_events'){reconcileLiveArray(setKnowledgeVersionEvents,payload,liveSorters.knowledgeEvents);bumpLiveRevision('knowledge')}
      else if(table==='knowledge_categories'){reconcileLiveArray(setKnowledgeCategories,payload,liveSorters.knowledgeCategories);bumpLiveRevision('knowledge')}
      else if(table==='vacation_requests'){reconcileLiveArray(setVacationRequests,payload,liveSorters.vacationRequests);bumpLiveRevision('vacations')}
      else if(table==='workspace_settings'){
        const event=payload?.eventType||payload?.type
        if(event!=='DELETE'&&payload?.new)setSettings(prev=>({...prev,...payload.new}))
        bumpLiveRevision('settings')
      }
      else if(table==='helpdesk_departments'){reconcileLiveArray(setDepartments,payload,liveSorters.departments);bumpLiveRevision('settings')}
      else if(table==='helpdesk_request_types'){reconcileLiveArray(setRequestTypes,payload,liveSorters.requestTypes);bumpLiveRevision('settings')}
      else if(table==='workspaces'){
        const event=payload?.eventType||payload?.type
        if(event!=='DELETE'&&payload?.new?.id===workspaceId)setWorkspace(prev=>prev?{...prev,...payload.new}:payload.new)
        bumpLiveRevision('settings')
      }
      else if(['ticket_comments','ticket_activity','ticket_attachments'].includes(table))bumpLiveRevision('tickets')
      else if(['sprint_comments','sprint_attachments'].includes(table))bumpLiveRevision('sprints')
      else if(['helpdesk_comments','helpdesk_activity','helpdesk_attachments','helpdesk_assignment_queue','helpdesk_assignment_log'].includes(table))bumpLiveRevision('helpdesk')
      else if(['knowledge_media','knowledge_version_translations'].includes(table))bumpLiveRevision('knowledge')
      else if(['vacation_types','vacation_balances'].includes(table))bumpLiveRevision('vacations')
      else if(['workspace_members','workspace_member_products','profiles'].includes(table))bumpLiveRevision('staff')
      if(table==='workspace_members'){
        const changedUser=payload?.new?.user_id||payload?.old?.user_id
        if(changedUser===session.user.id)loadMemberships(workspaceId)
      }
      scheduleDerived()
      const eventType=payload?.eventType||payload?.type
      if(eventType==='DELETE')scheduleRevalidate(120)
      else if(fullRevalidateTables.has(table))scheduleRevalidate(260)
    }

    const scopedTables=['tickets','sprints','products','ticket_modules','ticket_tags','ticket_tag_links','ticket_links','ticket_attachments','sprint_attachments','workspace_members','workspace_member_products','workspace_roles','workspace_settings','helpdesk_departments','helpdesk_request_types','helpdesk_tickets','helpdesk_attachments','helpdesk_assignment_queue','helpdesk_assignment_log','notifications','notification_outbox','knowledge_articles','knowledge_media','knowledge_article_versions','knowledge_version_events','knowledge_version_translations','knowledge_categories','vacation_requests','vacation_types','vacation_balances','custom_ticket_fields','custom_ticket_field_products','ticket_custom_field_values']
    const relatedTables=['profiles','ticket_comments','ticket_activity','sprint_comments','helpdesk_comments','helpdesk_activity']
    let channel=db.channel(`workspace-live-v2-${workspaceId}`)
    scopedTables.forEach(table=>{channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`workspace_id=eq.${workspaceId}`},payload=>patch(table,payload))})
    relatedTables.forEach(table=>{channel=channel.on('postgres_changes',{event:'*',schema:'public',table},payload=>patch(table,payload))})
    channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'workspaces',filter:`id=eq.${workspaceId}`},payload=>patch('workspaces',payload))
    channel=channel.subscribe(status=>{
      if(disposed)return
      if(status==='SUBSCRIBED'){
        const recovering=subscribedOnce
        subscribedOnce=true
        realtimeHealthy=true;realtimeWarned=false;setLiveStatus('live')
        scheduleRevalidate(recovering?40:80)
        return
      }
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
        realtimeHealthy=false;setLiveStatus('degraded')
        if(!realtimeWarned){realtimeWarned=true;showToast('error','La sincronización Live perdió conexión; se activó la recuperación automática.')}
      }
    })
    const reconcilePrimaryRows=async()=>{
      if(disposed||document.visibilityState==='hidden'||workspaceRef.current?.id!==workspaceId)return
      const [t,s,h,vr,ka,kv,kc]=await Promise.all([
        db.from('tickets').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
        db.from('sprints').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
        db.from('helpdesk_tickets').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
        db.from('vacation_requests').select('*').eq('workspace_id',workspaceId).order('start_date',{ascending:true}),
        db.from('knowledge_articles').select('*').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}),
        db.from('knowledge_article_versions').select('*').eq('workspace_id',workspaceId).order('version_number',{ascending:false}),
        db.from('knowledge_categories').select('*').eq('workspace_id',workspaceId).eq('active',true).order('sort_order').order('name')
      ])
      if(disposed||workspaceRef.current?.id!==workspaceId)return
      if(!t.error)setTickets(t.data||[]);if(!s.error)setSprints(s.data||[]);if(!h.error)setHelpdesk(h.data||[]);if(!vr.error)setVacationRequests(vr.data||[]);if(!ka.error)setKnowledgeArticles(ka.data||[]);if(!kv.error)setKnowledgeVersions(kv.data||[]);if(!kc.error)setKnowledgeCategories(kc.data||[])
      liveLastSyncRef.current=Date.now();scheduleDerived(0)
    }
    const fallback=setInterval(()=>{if(!realtimeHealthy&&document.visibilityState==='visible')scheduleRevalidate(0)},15000)
    const counterReconcile=setInterval(()=>{if(document.visibilityState==='visible')scheduleDerived(0)},20000)
    const liveReconcile=setInterval(()=>{if(document.visibilityState==='visible')reconcilePrimaryRows()},60000)
    const resume=()=>{
      if(document.visibilityState&&document.visibilityState!=='visible')return
      const stale=Date.now()-liveLastSyncRef.current>5000
      if(stale)scheduleRevalidate(0)
    }
    window.addEventListener('focus',resume)
    window.addEventListener('online',resume)
    document.addEventListener('visibilitychange',resume)
    return ()=>{
      disposed=true
      clearTimeout(liveRefreshTimerRef.current)
      clearTimeout(liveDerivedTimerRef.current)
      clearInterval(fallback)
      clearInterval(counterReconcile)
      clearInterval(liveReconcile)
      window.removeEventListener('focus',resume)
      window.removeEventListener('online',resume)
      document.removeEventListener('visibilitychange',resume)
      db.removeChannel(channel)
    }
  },[workspace?.id,session.user.id])
  useEffect(()=>{
    if(!workspace?.id) return
    let cancelled=false
    db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id,status_only:true}}).then(({data,error})=>{if(!cancelled)setEmailProviderStatus(error?{configured:false,error:error.message}:data||null)}).catch(err=>{if(!cancelled)setEmailProviderStatus({configured:false,error:err.message||String(err)})})
    return ()=>{cancelled=true}
  },[workspace?.id,settings?.email_notifications])
  useEffect(()=>{if(settings?.helpdesk_enabled===false && view==='helpdesk')setView(canViewDashboard?'overview':'mytasks')},[settings?.helpdesk_enabled,view,canViewDashboard])
  useEffect(()=>{if(search.trim() && canViewTickets && !['board','mytasks'].includes(view))setView('board')},[search,canViewTickets])
  useEffect(()=>{
    if(!workspace?.id)return
    if(helpdeskOnly && !['helpdesk',...(canViewKnowledge?['knowledge']:[])].includes(view)){setView('helpdesk');return}
    if(!canViewDashboard && !['mytasks','helpdesk',...(canViewKnowledge?['knowledge']:[]),...(canViewVacations?['vacations']:[])].includes(view)) setView(helpdeskEnabled?'helpdesk':canViewKnowledge?'knowledge':canViewVacations?'vacations':'mytasks')
    if(canViewDashboard && !canWork && !['overview','board','backlog','timeline','helpdesk',...(canViewKnowledge?['knowledge']:[]),...(canViewVacations?['vacations']:[])].includes(view)) setView('overview')
    if(!canManageStaff && view==='team') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':'mytasks')
    if(!(canManageSettings||canManageProducts) && view==='settings') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':'mytasks')
    if(!canManageTicketFields && view==='catalogs') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':'mytasks')
    if(!canViewDashboard && view==='reports') setView(helpdeskEnabled?'helpdesk':'mytasks')
    if(!canViewKnowledge && view==='knowledge') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':canViewVacations?'vacations':'mytasks')
    if(!canViewVacations && view==='vacations') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':canViewKnowledge?'knowledge':'mytasks')
  },[workspace?.id,myRole,myRoleTemplate?.id,helpdeskOnly,helpdeskEnabled,canViewKnowledge,canViewVacations,canViewDashboard,canWork,canManageStaff,canManageSettings,canManageProducts,canManageTicketFields])
  useEffect(()=>{
    const onKey=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&canViewTickets){
        e.preventDefault()
        document.getElementById('global-ticket-search')?.focus()
      }
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[canViewTickets])

  const filteredTickets=useMemo(()=>tickets.filter(t=>{
    const q=search.trim().toLowerCase()
    return (productId==='all'||t.product_id===productId)
      && (filters.status==='all'||t.status===filters.status)
      && (filters.assignee==='all'||t.dev_owner_id===filters.assignee||t.qa_owner_id===filters.assignee)
      && (filters.sprint==='all'||t.sprint_id===filters.sprint)
      && (filters.priority==='all'||t.priority===filters.priority)
      && (filters.type==='all'||t.type===filters.type)
      && (filters.module==='all'||t.module_id===filters.module)
      && (filters.tag==='all'||ticketTagLinks.some(x=>x.ticket_id===t.id&&x.tag_id===filters.tag))
      && (!q||`${t.ticket_key||''} ${t.title||''} ${t.description||''} ${modules.find(m=>m.id===t.module_id)?.name||''} ${ticketTagLinks.filter(x=>x.ticket_id===t.id).map(x=>tags.find(tag=>tag.id===x.tag_id)?.name||'').join(' ')}`.toLowerCase().includes(q))
  }),[tickets,productId,filters,search,ticketTagLinks,tags,modules])

  const myTickets=useMemo(()=>filteredTickets.filter(t=>t.dev_owner_id===session.user.id||t.qa_owner_id===session.user.id||t.reporter_id===session.user.id),[filteredTickets,session.user.id])
  const filteredHelpdesk=useMemo(()=>{const rank={created:0,review:1,attended:2,closed:3};return helpdesk.filter(h=>helpdeskMatchesFilters(h,helpFilters,true)).sort((a,b)=>helpFilters.status==='all'?(rank[normalizeHelpdeskStatus(a.status)]??9)-(rank[normalizeHelpdeskStatus(b.status)]??9)||new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at):new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))},[helpdesk,helpFilters])

  const refresh=async()=>{await loadWorkspaceData()}
  const runEmails=()=>{if(settings?.email_notifications) db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id}}).catch(()=>{})}

  const createWorkspace=async({name})=>{
    if(!canCreateWorkspace)throw new Error('Solo Admin, PM o Superadmin pueden crear espacios de trabajo.')
    const base=slugify(name)||'workspace'; const slug=`${base}-${Math.random().toString(36).slice(2,6)}`
    const {data,error}=await db.rpc('create_workspace',{p_name:name,p_slug:slug})
    if(error) throw error
    await loadMemberships(data); showToast('success','Espacio de trabajo creado.')
  }

  const saveTicket=async(form,ticket=null)=>{
    if(ticket && !canWork) throw new Error('Tu rol no permite editar tickets.')
    const {tag_ids=[],custom_values={},attachment_files=[],...core}=form
    const sp=core.story_points===''||core.story_points==null?null:Number(core.story_points)
    if(sp!==null&&!STORY_POINTS.includes(sp)) throw new Error('Story Points debe ser un valor entre 1 y 5.')
    const productId=core.product_id
    const applicableFields=customFields.filter(cf=>cf.active&&(cf.applies_to_all_products||customFieldProducts.some(fp=>fp.field_id===cf.id&&fp.product_id===productId)))
    for(const field of applicableFields){
      const raw=custom_values[field.id],empty=raw===undefined||raw===null||raw===''||(Array.isArray(raw)&&raw.length===0)
      if(field.required&&empty) throw new Error(`El campo ${field.name} es obligatorio.`)
    }
    const params={
      p_ticket_id:ticket?.id||null,
      p_workspace:workspace.id,
      p_product_id:productId,
      p_title:core.title,
      p_description:core.description||null,
      p_type:core.type||'task',
      p_priority:core.priority||'medium',
      p_status:!canWork&&!ticket?'backlog':(core.status||ticket?.status||'backlog'),
      p_sprint_id:!canWork&&!ticket?null:(core.sprint_id||null),
      p_dev_owner_id:!canWork&&!ticket?null:(core.dev_owner_id||null),
      p_qa_owner_id:!canWork&&!ticket?null:(core.qa_owner_id||null),
      p_story_points:!canWork&&!ticket?null:sp,
      p_start_date:!canWork&&!ticket?null:(core.start_date||null),
      p_due_date:!canWork&&!ticket?null:(core.due_date||null),
      p_module_id:core.module_id||null,
      p_tag_ids:tag_ids,
      p_custom_values:custom_values
    }
    const {data,error}=await db.rpc('save_ticket_documented',params)
    if(error)throw error
    try{
      if(attachment_files?.length)await uploadEvidenceFiles({workspaceId:workspace.id,scope:'tickets',parentId:data.id,commentId:null,files:attachment_files,evidenceType:'general',userId:session.user.id,compress:true})
    }catch(err){
      if(!ticket){await db.from('tickets').delete().eq('id',data.id);throw new Error(`${err.message||String(err)} No se creó el ticket para evitar guardar un ticket sin sus adjuntos.`)}
      throw new Error(`${err.message||String(err)} Los cambios del ticket se guardaron, pero no se pudieron adjuntar los archivos.`)
    }
    await refresh();runEmails();showToast('success',attachment_files?.length?(ticket?'Ticket actualizado con adjuntos.':'Ticket enviado a Backlog con adjuntos.'):(ticket?'Ticket actualizado.':'Ticket enviado a Backlog.'))
    return data
  }

  const deleteTicket=async ticket=>{
    const {error}=await db.from('tickets').delete().eq('id',ticket.id); if(error) throw error
    await refresh(); showToast('success','Ticket eliminado.')
  }

  const moveTicket=async(ticket,status)=>{
    if(!canWork) return showToast('error','Tu rol no permite cambiar estados.')
    const {error}=await db.rpc('transition_ticket_status',{p_ticket_id:ticket.id,p_status:status,p_override_blockers:false,p_note:null})
    if(error){
      if(/bloquead/i.test(error.message||'')&&(myRole==='admin'||myRole==='superadmin')){setModal({type:'dependency-override',ticket,status});return}
      return showToast('error',error.message)
    }
    await refresh(); runEmails()
  }

  const quickAssignTicket=async(ticket,userId,lane)=>{
    if(!canWork)throw new Error('Tu rol no permite asignar tickets.')
    const field=lane==='qa'?'qa_owner_id':'dev_owner_id'
    const {error}=await db.from('tickets').update({[field]:userId||null}).eq('id',ticket.id)
    if(error)throw error
    await refresh();runEmails();showToast('success',userId?'Responsable actualizado.':'Ticket sin responsable.')
  }

  const closeSprintAndRollover=async(sprint,nextSprintId)=>{
    if(!canPlan) throw new Error('Tu rol no permite cerrar sprints.')
    const {data,error}=await db.rpc('close_sprint_and_rollover',{p_sprint_id:sprint.id,p_next_sprint_id:nextSprintId||null})
    if(error)throw error
    await refresh();showToast('success',`${data?.moved||0} tickets no resueltos fueron trasladados.`)
    return data
  }

  const planTicket=async(ticket,sprintId)=>{
    if(!canPlan)throw new Error('Tu rol no permite planificar tickets.')
    const sprint=sprints.find(s=>s.id===sprintId)
    const payload=sprintId
      ? {sprint_id:sprintId,status:ticket.status==='backlog'?'todo':ticket.status,start_date:ticket.start_date||sprint?.start_date||null,due_date:ticket.due_date||sprint?.end_date||null}
      : {sprint_id:null,status:'backlog',start_date:null,due_date:null}
    const {error}=await db.from('tickets').update(payload).eq('id',ticket.id)
    if(error)throw error
    await refresh();showToast('success',sprintId?'Ticket agregado al sprint y reflejado en el Timeline.':'Ticket regresado al Backlog y retirado del Timeline.')
  }

  const bulkMoveTickets=async(ticketIds,sprintId)=>{
    if(!canPlan)throw new Error('Tu rol no permite planificar tickets.')
    const ids=[...new Set(ticketIds||[])].filter(Boolean)
    if(!ids.length)throw new Error('Selecciona al menos un ticket.')
    const {data,error}=await db.rpc('bulk_move_tickets_to_sprint',{p_workspace:workspace.id,p_ticket_ids:ids,p_sprint_id:sprintId})
    if(error)throw error
    await refresh();showToast('success',`${data?.moved||ids.length} tickets movidos a ${data?.sprint_name||'sprint'}.`)
    return data
  }

  const saveHelpdesk=async(form,item=null)=>{
    const selectedType=requestTypes.find(x=>x.id===form.request_type_id)||requestTypes.find(x=>x.id===item?.request_type_id)
    const mappedCategory=selectedType?(selectedType.code==='requirement'?'new_requirement':selectedType.code==='incident'?'incident':selectedType.code==='access'?'access':selectedType.code==='configuration'?'configuration':'general'):(item?.category||'general')
    const isRequirement=isProposalCategory(mappedCategory)||isProposalCategory(item?.category)
    const base={
      department_id:form.department_id||null,
      request_type_id:form.request_type_id||item?.request_type_id||null,
      product_id:form.product_id||null,
      subject:form.subject,
      description:form.description||null,
      requester_name:form.requester_name||null,
      requester_email:form.requester_email||session.user.email,
      category:mappedCategory,
      priority:form.priority||'medium',
      source:form.source||'internal'
    }
    const payload=item
      ? (canManageHelpdesk
          ? (isRequirement?base:{...base,status:form.status,assigned_to:form.assigned_to||null,due_at:localDateTimeToIso(form.due_at)})
          : base)
      : {...base,source:'portal',workspace_id:workspace.id,requester_user_id:session.user.id,status:'created',assigned_to:null,due_at:null}
    if(item){
      const {error}=await db.from('helpdesk_tickets').update(payload).eq('id',item.id)
      if(error)throw error
      await refresh();showToast('success','Solicitud actualizada.')
      return item
    }
    const {data:created,error:createError}=await db.from('helpdesk_tickets').insert(payload).select('*').single()
    if(createError)throw createError
    try{
      if(form.evidence_files?.length){
        await uploadEvidenceFiles({workspaceId:workspace.id,scope:'helpdesk',parentId:created.id,commentId:null,files:form.evidence_files,evidenceType:'general',userId:session.user.id,compress:true})
      }
    }catch(err){
      const {error:rollbackError}=await db.from('helpdesk_tickets').delete().eq('id',created.id)
      if(rollbackError)throw new Error(`${err.message||String(err)} La solicitud se creó, pero no pudo revertirse automáticamente: ${rollbackError.message}`)
      throw new Error(`${err.message||String(err)} No se creó la solicitud para evitar guardar un reporte sin su evidencia.`)
    }
    let routing=null
    if(!isRequirement && settings?.helpdesk_auto_assignment_enabled!==false){
      try{
        const {data,error}=await db.functions.invoke('auto-assign-helpdesk',{body:{ticket_id:created.id}})
        if(!error&&!data?.error)routing=data
      }catch(err){console.warn('Autoasignación Helpdesk pendiente de cola:',err)}
    }
    await refresh()
    const routingSuffix=routing?.assigned?` · asignada a ${routing?.assignee?.name||'responsable automático'}`:routing?.queued?' · en cola de asignación automática':''
    showToast('success',(form.evidence_files?.length?(isRequirement?'Requerimiento y evidencias enviados.':'Solicitud y evidencias enviadas.'):(isRequirement?'Nuevo requerimiento enviado para decisión.':'Solicitud de soporte creada.'))+routingSuffix)
    return created
  }

  const refreshLiveCounters=async()=>{
    if(!workspace?.id)return null
    const {data,error}=await db.rpc('get_live_counters',{p_workspace:workspace.id})
    if(!error){setNavCounts(data?.navigation||null);setModuleStats(data?.modules||[]);setLiveCounters(data||null)}
    return error?null:data
  }

  const reconcileHelpdeskItem=async id=>{
    const {data,error}=await db.from('helpdesk_tickets').select('*').eq('id',id).maybeSingle()
    if(error)throw error
    if(data)setHelpdesk(rows=>{const exists=rows.some(row=>row.id===id);const next=exists?rows.map(row=>row.id===id?{...row,...data}:row):[data,...rows];return [...next].sort(liveSorters.helpdesk)})
    await refreshLiveCounters()
    return data
  }

  const changeHelpdeskStatus=async(item,nextStatus)=>{
    const status=normalizeHelpdeskStatus(nextStatus)
    if(!HELP_STATUS.some(([key])=>key===status))throw new Error('Estado de Helpdesk no válido.')
    if(normalizeHelpdeskStatus(item.status)===status)return item
    const {data,error}=await db.from('helpdesk_tickets').update({status}).eq('id',item.id).select('*').single()
    if(error)throw error
    setHelpdesk(rows=>[...rows.map(row=>row.id===item.id?{...row,...data}:row)].sort(liveSorters.helpdesk))
    await refreshLiveCounters()
    showToast('success',`Solicitud ${item.ticket_key||''} actualizada a ${helpStatusLabel(status)}.`)
    return data
  }

  const assignHelpdeskInline=async(item,assigneeId)=>{
    if(!assigneeId||assigneeId===item.assigned_to)return item
    const {error}=await db.rpc('assign_helpdesk_ticket',{p_ticket_id:item.id,p_assignee:assigneeId,p_comment:null})
    if(error)throw error
    const data=await reconcileHelpdeskItem(item.id)
    showToast('success',`${item.ticket_key||'Solicitud'} reasignada correctamente.`)
    return data
  }

  const autoAssignExistingHelpdesk=async()=>{
    if(!canManageHelpdesk)throw new Error('Tu rol no permite ejecutar la asignación automática.')
    const pending=helpdesk.filter(h=>!h.assigned_to&&!isProposalCategory(h.category)&&['created','review','attended'].includes(h.status))
    if(!pending.length){showToast('success','No hay solicitudes activas pendientes de asignación.');return {processed:0,assigned:0,queued:0,errors:0}}
    setHelpdeskAutoAssigning(true)
    let assigned=0,queued=0,errors=0
    try{
      for(const ticket of pending){
        try{
          const {data,error}=await db.functions.invoke('auto-assign-helpdesk',{body:{ticket_id:ticket.id,manual_trigger:true}})
          if(error||data?.error)throw new Error(await functionErrorMessage(error,data))
          if(data?.assigned)assigned++
          else queued++
        }catch(err){errors++;console.warn('Autoasignación manual Helpdesk:',ticket.ticket_key,err)}
      }
      await refresh()
      const detail=[`${assigned} asignada${assigned===1?'':'s'}`,`${queued} en cola`];if(errors)detail.push(`${errors} con error`)
      showToast(errors?'error':'success',`Autoasignación procesada: ${detail.join(' · ')}.`)
      return {processed:pending.length,assigned,queued,errors}
    }finally{setHelpdeskAutoAssigning(false)}
  }

  const decideRequirement=async(item,decision,productId,note)=>{
    if(!canPlan)throw new Error('Tu rol no permite decidir nuevos requerimientos.')
    const {data,error}=await db.rpc('decide_helpdesk_requirement',{p_helpdesk_id:item.id,p_decision:decision,p_product_id:decision==='accepted_backlog'?productId:null,p_note:note||null})
    if(error)throw error
    await refresh();runEmails()
    showToast('success',decision==='accepted_backlog'?`Requerimiento aceptado a Backlog${data?.ticket_key?` como ${data.ticket_key}`:''}.`:'Sugerencia rechazada y notificada al solicitante.')
    return data
  }

  const deleteHelpdesk=async item=>{
    const {error}=await db.from('helpdesk_tickets').delete().eq('id',item.id); if(error) throw error
    await refresh(); showToast('success','Solicitud eliminada.')
  }

  const markNotification=async(id,read=true)=>{
    const {error}=await db.from('notifications').update({read_at:read?new Date().toISOString():null}).eq('id',id)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.map(x=>x.id===id?{...x,read_at:read?new Date().toISOString():null}:x))
  }
  const markAll=async()=>{
    const ids=notifications.filter(n=>!n.read_at).map(n=>n.id); if(!ids.length) return
    const now=new Date().toISOString(); const {error}=await db.from('notifications').update({read_at:now}).in('id',ids)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.map(x=>({...x,read_at:x.read_at||now})))
  }
  const deleteNotification=async id=>{
    const {error}=await db.from('notifications').delete().eq('id',id)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.filter(x=>x.id!==id))
  }
  const clearReadNotifications=async()=>{
    const ids=notifications.filter(n=>n.read_at).map(n=>n.id)
    if(!ids.length) return
    const {error}=await db.from('notifications').delete().in('id',ids)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.filter(x=>!x.read_at))
  }
  const cleanupUnusedKnowledgeMedia=async(articleId)=>{
    const [{data:versions},{data:mediaRows}]=await Promise.all([
      db.from('knowledge_article_versions').select('content_blocks').eq('article_id',articleId),
      db.from('knowledge_media').select('*').eq('article_id',articleId)
    ])
    const used=new Set((versions||[]).flatMap(v=>(v.content_blocks||[]).filter(b=>b?.type==='image'&&b.media_id).map(b=>b.media_id)))
    const unused=(mediaRows||[]).filter(m=>!used.has(m.id))
    if(unused.length)await deleteKnowledgeMediaRows(unused)
  }
  const openKnowledgeEdit=article=>{
    const draft=knowledgeVersions.find(v=>v.id===article.draft_version_id)||knowledgeVersions.find(v=>v.article_id===article.id&&v.status==='draft')
    if(draft)setKnowledgeScreen({mode:'edit',article,version:draft})
    else setModal({type:'knowledge-new-version',article})
  }
  const createKnowledgeVersion=async(article,note)=>{
    const {data,error}=await db.rpc('create_knowledge_draft_version',{p_article_id:article.id,p_change_note:note})
    if(error)throw error
    const {data:version,error:vError}=await db.from('knowledge_article_versions').select('*').eq('id',data).single()
    if(vError)throw vError
    await refresh();setModal(null);setKnowledgeScreen({mode:'edit',article:{...article,draft_version_id:data},version});showToast('success',`Borrador v${version.version_number} creado. La versión pública permanece sin cambios.`)
  }
  const publishKnowledgeVersion=async(article,version)=>{
    const {data,error}=await db.rpc('publish_knowledge_version',{p_version_id:version.id})
    if(error)throw error
    await refresh()
    const {data:fresh}=await db.from('knowledge_articles').select('*').eq('id',article.id).single()
    setKnowledgeScreen({mode:'read',article:fresh||article});showToast('success',`Versión v${version.version_number} publicada.`)
    return data
  }
  const saveKnowledgeArticle=async(payload,existingArticle=null,existingVersion=null)=>{
    const {article_id,row,blocks,change_note,publish=false}=payload
    const uploaded=[]
    const uploadPending=async(targetArticleId)=>{const finalBlocks=[];for(const raw of blocks){const b=normalizeKnowledgeBlockRuntime(raw);if(b.type==='image'&&b.pending_file){const mediaRow=await uploadKnowledgeImage({workspaceId:workspace.id,articleId:targetArticleId,userId:session.user.id,file:b.pending_file});uploaded.push(mediaRow);finalBlocks.push({...b,media_id:mediaRow.id,pending_file:undefined})}else finalBlocks.push(b)}return normalizeKnowledgeBlocks(finalBlocks)}
    const updateDraft=async(versionId,cleanBlocks)=>{
      const plain=knowledgePlainText(cleanBlocks)
      const {data,error}=await db.rpc('update_knowledge_draft_version',{p_version_id:versionId,p_title:row.title,p_slug:row.slug,p_summary:row.summary,p_content:plain,p_content_blocks:cleanBlocks,p_tags:row.tags,p_product_id:row.product_id,p_module_id:row.module_id,p_category_id:row.category_id})
      if(error)throw error
      return data
    }
    if(existingArticle&&existingVersion){
      try{
        const cleanBlocks=await uploadPending(existingArticle.id)
        const updatedVersion=await updateDraft(existingVersion.id,cleanBlocks)
        await cleanupUnusedKnowledgeMedia(existingArticle.id)
        if(publish){await publishKnowledgeVersion(existingArticle,updatedVersion);return {published:true,version:updatedVersion,blocks:cleanBlocks}}
        await refresh();showToast('success',`Borrador v${updatedVersion.version_number} guardado. La versión pública sigue activa.`);const nextArticle={...existingArticle,...row,draft_version_id:updatedVersion.id};setKnowledgeScreen({mode:'edit',article:nextArticle,version:updatedVersion});return {article:nextArticle,version:updatedVersion,blocks:cleanBlocks}
      }catch(err){if(uploaded.length)await deleteKnowledgeMediaRows(uploaded);throw err}
      return
    }
    let createdVersionId=null
    try{
      const stagedBlocks=normalizeKnowledgeBlocks(blocks),plainStaged=knowledgePlainText(stagedBlocks),note=(change_note||'Versión inicial').trim()||'Versión inicial'
      const {data:versionId,error:createError}=await db.rpc('create_knowledge_initial_draft',{p_workspace_id:workspace.id,p_article_id:article_id,p_title:row.title,p_slug:row.slug,p_summary:row.summary,p_content:plainStaged,p_content_blocks:stagedBlocks,p_tags:row.tags,p_product_id:row.product_id,p_module_id:row.module_id,p_category_id:row.category_id,p_default_language:row.default_language||locale,p_change_note:note})
      if(createError)throw createError
      createdVersionId=versionId
      const cleanBlocks=await uploadPending(article_id)
      const version=await updateDraft(versionId,cleanBlocks)
      const {data:article,error:aError}=await db.from('knowledge_articles').select('*').eq('id',article_id).single()
      if(aError)throw aError
      if(publish){await publishKnowledgeVersion(article,version);return {published:true,article,version,blocks:cleanBlocks}}
      await refresh();showToast('success','Artículo creado y guardado como borrador v1.');setKnowledgeScreen({mode:'edit',article,version});return {article,version,blocks:cleanBlocks}
    }catch(err){
      if(uploaded.length)await deleteKnowledgeMediaRows(uploaded)
      if(createdVersionId){
        try{const [{data:article},{data:version}]=await Promise.all([db.from('knowledge_articles').select('*').eq('id',article_id).maybeSingle(),db.from('knowledge_article_versions').select('*').eq('id',createdVersionId).maybeSingle()]);await refresh();if(article&&version)setKnowledgeScreen({mode:'edit',article,version});showToast('error','El borrador se creó de forma segura, pero una parte del contenido no pudo guardarse. Revisa el bloque marcado y vuelve a guardar.')}catch{}
      }
      if(err?.code==='23505'&&String(err?.message||'').toLowerCase().includes('slug'))throw new Error('Ya existe un artículo con ese slug. Ajusta el slug o el título e inténtalo nuevamente.')
      throw err
    }
  }

  const processEmails=async()=>{
    const {data,error}=await db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id}})
    if(error) throw error
    if(data)setEmailProviderStatus(data)
    await refresh()
    return data
  }

  if(!workspace&&busy) return <AccessValidationShell session={session} locale={locale} setLocale={setLocale} theme={theme} setTheme={setTheme} error="" onRetry={()=>{}}/>
  if(!workspace && !busy) return <EmptyWorkspace canCreate={canCreateWorkspace} onCreate={()=>setModal({type:'workspace-create'})}/>
  if(workspace&&!accessReady) return <AccessValidationShell session={session} locale={locale} setLocale={setLocale} theme={theme} setTheme={setTheme} error={workspaceLoadError} onRetry={()=>{setWorkspaceLoadError('');setBusy(true);loadWorkspaceData()}}/>

  return <div className="app-shell">
    <Topbar session={session} locale={locale} setLocale={setLocale} theme={theme} setTheme={setTheme} liveStatus={liveStatus} unread={unread} search={search} setSearch={setSearch} canSearch={canViewTickets} portalOnly={helpdeskOnly} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onNotifications={()=>setDrawer('notifications')} outToday={outTodayPeople}/>
    <Sidebar workspace={workspace} workspaces={workspaces} products={products} navCounts={navCounts} productId={productId} setProductId={setProductId} view={view} setView={navigateView} tickets={tickets} helpdesk={helpdesk} knowledgeArticles={knowledgeArticles} modules={modules} members={members} currentUserId={session.user.id} helpdeskEnabled={helpdeskEnabled} role={myRole} roleName={myRoleName} helpdeskOnly={helpdeskOnly} canCreateWorkspace={canCreateWorkspace} canManageStaff={canManageStaff} canManageSettings={canManageSettings||canManageProducts} canManageTicketFields={canManageTicketFields} canViewDashboard={canViewDashboard} canViewKnowledge={canViewKnowledge} canViewVacations={canViewVacations} outTodayCount={outTodayPeople.length} onWorkspace={()=>runWithKnowledgeGuard(()=>setModal({type:'workspace-switch'}))}/>
    <MobileNav view={view} setView={navigateView} setProductId={setProductId} helpdeskEnabled={helpdeskEnabled} role={myRole} helpdeskOnly={helpdeskOnly} canManageStaff={canManageStaff} canManageSettings={canManageSettings||canManageProducts} canManageTicketFields={canManageTicketFields} canViewDashboard={canViewDashboard} canViewKnowledge={canViewKnowledge} canViewVacations={canViewVacations}/>
    <main className="main-area">
      {busy ? <LoadingPanel/> : (knowledgeScreen&&canViewKnowledge) ? (
        <KnowledgeModuleErrorBoundary key={`knowledge-screen:${knowledgeScreen.mode}:${knowledgeScreen.article?.id||'new'}:${knowledgeScreen.version?.id||'new'}`} onReset={()=>setKnowledgeScreen(null)}>
          {knowledgeScreen.mode==='read'
            ? <KnowledgeArticlePage liveRevision={liveRevision.knowledge} article={knowledgeScreen.article} versions={knowledgeVersions.filter(v=>v.article_id===knowledgeScreen.article.id)} events={knowledgeVersionEvents.filter(e=>e.article_id===knowledgeScreen.article.id)} products={products} modules={modules} categories={knowledgeCategories} members={members} settings={settings} locale={locale} canManage={canEditKnowledge} onBack={()=>setKnowledgeScreen(null)} onEdit={()=>openKnowledgeEdit(knowledgeScreen.article)} onCreateVersion={()=>setModal({type:'knowledge-new-version',article:knowledgeScreen.article})} onPublishVersion={version=>publishKnowledgeVersion(knowledgeScreen.article,version)}/>
            : knowledgeScreen.mode==='preview'
              ? <KnowledgeListPreviewPage liveRevision={liveRevision.knowledge} article={knowledgeScreen.article} version={knowledgeScreen.version} products={helpdeskProducts.length?helpdeskProducts:products} modules={modules} categories={knowledgeCategories} settings={settings} locale={locale} onBack={()=>setKnowledgeScreen(null)}/>
            : <KnowledgeArticleEditorPage liveRevision={liveRevision.knowledge} key={`${knowledgeScreen.article?.id||'new'}:${knowledgeScreen.version?.id||'new'}`} article={knowledgeScreen.article||null} version={knowledgeScreen.version||null} workspace={workspace} products={products} modules={modules} categories={knowledgeCategories} initialCategoryId={knowledgeScreen.categoryId||null} settings={settings} session={session} locale={locale} canPublish={canEditKnowledge} onBack={()=>setKnowledgeScreen(null)} onSave={payload=>saveKnowledgeArticle(payload,knowledgeScreen.article||null,knowledgeScreen.version||null)}/>}
        </KnowledgeModuleErrorBoundary>
      ) : <>
        {view==='overview' && canViewDashboard && <Overview workspace={workspace} tickets={tickets} helpdesk={helpdesk} products={products} sprints={sprints}/>}
        {view==='board' && canViewDashboard && <TicketWorkspace workspace={workspace} title="Tablero" subtitle="Consulta, filtra y gestiona tickets del equipo." tickets={filteredTickets} allTickets={tickets} products={products} members={members} sprints={sprints} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onMove={moveTicket} onQuickAssign={quickAssignTicket} currentUserId={session.user.id}/>}
        {view==='timeline' && canViewDashboard && <GanttView workspace={workspace} tickets={filteredTickets} products={products} sprints={sprints} members={members} modules={modules} ticketLinks={ticketLinks} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket}/>}
        {view==='backlog' && canViewDashboard && <BacklogView workspace={workspace} tickets={tickets} products={products} sprints={sprints} members={members} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} canPlan={canPlan} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onPlan={ticket=>setModal({type:'ticket-plan',ticket})} onBulkMove={bulkMoveTickets} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onCloseSprint={sprint=>setModal({type:'sprint-rollover',sprint})} onCreateSprint={()=>setModal({type:'sprint-create'})} onImport={()=>setModal({type:'backlog-import'})}/>}
        {view==='mytasks' && <TicketWorkspace workspace={workspace} title="Mis tareas" subtitle="Tickets que reportaste o que tienes asignados." tickets={myTickets} allTickets={myTickets} products={products} members={members} sprints={sprints} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onMove={moveTicket} onQuickAssign={quickAssignTicket} currentUserId={session.user.id}/>}
        {view==='helpdesk' && helpdeskEnabled && (helpdeskStaff
          ? <HelpdeskView items={filteredHelpdesk} allItems={helpdesk} counterSnapshot={liveCounters?.helpdesk||null} departments={departments} requestTypes={requestTypes} products={helpdeskProducts} members={members} currentUserId={session.user.id} canPlan={canPlan} canAssign={canManageHelpdesk} autoAssigning={helpdeskAutoAssigning} filters={helpFilters} onFilter={()=>setModal({type:'help-filters'})} onStatusChange={status=>setHelpFilters(f=>({...f,status,quick:'all'}))} onQuickFilter={quick=>setHelpFilters({status:'all',requestType:'all',department:'all',product:'all',assignee:'all',priority:'all',quick})} onCreate={()=>setModal({type:'help-create'})} onActions={item=>setModal({type:'help-actions',item})} onOpen={item=>setModal({type:'help-detail',item})} onDecision={(item,decision=null)=>setModal({type:'help-requirement-decision',item,decision})} onAssign={item=>setModal({type:'help-assign',item})} onInlineAssign={(item,id)=>assignHelpdeskInline(item,id).catch(err=>showToast('error',err.message||String(err)))} onInlineStatus={(item,status)=>changeHelpdeskStatus(item,status).catch(err=>showToast('error',err.message||String(err)))} onAutoAssign={autoAssignExistingHelpdesk}/>
          : <HelpdeskPortal items={helpdesk} departments={departments} requestTypes={requestTypes} products={helpdeskProducts} onCreate={()=>setModal({type:'help-create'})} onOpen={item=>setModal({type:'help-detail',item})}/>)}
        {view==='reports' && canViewDashboard && <ReportsView workspace={workspace} products={products} modules={modules} tickets={tickets} sprints={sprints} toast={showToast}/>}
        {view==='knowledge' && canViewKnowledge && <KnowledgeModuleErrorBoundary onReset={()=>setKnowledgeScreen(null)}><KnowledgeView workspace={workspace} articles={knowledgeArticles} versions={knowledgeVersions} locale={locale} products={products} modules={modules} categories={knowledgeCategories} canCreate={canCreateKnowledge} canEdit={canEditKnowledge} canDelete={canDeleteKnowledge} currentUserId={session.user.id} onCreate={categoryId=>setKnowledgeScreen({mode:'create',article:null,version:null,categoryId})} onEdit={openKnowledgeEdit} onOpen={article=>setKnowledgeScreen({mode:'read',article})} onPreview={(article,version)=>setKnowledgeScreen({mode:'preview',article,version})} onDelete={article=>setModal({type:'knowledge-delete',article})} onCategoryCreate={()=>setModal({type:'knowledge-category-create'})} onCategoryEdit={category=>setModal({type:'knowledge-category-edit',category})} onCategoryDelete={category=>setModal({type:'knowledge-category-delete',category})}/></KnowledgeModuleErrorBoundary>}
        {view==='vacations' && canViewVacations && <VacationsView liveRevision={liveRevision.vacations} workspace={workspace} requests={vacationRequests} members={members} tickets={tickets} sprints={sprints} session={session} settings={settings} canRequest={canRequestVacations} canViewProjection={canViewVacationProjection} canManage={canManageVacations} onRefresh={refresh} toast={showToast}/>}
        {view==='catalogs' && canManageTicketFields && <TicketCatalogsView workspace={workspace} modules={modules} moduleStats={moduleStats} tags={tags} customFields={customFields} tickets={tickets} ticketTagLinks={ticketTagLinks} canManage={canManageTicketFields} onModuleCreate={()=>setModal({type:'module-create'})} onModuleEdit={module=>setModal({type:'module-edit',module})} onModuleDelete={module=>setModal({type:'module-delete',module})} onTagCreate={()=>setModal({type:'tag-create'})} onTagEdit={tag=>setModal({type:'tag-edit',tag})} onTagDelete={tag=>setModal({type:'tag-delete',tag})} onFieldCreate={()=>setModal({type:'field-create'})} onFieldEdit={field=>setModal({type:'field-edit',field})} onFieldDelete={field=>setModal({type:'field-delete',field})}/>}
        {view==='team' && canManageStaff && <StaffRolesView workspace={workspace} members={members} products={products} memberProductAccess={memberProductAccess} roleTemplates={roleTemplates} canManage={canManageStaff} isSuperadmin={isSuperadmin} session={session} onInvite={()=>setModal({type:'invite'})} onMember={member=>setModal({type:'member-edit',member})} onRoleCreate={()=>setModal({type:'role-create'})} onRoleEdit={role=>setModal({type:'role-edit',role})} onRoleDelete={role=>setModal({type:'role-delete',role})}/>}
        {view==='settings' && (canManageSettings||canManageProducts) && <SettingsView workspace={workspace} settings={settings} products={products} sprints={sprints} departments={departments} requestTypes={requestTypes} emailQueue={emailQueue} emailProviderStatus={emailProviderStatus} canManageSettings={canManageSettings} canManageProducts={canManageProducts} canPlan={canPlan} canDeleteWorkspace={isSuperadmin} onWorkspaceEdit={()=>setModal({type:'workspace-edit'})} onWorkspaceConfig={()=>setModal({type:'workspace-config'})} onWorkspaceDelete={()=>setModal({type:'workspace-delete'})} onSettingsSaved={refresh} onProductCreate={()=>setModal({type:'product-create'})} onProductEdit={product=>setModal({type:'product-edit',product})} onProductDelete={product=>setModal({type:'product-delete',product})} onSprintCreate={()=>setModal({type:'sprint-create'})} onSprintEdit={sprint=>setModal({type:'sprint-edit',sprint})} onSprintDelete={sprint=>setModal({type:'sprint-delete',sprint})} onDepartmentCreate={()=>setModal({type:'department-create'})} onDepartmentEdit={department=>setModal({type:'department-edit',department})} onDepartmentDelete={department=>setModal({type:'department-delete',department})} onRequestTypeCreate={()=>setModal({type:'request-type-create'})} onRequestTypeEdit={requestType=>setModal({type:'request-type-edit',requestType})} onRequestTypeDelete={requestType=>setModal({type:'request-type-delete',requestType})} onProcessEmails={processEmails} toast={showToast}/>}
      </>}
    </main>
    {drawer==='notifications' && <NotificationsDrawer locale={locale} notifications={notifications} onClose={()=>setDrawer(null)} onMark={markNotification} onMarkAll={markAll} onDelete={deleteNotification} onClearRead={clearReadNotifications} onOpen={n=>{setDrawer(null);const meta=n.metadata||{},entity=meta.entity_type;if(n.ticket_id||entity==='ticket'){const id=n.ticket_id||meta.entity_id;const t=tickets.find(x=>x.id===id);if(t)setModal({type:'ticket-detail',ticket:t});else showToast('error',locale==='en'?'The related ticket is no longer available.':'El ticket relacionado ya no está disponible.')}else if(n.helpdesk_ticket_id||entity==='helpdesk'){const id=n.helpdesk_ticket_id||meta.entity_id;const h=helpdesk.find(x=>x.id===id);if(h)setModal({type:'help-detail',item:h});else showToast('error',locale==='en'?'The related request is no longer available.':'La solicitud relacionada ya no está disponible.')}else if(entity==='sprint'){const sp=sprints.find(x=>x.id===meta.entity_id);if(sp)setModal({type:'sprint-detail',sprint:sp});else showToast('error',locale==='en'?'The related sprint is no longer available.':'El sprint relacionado ya no está disponible.')}else if(entity==='knowledge'){const a=knowledgeArticles.find(x=>x.id===(meta.article_id||meta.entity_id));if(a&&canViewKnowledge){setView('knowledge');setKnowledgeScreen({mode:'read',article:a})}else showToast('error',locale==='en'?'The related article is no longer available.':'El artículo relacionado ya no está disponible.')}else if(entity==='vacation'){if(canViewVacations)setView('vacations');else showToast('error','No tienes permiso para consultar Vacaciones.')}else if(entity==='staff'){setView('team')}}}/>}
    {modal && <ModalRouter modal={modal} setModal={setModal} liveRevision={liveRevision} workspace={workspace} workspaces={workspaces} memberships={memberships} products={products} helpdeskProducts={helpdeskProducts} sprints={sprints} tickets={tickets} members={members} memberProductAccess={memberProductAccess} roleTemplates={roleTemplates} departments={departments} requestTypes={requestTypes} helpdesk={helpdesk} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} ticketLinks={ticketLinks} customFields={customFields} customFieldProducts={customFieldProducts} customValues={customValues} knowledgeArticles={knowledgeArticles} knowledgeVersions={knowledgeVersions} knowledgeCategories={knowledgeCategories} vacationRequests={vacationRequests} createKnowledgeVersion={createKnowledgeVersion} locale={locale} settings={settings} session={session} myRole={myRole} myPermissions={myPermissions} isSuperadmin={isSuperadmin} isAdmin={canAdminWorkspace} canManage={canPlan} canAdminWorkspace={canAdminWorkspace} canManageStaff={canManageStaff} canManageHelpdesk={canManageHelpdesk} canManageSettings={canManageSettings} canManageProducts={canManageProducts} canManageTicketFields={canManageTicketFields} canDeleteTicket={canDeleteTicket} canPlan={canPlan} canWork={canWork} canCreateTicket={canCreateTicket} filters={filters} setFilters={setFilters} helpFilters={helpFilters} setHelpFilters={setHelpFilters} canCreateWorkspace={canCreateWorkspace} createWorkspace={createWorkspace} saveTicket={saveTicket} deleteTicket={deleteTicket} saveHelpdesk={saveHelpdesk} deleteHelpdesk={deleteHelpdesk} changeHelpdeskStatus={changeHelpdeskStatus} assignHelpdeskInline={assignHelpdeskInline} decideRequirement={decideRequirement} closeSprintAndRollover={closeSprintAndRollover} planTicket={planTicket} refresh={refresh} loadMemberships={loadMemberships} setWorkspace={setWorkspace} setView={navigateView} toast={showToast}/>}
    {toast && <Toast toast={toast}/>}
  </div>
}

function Topbar({session,locale='es',setLocale,theme='light',setTheme,liveStatus='connecting',unread,search,setSearch,canSearch=true,portalOnly=false,canCreate,onCreate,onNotifications,outToday=[]}){return <header className="global-topbar">
  <div className="topbar-brand"><img src="./logo.svg" alt="TROBBU"/><span></span><b>Jira Interno</b></div>
  {canSearch?<div className="global-search"><Icon name="lucide:search"/><input id="global-ticket-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tickets por clave, título o descripción"/><kbd>⌘ K</kbd></div>:<div className="portal-topbar-context"><Icon name="lucide:life-buoy"/><span><b>Portal de solicitudes</b><small>{portalOnly?'Seguimiento personal de Helpdesk':'Workspace interno'}</small></span></div>}
  <div className="topbar-actions"><span className={`live-sync-indicator ${liveStatus}`} title={liveStatus==='live'?'Datos sincronizados en tiempo real':liveStatus==='degraded'?'Realtime degradado · recuperación automática activa':'Conectando sincronización Live'}><i></i><span>{liveStatus==='live'?'En vivo':liveStatus==='degraded'?'Reconectando':'Conectando'}</span></span>{outToday.length>0&&<button type="button" className="out-today-badge" title={outToday.map(x=>x.name).join(', ')}><Icon name="lucide:calendar-off"/><span>{outToday.length} fuera hoy</span></button>}<ThemeToggle theme={theme} setTheme={setTheme} compact/><select className="language-switcher" value={locale} onChange={e=>setLocale?.(e.target.value)} aria-label="Idioma / Language"><option value="es">ES</option><option value="en">EN</option></select>{canCreate&&<button className="primary create-button" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button>}<button className="icon-button bell" onClick={onNotifications} title="Notificaciones"><Icon name="lucide:bell"/>{unread>0&&<em>{unread>9?'9+':unread}</em>}</button><div className="top-user"><span className="avatar sm">{initials(session.user.user_metadata?.full_name||session.user.email)}</span><div><b>{session.user.user_metadata?.full_name||'Usuario'}</b><small>{session.user.email}</small></div></div></div>
</header>}

function AccessValidationShell({session,locale='es',setLocale,theme='light',setTheme,error,onRetry}){
  return <div className="app-shell access-validation-shell" aria-busy="true">
    <header className="global-topbar access-validation-topbar"><div className="topbar-brand"><img src="./logo.svg" alt="TROBBU"/><span></span><b>Jira Interno</b></div><div className="access-topbar-placeholder skeleton-shimmer"></div><div className="topbar-actions"><ThemeToggle theme={theme} setTheme={setTheme} compact/><select className="language-switcher" value={locale} onChange={e=>setLocale?.(e.target.value)} aria-label="Idioma / Language"><option value="es">ES</option><option value="en">EN</option></select><div className="top-user"><span className="avatar sm">{initials(session.user.user_metadata?.full_name||session.user.email)}</span><div><b>{session.user.user_metadata?.full_name||'Usuario'}</b><small>{session.user.email}</small></div></div></div></header>
    <aside className="sidebar access-sidebar-skeleton" aria-hidden="true"><div className="skeleton-line short skeleton-shimmer"></div><div className="skeleton-workspace skeleton-shimmer"></div><div className="skeleton-nav-stack">{Array.from({length:7}).map((_,i)=><div className="skeleton-nav-row" key={i}><i className="skeleton-shimmer"></i><span className="skeleton-shimmer" style={{width:`${54+(i%3)*12}%`}}></span></div>)}</div><div className="sidebar-spacer"></div><div className="skeleton-nav-row"><i className="skeleton-shimmer"></i><span className="skeleton-shimmer" style={{width:'46%'}}></span></div></aside>
    <main className="main-area access-validation-main"><div className={`access-validation-card ${error?'error':''}`}><span className="access-validation-icon">{error?<Icon name="lucide:shield-alert" size={28}/>:<span className="loader"></span>}</span><div><b>{error?'No se pudo validar el acceso':'Validando acceso y permisos…'}</b><p>{error?'No se mostrará ningún módulo hasta confirmar tus permisos.':'Preparando únicamente los recursos autorizados para tu usuario.'}</p>{error&&<button type="button" className="secondary-button compact" onClick={onRetry}><Icon name="lucide:refresh-cw"/> Reintentar</button>}</div></div></main>
  </div>
}

function Sidebar({workspace,products,navCounts,productId,setProductId,view,setView,tickets,helpdesk,knowledgeArticles=[],modules=[],members=[],currentUserId,helpdeskEnabled,role,roleName,helpdeskOnly=false,canCreateWorkspace=false,canManageStaff,canManageSettings,canManageTicketFields,canViewDashboard,canViewKnowledge=true,canViewVacations=false,outTodayCount=0,onWorkspace}){
  const knowledgeItem=canViewKnowledge?[['knowledge','lucide:book-open-text','Knowledge']]:[]
  const vacationItem=canViewVacations?[['vacations','lucide:calendar-days','Vacaciones']]:[]
  const items=helpdeskOnly
    ? [['helpdesk','lucide:life-buoy','Mis solicitudes'],...knowledgeItem]
    : canViewDashboard
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog / Sprints'],['timeline','lucide:gantt-chart','Cronograma'],['reports','lucide:chart-no-axes-combined','Reportes / AI'],...knowledgeItem,...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy',role==='consulta'?'Mis solicitudes':'Helpdesk']]:[]),...vacationItem,...(canManageTicketFields?[['catalogs','lucide:tags','Campos y módulos']]:[]),...(canManageStaff?[['team','lucide:users-round','Staff y Roles']]:[])]
      : [...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Mis solicitudes']]:[]),...knowledgeItem,...vacationItem]
  const server=navCounts||{}
  const counts={board:Number(server.tickets??tickets.length),backlog:Number(server.backlog??tickets.filter(t=>!t.sprint_id&&t.status!=='closed').length),knowledge:Number(server.knowledge??knowledgeArticles.length),mytasks:Number(server.mytasks??tickets.filter(t=>t.dev_owner_id===currentUserId||t.qa_owner_id===currentUserId||t.reporter_id===currentUserId).length),helpdesk:Number(server.helpdesk??helpdesk.length),vacations:Number(outTodayCount||0)}
  const countKeys=new Set(['board','backlog','knowledge','mytasks','helpdesk','vacations']),productCounts=server.products||{}
  return <aside className="sidebar"><div className="sidebar-section-title"><span>ESPACIO DE TRABAJO</span>{canCreateWorkspace&&<button className="ghost-icon" onClick={onWorkspace} title="Cambiar o crear workspace"><Icon name="lucide:plus" size={16}/></button>}</div><button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{workspace?.name}</b><small>{roleName||ROLE_LABELS[role]||role}</small></div><Icon name="lucide:chevrons-up-down" size={16}/></button><nav className="side-nav">{items.map(([key,icon,label])=><button key={key} className={view===key?'active':''} onClick={()=>{if(!['board','timeline'].includes(key))setProductId('all');setView(key)}}><Icon name={icon}/><span>{label}</span>{countKeys.has(key)&&(key!=='vacations'||counts[key]>0)&&<em>{counts[key]}</em>}</button>)}</nav>{canViewDashboard&&!helpdeskOnly&&products.length>0&&<><div className="sidebar-divider"></div><div className="sidebar-section-title"><span>PRODUCTOS AUTORIZADOS</span></div><button className={`product-nav ${productId==='all'?'active':''}`} onClick={()=>{setProductId('all');setView('board')}}><span className="product-dot all"><Icon name="lucide:boxes" size={15}/></span><span>Todos los autorizados</span><em>{Number(server.tickets??tickets.length)}</em></button>{products.map((p,i)=><button key={p.id} className={`product-nav ${productId===p.id?'active':''}`} onClick={()=>{setProductId(p.id);setView('board')}}><span className={`product-dot p${i%4}`}><Icon name={i===2?'lucide:smartphone':'lucide:monitor'} size={15}/></span><span>{p.name}</span><em>{Number(productCounts[p.id]??tickets.filter(t=>t.product_id===p.id).length)}</em></button>)}</>}<div className="sidebar-spacer"></div><div className="sidebar-divider"></div>{canManageSettings&&!helpdeskOnly&&<button className={`footer-nav ${view==='settings'?'active':''}`} onClick={()=>{setProductId('all');setView('settings')}}><Icon name="lucide:settings"/>Configuración</button>}<button className="footer-nav" onClick={()=>db.auth.signOut()}><Icon name="lucide:log-out"/>Cerrar sesión</button></aside>
}

function MobileNav({view,setView,setProductId,helpdeskEnabled,role,helpdeskOnly=false,canManageStaff,canManageSettings,canManageTicketFields,canViewDashboard,canViewKnowledge=true,canViewVacations=false}){
  const knowledgeItem=canViewKnowledge?[['knowledge','lucide:book-open-text','Knowledge']]:[],vacationItem=canViewVacations?[['vacations','lucide:calendar-days','Vacaciones']]:[]
  const items=helpdeskOnly?[['helpdesk','lucide:life-buoy','Solicitudes'],...knowledgeItem]:canViewDashboard?[['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog'],['timeline','lucide:gantt-chart','Gantt'],['reports','lucide:chart-no-axes-combined','Reportes'],...knowledgeItem,...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Helpdesk']]:[]),...vacationItem,...(canManageTicketFields?[['catalogs','lucide:tags','Campos']]:[]),...(canManageStaff?[['team','lucide:users-round','Staff']]:[]),...(canManageSettings?[['settings','lucide:settings','Ajustes']]:[])]:[...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Solicitudes']]:[]),...knowledgeItem,...vacationItem]
  return <nav className="mobile-nav" aria-label="Navegación móvil">{items.map(([key,icon,label])=><button type="button" key={key} className={view===key?'active':''} onClick={()=>{setProductId('all');setView(key)}}><Icon name={icon} size={19}/><span>{label}</span></button>)}</nav>
}
function PageHeader({eyebrow='Proyectos',title,subtitle,icon='lucide:clipboard-check',action}){return <div className="page-header"><div><div className="breadcrumbs"><span>{eyebrow}</span><Icon name="lucide:chevron-right" size={14}/><span>TROBBU</span></div><div className="page-title-row"><span className="page-icon"><Icon name={icon}/></span><div><h1>{title}</h1><p>{subtitle}</p></div></div></div>{action}</div>}
function LoadingPanel(){return <div className="center content-loading"><span className="loader"></span><span>Actualizando información…</span></div>}
function EmptyWorkspace({canCreate=false,onCreate}){return <div className="empty-state"><img src="./logo.svg"/><span className="page-icon"><Icon name="lucide:layers-3" size={26}/></span><h2>{canCreate?'Crea tu primer espacio de trabajo':'No tienes espacios de trabajo asignados.'}</h2><p>{canCreate?'Los productos base y la configuración se crearán automáticamente.':'Solicita acceso a un Admin, PM o Superadmin.'}</p>{canCreate&&<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear workspace</button>}<button className="secondary-button" onClick={()=>db.auth.signOut()}><Icon name="lucide:log-out"/> Cerrar sesión</button></div>}
function Toast({toast}){return <div className={`toast ${toast.type}`}><Icon name={toast.type==='error'?'lucide:circle-alert':'lucide:circle-check'} /><span>{toast.message}</span></div>}

function Overview({workspace,tickets,helpdesk,products,sprints}){
  const [product,setProduct]=useState('all')
  const [sprint,setSprint]=useState('all')
  const [filterOpen,setFilterOpen]=useState(false)
  useEffect(()=>{setProduct('all');setSprint('all');setFilterOpen(false)},[workspace?.id])
  const scoped=tickets.filter(t=>(product==='all'||t.product_id===product)&&(sprint==='all'||t.sprint_id===sprint))
  const metrics={
    created:scoped.length,
    inProgress:scoped.filter(t=>t.status==='in_progress').length,
    devDone:scoped.filter(t=>t.dev_completed_at).length,
    qaDone:scoped.filter(t=>t.qa_completed_at).length,
    rejected:scoped.filter(t=>t.status==='qa_rejected').length,
    closed:scoped.filter(t=>t.status==='closed').length
  }
  const supportOpen=helpdesk.filter(h=>normalizeHelpdeskStatus(h.status)!=='closed').length
  const totalPoints=scoped.reduce((a,t)=>a+Number(t.story_points||0),0)
  const closedPoints=scoped.filter(t=>t.status==='closed').reduce((a,t)=>a+Number(t.story_points||0),0)
  const completion=totalPoints?Math.round(closedPoints/totalPoints*100):(scoped.length?Math.round(metrics.closed/scoped.length*100):0)
  return <div className="page"><PageHeader title="Resumen" subtitle={`Dashboard interactivo de ${workspace.name}`} icon="lucide:layout-dashboard"/>
    <div className="dashboard-filters"><button className={`filter-button ${(product!=='all'||sprint!=='all')?'active':''}`} onClick={()=>setFilterOpen(true)}><Icon name="lucide:list-filter"/> Filtros del dashboard {(product!=='all'||sprint!=='all')&&<em>{Number(product!=='all')+Number(sprint!=='all')}</em>}</button>{product!=='all'&&<span className="filter-summary-chip"><Icon name="lucide:boxes"/>{products.find(p=>p.id===product)?.name}</span>}{sprint!=='all'&&<span className="filter-summary-chip"><Icon name="lucide:calendar-range"/>{sprints.find(x=>x.id===sprint)?.name}</span>}<span className="dashboard-context"><Icon name="lucide:filter" size={15}/> {scoped.length} tickets analizados</span></div>
    <div className="metric-grid six"><Metric label="Tickets creados" value={metrics.created} icon="lucide:ticket-plus" tone="blue"/><Metric label="En curso" value={metrics.inProgress} icon="lucide:loader-circle" tone="orange"/><Metric label="Finalizados Dev" value={metrics.devDone} icon="lucide:code-2" tone="navy"/><Metric label="Finalizados QA" value={metrics.qaDone} icon="lucide:scan-search" tone="purple"/><Metric label="QA rechazados" value={metrics.rejected} icon="lucide:circle-x" tone="red"/><Metric label="Cerrados" value={metrics.closed} icon="lucide:badge-check" tone="green"/></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h3>Avance del alcance</h3><p>Story points cerrados frente al total del filtro actual.</p></div><strong className="completion-value">{completion}%</strong></div><div className="big-progress"><i style={{width:`${completion}%`}}></i></div><div className="progress-caption"><span>{closedPoints} pts cerrados</span><span>{totalPoints} pts totales</span></div><div className="support-callout"><Icon name="lucide:life-buoy"/><div><b>{supportOpen} solicitudes de Helpdesk abiertas</b><span>Atención interna pendiente en el mismo workspace.</span></div></div></section>
      <section className="panel"><div className="panel-heading"><div><h3>Distribución por estado</h3><p>Flujo de los tickets filtrados.</p></div></div><div className="status-stack">{STATUS.map(([key,label])=><div key={key}><span><Icon name={statusIcon(key)} size={15}/>{label}</span><b>{scoped.filter(t=>t.status===key).length}</b></div>)}</div></section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h3>Avance por producto</h3><p>Cerrados frente al total en el contexto seleccionado.</p></div></div>{products.filter(p=>product==='all'||p.id===product).map(p=>{const rows=scoped.filter(t=>t.product_id===p.id),done=rows.filter(t=>t.status==='closed').length,pct=rows.length?Math.round(done/rows.length*100):0;return <div className="progress-row" key={p.id}><div><b>{p.name}</b><span>{done}/{rows.length} cerrados</span></div><div className="progress-track"><i style={{width:`${pct}%`}}></i></div><strong>{pct}%</strong></div>})}</section>
    {filterOpen&&<DashboardFilterModal product={product} sprint={sprint} products={products} sprints={sprints} onClose={()=>setFilterOpen(false)} onApply={({product:nextProduct,sprint:nextSprint})=>{setProduct(nextProduct);setSprint(nextSprint);setFilterOpen(false)}}/>}
  </div>
}
function Metric({label,value,icon,tone,onClick,active=false}){const body=<><span className="metric-icon"><Icon name={icon}/></span><div><small>{label}</small><strong>{value}</strong></div></>;return onClick?<button type="button" className={`metric-card ${tone} filterable ${active?'active':''}`} onClick={onClick}>{body}</button>:<div className={`metric-card ${tone}`}>{body}</div>}

function DashboardFilterModal({product,sprint,products,sprints,onClose,onApply}){const [f,setF]=useState({product,sprint});return <Modal title="Filtros del dashboard" subtitle="Segmenta las métricas por producto y sprint." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Producto<select value={f.product} onChange={e=>setF({...f,product:e.target.value})}><option value="all">Todos los productos</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos los sprints</option>{sprints.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="text-button" onClick={()=>setF({product:'all',sprint:'all'})}>Restablecer</button><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function TicketWorkspace({workspace,title,subtitle,tickets,allTickets,products,members,sprints,modules=[],tags=[],ticketTagLinks=[],boardMode,setBoardMode,filters,onFilter,onClearFilters,canWork,canPlan,canDelete,canCreate,onCreate,onActions,onOpen,onEdit,onDelete,onBacklog,onSprint,onMove,onQuickAssign,currentUserId}){
  const activeFilters=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader title={title} subtitle={subtitle} action={canCreate?<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo ticket</button>:<span className="readonly-chip"><Icon name="lucide:eye"/> Solo consulta</span>}/>
    <section className="workspace-panel"><div className="panel-toolbar"><div className="tabs"><button className={boardMode==='table'?'active':''} onClick={()=>setBoardMode('table')}><Icon name="lucide:table-2"/>Tabla</button><button className={boardMode==='kanban'?'active':''} onClick={()=>setBoardMode('kanban')}><Icon name="lucide:columns-3"/>Kanban</button><button className={boardMode==='calendar'?'active':''} onClick={()=>setBoardMode('calendar')}><Icon name="lucide:calendar-days"/>Calendario</button><button className={boardMode==='gantt'?'active':''} onClick={()=>setBoardMode('gantt')}><Icon name="lucide:gantt-chart"/>Cronograma</button></div><div className="toolbar-actions"><button className={`filter-button ${activeFilters?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {activeFilters>0&&<em>{activeFilters}</em>}</button>{activeFilters>0&&<button className="text-button" onClick={onClearFilters}>Limpiar</button>}{canCreate&&<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button>}</div></div>
    <div className="mini-stats"><span>Total <b>{allTickets.length}</b></span><span className="gray">Backlog <b>{allTickets.filter(t=>t.status==='backlog').length}</b></span><span className="amber">En desarrollo <b>{allTickets.filter(t=>['todo','in_progress','dev_done'].includes(t.status)).length}</b></span><span className="blue">En QA <b>{allTickets.filter(t=>['qa_review','qa_rejected','qa_passed'].includes(t.status)).length}</b></span><span className="green">Cerrados <b>{allTickets.filter(t=>t.status==='closed').length}</b></span></div>
    {boardMode==='table'&&<TicketTable tickets={tickets} products={products} members={members} canWork={canWork} currentUserId={currentUserId} onQuickAssign={onQuickAssign} onActions={onActions} onOpen={onOpen}/>}
    {boardMode==='kanban'&&<Kanban tickets={tickets} products={products} members={members} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} canWork={canWork} currentUserId={currentUserId} onQuickAssign={onQuickAssign} onActions={onActions} onOpen={onOpen} onMove={onMove}/>}
    {boardMode==='calendar'&&<CalendarView workspace={workspace} tickets={tickets} products={products} onOpen={onOpen}/>}
    {boardMode==='gantt'&&<GanttView workspace={workspace} tickets={tickets} products={products} sprints={sprints} members={members} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} onBacklog={onBacklog} onSprint={onSprint} canWork={canWork} canPlan={canPlan} canDelete={canDelete} embedded/>}
    </section>
  </div>
}

function TicketAssigneeSelect({ticket,members,canWork,currentUserId,onQuickAssign,variant='kanban'}){
  const lane=['qa_review','qa_rejected','qa_passed'].includes(ticket.status)?'qa':'dev'
  const currentId=lane==='qa'?ticket.qa_owner_id:ticket.dev_owner_id
  const memberHasProduct=m=>m.role==='superadmin'||m.all_products||m.product_ids?.includes(ticket.product_id)
  const candidates=members.filter(m=>m.user_id===currentId||(m.active&&memberHasProduct(m)&&(lane==='qa'?effectivePermissions(m,m.role_template).qa_review:effectivePermissions(m,m.role_template).edit_tickets)))
  const current=candidates.find(m=>m.user_id===currentId)||members.find(m=>m.user_id===currentId)
  const owner=current?.profile?.full_name||current?.profile?.email||'Sin asignar'
  if(!canWork)return <span className={`quick-assignee-select readonly ${variant}`}><span className="mini-avatar assignee-avatar">{initials(owner)}</span><b>{owner}</b></span>
  return <label className={`quick-assignee-select ${variant}`} title={lane==='qa'?'Responsable QA':'Responsable Dev'}>
    <span className="mini-avatar assignee-avatar">{initials(owner)}</span><span className="quick-assignee-value">{owner}</span><Icon name="lucide:chevron-down" size={13} className="assignee-select-chevron"/>
    <select value={currentId||''} aria-label={lane==='qa'?'Responsable QA':'Responsable Dev'} onChange={async e=>{try{await onQuickAssign(ticket,e.target.value||null,lane)}catch(err){console.error(err)}}}><option value="">Sin asignar</option>{candidates.map(m=><option value={m.user_id} key={m.user_id}>{m.user_id===currentUserId?'Asignarme · ':''}{m.profile?.full_name||m.profile?.email||'Usuario'}</option>)}</select>
  </label>
}
function TicketTable({tickets,products,members,canWork,currentUserId,onQuickAssign,onActions,onOpen}){return <div className="table-wrap ticket-table-wrap"><div className="table modern-table"><div className="tr th"><span>TICKET</span><span>PROYECTO</span><span>RESPONSABLE</span><span>FECHA LÍMITE</span><span>ESTADO</span><span></span></div>{tickets.length===0&&<TableEmpty text="No hay tickets con estos criterios."/>}{tickets.map(t=>{const p=products.find(x=>x.id===t.product_id);return <div className="tr ticket-table-row" key={t.id}><span className="task-cell" data-label="Ticket"><button className="task-link" onClick={()=>onOpen(t)} title={t.title} aria-label={`Ver detalles de ${t.ticket_key}: ${t.title}`}><b>{t.title}</b><small>{t.ticket_key} · {TYPE_LABELS[t.type]}</small></button></span><span className="project-cell" data-label="Proyecto"><span className="product-cell-icon"><Icon name="lucide:folder" size={14}/></span><span className="cell-text-clamp">{p?.name||'—'}</span></span><span className="assignee-cell" data-label="Responsable"><TicketAssigneeSelect ticket={t} members={members} canWork={canWork} currentUserId={currentUserId} onQuickAssign={onQuickAssign} variant="table"/></span><span className="due-cell" data-label="Fecha límite">{formatDate(t.due_date)}</span><span className="status-cell" data-label="Estado"><StatusBadge status={t.status}/></span><span className="actions-cell"><button className="icon-button" onClick={()=>onActions(t)} title="Acciones" aria-label={`Acciones de ${t.ticket_key}`}><Icon name="lucide:ellipsis-vertical"/></button></span></div>})}</div></div>}
function TableEmpty({text}){return <div className="table-empty"><Icon name="lucide:inbox" size={32}/><b>Sin resultados</b><span>{text}</span></div>}
function StatusBadge({status}){return <span className={`status-badge status-badge-${status}`}><Icon name={statusIcon(status)} size={13}/>{statusLabel(status)}</span>}
function HelpStatusBadge({status}){const normalized=normalizeHelpdeskStatus(status);return <span className={`help-status help-${normalized}`}><Icon name={helpStatusIcon(normalized)} size={13}/>{helpStatusLabel(normalized)}</span>}

function Kanban({tickets,products,members,modules=[],tags=[],ticketTagLinks=[],canWork,currentUserId,onQuickAssign,onActions,onOpen,onMove}){return <div className="kanban-shell">{STATUS.map(([key,label,icon])=>{const rows=tickets.filter(t=>t.status===key);return <div className="kanban-column" key={key} onDragOver={e=>canWork&&e.preventDefault()} onDrop={e=>{if(!canWork)return;const id=e.dataTransfer.getData('text/plain');const t=tickets.find(x=>x.id===id);if(t)onMove(t,key)}}><div className="kanban-head"><span><Icon name={icon} size={16}/>{label}</span><b>{rows.length}</b></div><div className="kanban-list">{rows.map(t=><TicketCard key={t.id} ticket={t} product={products.find(p=>p.id===t.product_id)} module={modules.find(m=>m.id===t.module_id)} ticketTags={ticketTagLinks.filter(x=>x.ticket_id===t.id).map(x=>tags.find(tag=>tag.id===x.tag_id)).filter(Boolean)} members={members} canWork={canWork} currentUserId={currentUserId} onQuickAssign={onQuickAssign} onActions={onActions} onOpen={onOpen}/>)}</div></div>})}</div>}
function TicketCard({ticket,product,module,ticketTags=[],members,canWork,currentUserId,onQuickAssign,onActions,onOpen}){
  const critical=['highest','blocker'].includes(ticket.priority)
  return <article className={`ticket-card kanban-rich-card ${critical?'critical':''}`} draggable={canWork} onDragStart={e=>e.dataTransfer.setData('text/plain',ticket.id)}><div className="ticket-card-top"><small>{ticket.ticket_key}</small><span className={`priority-badge priority-${ticket.priority}`}><Icon name={ticket.priority==='blocker'?'lucide:octagon-alert':'lucide:signal-high'} size={12}/>{PRIORITY_LABELS[ticket.priority]}</span><button className="icon-button" onClick={()=>onActions(ticket)}><Icon name="lucide:ellipsis"/></button></div><button className="ticket-title-link" onClick={()=>onOpen(ticket)}><h4>{ticket.title}</h4></button>{module&&<span className="kanban-module-badge"><Icon name="lucide:blocks" size={12}/>{module.module_key} · {module.name}</span>}{ticketTags.length>0&&<div className="kanban-tag-row">{ticketTags.slice(0,3).map(tag=><span key={tag.id} style={{'--tag-color':tag.color}}><i></i>{tag.name}</span>)}{ticketTags.length>3&&<em>+{ticketTags.length-3}</em>}</div>}<div className="card-meta kanban-assignee-row"><TicketAssigneeSelect ticket={ticket} members={members} canWork={canWork} currentUserId={currentUserId} onQuickAssign={onQuickAssign} variant="kanban"/>{ticket.due_date&&<><i>•</i><span>{formatDate(ticket.due_date)}</span></>}</div><div className="card-footer"><span className="product-badge"><Icon name="lucide:folder" size={13}/>{product?.name||'Producto'}</span></div></article>
}

function CalendarView({workspace,tickets,products,onOpen}){
  const [cursor,setCursor]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)})
  useEffect(()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1))},[workspace?.id])
  const year=cursor.getFullYear(),month=cursor.getMonth()
  const first=new Date(year,month,1)
  const mondayOffset=(first.getDay()+6)%7
  const start=new Date(year,month,1-mondayOffset)
  const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
  const inRange=(ticket,key)=>{
    const a=ticket.start_date||ticket.due_date
    const b=ticket.due_date||ticket.start_date
    if(!a||!b)return false
    return key>=String(a).slice(0,10)&&key<=String(b).slice(0,10)
  }
  const unscheduled=tickets.filter(t=>!t.start_date&&!t.due_date&&t.status!=='closed')
  const upcoming=tickets.filter(t=>t.due_date&&t.status!=='closed').sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).slice(0,8)
  const monthLabel=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(cursor)
  return <div className="calendar-layout">
    <div className="calendar-main">
      <div className="calendar-toolbar"><div><h3>{monthLabel}</h3><p>Inicio planificado, duración y fecha de entrega.</p></div><div className="calendar-actions"><button type="button" className="secondary-button compact" onClick={()=>setCursor(new Date(year,month-1,1))}><Icon name="lucide:chevron-left"/></button><button type="button" className="secondary-button compact" onClick={()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1))}}>Hoy</button><button type="button" className="secondary-button compact" onClick={()=>setCursor(new Date(year,month+1,1))}><Icon name="lucide:chevron-right"/></button></div></div>
      <div className="calendar-weekdays">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=><span key={x}>{x}</span>)}</div>
      <div className="calendar-grid">{days.map(day=>{const key=dateKey(day),rows=tickets.filter(t=>inRange(t,key)).slice(0,4),outside=day.getMonth()!==month,today=key===dateKey(new Date());return <div className={`calendar-day ${outside?'outside':''} ${today?'today':''}`} key={key}><div className="calendar-day-number"><span>{day.getDate()}</span>{today&&<em>Hoy</em>}</div><div className="calendar-events">{rows.map(t=>{const product=products.find(p=>p.id===t.product_id);const start=String(t.start_date||'').slice(0,10)===key,end=String(t.due_date||'').slice(0,10)===key;return <button type="button" key={t.id} className={`calendar-ticket ${start?'starts':''} ${end?'ends':''}`} onClick={()=>onOpen(t)} title={`${t.ticket_key} · ${t.title}`}><span>{start?'▶':end?'◆':'•'}</span><b>{t.ticket_key}</b><small>{t.title}</small>{product&&<i>{product.key}</i>}</button>})}{tickets.filter(t=>inRange(t,key)).length>4&&<span className="calendar-more">+{tickets.filter(t=>inRange(t,key)).length-4} más</span>}</div></div>})}</div>
    </div>
    <aside className="calendar-aside"><div className="calendar-legend"><h4>Leyenda</h4><span><i className="legend-start">▶</i> Inicio</span><span><i className="legend-range">•</i> En ejecución</span><span><i className="legend-end">◆</i> Entrega</span></div><div className="calendar-side-card"><h4>Sin programar</h4><strong>{unscheduled.length}</strong><p>Tickets sin fecha de inicio ni entrega.</p></div><div className="calendar-side-card"><h4>Próximas entregas</h4>{upcoming.length===0&&<p className="muted">No hay fechas próximas.</p>}{upcoming.map(t=><button type="button" key={t.id} onClick={()=>onOpen(t)}><span><b>{t.ticket_key}</b><small>{t.title}</small></span><time>{formatDate(t.due_date)}</time></button>)}</div></aside>
  </div>
}

function GanttView({workspace,tickets,products,sprints,members=[],modules=[],ticketLinks=[],onOpen,onEdit,onDelete,onBacklog,onSprint,canWork=false,canPlan=false,canDelete=false,embedded=false}){
  const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return dateKey(d)}
  const [range,setRange]=useState('4w')
  const [groupBy,setGroupBy]=useState('none')
  const [kpiFilter,setKpiFilter]=useState('all')
  const [cursor,setCursor]=useState(yesterday)
  useEffect(()=>{setCursor(yesterday());setRange('4w');setGroupBy('none');setKpiFilter('all')},[workspace?.id])
  const start=new Date(`${cursor}T12:00:00`)
  const addRange=(date,key)=>{const d=new Date(date);if(key.endsWith('w'))d.setDate(d.getDate()+Number(key.slice(0,-1))*7);else d.setMonth(d.getMonth()+Number(key.slice(0,-1)));return d}
  const endExclusive=addRange(start,range)
  const end=new Date(endExclusive);end.setDate(end.getDate()-1)
  const span=daysBetween(cursor,dateKey(end))+1
  const days=Array.from({length:span},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
  const todayKey=dateKey(new Date())
  const scheduled=tickets.filter(t=>t.start_date||t.due_date).sort((a,b)=>String(a.start_date||a.due_date).localeCompare(String(b.start_date||b.due_date)))
  const unscheduled=tickets.filter(t=>!t.start_date&&!t.due_date&&t.status!=='closed')
  const overdueTickets=tickets.filter(t=>t.due_date&&t.due_date<todayKey&&!['qa_passed','closed'].includes(t.status))
  const overdue=overdueTickets.length
  const historicalSprints=sprints.filter(s=>s.status==='completed')
  const historicalSprintIds=new Set(historicalSprints.map(s=>s.id))
  const closedTickets=tickets.filter(t=>t.status==='closed')
  const dayWidth=span<=8?70:span<=30?34:span<=45?26:span<=60?22:span<=95?16:11
  const cellStyle={gridTemplateColumns:`repeat(${span},${dayWidth}px)`}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
  const position=t=>{const a=t.start_date||t.due_date,b=t.due_date||t.start_date;if(!a||!b)return null;const from=daysBetween(cursor,a),to=daysBetween(cursor,b);if(to<0||from>=span)return null;return {start:clamp(from,0,span-1)+1,end:clamp(to,0,span-1)+2,leftCut:from<0,rightCut:to>=span}}
  const filteredScheduled=kpiFilter==='overdue'?overdueTickets:kpiFilter==='closed'?closedTickets.filter(t=>t.start_date||t.due_date):kpiFilter==='historical'?scheduled.filter(t=>historicalSprintIds.has(t.sprint_id)):kpiFilter==='unscheduled'?[]:scheduled
  const visibleTickets=filteredScheduled.filter(t=>position(t))
  const ticketGroups=groupBy==='module'
    ? Object.values(visibleTickets.reduce((acc,t)=>{const key=t.module_id||'none';if(!acc[key])acc[key]={id:key,module:modules.find(m=>m.id===t.module_id)||null,tickets:[]};acc[key].tickets.push(t);return acc},{})).sort((a,b)=>String(a.module?.name||'ZZZ Sin módulo').localeCompare(String(b.module?.name||'ZZZ Sin módulo')))
    : [{id:'all',module:null,tickets:visibleTickets}]
  const sprintSource=kpiFilter==='historical'?historicalSprints:kpiFilter==='overdue'||kpiFilter==='closed'||kpiFilter==='unscheduled'?[]:sprints
  const sprintRows=sprintSource.filter(x=>x.start_date&&x.end_date).map(s=>({s,pos:position({start_date:s.start_date,due_date:s.end_date})})).filter(x=>x.pos).sort((a,b)=>String(a.s.start_date).localeCompare(String(b.s.start_date)))
  const filterResultTickets=kpiFilter==='unscheduled'?unscheduled:kpiFilter==='overdue'?overdueTickets:kpiFilter==='closed'?closedTickets:kpiFilter==='historical'?tickets.filter(t=>historicalSprintIds.has(t.sprint_id)):[]
  const toggleKpi=key=>setKpiFilter(current=>current===key?'all':key)
  const shiftPeriod=dir=>{const d=new Date(start);if(range.endsWith('w'))d.setDate(d.getDate()+dir*Number(range.slice(0,-1))*7);else d.setMonth(d.getMonth()+dir*Number(range.slice(0,-1)));setCursor(dateKey(d))}
  const today=()=>setCursor(yesterday())
  const jumpSprint=id=>{const sprint=sprints.find(x=>x.id===id);if(sprint?.start_date)setCursor(sprint.start_date)}
  const monthGroups=[]
  days.forEach((d,i)=>{const key=`${d.getFullYear()}-${d.getMonth()}`;const last=monthGroups[monthGroups.length-1];if(last?.key===key)last.count++;else monthGroups.push({key,label:new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(d),start:i+1,count:1})})
  const assignee=t=>members.find(m=>m.user_id===(t.qa_owner_id||t.dev_owner_id))?.profile?.full_name||''
  const rangeLabel={ '1w':'1 semana','4w':'4 semanas','6w':'6 semanas','8w':'8 semanas','1m':'1 mes','2m':'2 meses','3m':'3 meses','6m':'6 meses' }[range]
  const content=<>
    <div className="gantt-toolbar jira-timeline-toolbar"><div className="gantt-title-line"><h3>Timeline / Gantt</h3><p>{formatDate(cursor)} → {formatDate(dateKey(end))} · {rangeLabel} · histórico, proyección y progreso</p></div><div className="gantt-controls gantt-controls-v14">
      <label className="gantt-date-control"><span>Desde</span><input type="date" value={cursor} onChange={e=>e.target.value&&setCursor(e.target.value)} aria-label="Fecha inicial del Gantt"/></label>
      <select value={range} onChange={e=>setRange(e.target.value)} aria-label="Periodo visible"><optgroup label="Semanas"><option value="1w">1 semana</option><option value="4w">4 semanas</option><option value="6w">6 semanas</option><option value="8w">8 semanas</option></optgroup><optgroup label="Meses"><option value="1m">1 mes</option><option value="2m">2 meses</option><option value="3m">3 meses</option><option value="6m">6 meses</option></optgroup></select>
      <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} aria-label="Agrupar Timeline"><option value="none">Sin agrupar</option><option value="module">Agrupar por módulo</option></select>
      <select value="" onChange={e=>{if(e.target.value)jumpSprint(e.target.value)}} aria-label="Ir a sprint"><option value="">Ir a sprint…</option>{[...sprints].sort((a,b)=>String(b.start_date||'').localeCompare(String(a.start_date||''))).map(s=><option key={s.id} value={s.id}>{s.status==='completed'?'✓ ':s.status==='active'?'● ':'○ '}{s.name} · {formatDate(s.start_date)}</option>)}</select>
      <div className="gantt-nav-control" aria-label="Navegación del periodo"><button type="button" className="secondary-button compact" onClick={()=>shiftPeriod(-1)} title="Periodo anterior"><Icon name="lucide:chevron-left"/></button><button type="button" className="secondary-button compact" onClick={today}>Hoy</button><button type="button" className="secondary-button compact" onClick={()=>shiftPeriod(1)} title="Periodo siguiente"><Icon name="lucide:chevron-right"/></button></div>
    </div></div>
    <div className="gantt-kpis" role="group" aria-label="Filtros rápidos del cronograma"><button type="button" className={kpiFilter==='planned'?'active':''} onClick={()=>toggleKpi('planned')}><b>{scheduled.length}</b> planificados</button><button type="button" className={kpiFilter==='unscheduled'?'active':''} onClick={()=>toggleKpi('unscheduled')}><b>{unscheduled.length}</b> en Backlog / sin fechas</button><button type="button" className={`${overdue?'danger-text ':''}${kpiFilter==='overdue'?'active':''}`} onClick={()=>toggleKpi('overdue')}><b>{overdue}</b> vencidos</button><button type="button" className={kpiFilter==='historical'?'active':''} onClick={()=>toggleKpi('historical')}><b>{historicalSprints.length}</b> sprints históricos</button><button type="button" className={kpiFilter==='closed'?'active':''} onClick={()=>toggleKpi('closed')}><b>{closedTickets.length}</b> tickets cerrados</button>{kpiFilter!=='all'&&<button type="button" className="gantt-kpi-clear" onClick={()=>setKpiFilter('all')}><Icon name="lucide:x" size={12}/> Limpiar filtro</button>}</div>
    {filterResultTickets.length>0&&<div className="gantt-filter-results"><div><b>{kpiFilter==='unscheduled'?'Backlog / sin fechas':kpiFilter==='overdue'?'Tickets vencidos':kpiFilter==='closed'?'Tickets cerrados':'Tickets de sprints históricos'}</b><small>{filterResultTickets.length} resultado(s). Haz clic para abrir el ticket.</small></div><div>{filterResultTickets.slice(0,40).map(t=><button type="button" key={t.id} onClick={()=>onOpen(t)}><span>{t.ticket_key}</span>{t.title}</button>)}</div></div>}
    <div className="gantt-scroll jira-timeline-scroll"><div className="gantt-canvas jira-timeline-canvas" style={{'--gantt-days':span,'--gantt-day-width':`${dayWidth}px`}}>
      <div className="gantt-month-header"><div className="gantt-label gantt-label-head">Actividad</div><div className="gantt-days gantt-month-grid" style={cellStyle}>{monthGroups.map(g=><span key={g.key} style={{gridColumn:`${g.start}/span ${g.count}`}}>{g.label}</span>)}</div></div>
      <div className="gantt-header"><div className="gantt-label gantt-label-head"><span>Tarea</span><small>{visibleTickets.length} visibles</small></div><div className="gantt-days gantt-days-head" style={cellStyle}>{days.map(d=><span key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}><b>{d.getDate()}</b><small>{new Intl.DateTimeFormat('es-MX',{weekday:'narrow'}).format(d)}</small></span>)}</div></div>
      {sprintRows.length>0&&<div className="gantt-sprints"><div className="gantt-group-title"><Icon name="lucide:calendar-range"/> Sprints · activos, planeados e históricos</div>{sprintRows.map(({s,pos})=>{const rows=tickets.filter(t=>t.sprint_id===s.id),pct=rows.length?Math.round(rows.reduce((a,t)=>a+ticketProgress(t.status),0)/rows.length):0;return <div className={`gantt-row sprint-row sprint-${s.status}`} key={s.id}><button type="button" className="gantt-label sprint-label-button" onClick={()=>onSprint?.(s)}><span className={`sprint-status ${s.status}`}>{s.status==='active'?'Activo':s.status==='completed'?'Cerrado':'Planeado'}</span><b>{s.name}</b><small>{formatDate(s.start_date)} → {formatDate(s.end_date)} · {rows.length} tickets · {pct}%</small></button><div className="gantt-days gantt-track" style={cellStyle}>{days.map(d=><i key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}></i>)}<button type="button" className={`gantt-sprint-bar ${s.status}`} style={{gridColumn:`${pos.start}/${pos.end}`}} onClick={()=>onSprint?.(s)} title={`${s.name} · ${pct}%`}><b>{s.name}</b><em style={{width:`${pct}%`}}></em></button></div></div>})}</div>}
      <div className="gantt-group-title"><Icon name="lucide:ticket"/> Actividades</div>
      {visibleTickets.length===0&&<div className="gantt-empty"><Icon name="lucide:calendar-off"/><span>No hay tickets programados dentro del periodo visible. Cambia la fecha, el periodo o selecciona un sprint histórico.</span></div>}
      {ticketGroups.map(group=><React.Fragment key={group.id}>{groupBy==='module'&&<div className="gantt-module-group-row"><div className="gantt-label"><span className="module-chip" style={{'--module-color':group.module?.color||'#D4DCE0'}}><i></i>{group.module?`${group.module.module_key} · ${group.module.name}`:'Sin módulo'}</span><small>{group.tickets.length} tickets</small></div><div className="gantt-days gantt-track" style={cellStyle}></div></div>}{group.tickets.map(t=>{const pos=position(t),product=products.find(p=>p.id===t.product_id),module=modules.find(m=>m.id===t.module_id),pct=ticketProgress(t.status),owner=assignee(t),blockers=ticketLinks.filter(l=>l.link_type==='blocks'&&l.target_ticket_id===t.id).map(l=>tickets.find(x=>x.id===l.source_ticket_id)).filter(Boolean),blocker=blockers[0],blockPos=blocker?position(blocker):null;return <div className={`gantt-row ticket-timeline-row ${t.status==='closed'?'historical':''}`} key={t.id}><div className="gantt-label gantt-ticket-label jira-task-label"><button type="button" className="gantt-task-main" onClick={()=>onOpen(t)}><span><Icon name={statusIcon(t.status)} size={13}/><b>{t.ticket_key}</b><em>{product?.key||'—'}</em></span><strong>{t.title}</strong><small>{statusLabel(t.status)} · {pct}%{owner?` · ${owner}`:''}{module?` · ${module.module_key}`:''}</small></button><div className="gantt-row-actions"><button type="button" title="Ver detalle" onClick={()=>onOpen(t)}><Icon name="lucide:eye"/></button>{canWork&&<button type="button" title="Editar" onClick={()=>onEdit?.(t)}><Icon name="lucide:pencil"/></button>}{canPlan&&t.sprint_id&&<button type="button" title="Mover a Backlog" onClick={()=>onBacklog?.(t)}><Icon name="lucide:inbox"/></button>}{canDelete&&<button type="button" className="danger-text" title="Eliminar" onClick={()=>onDelete?.(t)}><Icon name="lucide:trash-2"/></button>}</div></div><div className="gantt-days gantt-track" style={cellStyle}>{days.map(d=><i key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}></i>)}{blockPos&&pos&&<span className="gantt-dependency-line" style={{gridColumn:`${Math.min(Math.max(blockPos.end-1,1),pos.start)}/${Math.max(Math.max(blockPos.end-1,1),pos.start)+1}`}} title={`Bloqueado por ${blocker.ticket_key}`}><Icon name="lucide:corner-down-right" size={12}/><em>{blocker.ticket_key}</em></span>}{pos&&<button type="button" className={`gantt-bar status-${t.status} ${pos.leftCut?'cut-left':''} ${pos.rightCut?'cut-right':''}`} style={{gridColumn:`${pos.start}/${pos.end}`}} onClick={()=>onOpen(t)} title={`${t.ticket_key} · ${t.title} · ${pct}%`}><span style={{width:`${pct}%`}}></span><b>{pct}%</b></button>}</div></div>})}</React.Fragment>)}
    </div></div>
    {unscheduled.length>0&&<div className="gantt-unscheduled"><div><Icon name="lucide:inbox"/><span><b>{unscheduled.length} actividades en Backlog / sin programar</b><small>Asigna sprint y fechas para incorporarlas al Timeline.</small></span></div><div>{unscheduled.slice(0,8).map(t=><button type="button" key={t.id} onClick={()=>onOpen(t)}>{t.ticket_key} · {t.title}</button>)}</div></div>}
  </>
  if(embedded)return <div className="gantt-embedded">{content}</div>
  return <div className="page"><PageHeader eyebrow="Planificación" title="Timeline / Gantt" subtitle="Cronograma estilo Jira con fecha inicial configurable, ventanas semanales/mensuales e histórico de sprints." icon="lucide:gantt-chart"/><section className="workspace-panel gantt-panel">{content}</section></div>
}
function BacklogView({workspace,tickets,products,sprints,members,modules=[],tags=[],ticketTagLinks=[],canPlan,onTicket,onPlan,onBulkMove,onSprint,onCloseSprint,onCreateSprint,onImport}){
  const [moduleFilter,setModuleFilter]=useState('all'),[tagFilter,setTagFilter]=useState('all'),[selected,setSelected]=useState([]),[bulkSprint,setBulkSprint]=useState(''),[bulkError,setBulkError]=useState('')
  const tagTicketIds=useMemo(()=>tagFilter==='all'?null:new Set(ticketTagLinks.filter(x=>x.tag_id===tagFilter).map(x=>x.ticket_id)),[tagFilter,ticketTagLinks])
  const visibleTickets=useMemo(()=>tickets.filter(t=>(moduleFilter==='all'||(moduleFilter===''?!t.module_id:t.module_id===moduleFilter))&&(!tagTicketIds||tagTicketIds.has(t.id))),[tickets,moduleFilter,tagTicketIds])
  const backlog=visibleTickets.filter(t=>!t.sprint_id&&t.status!=='closed')
  const ordered=[...sprints].sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')))
  const active=ordered.filter(s=>s.status!=='completed')
  const completed=ordered.filter(s=>s.status==='completed').slice(-4).reverse()
  const today=dateKey(new Date())
  const selectedSet=new Set(selected),allSelected=backlog.length>0&&backlog.every(t=>selectedSet.has(t.id))
  const toggle=id=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
  const toggleAll=()=>setSelected(allSelected?[]:backlog.map(t=>t.id))
  const bulk=async()=>{setBulkError('');try{if(!bulkSprint)throw new Error('Selecciona el sprint destino.');await onBulkMove(selected,bulkSprint);setSelected([]);setBulkSprint('')}catch(e){setBulkError(e.message||String(e))}}
  useEffect(()=>{setSelected(v=>v.filter(id=>backlog.some(t=>t.id===id)))},[moduleFilter,tagFilter,tickets.length])
  return <div className="page"><PageHeader eyebrow="Planificación" title="Backlog y Sprints" subtitle="Prioriza el trabajo pendiente, organiza ciclos y mueve varias actividades a un sprint en una sola acción." icon="lucide:list-todo" action={canPlan?<div className="page-header-actions"><button className="secondary-button" onClick={onImport}><Icon name="lucide:file-spreadsheet"/> Importar Excel / CSV</button><button className="primary" onClick={onCreateSprint}><Icon name="lucide:plus"/> Nuevo sprint</button></div>:<span className="readonly-chip"><Icon name="lucide:eye"/> Consulta</span>}/>
    <div className="backlog-filterbar"><div><Icon name="lucide:filter"/><b>Agrupar / filtrar trabajo</b></div><label>Módulo<select value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)}><option value="all">Todos los módulos</option><option value="">Sin módulo</option>{modules.map(m=><option value={m.id} key={m.id}>{m.module_key} · {m.name}</option>)}</select></label><label>Tag<select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}><option value="all">Todas las tags</option>{tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>{(moduleFilter!=='all'||tagFilter!=='all')&&<button type="button" className="text-button" onClick={()=>{setModuleFilter('all');setTagFilter('all')}}>Limpiar</button>}</div>
    {canPlan&&<div className={`bulk-sprint-bar ${selected.length?'active':''}`}><label className="bulk-select-all"><input type="checkbox" checked={allSelected} onChange={toggleAll}/><span>{selected.length?`${selected.length} seleccionados`:'Seleccionar backlog'}</span></label><div><select value={bulkSprint} onChange={e=>setBulkSprint(e.target.value)} disabled={!selected.length}><option value="">Mover seleccionados a…</option>{active.map(s=><option key={s.id} value={s.id}>{s.name} · {s.status==='active'?'Activo':'Planeado'}</option>)}</select><button type="button" className="primary compact" disabled={!selected.length||!bulkSprint} onClick={bulk}><Icon name="lucide:move-right"/> Mover {selected.length||''}</button>{selected.length>0&&<button type="button" className="text-button" onClick={()=>setSelected([])}>Cancelar selección</button>}</div>{bulkError&&<span className="bulk-error"><Icon name="lucide:triangle-alert"/>{bulkError}</span>}</div>}
    <div className="backlog-summary"><Metric label="Backlog" value={backlog.length} icon="lucide:inbox" tone="navy"/><Metric label="Sprints activos" value={active.filter(s=>s.status==='active').length} icon="lucide:zap" tone="orange"/><Metric label="Planeados" value={active.filter(s=>s.status==='planned').length} icon="lucide:calendar-clock" tone="blue"/><Metric label="Sin resolver en sprint" value={visibleTickets.filter(t=>t.sprint_id&&!['qa_passed','closed'].includes(t.status)).length} icon="lucide:circle-dashed" tone="red"/></div>
    <section className="backlog-board"><div className="backlog-column backlog-pool"><div className="backlog-head"><div><span className="eyebrow">COLA DE TRABAJO</span><h3>Backlog</h3><p>Tickets aún no comprometidos en un sprint.</p></div><b>{backlog.length}</b></div><div className="backlog-ticket-list">{backlog.length===0&&<div className="compact-empty"><Icon name="lucide:inbox"/><span>Backlog vacío para este filtro</span></div>}{backlog.map(t=>{const p=products.find(x=>x.id===t.product_id),m=modules.find(x=>x.id===t.module_id);return <article className={`backlog-ticket ${selectedSet.has(t.id)?'selected':''}`} key={t.id}>{canPlan&&<label className="backlog-check" title="Seleccionar para mover en lote"><input type="checkbox" checked={selectedSet.has(t.id)} onChange={()=>toggle(t.id)}/></label>}<button type="button" className="backlog-ticket-main" onClick={()=>onTicket(t)}><small>{t.ticket_key} · {p?.name||'Producto'}{m?` · ${m.module_key}`:''}</small><b>{t.title}</b><span><StatusBadge status={t.status}/><em className={`priority-badge priority-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</em></span></button>{canPlan&&<button type="button" className="secondary-button compact" onClick={()=>onPlan(t)}><Icon name="lucide:calendar-plus"/> Planificar</button>}</article>})}</div></div>
      <div className="sprint-stack"><div className="backlog-head"><div><span className="eyebrow">CICLOS</span><h3>Sprints</h3><p>Trabajo comprometido y proyección de entregas.</p></div></div>{active.length===0&&<div className="compact-empty"><Icon name="lucide:calendar-off"/><span>No hay sprints planeados o activos.</span></div>}{active.map(s=>{const rows=visibleTickets.filter(t=>t.sprint_id===s.id),done=rows.filter(t=>['qa_passed','closed'].includes(t.status)).length,pct=rows.length?Math.round(done/rows.length*100):0,unresolved=rows.length-done,expired=s.end_date&&s.end_date<today;return <article className={`sprint-card ${s.status} ${expired?'expired':''}`} key={s.id}><div className="sprint-card-head"><div><span className={`sprint-status ${s.status}`}>{s.status==='active'?'Activo':'Planeado'}</span>{expired&&<span className="expired-chip"><Icon name="lucide:alarm-clock"/> Vencido</span>}<h3>{s.name}</h3><p>{s.goal||'Sin objetivo definido.'}</p></div><button type="button" className="icon-button" onClick={()=>onSprint(s)}><Icon name="lucide:expand"/></button></div><div className="sprint-dates"><span><Icon name="lucide:calendar-range"/> {formatDate(s.start_date)} → {formatDate(s.end_date)}</span><span>{rows.length} tickets · {unresolved} no resueltos</span></div><div className="sprint-progress"><div><i style={{width:`${pct}%`}}></i></div><b>{pct}%</b></div><div className="sprint-preview">{rows.slice(0,4).map(t=><button type="button" key={t.id} onClick={()=>onTicket(t)}><span>{t.ticket_key}</span><b>{t.title}</b><StatusBadge status={t.status}/></button>)}{rows.length>4&&<small>+{rows.length-4} actividades</small>}</div><div className="sprint-card-actions"><button type="button" className="secondary-button compact" onClick={()=>onSprint(s)}><Icon name="lucide:file-text"/> Detalle</button>{canPlan&&<button type="button" className={expired?'primary compact':'secondary-button compact'} onClick={()=>onCloseSprint(s)}><Icon name="lucide:arrow-right-circle"/> Cerrar / trasladar</button>}</div></article>})}
      {completed.length>0&&<div className="completed-sprints"><h4>Sprints completados</h4>{completed.map(s=><button type="button" key={s.id} onClick={()=>onSprint(s)}><span><b>{s.name}</b><small>{formatDate(s.start_date)} → {formatDate(s.end_date)}</small></span><Icon name="lucide:chevron-right"/></button>)}</div>}</div>
    </section>
  </div>
}
function BacklogImportModal({workspace,products,members,session,onClose,onImported}){
  const [fileName,setFileName]=useState('')
  const [rows,setRows]=useState([])
  const [issues,setIssues]=useState([])
  const [parsing,setParsing]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [sourceType,setSourceType]=useState('')
  const productMap=useMemo(()=>{const map={};products.forEach(p=>{map[importNorm(p.key)]=p;map[importNorm(p.name)]=p});return map},[products])
  const memberCanProduct=(m,productId)=>m.role==='superadmin'||m.all_products||m.product_ids?.includes(productId)
  const normalizeRecords=(source,rowOffset=2)=>{
    const parsed=[],errs=[]
    const candidates=source.map((r,i)=>({r,excelRow:r.__rowNumber||i+rowOffset,title:String(importCell(r,'Titulo','Titulo*','Título','Título*')||'').trim(),productValue:String(importCell(r,'Producto','Producto*')||'').trim()})).filter(x=>(x.title||x.productValue)&&!importNorm(x.title).startsWith('ejemplo -'))
    if(candidates.length>250)errs.push({row:'—',message:'El archivo supera el máximo de 250 tickets por importación.'})
    candidates.slice(0,250).forEach(({r,excelRow,title,productValue})=>{
      const localIssues=[]
      if(!title)localIssues.push('Falta Titulo.')
      if(title.length>220)localIssues.push('Titulo supera 220 caracteres.')
      const product=productMap[importNorm(productValue)]
      if(!product)localIssues.push(`Producto “${productValue||'—'}” no existe o no está autorizado.`)
      const typeText=importNorm(importCell(r,'Tipo')||'tarea'),type=IMPORT_TYPE_MAP[typeText]
      if(!type)localIssues.push(`Tipo “${importCell(r,'Tipo')}” inválido.`)
      const priorityText=importNorm(importCell(r,'Prioridad')||'media'),priority=IMPORT_PRIORITY_MAP[priorityText]
      if(!priority)localIssues.push(`Prioridad “${importCell(r,'Prioridad')}” inválida.`)
      const spRaw=String(importCell(r,'Story Points','Story points')||'').trim();const storyPoints=spRaw===''?null:Number(spRaw)
      if(storyPoints!==null&&(!Number.isInteger(storyPoints)||storyPoints<1||storyPoints>5))localIssues.push('Story Points debe ser un entero entre 1 y 5.')
      const startRaw=importCell(r,'Fecha inicio'),dueRaw=importCell(r,'Fecha limite','Fecha límite')
      const startDate=importDateValue(startRaw),dueDate=importDateValue(dueRaw)
      if(String(startRaw).trim()&&startDate===null)localIssues.push(`Fecha inicio “${startRaw}” inválida.`)
      if(String(dueRaw).trim()&&dueDate===null)localIssues.push(`Fecha limite “${dueRaw}” inválida.`)
      if(startDate&&dueDate&&dueDate<startDate)localIssues.push('Fecha límite no puede ser anterior a Fecha inicio.')
      localIssues.forEach(message=>errs.push({row:excelRow,message}))
      let devOwner=null,qaOwner=null
      if(product&&localIssues.length===0){
        const resolverIssues=[]
        const resolve=(value,permission,label)=>{const raw=String(value??'').trim();if(!raw)return null;const norm=importNorm(raw);const matches=members.filter(m=>m.active&&effectivePermissions(m,m.role_template)[permission]&&memberCanProduct(m,product.id)&&(m.user_id===raw||importNorm(m.profile?.full_name)===norm));if(matches.length===0){resolverIssues.push(`${label}: “${raw}” no coincide con Staff autorizado.`);return null}if(matches.length>1){resolverIssues.push(`${label}: “${raw}” es ambiguo; usa UUID.`);return null}return matches[0].user_id}
        devOwner=resolve(importCell(r,'Responsable Dev'),'edit_tickets','Responsable Dev')
        qaOwner=resolve(importCell(r,'Responsable QA'),'qa_review','Responsable QA')
        resolverIssues.forEach(message=>errs.push({row:excelRow,message}))
      }
      parsed.push({row:excelRow,title,product_id:product?.id||'',product_key:product?.key||productValue,description:String(importCell(r,'Descripcion','Descripción')||'').trim(),type:type||'task',priority:priority||'medium',story_points:storyPoints,dev_owner_id:devOwner,qa_owner_id:qaOwner,start_date:startDate||'',due_date:dueDate||''})
    })
    if(parsed.length===0&&!errs.length)errs.push({row:'—',message:'No se encontraron tickets válidos en el archivo.'})
    return {parsed,errs}
  }
  const parseFile=async file=>{
    setError('');setRows([]);setIssues([]);setFileName(file?.name||'');setSourceType('')
    if(!file)return
    setParsing(true)
    try{
      const lower=String(file.name||'').toLowerCase()
      let source=[],rowOffset=2
      if(lower.endsWith('.csv')){
        if(!window.TrobbuCsvImport)throw new Error('No se pudo cargar el lector CSV. Recarga la página e intenta nuevamente.')
        const result=await window.TrobbuCsvImport.readFile(file)
        if(!result.headerCheck.valid)throw new Error(result.headerCheck.errors.join(' '))
        source=result.records||[];rowOffset=2;setSourceType('CSV')
      }else if(lower.endsWith('.xlsx')||lower.endsWith('.xls')||lower.endsWith('.xlsm')){
        if(!window.XLSX)throw new Error('No se pudo cargar el lector de Excel. Recarga la página e intenta nuevamente.')
        const buffer=await file.arrayBuffer(),book=window.XLSX.read(buffer,{type:'array',cellDates:false})
        const sheet=book.Sheets['Tickets Backlog']||book.Sheets[book.SheetNames[0]]
        if(!sheet)throw new Error('El archivo no contiene una hoja válida.')
        const matrix=window.XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false})
        if(!window.TrobbuCsvImport)throw new Error('No se pudo cargar el normalizador de encabezados. Recarga la página e intenta nuevamente.')
        const converted=window.TrobbuCsvImport.rowsToObjects(matrix)
        const headerCheck=window.TrobbuCsvImport.validateHeaders(converted.headers)
        if(!headerCheck.valid)throw new Error(headerCheck.errors.join(' '))
        source=converted.records||[];rowOffset=(converted.headerRowIndex>=0?converted.headerRowIndex+2:2);setSourceType(lower.endsWith('.xlsm')?'XLSM':'Excel')
      }else throw new Error('Formato no compatible. Usa XLSX, XLS, XLSM o CSV exportado desde Google Sheets.')
      const {parsed,errs}=normalizeRecords(source,rowOffset)
      setRows(parsed);setIssues(errs)
    }catch(err){setError(err.message||String(err))}finally{setParsing(false)}
  }
  const valid=rows.length>0&&issues.length===0
  const save=async()=>{
    if(!valid)throw new Error('Corrige los errores del archivo antes de importar.')
    setSaving(true);setError('')
    try{
      const payload=rows.map(({row,product_key,...x})=>x)
      const {data,error}=await db.rpc('import_backlog_tickets',{p_workspace:workspace.id,p_rows:payload})
      if(error)throw error
      await onImported(data||{imported:rows.length})
    }catch(err){setError(err.message||String(err))}finally{setSaving(false)}
  }
  return <Modal title="Importar tickets al Backlog" subtitle="Carga actividades desde Excel, XLSM o CSV exportado desde Google Sheets. Todo el archivo se valida antes de crear tickets." onClose={onClose} size="xl">
    <div className="form-body backlog-import-body">
      <div className="import-intro"><span><Icon name="lucide:file-spreadsheet" size={26}/></span><div><b>Plantilla controlada para Backlog</b><p>Título y producto son obligatorios. Sprint siempre queda vacío; estado siempre será Backlog.</p></div><div className="import-template-actions"><a className="secondary-button compact" href="./plantilla-importacion-backlog-trobbu.xlsx" download><Icon name="lucide:download"/> Excel</a><a className="secondary-button compact" href="./plantilla-importacion-backlog-trobbu.xlsm" download><Icon name="lucide:download"/> XLSM</a><a className="secondary-button compact" href="./plantilla-importacion-backlog-trobbu.csv" download><Icon name="lucide:download"/> CSV</a></div></div>
      <label className="file-drop import-file-drop"><input type="file" accept=".xlsx,.xls,.xlsm,.csv,text/csv,application/vnd.ms-excel.sheet.macroEnabled.12" onChange={e=>parseFile(e.target.files?.[0])}/><Icon name="lucide:upload-cloud" size={28}/><b>{fileName||'Seleccionar Excel, CSV o XLSM'}</b><span>{parsing?'Validando archivo…':`${sourceType?sourceType+' · ':''}XLSX, XLS, XLSM o CSV · máximo 250 tickets`}</span></label>
      {(rows.length>0||issues.length>0)&&<div className="import-kpis"><span><b>{rows.length}</b> filas detectadas</span><span className={issues.length?'danger-text':'success-text'}><b>{issues.length}</b> errores</span><span><b>{valid?rows.length:0}</b> listos para importar</span></div>}
      {issues.length>0&&<div className="import-errors"><h4><Icon name="lucide:triangle-alert"/> Corrige antes de importar</h4>{issues.slice(0,20).map((x,i)=><p key={`${x.row}-${i}`}><b>Fila {x.row}</b>{x.message}</p>)}{issues.length>20&&<small>+{issues.length-20} errores adicionales</small>}</div>}
      {rows.length>0&&<div className="import-preview"><div className="panel-heading"><div><h4>Vista previa</h4><p>Se muestran hasta 20 tickets.</p></div></div><div className="table-wrap"><table><thead><tr><th>Fila</th><th>Producto</th><th>Título</th><th>Tipo</th><th>Prioridad</th><th>SP</th><th>Inicio</th><th>Límite</th></tr></thead><tbody>{rows.slice(0,20).map(r=><tr key={r.row}><td>{r.row}</td><td><b>{r.product_key}</b></td><td>{r.title}</td><td>{TYPE_LABELS[r.type]}</td><td>{PRIORITY_LABELS[r.priority]}</td><td>{r.story_points??'—'}</td><td>{r.start_date||'—'}</td><td>{r.due_date||'—'}</td></tr>)}</tbody></table></div></div>}
      {error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}
    </div>
    <div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div><div className="modal-actions"><button type="button" className="primary" disabled={!valid||saving||parsing} onClick={save}>{saving?'Importando…':`Importar ${valid?rows.length:0} tickets`}</button></div></div>
  </Modal>
}

function ReporterTicketsView({tickets,products,onCreate,onOpen}){
  const open=tickets.filter(t=>!['qa_passed','closed'].includes(t.status)).length
  const done=tickets.filter(t=>['qa_passed','closed'].includes(t.status)).length
  return <div className="page"><PageHeader eyebrow="Portal de tickets" title="Mis tickets enviados" subtitle="Crea solicitudes de desarrollo y consulta su avance sin acceder a la administración del tablero." icon="lucide:ticket-check" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Enviar ticket</button>}/><div className="metric-grid four"><Metric label="Enviados" value={tickets.length} icon="lucide:send" tone="blue"/><Metric label="En backlog" value={tickets.filter(t=>t.status==='backlog').length} icon="lucide:inbox" tone="navy"/><Metric label="En seguimiento" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Completados" value={done} icon="lucide:circle-check" tone="green"/></div><section className="workspace-panel"><div className="requester-ticket-list">{tickets.length===0&&<TableEmpty text="Todavía no has enviado tickets en este workspace."/>}{tickets.map(t=>{const product=products.find(p=>p.id===t.product_id);return <button type="button" key={t.id} onClick={()=>onOpen(t)}><span className="requester-ticket-icon"><Icon name="lucide:ticket"/></span><span><small>{t.ticket_key} · {product?.name||'Producto'}</small><b>{t.title}</b><em>Actualizado {formatDateTime(t.updated_at)}</em></span><StatusBadge status={t.status}/><Icon name="lucide:chevron-right"/></button>})}</div></section></div>
}

function RequirementBadge({status}){const value=status||'pending';const icon=value==='accepted_backlog'?'lucide:circle-check-big':value==='rejected'?'lucide:circle-x':'lucide:clock-3';return <span className={`requirement-badge requirement-${value}`}><Icon name={icon} size={13}/>{requirementStatusLabel(value)}</span>}
function HelpdeskPortal({items,departments,requestTypes=[],products=[],onCreate,onOpen}){
  const order=['created','review','attended','closed']
  const normal=items.filter(x=>!isProposalCategory(x.category)),requirements=items.filter(x=>isProposalCategory(x.category))
  const active=normal.filter(x=>normalizeHelpdeskStatus(x.status)!=='closed').length
  const categoryCounts=requestTypes.map(type=>({key:type.id,label:type.name,color:type.color,count:items.filter(x=>x.request_type_id===type.id).length})).filter(x=>x.count)
  return <div className="page"><PageHeader eyebrow="Portal administrativo" title="Mis solicitudes" subtitle="Crea solicitudes, consulta únicamente las tuyas y confirma el cierre cuando la atención esté completa." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid six portal-metrics"><Metric label="Solicitudes" value={items.length} icon="lucide:inbox" tone="blue"/><Metric label="En seguimiento" value={active} icon="lucide:loader-circle" tone="orange"/><Metric label="Cerradas" value={normal.filter(x=>normalizeHelpdeskStatus(x.status)==='closed').length} icon="lucide:circle-check" tone="green"/><Metric label="Requerimientos pendientes" value={requirements.filter(x=>(x.proposal_status||'pending')==='pending').length} icon="lucide:lightbulb" tone="purple"/><Metric label="Aceptados a Backlog" value={requirements.filter(x=>x.proposal_status==='accepted_backlog').length} icon="lucide:list-plus" tone="navy"/><Metric label="Sugerencias rechazadas" value={requirements.filter(x=>x.proposal_status==='rejected').length} icon="lucide:circle-x" tone="red"/></div>
    <div className="portal-info"><Icon name="lucide:shield-check"/><div><b>Portal privado de solicitudes.</b><p>Cuando una solicitud quede Atendida, revisa la solución y ciérrala si todo está correcto. PM/Admin/Superadmin también pueden cerrarla cuando sea necesario.</p></div></div>
    {categoryCounts.length>0&&<section className="panel portal-category-stats"><div className="panel-heading"><div><h3>Solicitudes por tipo</h3><p>Distribución personal de lo que has solicitado.</p></div></div><div>{categoryCounts.map(c=><span key={c.key}><b>{c.count}</b><small><i className="request-type-dot" style={{background:c.color||'#D4DCE0'}}></i>{c.label}</small></span>)}</div></section>}
    <section className="request-list">{items.length===0&&<div className="empty-state-inline"><Icon name="lucide:life-buoy" size={34}/><h3>No tienes solicitudes</h3><p>Cuando necesites acceso, reportar un error o proponer un requerimiento, créalo desde aquí.</p><button className="primary compact" onClick={onCreate}>Crear solicitud</button></div>}{items.map(item=>{const dept=departments.find(d=>d.id===item.department_id),requestType=requestTypes.find(x=>x.id===item.request_type_id),product=products.find(x=>x.id===item.product_id),isRequirement=isProposalCategory(item.category),status=normalizeHelpdeskStatus(item.status),idx=Math.max(0,order.indexOf(status));return <article className={`request-card ${isRequirement?'requirement-card':''}`} key={item.id}><button type="button" className="request-card-main" onClick={()=>onOpen(item)}><div className="request-card-title"><span className="request-icon"><Icon name={isRequirement?'lucide:lightbulb':'lucide:headphones'}/></span><div><small>{item.ticket_key} · {dept?.name||'Sin área'} · {requestType?.name||helpCategoryLabel(item.category)}{product?` · ${product.name}`:''}</small><h3>{item.subject}</h3><p>{item.description||'Sin descripción.'}</p></div>{isRequirement?<RequirementBadge status={item.proposal_status}/>:<HelpStatusBadge status={status}/>}</div>{isRequirement?<div className="requirement-flow"><span className="requirement-flow-node done"><i><Icon name="lucide:send" size={12}/></i><b>Solicitado</b></span><span className={`requirement-flow-line ${(item.proposal_status||'pending')!=='pending'?'done':''}`}></span><span className={`requirement-flow-node ${(item.proposal_status||'pending')==='pending'?'current':'done'}`}><i><Icon name={(item.proposal_status||'pending')==='pending'?'lucide:clock-3':item.proposal_status==='accepted_backlog'?'lucide:list-plus':'lucide:circle-x'} size={12}/></i><b>{requirementStatusLabel(item.proposal_status)}</b></span>{item.converted_ticket_key&&<span className="converted-ticket-chip"><Icon name="lucide:ticket-check"/>{item.converted_ticket_key}</span>}</div>:<div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<idx?'done':''} ${i===idx?'current':''}`}><i>{i<idx?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div>}<div className="request-meta"><span><Icon name="lucide:calendar"/> Creado {formatDateTime(item.created_at)}</span>{!isRequirement&&item.due_at&&status!=='closed'&&<span><Icon name="lucide:clock"/> Objetivo {formatDateTime(item.due_at)}</span>}{isRequirement&&item.decision_at&&<span><Icon name="lucide:gavel"/> Decisión {formatDateTime(item.decision_at)}</span>}<span><Icon name="lucide:refresh-cw"/> Actualizado {formatDateTime(item.updated_at)}</span></div></button></article>})}</section>
  </div>
}
function HelpdeskView({items,allItems,counterSnapshot=null,departments,requestTypes=[],products=[],members,currentUserId,canPlan,canAssign,autoAssigning=false,filters,onFilter,onStatusChange,onQuickFilter,onCreate,onActions,onOpen,onDecision,onAssign,onInlineAssign,onInlineStatus,onAutoAssign}){
  const counterBase=allItems.filter(h=>helpdeskMatchesFilters(h,filters,false))
  const normal=allItems.filter(h=>!isProposalCategory(h.category))
  const requirements=allItems.filter(h=>isProposalCategory(h.category))
  const localOpen=normal.filter(h=>normalizeHelpdeskStatus(h.status)!=='closed').length
  const localClosed=normal.filter(h=>normalizeHelpdeskStatus(h.status)==='closed').length
  const localPendingRequirements=requirements.filter(h=>(h.proposal_status||'pending')==='pending').length
  const localOverdue=normal.filter(h=>h.due_at&&normalizeHelpdeskStatus(h.status)!=='closed'&&new Date(h.due_at)<new Date()).length
  const serverNumber=(key,fallback)=>counterSnapshot&&Number.isFinite(Number(counterSnapshot[key]))?Number(counterSnapshot[key]):fallback
  const open=counterSnapshot?serverNumber('created',0)+serverNumber('review',0)+serverNumber('attended',0):localOpen
  const closed=serverNumber('closed',localClosed)
  const pendingRequirements=serverNumber('pending_requirements',localPendingRequirements)
  const overdue=serverNumber('overdue',localOverdue)
  const total=serverNumber('total',allItems.length)
  const typeStats=requestTypes.map(type=>({type,total:allItems.filter(h=>h.request_type_id===type.id).length,open:allItems.filter(h=>h.request_type_id===type.id&&normalizeHelpdeskStatus(h.status)!=='closed').length,done:allItems.filter(h=>h.request_type_id===type.id&&normalizeHelpdeskStatus(h.status)==='closed').length})).filter(x=>x.total)
  const queued=normal.filter(h=>!h.assigned_to&&h.assignment_source==='queue').length
  const active=Object.values(filters).filter(v=>v!=='all').length
  const statusCounts=Object.fromEntries(HELP_STATUS.map(([status])=>[status,counterBase.filter(h=>normalizeHelpdeskStatus(h.status)===status).length]))
  const assignees=members.filter(m=>m.active&&!roleIsHelpdeskRequester(m.role_template)&&m.role!=='consulta')
  return <div className="page"><PageHeader eyebrow="Servicio interno" title="Helpdesk" subtitle="Atiende solicitudes operativas y decide qué nuevos requerimientos pasan al Backlog." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid helpdesk-kpi-grid" role="group" aria-label="Filtros rápidos de Helpdesk"><Metric label="Solicitudes" value={total} icon="lucide:inbox" tone="blue" active={(filters.quick||'all')==='all'&&Object.entries(filters).filter(([key])=>key!=='quick').every(([,value])=>value==='all')} onClick={()=>onQuickFilter?.('all')}/><Metric label="Abiertas" value={open} icon="lucide:loader-circle" tone="orange" active={filters.quick==='open'} onClick={()=>onQuickFilter?.('open')}/><Metric label="Requerimientos por decidir" value={pendingRequirements} icon="lucide:lightbulb" tone="purple" active={filters.quick==='pending_requirements'} onClick={()=>onQuickFilter?.('pending_requirements')}/><Metric label="Vencidas" value={overdue} icon="lucide:alarm-clock" tone="red" active={filters.quick==='overdue'} onClick={()=>onQuickFilter?.('overdue')}/><Metric label="Cerradas" value={closed} icon="lucide:circle-check" tone="green" active={filters.quick==='closed'} onClick={()=>onQuickFilter?.('closed')}/></div>
    {queued>0&&<div className="helpdesk-routing-summary"><Icon name="lucide:route"/><span><b>{queued} {queued===1?'solicitud en cola':'solicitudes en cola'}</b><small>Se asignarán automáticamente en cuanto exista capacidad según las reglas configuradas.</small></span></div>}
    {typeStats.length>0&&<section className="panel helpdesk-type-stats"><div className="panel-heading"><div><h3>Solicitudes por tipo</h3><p>Segmentación usando el catálogo configurable de Helpdesk.</p></div></div><div className="helpdesk-type-stat-grid">{typeStats.map(x=><button type="button" key={x.type.id} onClick={()=>onFilter?.()}><span className="request-type-icon" style={{background:`${x.type.color||'#0D47A1'}18`,color:x.type.color||'#0D47A1'}}><Icon name={x.type.icon||'lucide:ticket'}/></span><span><b>{x.type.name}</b><small>{x.open} abiertas · {x.done} cerradas</small></span><strong>{x.total}</strong></button>)}</div></section>}
    <div className="helpdesk-status-filter" role="group" aria-label="Filtrar Helpdesk por estatus"><button type="button" className={filters.status==='all'?'active':''} onClick={()=>onStatusChange?.('all')}><Icon name="lucide:layers-3"/> Ver todo <em>{counterBase.length}</em></button>{HELP_STATUS.map(([status,label,icon])=><button type="button" key={status} className={filters.status===status?'active':''} onClick={()=>onStatusChange?.(status)}><Icon name={icon}/>{label}<em>{statusCounts[status]||0}</em></button>)}</div>
    <section className="workspace-panel"><div className="panel-toolbar"><div><h3>Solicitudes internas</h3><p className="muted">Cambia responsable y estado directamente desde la tabla. Atendido queda pendiente de confirmación del solicitante antes de Cerrado.</p></div><div className="toolbar-actions">{canAssign&&<button type="button" className="secondary-button compact helpdesk-autoassign-button" onClick={onAutoAssign} disabled={autoAssigning}><Icon name={autoAssigning?"lucide:loader-circle":"lucide:wand-sparkles"}/>{autoAssigning?"Autoasignando…":"Autoasignar pendientes"}</button>}<button className={`filter-button ${active?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {active>0&&<em>{active}</em>}</button><button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button></div></div>
    <div className="table-wrap"><div className="table help-table"><div className="tr th"><span>SOLICITUD</span><span>ÁREA</span><span>ASIGNADO</span><span>PRIORIDAD</span><span>ESTADO / DECISIÓN</span><span></span></div>{items.length===0&&<TableEmpty text="No hay solicitudes con estos filtros."/>}{items.map(h=>{const dep=departments.find(d=>d.id===h.department_id),requestType=requestTypes.find(x=>x.id===h.request_type_id),product=products.find(x=>x.id===h.product_id),req=isProposalCategory(h.category),status=normalizeHelpdeskStatus(h.status),decision=h.proposal_status||'pending';return <div className={`tr ${req?'requirement-row':''}`} key={h.id}><span className="task-cell"><button className="task-link" onClick={()=>onOpen(h)}><b>{h.subject}</b><small>{h.ticket_key} · {requestType?.name||helpCategoryLabel(h.category)}{product?` · ${product.name}`:''}</small></button></span><span><span className="dept-dot" style={{background:dep?.color||'#D4DCE0'}}></span>{dep?.name||'Sin área'}</span><span className="assignee-cell">{req?<span className="muted"><Icon name="lucide:gavel" size={14}/> Decisión PM</span>:<label className="table-inline-control assignee-inline full-click-select"><Icon name="lucide:user-round-cog" size={14}/><span className="table-inline-value">{members.find(m=>m.user_id===h.assigned_to)?.profile?.full_name||members.find(m=>m.user_id===h.assigned_to)?.profile?.email||'Sin asignar'}</span><Icon name="lucide:chevron-down" size={13}/><select className="table-inline-native" aria-label={`Responsable ${h.ticket_key}`} value={h.assigned_to||''} onChange={e=>onInlineAssign?.(h,e.target.value)}><option value="" disabled>Sin asignar</option>{assignees.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||m.profile?.email||'Usuario'}</option>)}</select></label>}</span><span><span className={`priority-badge priority-${h.priority}`}>{PRIORITY_LABELS[h.priority]}</span></span><span>{req?<label className={`table-inline-control decision-inline full-click-select ${decision}`}><Icon name="lucide:gavel" size={14}/><span className="table-inline-value">{decision==='accepted_backlog'?'Aceptar a Backlog':decision==='rejected'?'Rechazar':'Pendiente'}</span><Icon name="lucide:chevron-down" size={13}/><select className="table-inline-native" aria-label={`Decisión ${h.ticket_key}`} value={decision} disabled={decision!=='pending'||!canPlan} onChange={e=>onDecision?.(h,e.target.value)}><option value="pending">Pendiente</option><option value="accepted_backlog">Aceptar a Backlog</option><option value="rejected">Rechazar</option></select></label>:<label className={`table-inline-control status-inline full-click-select status-${status}`}><Icon name={helpStatusIcon(status)} size={14}/><span className="table-inline-value">{helpStatusLabel(status)}</span><Icon name="lucide:chevron-down" size={13}/><select className="table-inline-native" aria-label={`Estado ${h.ticket_key}`} value={status} onChange={e=>onInlineStatus?.(h,e.target.value)}>{helpdeskWorkflowOptions(status).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>}</span><span><div className="inline-actions"><button className="icon-button" onClick={()=>onActions(h)} title="Acciones"><Icon name="lucide:ellipsis-vertical"/></button></div></span></div>})}</div></div></section>
  </div>
}
function knowledgeSlug(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)}
class KnowledgeModuleErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,info){console.error('Knowledge module render error',error,info)}
  reset=()=>{this.setState({error:null});this.props.onReset?.()}
  render(){if(!this.state.error)return this.props.children;return <div className="page knowledge-crash-state"><div className="content-card"><span className="page-icon danger"><Icon name="lucide:triangle-alert"/></span><h2>Knowledge encontró un error de visualización</h2><p>El módulo protegió tu sesión para evitar una pantalla en blanco. Puedes volver al listado y continuar; el detalle técnico quedó en la consola para QA.</p><code>{String(this.state.error?.message||this.state.error||'Error desconocido')}</code><div><button type="button" className="primary" onClick={this.reset}><Icon name="lucide:refresh-cw"/> Volver a Knowledge</button></div></div></div>}
}
function KnowledgeView({workspace,articles,versions=[],locale='es',products,modules,categories=[],canCreate=false,canEdit=false,canDelete=false,currentUserId=null,onCreate,onEdit,onOpen,onPreview,onDelete,onCategoryCreate,onCategoryEdit,onCategoryDelete}){
  const [q,setQ]=useState(''),[scope,setScope]=useState(()=>(canCreate||canEdit||canDelete)?'all':'published'),[productFilter,setProductFilter]=useState('all'),[selectedCategory,setSelectedCategory]=useState('all'),[localized,setLocalized]=useState({})
  useEffect(()=>{if(selectedCategory!=='all'&&!categories.some(c=>c.id===selectedCategory))setSelectedCategory('all')},[categories.map(c=>c.id).join('|')])
  useEffect(()=>{let cancelled=false;(async()=>{const map={};const targets=articles.filter(a=>a.status==='published'&&a.active_version_id&&locale!==(a.default_language||'es')).slice(0,50);for(const a of targets){if(cancelled)return;const local=knowledgeTranslationLocalGet(a.active_version_id,locale);if(local){map[a.id]=local;continue}try{const {data,error}=await db.functions.invoke('translate-knowledge-version',{body:{version_id:a.active_version_id,language:locale}});if(!error&&!data?.error&&data?.translation){map[a.id]=data.translation;knowledgeTranslationLocalSet(a.active_version_id,locale,data.translation)}}catch{}}if(!cancelled)setLocalized(map)})();return()=>{cancelled=true}},[locale,workspace?.id,articles.map(a=>`${a.id}:${a.active_version_id}`).join('|')])
  const displayArticle=a=>localized[a.id]?{...a,title:localized[a.id].title||a.title,summary:localized[a.id].summary??a.summary,content:localized[a.id].content||a.content,tags:localized[a.id].tags||a.tags}:a
  const categoryCounts=Object.fromEntries(categories.map(c=>[c.id,articles.filter(a=>a.category_id===c.id).length]))
  const visible=articles.filter(a=>{const d=displayArticle(a),text=`${d.title} ${d.summary||''} ${(d.tags||[]).join(' ')} ${d.content||''}`.toLowerCase();return (scope==='all'||a.status===scope||scope==='draft'&&a.draft_version_id)&&(productFilter==='all'||a.product_id===productFilter)&&(selectedCategory==='all'||a.category_id===selectedCategory)&&(!q.trim()||text.includes(q.trim().toLowerCase()))})
  const activeVersion=a=>versions.find(v=>v.id===a.active_version_id&&v.article_id===a.id)||versions.filter(v=>v.article_id===a.id&&v.status==='published').sort((x,y)=>Number(y.version_number||0)-Number(x.version_number||0))[0]
  const draftVersion=a=>versions.find(v=>v.id===a.draft_version_id)||versions.find(v=>v.article_id===a.id&&v.status==='draft')
  const canManageAny=canCreate||canEdit||canDelete,selected=categories.find(c=>c.id===selectedCategory)||null
  const createInContext=()=>selected&&onCreate?.(selected.id)
  return <div className="page knowledge-home-page"><PageHeader eyebrow="Recursos internos" title="Knowledge" subtitle="Organiza categorías y crea artículos versionados dentro de cada una." icon="lucide:book-open-text" action={selected&&canCreate?<button className="primary" onClick={createInContext}><Icon name="lucide:file-plus-2"/> Nuevo artículo en {selected.name}</button>:canEdit?<button className="secondary-button" onClick={onCategoryCreate}><Icon name="lucide:folder-plus"/> Nueva categoría</button>:null}/>
    <section className="content-card knowledge-categories-panel">
      <div className="knowledge-categories-head"><div><h2>Categorías</h2><p>Primero clasifica la información; después crea y administra los artículos dentro de cada categoría.</p></div>{canEdit&&<button type="button" className="secondary-button compact" onClick={onCategoryCreate}><Icon name="lucide:folder-plus"/> Nueva categoría</button>}</div>
      <div className="knowledge-category-grid">
        <article className={`knowledge-category-card ${selectedCategory==='all'?'active':''}`}><button type="button" className="knowledge-category-main" onClick={()=>setSelectedCategory('all')}><span className="knowledge-category-icon all"><Icon name="lucide:library-big"/></span><span><b>Todos los artículos</b><small>Vista completa del workspace</small></span><strong>{articles.length}</strong></button></article>
        {categories.map(cat=><article className={`knowledge-category-card ${selectedCategory===cat.id?'active':''}`} key={cat.id} style={{'--category-color':cat.color||'#4D5A51'}}><button type="button" className="knowledge-category-main" onClick={()=>setSelectedCategory(cat.id)}><span className="knowledge-category-icon"><Icon name={cat.icon||'lucide:folder'}/></span><span><b>{cat.name}</b><small>{cat.description||'Categoría de Knowledge'}</small></span><strong>{categoryCounts[cat.id]||0}</strong></button>{(canCreate||canEdit||canDelete)&&<div className="knowledge-category-actions">{canCreate&&<button type="button" title={`Crear artículo en ${cat.name}`} onClick={()=>onCreate?.(cat.id)}><Icon name="lucide:file-plus-2"/></button>}{canEdit&&<button type="button" title="Editar categoría" onClick={()=>onCategoryEdit?.(cat)}><Icon name="lucide:pencil"/></button>}{canDelete&&cat.code!=='general'&&<button type="button" className="danger-text" title="Eliminar categoría" onClick={()=>onCategoryDelete?.(cat)}><Icon name="lucide:trash-2"/></button>}</div>}</article>)}
      </div>
    </section>
    <section className="content-card knowledge-articles-panel">
      <div className="knowledge-articles-heading"><div><span className="page-icon sm"><Icon name={selected?.icon||'lucide:notebook-tabs'}/></span><div><h2>{selected?.name||'Todos los artículos'}</h2><p>{selected?.description||'Busca, filtra, crea nuevas versiones y publica contenido de Knowledge.'}</p></div></div>{canCreate&&selected&&<button type="button" className="primary compact" onClick={createInContext}><Icon name="lucide:plus"/> Artículo en {selected.name}</button>}</div>
      <div className="knowledge-toolbar knowledge-toolbar-expanded"><div className="knowledge-search"><Icon name="lucide:search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por título, contenido o etiqueta…"/></div><select value={productFilter} onChange={e=>setProductFilter(e.target.value)}><option value="all">Todos los productos</option><option value="">General / sin producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{canManageAny&&<select value={scope} onChange={e=>setScope(e.target.value)}><option value="published">Publicados</option><option value="draft">Con borrador</option><option value="archived">Archivados</option><option value="all">Todos</option></select>}</div>
      <div className="knowledge-filter-summary"><Icon name="lucide:filter"/><span>{visible.length} de {articles.length} artículos</span>{selected&&<em><Icon name={selected.icon||'lucide:folder'} size={12}/>{selected.name}</em>}{productFilter!=='all'&&<em>{productFilter?products.find(p=>p.id===productFilter)?.name||'Producto':'General'}</em>}</div>
      <div className="knowledge-grid">{visible.length===0&&<div className="knowledge-empty"><Icon name="lucide:book-dashed" size={38}/><h3>Sin artículos</h3><p>{canCreate?(selected?`Crea el primer artículo dentro de ${selected.name}.`:'Selecciona una categoría y crea el primer recurso.'):'No hay recursos publicados con estos filtros.'}</p>{canCreate&&selected&&<button type="button" className="primary compact" onClick={createInContext}><Icon name="lucide:file-plus-2"/> Crear artículo</button>}</div>}{visible.map(a=>{const d=displayArticle(a),p=products.find(x=>x.id===a.product_id),m=modules.find(x=>x.id===a.module_id),cat=categories.find(x=>x.id===a.category_id),active=activeVersion(a),draft=draftVersion(a);return <article className="knowledge-card" key={a.id}><button type="button" className="knowledge-card-main" onClick={()=>a.active_version_id?onOpen(a):onPreview(a,draft||active||versions.filter(v=>v.article_id===a.id).sort((x,y)=>y.version_number-x.version_number)[0]||null)}><div className="knowledge-card-icon"><Icon name={cat?.icon||'lucide:notebook-text'}/></div><div><div className="knowledge-card-meta">{active&&<span className="knowledge-version-chip"><Icon name="lucide:git-branch"/>v{active.version_number}</span>}{draft&&<span className="knowledge-status draft">Borrador v{draft.version_number}</span>}{locale!==(a.default_language||'es')&&localized[a.id]&&<span className="knowledge-language-badge"><Icon name="lucide:languages"/>{locale.toUpperCase()}</span>}{cat&&<span className="knowledge-category-chip"><Icon name={cat.icon||'lucide:folder-tree'}/>{cat.name}</span>}{p&&<span><Icon name="lucide:folder"/>{p.name}</span>}{m&&<span><Icon name="lucide:blocks"/>{m.module_key}</span>}</div><h3>{d.title}</h3><p>{cleanKnowledgeSnippet(d.summary||d.content,180)}</p><div className="knowledge-tags">{(d.tags||[]).slice(0,4).map(tag=><span key={tag}>{tag}</span>)}</div></div></button><div className="knowledge-card-actions"><button type="button" onClick={()=>onPreview(a,draft||active||versions.filter(v=>v.article_id===a.id).sort((x,y)=>y.version_number-x.version_number)[0]||null)}><Icon name="lucide:scan-eye"/>{locale==='en'?'Reader preview':'Vista previa lector'}</button>{(canEdit||(canCreate&&a.created_by===currentUserId&&!a.active_version_id&&!!draft))&&<button type="button" onClick={()=>onEdit(a)}><Icon name={draft?'lucide:file-pen-line':'lucide:git-branch-plus'}/>{draft?'Editar borrador':'Nueva versión'}</button>}{canDelete&&<button type="button" className="danger-text" onClick={()=>onDelete(a)}><Icon name="lucide:trash-2"/>Eliminar</button>}</div></article>})}</div>
    </section>
  </div>
}

function KnowledgeRichTextEditor({html,onChange,onLiveInput,lineHeight='1.5',onLineHeightChange}){
  const hostRef=useRef(null),surfaceRef=useRef(null),rangeRef=useRef(null),draftHtmlRef=useRef(String(html||'')),statsRef=useRef(null),onChangeRef=useRef(onChange),onLiveInputRef=useRef(onLiveInput)
  const [showLink,setShowLink]=useState(false),[linkUrl,setLinkUrl]=useState('https://'),[safeWriting,setSafeWriting]=useState(false),[safeText,setSafeText]=useState('')
  onChangeRef.current=onChange;onLiveInputRef.current=onLiveInput
  const updateStats=value=>{const text=stripKnowledgeHtml(value),words=text?text.split(/\s+/).filter(Boolean).length:0;if(statsRef.current)statsRef.current.textContent=`${words} palabras · ${text.length} caracteres`}
  const surface=()=>surfaceRef.current
  const isEmpty=value=>!stripKnowledgeHtml(String(value||''))
  const setEmptyState=el=>{if(!el)return;el.dataset.empty=isEmpty(el.innerHTML)?'true':'false'}
  const placeCaretAtStart=el=>{if(!el)return;let target=el.querySelector('p,div,h1,h2,h3,h4,h5,li')||el;if(target===el&&!el.firstChild){const p=document.createElement('p');p.appendChild(document.createElement('br'));el.appendChild(p);target=p}const sel=window.getSelection?.();if(!sel)return;try{const range=document.createRange();range.selectNodeContents(target);range.collapse(true);sel.removeAllRanges();sel.addRange(range);rangeRef.current=range.cloneRange()}catch{}}
  const ensureScaffold=(placeCaret=false)=>{const el=surface();if(!el)return;if(isEmpty(el.innerHTML)){if(!(el.children.length===1&&el.firstElementChild?.tagName==='P'))el.innerHTML='<p><br></p>';else if(!el.firstElementChild.innerHTML.trim())el.firstElementChild.innerHTML='<br>';el.dataset.empty='true';if(placeCaret)placeCaretAtStart(el)}else el.dataset.empty='false'}
  const saveSelection=()=>{const sel=window.getSelection?.(),el=surface();if(!sel||!sel.rangeCount||!el)return;const range=sel.getRangeAt(0);if(el.contains(range.commonAncestorContainer))rangeRef.current=range.cloneRange()}
  const restoreSelection=()=>{const el=surface();if(!el)return;el.focus({preventScroll:true});if(!rangeRef.current){ensureScaffold(true);return}const sel=window.getSelection?.();if(!sel)return;try{sel.removeAllRanges();sel.addRange(rangeRef.current)}catch{rangeRef.current=null;ensureScaffold(true)}}
  const readSurface=()=>surface()?.innerHTML??draftHtmlRef.current??''
  const normalizeEditorHtml=value=>{const clean=sanitizeKnowledgeHtml(value);return isEmpty(clean)?'':clean}
  const commit=(forceDom=false)=>{const el=surface(),clean=normalizeEditorHtml(readSurface());draftHtmlRef.current=clean;if(forceDom&&el){if(clean){if(el.innerHTML!==clean)el.innerHTML=clean}else el.innerHTML='<p><br></p>';setEmptyState(el)}onLiveInputRef.current?.(clean);onChangeRef.current?.(clean);updateStats(clean);saveSelection();return clean}
  const safeHtmlFromText=value=>String(value||'').trim()?sanitizeKnowledgeHtml(`<p>${escapeKnowledgeText(String(value||''))}</p>`):''
  const enterSafeWriting=()=>{const clean=commit(false),el=surface();setSafeText(el?.innerText||stripKnowledgeHtml(clean));setSafeWriting(true)}
  const updateSafeWriting=value=>{setSafeText(value);const next=safeHtmlFromText(value);draftHtmlRef.current=next;onLiveInputRef.current?.(next);updateStats(next)}
  const applySafeWriting=()=>{const value=String(safeText||''),next=safeHtmlFromText(value);draftHtmlRef.current=next;const el=surface();if(el){el.innerHTML=next||'<p><br></p>';setEmptyState(el)}onLiveInputRef.current?.(next);onChangeRef.current?.(next);updateStats(next);setSafeWriting(false);requestAnimationFrame(()=>{const target=surface();if(target){target.focus({preventScroll:true});if(isEmpty(next))ensureScaffold(true);else placeCaretAtStart(target)}})}
  useEffect(()=>{
    const host=hostRef.current;if(!host)return
    const el=document.createElement('div');el.className='knowledge-rich-surface';el.contentEditable='true';el.spellcheck=true;el.tabIndex=0;el.setAttribute('role','textbox');el.setAttribute('aria-multiline','true');el.setAttribute('aria-label','Contenido del bloque de texto');el.dataset.placeholder='Escribe el contenido del documento…';el.style.lineHeight=String(lineHeight||'1.5')
    const initial=normalizeEditorHtml(draftHtmlRef.current);el.innerHTML=initial||'<p><br></p>';setEmptyState(el);host.replaceChildren(el);surfaceRef.current=el;updateStats(initial)
    const handleFocus=()=>{if(isEmpty(el.innerHTML))ensureScaffold(true);else saveSelection()}
    const handleBeforeInput=e=>{if(e.isComposing)return;if(isEmpty(el.innerHTML)&&String(e.inputType||'').startsWith('insert'))ensureScaffold(!rangeRef.current)}
    const handleInput=()=>{const raw=el.innerHTML;draftHtmlRef.current=normalizeEditorHtml(raw);setEmptyState(el);updateStats(draftHtmlRef.current);saveSelection();onLiveInputRef.current?.(draftHtmlRef.current)}
    const handlePaste=e=>{e.preventDefault();saveSelection();restoreSelection();const htmlData=e.clipboardData?.getData('text/html')||'',textData=e.clipboardData?.getData('text/plain')||'';const clean=sanitizeKnowledgeHtml(htmlData||escapeKnowledgeText(textData));try{document.execCommand('insertHTML',false,clean)}catch{}handleInput()}
    const handleDrop=e=>{if(e.dataTransfer?.files?.length)e.preventDefault()}
    const handleBlur=()=>commit(true)
    el.addEventListener('focus',handleFocus);el.addEventListener('beforeinput',handleBeforeInput);el.addEventListener('input',handleInput);el.addEventListener('mouseup',saveSelection);el.addEventListener('keyup',saveSelection);el.addEventListener('paste',handlePaste);el.addEventListener('drop',handleDrop);el.addEventListener('blur',handleBlur)
    return()=>{el.removeEventListener('focus',handleFocus);el.removeEventListener('beforeinput',handleBeforeInput);el.removeEventListener('input',handleInput);el.removeEventListener('mouseup',saveSelection);el.removeEventListener('keyup',saveSelection);el.removeEventListener('paste',handlePaste);el.removeEventListener('drop',handleDrop);el.removeEventListener('blur',handleBlur);if(surfaceRef.current===el)surfaceRef.current=null}
  },[])
  useEffect(()=>{const el=surface(),next=normalizeEditorHtml(String(html||''));draftHtmlRef.current=next;if(el&&document.activeElement!==el&&!safeWriting){el.innerHTML=next||'<p><br></p>';setEmptyState(el);updateStats(next)}},[html,safeWriting])
  useEffect(()=>{const el=surface();if(el)el.style.lineHeight=String(lineHeight||'1.5')},[lineHeight])
  const command=(cmd,value=null)=>{const el=surface();if(!el||safeWriting)return;restoreSelection();let ok=false;try{ok=document.execCommand(cmd,false,value)}catch{}if(!ok&&cmd==='formatBlock'){try{document.execCommand(cmd,false,`<${String(value).replace(/[<>]/g,'')}>`)}catch{}}saveSelection();commit(false)}
  const applyLink=()=>{const url=String(linkUrl||'').trim();if(!/^(https?:\/\/|mailto:|tel:)/i.test(url))return;restoreSelection();try{document.execCommand('createLink',false,url)}catch{}saveSelection();commit(false);setShowLink(false)}
  const preserveSelection=e=>{e?.preventDefault?.();saveSelection()}
  return <div className="knowledge-rich-editor">
    <div className="knowledge-rich-modebar"><span><Icon name={safeWriting?'lucide:keyboard':'lucide:sparkles'}/><b>{safeWriting?'Modo escritura segura':'Edición enriquecida'}</b><small>{safeWriting?'Escribe sin formato y después pasa el contenido al editor para aplicar estilos.':'Escribe directamente y selecciona cualquier parte para aplicar estilos.'}</small></span>{safeWriting?<button type="button" className="primary compact" onClick={applySafeWriting}><Icon name="lucide:wand-sparkles"/> Pasar a modo formato</button>:<button type="button" className="secondary-button compact" onClick={enterSafeWriting}><Icon name="lucide:keyboard"/> Escritura segura</button>}</div>
    {!safeWriting&&<div className="knowledge-rich-toolbar" role="toolbar" aria-label="Herramientas del bloque de texto">
      <select aria-label="Estilo" defaultValue="p" onMouseDown={saveSelection} onChange={e=>{command('formatBlock',e.target.value);e.target.value='p'}}><option value="p">Normal · 14 px</option>{KNOWLEDGE_HEADING_PRESETS.map(x=><option key={x.tag} value={x.tag}>Título {x.label} · {x.size} px</option>)}</select>
      <select aria-label="Fuente" defaultValue="Inter" onMouseDown={saveSelection} onChange={e=>command('fontName',e.target.value)}>{KNOWLEDGE_COVER_FONTS.map(x=><option key={x}>{x}</option>)}</select>
      <select aria-label="Tamaño" defaultValue="3" onMouseDown={saveSelection} onChange={e=>command('fontSize',e.target.value)}><option value="1">11 px</option><option value="2">12 px</option><option value="3">14 px</option><option value="4">16 px</option><option value="5">18 px</option><option value="6">24 px</option><option value="7">32 px</option></select>
      <span className="knowledge-toolbar-separator"></span>
      <button type="button" onMouseDown={preserveSelection} onClick={()=>command('undo')} title="Deshacer"><Icon name="lucide:undo-2"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('redo')} title="Rehacer"><Icon name="lucide:redo-2"/></button><span className="knowledge-toolbar-separator"></span>
      <button type="button" onMouseDown={preserveSelection} onClick={()=>command('bold')} title="Negrita"><Icon name="lucide:bold"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('italic')} title="Cursiva"><Icon name="lucide:italic"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('underline')} title="Subrayado"><Icon name="lucide:underline"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('strikeThrough')} title="Tachado"><Icon name="lucide:strikethrough"/></button><span className="knowledge-toolbar-separator"></span>
      <label className="knowledge-color-tool" title="Color de texto"><Icon name="lucide:palette"/><input type="color" defaultValue="#172B4D" onMouseDown={saveSelection} onChange={e=>command('foreColor',e.target.value)}/></label><label className="knowledge-color-tool" title="Resaltado"><Icon name="lucide:highlighter"/><input type="color" defaultValue="#FFF0B3" onMouseDown={saveSelection} onChange={e=>command('hiliteColor',e.target.value)}/></label><span className="knowledge-toolbar-separator"></span>
      <button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertOrderedList')} title="Lista numerada"><Icon name="lucide:list-ordered"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('insertUnorderedList')} title="Lista con viñetas"><Icon name="lucide:list"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('outdent')} title="Reducir sangría"><Icon name="lucide:indent-decrease"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('indent')} title="Aumentar sangría"><Icon name="lucide:indent-increase"/></button><span className="knowledge-toolbar-separator"></span>
      <button type="button" onMouseDown={preserveSelection} onClick={()=>command('justifyLeft')} title="Alinear izquierda"><Icon name="lucide:align-left"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('justifyCenter')} title="Centrar"><Icon name="lucide:align-center"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('justifyRight')} title="Alinear derecha"><Icon name="lucide:align-right"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('justifyFull')} title="Justificar"><Icon name="lucide:align-justify"/></button><span className="knowledge-toolbar-separator"></span>
      <button type="button" className={showLink?'active':''} onMouseDown={preserveSelection} onClick={()=>setShowLink(x=>!x)} title="Insertar enlace"><Icon name="lucide:link"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('unlink')} title="Quitar enlace"><Icon name="lucide:unlink"/></button><button type="button" onMouseDown={preserveSelection} onClick={()=>command('removeFormat')} title="Limpiar formato"><Icon name="lucide:remove-formatting"/></button>
    </div>}
    {!safeWriting&&showLink&&<div className="knowledge-link-editor"><Icon name="lucide:link"/><input type="url" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://..."/><button type="button" className="primary compact" onMouseDown={saveSelection} onClick={applyLink}>Aplicar enlace</button><button type="button" className="icon-button" onClick={()=>setShowLink(false)}><Icon name="lucide:x"/></button></div>}
    <div ref={hostRef} className={`knowledge-rich-surface-host ${safeWriting?'is-hidden':''}`}></div>
    {safeWriting&&<textarea className="knowledge-safe-writing-area" rows="12" autoFocus value={safeText} onChange={e=>updateSafeWriting(e.target.value)} placeholder="Escribe todo el contenido aquí. Cuando termines, pulsa “Pasar a modo formato” para aplicar negritas, títulos, fuentes, enlaces y demás estilos."/>}
    <div className="knowledge-rich-footer"><label>Interlineado:<select value={String(lineHeight||'1.5')} disabled={safeWriting} onMouseDown={saveSelection} onChange={e=>{commit(false);onLineHeightChange?.(e.target.value)}}><option value="1">Sencillo</option><option value="1.15">1.15</option><option value="1.3">1.3</option><option value="1.5">Normal · 1.5</option><option value="1.75">1.75</option><option value="2">Doble</option></select></label><span ref={statsRef}>0 palabras · 0 caracteres</span></div>
  </div>
}

function KnowledgeBlockEditor({blocks,setBlocks,media=[],articleTitle='',coverSettings=null,onRichInput=null}){
  const [dragId,setDragId]=useState(null)
  const defaults=type=>type==='image'?{media_id:null,alt:'',caption:'',align:'center',pending_file:null}:type==='video'?{url:'',caption:''}:type==='cover'?{template:'forest',eyebrow:'TROBBU · KNOWLEDGE',title:articleTitle||'',subtitle:'',meta:'Documento interno',show_logo:true,page_break:true}:type==='richtext'?{html:'<p></p>',line_height:'1.5'}:type==='list'?{text:'',list_style:'unordered'}:type==='quote'?{text:'',author:''}:type==='callout'?{text:'',title:'',tone:'info'}:type==='code'?{text:'',language:'text'}:['divider','pagebreak'].includes(type)?{}:{text:''}
  const add=type=>setBlocks(x=>[...x,{id:knowledgeBlockId(),type,...defaults(type)}])
  const patch=(id,data)=>setBlocks(x=>x.map(b=>b.id===id?{...b,...data}:b))
  const remove=id=>setBlocks(x=>x.filter(b=>b.id!==id))
  const move=(id,dir)=>setBlocks(x=>{const a=[...x],i=a.findIndex(b=>b.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return a;[a[i],a[j]]=[a[j],a[i]];return a})
  const moveBefore=(id,targetId)=>setBlocks(x=>{const a=[...x],from=a.findIndex(b=>b.id===id),to=a.findIndex(b=>b.id===targetId);if(from<0||to<0||from===to)return a;const [item]=a.splice(from,1);a.splice(from<to?to-1:to,0,item);return a})
  const label={cover:'Portada',richtext:'Texto',heading1:'Título H1',heading2:'Título H2',heading3:'Título H3',heading4:'Título H4',heading5:'Título H5',list:'Lista',quote:'Cita',callout:'Destacado',code:'Código',image:'Imagen',video:'Video',divider:'Separador',pagebreak:'Salto de página'}
  const headingTypes=['heading1','heading2','heading3','heading4','heading5']
  const hasCover=blocks.some(x=>normalizeKnowledgeBlockRuntime(x).type==='cover')
  return <div className="knowledge-editor-shell">
    <div className="knowledge-editor-toolbar">
      <button type="button" disabled={hasCover} title={hasCover?'Solo se admite una portada por artículo':'Agregar portada ejecutiva'} onClick={()=>add('cover')}><Icon name="lucide:panel-top"/> Portada</button>
      <button type="button" onClick={()=>add('richtext')}><Icon name="lucide:type"/> Texto</button>
      <div className="knowledge-heading-add"><Icon name="lucide:heading"/><select defaultValue="" onChange={e=>{if(e.target.value)add(e.target.value);e.target.value='' }}><option value="" disabled>Título</option>{KNOWLEDGE_HEADING_PRESETS.map(x=><option key={x.type} value={x.type}>{x.label} · {x.size}px</option>)}</select></div>
      <button type="button" onClick={()=>add('list')}><Icon name="lucide:list"/> Lista</button>
      <button type="button" onClick={()=>add('quote')}><Icon name="lucide:quote"/> Cita</button>
      <button type="button" onClick={()=>add('callout')}><Icon name="lucide:message-square-text"/> Destacado</button>
      <button type="button" onClick={()=>add('code')}><Icon name="lucide:code-2"/> Código</button>
      <button type="button" onClick={()=>add('image')}><Icon name="lucide:image-plus"/> Imagen</button>
      <button type="button" onClick={()=>add('video')}><Icon name="lucide:video"/> Video</button>
      <button type="button" onClick={()=>add('divider')}><Icon name="lucide:minus"/> Separador</button>
      <button type="button" onClick={()=>add('pagebreak')}><Icon name="lucide:between-horizontal-start"/> Salto de página</button>
    </div>
    <div className="knowledge-block-list">{blocks.map((raw,i)=>{const b=normalizeKnowledgeBlockRuntime(raw),currentMedia=media.find(m=>m.id===b.media_id);return <div className={`knowledge-block block-${b.type} ${dragId===b.id?'dragging':''}`} key={b.id} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragId&&dragId!==b.id)moveBefore(dragId,b.id);setDragId(null)}}>
      <div className="knowledge-block-head"><span className="knowledge-block-drag" draggable onDragStart={()=>setDragId(b.id)} onDragEnd={()=>setDragId(null)} title="Arrastra para reordenar"><Icon name="lucide:grip-vertical"/><b>#{i+1} – {label[b.type]||'Bloque'}</b></span><div><button type="button" disabled={i===0} onClick={()=>move(b.id,-1)} title="Subir"><Icon name="lucide:chevron-up"/></button><button type="button" disabled={i===blocks.length-1} onClick={()=>move(b.id,1)} title="Bajar"><Icon name="lucide:chevron-down"/></button><button type="button" className="danger-text" onClick={()=>remove(b.id)} title="Eliminar bloque"><Icon name="lucide:trash-2"/></button></div></div>
      {b.type==='cover'&&<div className="knowledge-cover-editor"><div className={`knowledge-cover-preview template-${b.template||'forest'}`} style={knowledgeCoverStyle(coverSettings,b.template||'forest')}><div className="knowledge-cover-brand">{b.show_logo!==false&&<><b>TROBBU</b><small>BOUTIQUE COLLECTION</small></>}</div><div className="knowledge-cover-copy"><span>{b.eyebrow||'TROBBU · KNOWLEDGE'}</span><h2>{b.title||articleTitle||'Título ejecutivo del artículo'}</h2><p>{b.subtitle||'Resumen o propósito del documento para una presentación profesional.'}</p><small>{b.meta||'Documento interno'}</small></div></div><div className="knowledge-cover-controls"><label>Plantilla<select value={b.template||'forest'} onChange={e=>patch(b.id,{template:e.target.value})}>{KNOWLEDGE_COVER_TEMPLATES.map(x=><option key={x.value} value={x.value}>{x.label} · {x.description}</option>)}</select></label><label>Eyebrow<input value={b.eyebrow||''} onChange={e=>patch(b.id,{eyebrow:e.target.value})} placeholder="TROBBU · KNOWLEDGE"/></label><label className="knowledge-wide-field">Título de portada<input value={b.title||''} onChange={e=>patch(b.id,{title:e.target.value})} placeholder={articleTitle||'Título del documento'}/></label><label className="knowledge-wide-field">Subtítulo<textarea rows="3" value={b.subtitle||''} onChange={e=>patch(b.id,{subtitle:e.target.value})} placeholder="Objetivo, alcance o descripción ejecutiva…"/></label><label>Pie / clasificación<input value={b.meta||''} onChange={e=>patch(b.id,{meta:e.target.value})} placeholder="Documento interno · 2026"/></label><div className="knowledge-cover-toggles"><label className="switch-line"><input type="checkbox" checked={b.show_logo!==false} onChange={e=>patch(b.id,{show_logo:e.target.checked})}/><span>Mostrar marca TROBBU</span></label><label className="switch-line"><input type="checkbox" checked={b.page_break!==false} onChange={e=>patch(b.id,{page_break:e.target.checked})}/><span>Iniciar contenido en página siguiente al imprimir/PDF</span></label></div></div></div>}
      {b.type==='richtext'&&<KnowledgeRichTextEditor html={b.html||''} lineHeight={b.line_height||'1.5'} onLiveInput={html=>onRichInput?.(b.id,html)} onLineHeightChange={line_height=>patch(b.id,{line_height})} onChange={html=>patch(b.id,{html})}/>} 
      {headingTypes.includes(b.type)&&<div className="knowledge-heading-editor"><label>Nivel<select value={b.type} onChange={e=>patch(b.id,{type:e.target.value})}>{KNOWLEDGE_HEADING_PRESETS.map(x=><option key={x.type} value={x.type}>{x.label} · {x.size}px</option>)}</select></label><label className="knowledge-heading-text">Texto del título<input value={b.text||''} onChange={e=>patch(b.id,{text:e.target.value})} placeholder="Escribe el título…"/></label></div>}
      {b.type==='list'&&<div className="knowledge-list-editor"><label>Tipo de lista<select value={b.list_style||'unordered'} onChange={e=>patch(b.id,{list_style:e.target.value})}><option value="unordered">Viñetas</option><option value="ordered">Numerada</option></select></label><label>Elementos<textarea rows="5" value={b.text||''} onChange={e=>patch(b.id,{text:e.target.value})} placeholder={'Un elemento por línea\nSegundo elemento\nTercer elemento'}/></label></div>}
      {b.type==='quote'&&<div className="knowledge-quote-editor"><label>Cita<textarea rows="4" value={b.text||''} onChange={e=>patch(b.id,{text:e.target.value})} placeholder="Texto de la cita…"/></label><label>Autor / fuente <span className="optional">Opcional</span><input value={b.author||''} onChange={e=>patch(b.id,{author:e.target.value})} placeholder="Nombre o referencia"/></label></div>}
      {b.type==='callout'&&<div className="knowledge-callout-editor"><div className="form-grid"><label>Tipo<select value={b.tone||'info'} onChange={e=>patch(b.id,{tone:e.target.value})}><option value="info">Información</option><option value="success">Éxito</option><option value="warning">Advertencia</option><option value="danger">Crítico</option></select></label><label>Título <span className="optional">Opcional</span><input value={b.title||''} onChange={e=>patch(b.id,{title:e.target.value})} placeholder="Importante"/></label></div><label>Contenido<textarea rows="4" value={b.text||''} onChange={e=>patch(b.id,{text:e.target.value})}/></label></div>}
      {b.type==='code'&&<div className="knowledge-code-editor"><label>Lenguaje<input value={b.language||'text'} onChange={e=>patch(b.id,{language:e.target.value})} placeholder="javascript, sql, bash…"/></label><label>Código<textarea rows="8" spellCheck="false" value={b.text||''} onChange={e=>patch(b.id,{text:e.target.value})} placeholder="Pega aquí el código o ejemplo técnico…"/></label></div>}
      {b.type==='image'&&<div className="knowledge-image-editor">{currentMedia?.signed_url&&<img className={`align-${b.align||'center'}`} src={currentMedia.signed_url} alt={b.alt||''}/>} {b.pending_file&&<div className="knowledge-pending-media"><Icon name="lucide:image"/><span><b>{b.pending_file.name}</b><small>{fileSizeLabel(b.pending_file.size)} antes de compresión</small></span></div>}<label>Imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>15*1024*1024){e.target.value='';return}patch(b.id,{pending_file:file,media_id:null})}}/></label><div className="form-grid"><label>Texto alternativo<input value={b.alt||''} onChange={e=>patch(b.id,{alt:e.target.value})} placeholder="Describe la imagen"/></label><label>Pie de imagen<input value={b.caption||''} onChange={e=>patch(b.id,{caption:e.target.value})} placeholder="Descripción opcional"/></label><label>Alineación<select value={b.align||'center'} onChange={e=>patch(b.id,{align:e.target.value})}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option><option value="wide">Ancho completo</option></select></label></div><div className="compression-notice"><Icon name="lucide:wand-sparkles"/><div><b>Compresión automática</b><span>Máximo 15 MB original. Se redimensiona a 1920 px y se convierte a WebP cuando reduce el peso.</span></div></div></div>}
      {b.type==='video'&&<div className="knowledge-video-editor"><label>URL de YouTube o Vimeo<input type="url" value={b.url||''} onChange={e=>patch(b.id,{url:e.target.value})} placeholder="https://www.youtube.com/watch?v=..."/></label><label>Pie del video<input value={b.caption||''} onChange={e=>patch(b.id,{caption:e.target.value})}/></label><small className="field-help">Los videos se insertan por URL para no consumir Storage ni ancho de banda del sistema.</small></div>}
      {b.type==='divider'&&<div className="knowledge-divider-preview"><span></span><small>Separador visual</small><span></span></div>}
      {b.type==='pagebreak'&&<div className="knowledge-pagebreak-preview"><span></span><small><Icon name="lucide:between-horizontal-start"/> Salto de página al imprimir / exportar</small><span></span></div>}
    </div>})}</div>
  </div>
}
function KnowledgeArticleDetail({article,products,modules,canManage,onClose,onEdit}){
  const [media,setMedia]=useState([]);const p=products.find(x=>x.id===article.product_id),m=modules.find(x=>x.id===article.module_id);const blocks=knowledgeDefaultBlocks(article)
  useEffect(()=>{let cancelled=false;(async()=>{const {data,error}=await db.from('knowledge_media').select('*').eq('article_id',article.id).order('created_at');if(!cancelled&&!error)setMedia(await signedKnowledgeMedia(data||[]))})();return()=>{cancelled=true}},[article.id])
  return <Modal title={article.title} subtitle={article.summary||'Artículo de Knowledge'} onClose={onClose} size="xl"><div className="knowledge-detail knowledge-rich-detail"><div className="knowledge-detail-meta">{p&&<span><Icon name="lucide:folder"/>{p.name}</span>}{m&&<span><Icon name="lucide:blocks"/>{m.module_key} · {m.name}</span>}{(article.tags||[]).map(tag=><span key={tag}><Icon name="lucide:tag"/>{tag}</span>)}</div><article className="knowledge-content knowledge-rendered"><KnowledgeRenderedBlocks blocks={blocks} media={media} title={article.title}/></article></div><div className="form-footer static-footer"><div className="form-footer-left"><button className="secondary-button" onClick={onClose}>Cerrar</button></div>{canManage&&<button className="primary" onClick={onEdit}><Icon name="lucide:pencil"/> Editar artículo</button>}</div></Modal>
}

function KnowledgePreviewImage({block,media=[]}){
  const row=media.find(x=>x.id===block.media_id)
  const [pendingUrl,setPendingUrl]=useState('')
  useEffect(()=>{if(!block.pending_file){setPendingUrl('');return}const url=URL.createObjectURL(block.pending_file);setPendingUrl(url);return()=>URL.revokeObjectURL(url)},[block.pending_file])
  const src=row?.signed_url||pendingUrl
  if(!src)return null
  return <figure><img src={src} alt={block.alt||''}/>{block.caption&&<figcaption>{block.caption}</figcaption>}</figure>
}
function KnowledgeRenderedBlocks({blocks,media=[],title='Artículo',coverSettings=null}){
  const render=raw=>{const b=normalizeKnowledgeBlockRuntime(raw)
    if(b.type==='richtext')return <div className="knowledge-rich-rendered" style={{lineHeight:b.line_height||'1.5'}} dangerouslySetInnerHTML={{__html:sanitizeKnowledgeHtml(b.html||'')}}/>
    if(b.type==='heading1')return <h1>{b.text}</h1>;if(b.type==='heading2')return <h2>{b.text}</h2>;if(b.type==='heading3')return <h3>{b.text}</h3>;if(b.type==='heading4')return <h4>{b.text}</h4>;if(b.type==='heading5')return <h5>{b.text}</h5>
    if(b.type==='list'){const Tag=b.list_style==='ordered'?'ol':'ul';return <Tag>{String(b.text||'').split('\n').filter(Boolean).map((x,i)=><li key={i}>{x}</li>)}</Tag>}
    if(b.type==='quote')return <blockquote>{b.text}{b.author&&<cite>— {b.author}</cite>}</blockquote>
    if(b.type==='callout')return <aside className={`knowledge-callout tone-${b.tone||'info'}`}><Icon name={b.tone==='success'?'lucide:circle-check':b.tone==='warning'?'lucide:triangle-alert':b.tone==='danger'?'lucide:shield-alert':'lucide:info'}/><span>{b.title&&<b>{b.title}</b>}<p>{b.text}</p></span></aside>
    if(b.type==='code')return <div className="knowledge-code-rendered">{b.language&&<small>{b.language}</small>}<pre><code>{b.text}</code></pre></div>
    if(b.type==='cover')return <section className={`knowledge-cover-rendered template-${b.template||'forest'} ${b.page_break!==false?'print-page-break':''}`} style={knowledgeCoverStyle(coverSettings,b.template||'forest')}><div className="knowledge-cover-brand">{b.show_logo!==false&&<><b>TROBBU</b><small>BOUTIQUE COLLECTION</small></>}</div><div className="knowledge-cover-copy"><span>{b.eyebrow||'TROBBU · KNOWLEDGE'}</span><h1>{b.title||title}</h1>{b.subtitle&&<p>{b.subtitle}</p>}{b.meta&&<small>{b.meta}</small>}</div></section>
    if(b.type==='divider')return <hr/>;if(b.type==='pagebreak')return <div className="knowledge-page-break" role="separator" aria-label="Salto de página"><span>Salto de página</span></div>
    if(b.type==='image')return <div className={`knowledge-rendered-image align-${b.align||'center'}`}><KnowledgePreviewImage block={b} media={media}/></div>
    if(b.type==='video'){const src=knowledgeVideoEmbed(b.url);return src?<figure className="knowledge-video"><iframe src={src} title={b.caption||title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>{b.caption&&<figcaption>{b.caption}</figcaption>}</figure>:null}
    return null
  }
  return <>{(blocks||[]).map(raw=>{const b=normalizeKnowledgeBlockRuntime(raw);return <React.Fragment key={b.id}>{render(b)}</React.Fragment>})}</>
}
function KnowledgeReaderPreview({form,blocks,media,products,modules,categories=[],coverSettings=null,onExit}){
  const p=products.find(x=>x.id===form.product_id),m=modules.find(x=>x.id===form.module_id),c=categories.find(x=>x.id===form.category_id)
  return <div className="knowledge-preview-shell">
    <div className="knowledge-preview-banner"><span><Icon name="lucide:eye"/><b>POV lector</b><small>Vista previa local · los cambios aún no se han publicado.</small></span><div className="knowledge-preview-actions"><button type="button" className="secondary-button compact" onClick={()=>window.print()}><Icon name="lucide:printer"/> Imprimir / PDF</button><button type="button" className="secondary-button compact" onClick={onExit}><Icon name="lucide:pencil"/> Volver a editar</button></div></div>
    <article className="content-card knowledge-reader-card knowledge-preview-card">
      <header className="knowledge-reader-hero"><span className="eyebrow">KNOWLEDGE</span><h1>{form.title.trim()||'Título del artículo'}</h1><p>{form.summary.trim()||'Así verá el lector el resumen y contenido del artículo.'}</p><div className="knowledge-detail-meta"><span><Icon name="lucide:circle-dot"/>{form.status==='published'?'Publicado':form.status==='archived'?'Archivado':'Borrador'}</span>{c&&<span><Icon name={c.icon||'lucide:folder-tree'}/>{c.name}</span>}{p&&<span><Icon name="lucide:folder"/>{p.name}</span>}{m&&<span><Icon name="lucide:blocks"/>{m.module_key} · {m.name}</span>}{form.tags.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20).map(tag=><span key={tag}><Icon name="lucide:tag"/>{tag}</span>)}</div></header>
      <div className="knowledge-content knowledge-rendered knowledge-reader-content"><KnowledgeRenderedBlocks blocks={blocks} media={media} title={form.title} coverSettings={coverSettings}/></div>
    </article>
  </div>
}

function KnowledgeArticleEditorPage({liveRevision=0,article,version,workspace,products,modules,categories=[],initialCategoryId=null,settings=null,session,locale='es',canPublish=false,onBack,onSave}){
  const source=version||article||{},[articleId]=useState(()=>article?.id||crypto.randomUUID())
  const defaultCategory=source.category_id||initialCategoryId||categories.find(c=>c.code==='general')?.id||categories[0]?.id||''
  const [f,setF]=useState({title:source.title||'',slug:source.slug||article?.slug||'',summary:source.summary||'',tags:(source.tags||[]).join(', '),product_id:source.product_id||'',module_id:source.module_id||'',category_id:defaultCategory,source_language:article?.default_language||locale})
  const [changeNote,setChangeNote]=useState(version?.change_note||'Versión inicial')
  const [blocks,setBlocks]=useState(()=>knowledgeDefaultBlocks(source)),[media,setMedia]=useState([]),[saving,setSaving]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false),[exitPrompt,setExitPrompt]=useState(false)
  const [savedSnapshot,setSavedSnapshot]=useState(()=>knowledgeEditorSnapshot({title:source.title||'',slug:source.slug||article?.slug||'',summary:source.summary||'',tags:(source.tags||[]).join(', '),product_id:source.product_id||'',module_id:source.module_id||'',category_id:defaultCategory,source_language:article?.default_language||locale},version?.change_note||'Versión inicial',blocks))
  const pendingExitRef=useRef(null),dirtyRef=useRef(false),liveTypingDirtyRef=useRef(false),liveRichHtmlRef=useRef(new Map())
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const blocksWithLiveHtml=sourceBlocks=>(sourceBlocks||[]).map(raw=>{const b=normalizeKnowledgeBlockRuntime(raw);return b.type==='richtext'&&liveRichHtmlRef.current.has(b.id)?{...b,html:liveRichHtmlRef.current.get(b.id)}:raw})
  const noteRichInput=(id,html)=>{liveRichHtmlRef.current.set(id,html);liveTypingDirtyRef.current=true;dirtyRef.current=true}
  const currentSnapshot=useMemo(()=>knowledgeEditorSnapshot(f,changeNote,blocks),[f,changeNote,blocks])
  const dirty=liveTypingDirtyRef.current||currentSnapshot!==savedSnapshot
  dirtyRef.current=dirty
  const requestExit=action=>{const next=action||onBack;if(!dirtyRef.current){next?.();return}pendingExitRef.current=next;setExitPrompt(true)}
  const discardAndExit=()=>{const next=pendingExitRef.current||onBack;pendingExitRef.current=null;setExitPrompt(false);dirtyRef.current=false;next?.()}
  const keepEditing=()=>{pendingExitRef.current=null;setExitPrompt(false)}
  useEffect(()=>{let cancelled=false;(async()=>{if(!article?.id)return;const {data,error}=await db.from('knowledge_media').select('*').eq('article_id',article.id).order('created_at');if(!cancelled&&!error)setMedia(await signedKnowledgeMedia(data||[]))})();return()=>{cancelled=true}},[article?.id,liveRevision])
  useEffect(()=>{const guard={isDirty:()=>dirtyRef.current,requestExit:action=>requestExit(action)};window.__jiraKnowledgeEditorGuard=guard;const before=e=>{if(!dirtyRef.current)return;e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',before);return()=>{window.removeEventListener('beforeunload',before);if(window.__jiraKnowledgeEditorGuard===guard)delete window.__jiraKnowledgeEditorGuard}},[])
  const submit=async(e,publish=false)=>{
    e?.preventDefault?.();setError('')
    try{
      if(!f.title.trim())throw new Error('El título es obligatorio.')
      if(!f.category_id)throw new Error('Selecciona una categoría para el artículo.')
      if(!version&&!changeNote.trim())throw new Error('Indica el motivo de esta versión.')
      if(!blocks.length)throw new Error('Agrega al menos un bloque de contenido.')
      for(const b of blocks){if(b.type==='image'&&!b.media_id&&!b.pending_file)throw new Error('Selecciona una imagen o elimina el bloque de imagen vacío.');if(b.type==='video'&&b.url&&!knowledgeVideoEmbed(b.url))throw new Error('Solo se admiten URLs válidas de YouTube o Vimeo.')}
      const clean=normalizeKnowledgeBlocks(blocksWithLiveHtml(blocks)),plain=knowledgePlainText(clean)
      if(!plain&&!blocks.some(b=>['image','video','divider','pagebreak','cover'].includes(normalizeKnowledgeBlockRuntime(b).type)))throw new Error('Agrega contenido al artículo.')
      setSaving(true)
      const result=await onSave({article_id:articleId,row:{title:f.title.trim(),slug:(f.slug.trim()||knowledgeSlug(f.title)),summary:f.summary.trim()||null,content:plain,tags:f.tags.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20),product_id:f.product_id||null,module_id:f.module_id||null,category_id:f.category_id||null,content_blocks:clean,default_language:f.source_language},blocks,media,change_note:changeNote,publish})
      if(!publish){const savedBlocks=result?.blocks||clean;if(result?.blocks)setBlocks(savedBlocks);liveRichHtmlRef.current.clear();liveTypingDirtyRef.current=false;setSavedSnapshot(knowledgeEditorSnapshot(f,changeNote,savedBlocks));dirtyRef.current=false}
    }catch(err){setError(err.message||String(err))}finally{setSaving(false)}
  }
  const versionNo=version?.version_number||1
  return <div className="page knowledge-author-page">
    <div className="knowledge-author-header">
      <div className="knowledge-author-header-top">
        <div className="knowledge-author-heading"><span className="page-icon"><Icon name={article?'lucide:file-pen-line':'lucide:file-plus-2'}/></span><div><span className="eyebrow">KNOWLEDGE</span><h1>{article?`Editar borrador v${versionNo}`:'Nuevo artículo'}</h1></div></div>
        <span className="knowledge-version-chip"><Icon name="lucide:git-branch"/> v{versionNo} · Borrador</span>
      </div>
      <div className="knowledge-author-header-bottom">
        <div><p>La versión pública permanece visible hasta que publiques este borrador.</p>{dirty&&<small className="knowledge-unsaved-indicator"><Icon name="lucide:circle"/> Cambios sin guardar</small>}{version?.change_note&&<small className="knowledge-version-reason"><b>Motivo:</b> {version.change_note}</small>}</div>
        <div className="knowledge-author-actions"><button type="button" className="secondary-button knowledge-exit-action" onClick={()=>requestExit(onBack)}><Icon name="lucide:log-out"/>Salir</button><button type="button" className={`secondary-button ${preview?'active':''}`} onClick={()=>setPreview(x=>!x)}><Icon name={preview?'lucide:pencil':'lucide:eye'}/>{preview?'Editar contenido':'Vista previa'}</button><button type="button" className="secondary-button" disabled={saving} onClick={e=>submit(e,false)}><Icon name="lucide:save"/>{saving?'Guardando…':'Guardar borrador'}</button>{canPublish&&<button type="button" className="primary" disabled={saving} onClick={e=>submit(e,true)}><Icon name="lucide:send"/>{article?'Publicar versión':'Publicar artículo'}</button>}</div>
      </div>
    </div>
    {error&&<div className="error knowledge-page-error"><Icon name="lucide:circle-alert"/>{error}</div>}
    {preview?<KnowledgeReaderPreview form={{...f,status:'draft'}} blocks={blocksWithLiveHtml(blocks)} media={media} products={products} modules={modules} categories={categories} coverSettings={settings?.knowledge_cover_templates} onExit={()=>setPreview(false)}/>:<form className="knowledge-page-form" onSubmit={e=>submit(e,false)}>
      <section className="content-card knowledge-page-section">
        <div className="knowledge-section-title"><span><Icon name="lucide:settings-2"/></span><div><h2>Detalles del artículo</h2><p>Clasificación, resumen y metadatos que usarán los lectores y el asistente de Knowledge.</p></div></div>
        <div className="knowledge-details-grid">
          <label className="knowledge-title-field">Título<input required value={f.title} onChange={e=>{set('title',e.target.value);if(!article&&!f.slug)set('slug',knowledgeSlug(e.target.value))}} placeholder="Ej. Cómo configurar pagos con Stripe"/></label>
          <label>Slug<input required value={f.slug} onChange={e=>set('slug',knowledgeSlug(e.target.value))} placeholder="como-configurar-pagos-stripe"/></label>
          <label>Categoría<select required value={f.category_id} onChange={e=>set('category_id',e.target.value)}><option value="" disabled>Selecciona una categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Producto<select value={f.product_id} onChange={e=>{set('product_id',e.target.value);if(f.module_id&&!modules.some(m=>m.id===f.module_id&&(!e.target.value||m.product_id===e.target.value||!m.product_id)))set('module_id','')}}><option value="">General</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Módulo<select value={f.module_id} onChange={e=>set('module_id',e.target.value)}><option value="">Sin módulo</option>{modules.filter(m=>!f.product_id||m.product_id===f.product_id||!m.product_id).map(m=><option key={m.id} value={m.id}>{m.module_key} · {m.name}</option>)}</select></label>
          <label>Idioma fuente<select value={f.source_language} onChange={e=>set('source_language',e.target.value)} disabled={!!article}><option value="es">Español (ES)</option><option value="en">English (EN)</option></select></label>
          {!version&&<label>Motivo de la versión<input required value={changeNote} onChange={e=>setChangeNote(e.target.value)} placeholder="Versión inicial / motivo del cambio"/></label>}
          <label className="knowledge-wide-field">Resumen<textarea rows="3" value={f.summary} onChange={e=>set('summary',e.target.value)} placeholder="Explica en pocas líneas qué resolverá este artículo."/></label>
          <label className="knowledge-wide-field">Etiquetas <span className="optional">Separadas por coma</span><input value={f.tags} onChange={e=>set('tags',e.target.value)} placeholder="reservaciones, pagos, stripe"/></label>
        </div>
      </section>
      <section className="content-card knowledge-page-section knowledge-content-builder">
        <div className="knowledge-section-title"><span><Icon name="lucide:blocks"/></span><div><h2>Contenido del artículo</h2><p>Combina portada ejecutiva, títulos H1–H5 (32/28/24/20/16 px), texto enriquecido por selección, listas, destacados, multimedia, separadores y saltos de página. Los bloques se publican en el mismo orden.</p></div></div>
        <div className="knowledge-page-editor"><KnowledgeBlockEditor blocks={blocks} setBlocks={setBlocks} media={media} articleTitle={f.title} coverSettings={settings?.knowledge_cover_templates} onRichInput={noteRichInput}/></div>
      </section>
      <div className="knowledge-page-bottom-actions"><button type="button" className="secondary-button" onClick={()=>requestExit(onBack)}>Cancelar</button><button type="button" className="secondary-button" onClick={()=>setPreview(true)}><Icon name="lucide:eye"/> Vista previa lector</button><button type="submit" className="secondary-button" disabled={saving}><Icon name="lucide:save"/> Guardar borrador</button>{canPublish&&<button type="button" className="primary" disabled={saving} onClick={e=>submit(e,true)}><Icon name="lucide:send"/> {article?'Publicar versión':'Publicar artículo'}</button>}</div>
    </form>}
    {exitPrompt&&<Modal title="¿Estás seguro de salir?" subtitle="Tienes cambios sin guardar en este artículo." onClose={keepEditing} size="sm"><div className="form-body knowledge-exit-body"><div className="knowledge-exit-warning"><span><Icon name="lucide:triangle-alert" size={28}/></span><div><b>Los cambios realizados se perderán.</b><p>Te sugerimos guardar este borrador antes de salir.</p></div></div></div><div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="danger-outline" onClick={discardAndExit}><Icon name="lucide:log-out"/> Salir y descartar</button></div><div className="modal-actions"><button type="button" className="primary" onClick={keepEditing}><Icon name="lucide:pencil"/> Continuar editando</button></div></div></Modal>}
  </div>
}

function KnowledgeArticlePage({liveRevision=0,article,versions=[],events=[],products,modules,categories=[],members=[],settings=null,locale='es',canManage,onBack,onEdit,onCreateVersion,onPublishVersion}){
  const [media,setMedia]=useState([]),[display,setDisplay]=useState(article),[translation,setTranslation]=useState({loading:false,cached:false,provider:'source',error:''}),[historyOpen,setHistoryOpen]=useState(false)
  const activeVersion=versions.find(v=>v.id===article.active_version_id&&v.article_id===article.id)||versions.filter(v=>v.article_id===article.id&&v.status==='published').sort((a,b)=>Number(b.version_number||0)-Number(a.version_number||0))[0]||null
  const p=products.find(x=>x.id===display.product_id),m=modules.find(x=>x.id===display.module_id),c=categories.find(x=>x.id===display.category_id),blocks=knowledgeDefaultBlocks(display)
  const nameFor=id=>members.find(x=>x.user_id===id)?.profile?.full_name||members.find(x=>x.user_id===id)?.profile?.email||'Usuario'
  useEffect(()=>{let cancelled=false;(async()=>{const {data,error}=await db.from('knowledge_media').select('*').eq('article_id',article.id).order('created_at');if(!cancelled&&!error)setMedia(await signedKnowledgeMedia(data||[]))})();return()=>{cancelled=true}},[article.id,liveRevision])
  useEffect(()=>{let cancelled=false;(async()=>{
    const source=activeVersion?{...article,...activeVersion,status:'published'}:article
    if(locale===(article.default_language||'es')||!activeVersion?.id){setDisplay(source);setTranslation({loading:false,cached:true,provider:'source',error:''});return}
    const local=knowledgeTranslationLocalGet(activeVersion.id,locale)
    if(local){setDisplay({...source,title:local.title||source.title,summary:local.summary??source.summary,content:local.content||source.content,content_blocks:local.content_blocks||source.content_blocks,tags:local.tags||source.tags});setTranslation({loading:false,cached:true,provider:'local',error:''});return}
    setTranslation(x=>({...x,loading:true,error:''}))
    try{const {data,error}=await db.functions.invoke('translate-knowledge-version',{body:{version_id:activeVersion.id,language:locale}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));if(cancelled)return;const t=data.translation||{};knowledgeTranslationLocalSet(activeVersion.id,locale,t);setDisplay({...source,title:t.title||source.title,summary:t.summary??source.summary,content:t.content||source.content,content_blocks:t.content_blocks||source.content_blocks,tags:t.tags||source.tags});setTranslation({loading:false,cached:!!data.cached,provider:data.provider||'cache',error:''})}
    catch(err){if(!cancelled){setDisplay(source);setTranslation({loading:false,cached:false,provider:'source',error:err.message||String(err)})}}
  })();return()=>{cancelled=true}},[article.id,article.active_version_id,locale,activeVersion?.id])
  const history=[...versions].sort((a,b)=>b.version_number-a.version_number)
  return <div className="page knowledge-reader-page" data-i18n-skip>
    <div className="knowledge-reader-actions"><button type="button" className="secondary-button compact" onClick={onBack}><Icon name="lucide:arrow-left"/> {locale==='en'?'Back to Knowledge':'Volver a Knowledge'}</button><div className="knowledge-reader-action-group"><button type="button" className="secondary-button compact knowledge-print-action" onClick={()=>window.print()}><Icon name="lucide:printer"/> {locale==='en'?'Print / PDF':'Imprimir / PDF'}</button><span className="knowledge-language-badge"><Icon name="lucide:languages"/>{locale.toUpperCase()}{translation.loading?' · …':translation.provider!=='source'?` · ${translation.cached?'cache':'AI'}`:''}</span>{canManage&&<button type="button" className="secondary-button compact" onClick={()=>setHistoryOpen(x=>!x)}><Icon name="lucide:history"/> {locale==='en'?'Versions':'Versiones'} <em>{history.length}</em></button>}{canManage&&<button type="button" className="primary compact" onClick={article.draft_version_id?onEdit:onCreateVersion}><Icon name={article.draft_version_id?'lucide:file-pen-line':'lucide:git-branch-plus'}/> {article.draft_version_id?(locale==='en'?'Edit draft':'Editar borrador'):(locale==='en'?'New version':'Nueva versión')}</button>}</div></div>
    {translation.error&&locale!==(article.default_language||'es')&&<div className="notice knowledge-translation-notice"><Icon name="lucide:languages"/><span>{locale==='en'?'The saved translation could not be loaded; showing the source language.':'No se pudo cargar la traducción guardada; se muestra el idioma fuente.'}</span></div>}
    <article className="content-card knowledge-reader-card">
      <header className="knowledge-reader-hero"><div className="knowledge-reader-version-line"><span className="knowledge-status published">{locale==='en'?'Published':'Publicado'}</span>{activeVersion&&<span className="knowledge-version-chip"><Icon name="lucide:git-branch"/>v{activeVersion.version_number}</span>}</div><h1>{display.title}</h1>{display.summary&&<p>{display.summary}</p>}<div className="knowledge-detail-meta">{c&&<span><Icon name={c.icon||'lucide:folder-tree'}/>{c.name}</span>}{p&&<span><Icon name="lucide:folder"/>{p.name}</span>}{m&&<span><Icon name="lucide:blocks"/>{m.module_key} · {m.name}</span>}{(display.tags||[]).map(tag=><span key={tag}><Icon name="lucide:tag"/>{tag}</span>)}</div></header>
      <div className="knowledge-content knowledge-rendered knowledge-reader-content"><KnowledgeRenderedBlocks blocks={blocks} media={media} title={display.title} coverSettings={settings?.knowledge_cover_templates}/></div>
    </article>
    {historyOpen&&canManage&&<section className="content-card knowledge-version-history"><div className="knowledge-section-title"><span><Icon name="lucide:history"/></span><div><h2>{locale==='en'?'Version history':'Historial de versiones'}</h2><p>{locale==='en'?'Audit trail of drafts, publications and restorations.':'Trazabilidad de borradores, publicaciones y restauraciones.'}</p></div></div><div className="knowledge-version-list">{history.map(v=>{const active=v.id===article.active_version_id,draft=v.status==='draft';return <article key={v.id} className={`knowledge-version-row ${active?'active':''} ${draft?'draft':''}`}><div className="knowledge-version-number"><b>v{v.version_number}</b><span className={`knowledge-status ${v.status}`}>{active?(locale==='en'?'Active':'Activa'):draft?(locale==='en'?'Draft':'Borrador'):(locale==='en'?'History':'Histórico')}</span></div><div className="knowledge-version-copy"><b>{v.change_note}</b><small>{locale==='en'?'Created by':'Creada por'} {nameFor(v.created_by)} · {formatDateTime(v.created_at)}</small><small>{locale==='en'?'Last edited by':'Última edición por'} {nameFor(v.content_updated_by||v.updated_by)} · {formatDateTime(v.content_updated_at||v.updated_at)}</small>{v.published_at&&<small>{locale==='en'?'Published by':'Publicada por'} {nameFor(v.published_by)} · {formatDateTime(v.published_at)}</small>}{events.filter(e=>e.version_id===v.id).length>0&&<details className="knowledge-version-events"><summary>{locale==='en'?'Activity':'Actividad'} · {events.filter(e=>e.version_id===v.id).length}</summary>{events.filter(e=>e.version_id===v.id).slice(0,8).map(e=><span key={e.id}><b>{e.event_type==='created'?(locale==='en'?'Created':'Creada'):e.event_type==='published'?(locale==='en'?'Published':'Publicada'):e.event_type==='restored'?(locale==='en'?'Restored':'Restaurada'):e.event_type==='archived'?(locale==='en'?'Archived':'Archivada'):(locale==='en'?'Updated':'Actualizada')}</b><small>{nameFor(e.actor_id)} · {formatDateTime(e.created_at)}</small></span>)}</details>}</div><div className="knowledge-version-actions">{draft&&<button type="button" className="secondary-button compact" onClick={onEdit}><Icon name="lucide:pencil"/>{locale==='en'?'Edit draft':'Editar borrador'}</button>}{!draft&&!active&&<button type="button" className="secondary-button compact" onClick={()=>onPublishVersion(v)}><Icon name="lucide:rotate-ccw"/>{locale==='en'?'Restore as public':'Restaurar como pública'}</button>}</div></article>})}</div></section>}
  </div>
}


function KnowledgeListPreviewPage({liveRevision=0,article,version,products=[],modules=[],categories=[],settings=null,locale='es',onBack}){
  const [media,setMedia]=useState([])
  const source=version?{...article,...version}:article
  const product=products.find(x=>x.id===source.product_id),module=modules.find(x=>x.id===source.module_id),category=categories.find(x=>x.id===source.category_id)
  const blocks=knowledgeDefaultBlocks(source)
  useEffect(()=>{let cancelled=false;(async()=>{const {data,error}=await db.from('knowledge_media').select('*').eq('article_id',article.id).order('created_at');if(!cancelled&&!error)setMedia(await signedKnowledgeMedia(data||[]))})();return()=>{cancelled=true}},[article.id,liveRevision])
  const statusLabel=source.status==='draft'?(locale==='en'?'Draft':'Borrador'):source.status==='archived'?(locale==='en'?'Archived':'Archivado'):(locale==='en'?'Published':'Publicado')
  return <div className="page knowledge-reader-page" data-i18n-skip>
    <div className="knowledge-preview-banner knowledge-list-preview-banner"><span><Icon name="lucide:scan-eye"/><b>{locale==='en'?'Reader POV preview':'Vista previa POV lector'}</b><small>{locale==='en'?`Previewing ${version?`v${version.version_number} · `:''}${statusLabel}. No content is changed.`:`Visualizando ${version?`v${version.version_number} · `:''}${statusLabel}. No se modifica ningún contenido.`}</small></span><div className="knowledge-preview-actions"><button type="button" className="secondary-button compact" onClick={()=>window.print()}><Icon name="lucide:printer"/> {locale==='en'?'Print / PDF':'Imprimir / PDF'}</button><button type="button" className="secondary-button compact" onClick={onBack}><Icon name="lucide:arrow-left"/> {locale==='en'?'Back to Knowledge':'Volver a Knowledge'}</button></div></div>
    <article className="content-card knowledge-reader-card knowledge-preview-card">
      <header className="knowledge-reader-hero"><div className="knowledge-reader-version-line"><span className={`knowledge-status ${source.status||'draft'}`}>{statusLabel}</span>{version&&<span className="knowledge-version-chip"><Icon name="lucide:git-branch"/>v{version.version_number}</span>}</div><h1>{source.title}</h1>{source.summary&&<p>{cleanKnowledgeSnippet(source.summary,420)}</p>}<div className="knowledge-detail-meta">{category&&<span><Icon name={category.icon||'lucide:folder-tree'}/>{category.name}</span>}{product&&<span><Icon name="lucide:folder"/>{product.name}</span>}{module&&<span><Icon name="lucide:blocks"/>{module.module_key} · {module.name}</span>}{(source.tags||[]).map(tag=><span key={tag}><Icon name="lucide:tag"/>{tag}</span>)}</div></header>
      <div className="knowledge-content knowledge-rendered knowledge-reader-content"><KnowledgeRenderedBlocks blocks={blocks} media={media} title={source.title} coverSettings={settings?.knowledge_cover_templates}/></div>
    </article>
  </div>
}

function KnowledgeSuggestions({workspace,locale='es',title,description,articles=[],productId=null,departmentId=null,requestTypeId=null}){
  const [state,setState]=useState({loading:false,message:'',articles:[],provider:'',error:false,mode:'title'}),[expanded,setExpanded]=useState(null)
  useEffect(()=>{
    const subject=String(title||'').trim(),detail=String(description||'').trim(),titleReady=subject.length>=5,detailReady=detail.length>=12
    // v17.8: restore proactive matching while the requester types the title.
    // Description, product, department and request type enrich the same search when available.
    if(!titleReady&&!detailReady){setState({loading:false,message:'',articles:[],provider:'',error:false,mode:'title'});return}
    let cancelled=false
    setState({loading:false,message:'',articles:[],provider:'',error:false,mode:detailReady?'full':'title'})
    const timer=setTimeout(async()=>{
      if(!cancelled)setState(x=>({...x,loading:true,error:false}))
      try{
        const {data,error}=await db.functions.invoke('trobbu-knowledge-assistant',{body:{workspace_id:workspace.id,title,description,product_id:productId||null,department_id:departmentId||null,request_type_id:requestTypeId||null,language:locale}})
        if(error||data?.error)throw new Error(await functionErrorMessage(error,data))
        if(!cancelled)setState({loading:false,message:data.message||'',articles:(data.articles||[]).map(a=>({...a,summary:cleanKnowledgeSnippet(a.summary||a.content_preview,200)})),provider:data.provider||'',error:false,mode:data.mode||(detailReady?'full':'title')})
      }catch(err){
        if(!cancelled)setState({loading:false,message:detailReady?(locale==='en'?'I could not validate reliable Knowledge matches right now. You can continue creating the request.':'No pude validar coincidencias confiables de Knowledge en este momento. Puedes continuar creando la solicitud.'):'',articles:[],provider:'unavailable',error:detailReady,mode:detailReady?'full':'title'})
      }
    },650)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[workspace?.id,title,description,productId,departmentId,requestTypeId,locale])
  if(!state.loading&&!state.message&&!state.articles.length)return null
  const guidance=state.mode==='title'
    ? (locale==='en'?'The assistant is matching the request title against published Knowledge articles. Add description or product context to refine it further.':'El asistente está relacionando el título contra artículos publicados de Knowledge. Agrega descripción o producto para afinar todavía más la coincidencia.')
    : (locale==='en'?'The assistant validated the complete request against each article title, category, tags, summary and searchable content. Review the evidence before opening the ticket.':'El asistente validó la solicitud completa contra título, categoría, etiquetas, resumen y contenido consultable de cada artículo. Revisa la evidencia antes de abrir el ticket.')
  return <div className={`knowledge-suggestions ${state.error?'knowledge-suggestions-error':''}`}><div className="knowledge-suggestion-head"><span><Icon name="lucide:sparkles"/><b>{locale==='en'?'Knowledge Assistant':'Asistente Knowledge'}</b></span>{state.loading&&<small>{locale==='en'?'Validating semantic matches…':'Validando coincidencias semánticas…'}</small>}</div>{state.articles.length>0&&<div className="knowledge-suggestion-guidance"><Icon name="lucide:book-open-check"/><p>{guidance}</p></div>}{state.message&&<p className="knowledge-suggestion-ai-message">{cleanKnowledgeSnippet(state.message,300)}</p>}{state.articles.length>0&&<div className="knowledge-suggestion-list">{state.articles.map(a=><article key={a.id}><button type="button" onClick={()=>setExpanded(expanded===a.id?null:a.id)}><span><Icon name="lucide:book-open"/><b>{a.title}</b><small>{cleanKnowledgeSnippet(a.summary||(locale==='en'?'Related resource':'Recurso relacionado'),200)}</small>{Number.isFinite(Number(a.relevance))&&<em className="knowledge-relevance"><Icon name="lucide:target" size={12}/>{Math.round(Number(a.relevance)*100)}% relevancia</em>}</span><Icon name={expanded===a.id?'lucide:chevron-up':'lucide:chevron-down'}/></button>{expanded===a.id&&<div className="knowledge-suggestion-preview">{a.match_reason&&<p className="knowledge-match-reason"><b>Por qué coincide:</b> {cleanKnowledgeSnippet(a.match_reason,220)}</p>}{Array.isArray(a.matched_terms)&&a.matched_terms.length>0&&<div className="knowledge-match-terms"><b>{locale==='en'?'Matched concepts':'Conceptos coincidentes'}:</b>{a.matched_terms.slice(0,5).map(term=><span key={term}>{term}</span>)}</div>}<p>{cleanKnowledgeSnippet(a.summary||(locale==='en'?'Open the full article to review all details.':'Abre el artículo completo para revisar todos los detalles.'),220)}</p><a className="primary compact knowledge-direct-link" href={knowledgeArticleUrl(a.id)} target="_blank" rel="noopener noreferrer"><Icon name="lucide:external-link"/> {locale==='en'?'Read full article':'Leer artículo completo'}</a><small>{locale==='en'?'The article opens in a new tab so the request you are writing remains intact.':'El artículo se abrirá en una nueva pestaña para conservar lo que ya escribiste en este ticket.'}</small></div>}</article>)}</div>}</div>
}


function VacationStatusBadge({status}){
  const map={pending:['Pendiente','lucide:clock-3'],approved:['Aprobada','lucide:circle-check'],rejected:['Rechazada','lucide:circle-x'],cancelled:['Cancelada','lucide:ban']},row=map[status]||[status,'lucide:circle']
  return <span className={`vacation-status ${status}`}><Icon name={row[1]} size={13}/>{row[0]}</span>
}
function VacationRiskBadge({risk}){
  if(!risk)return <span className="vacation-risk none"><Icon name="lucide:sparkles" size={13}/>Sin analizar</span>
  const label={low:'Bajo',medium:'Medio',high:'Alto',critical:'Crítico'}[risk]||risk
  return <span className={`vacation-risk ${risk}`}><Icon name={risk==='low'?'lucide:shield-check':risk==='medium'?'lucide:triangle-alert':'lucide:shield-alert'} size={13}/>Riesgo {label}</span>
}
function VacationDecisionModal({item,status,onClose,onSave}){
  const [note,setNote]=useState('')
  return <Modal title={status==='approved'?'Aprobar vacaciones':'Rechazar solicitud'} subtitle={`${formatDate(item.start_date)} → ${formatDate(item.end_date)}`} onClose={onClose}><AsyncForm onSubmit={()=>onSave(note)} submitLabel={status==='approved'?'Confirmar aprobación':'Confirmar rechazo'}><div className={`notice ${status==='approved'?'success-notice':''}`}><Icon name={status==='approved'?'lucide:calendar-check-2':'lucide:calendar-x-2'}/><span>{status==='approved'?'La ausencia quedará aprobada y el integrante se excluirá de la autoasignación durante sus días de ausencia. El análisis de IA, si existe, es únicamente una sugerencia de riesgo.':'El solicitante recibirá una notificación con el resultado.'}</span></div><label>Nota de decisión <span className="optional">Recomendada</span><textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} placeholder={status==='approved'?'Ej. Aprobado con handoff de tickets antes del inicio.':'Explica brevemente el motivo o alternativa propuesta.'}/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>
}
function vacationTypeFor(types,id){return (types||[]).find(t=>t.id===id)||null}
function vacationRequestUnitsForYear(request,types,year,{deductOnly=false}={}){
  const type=vacationTypeFor(types,request?.vacation_type_id),fraction=Number(type?.day_fraction||((request?.half_day_period)?0.5:1)),deducts=type?.deducts_from_balance!==false
  if(deductOnly&&!deducts)return 0
  const ys=`${year}-01-01`,ye=`${year}-12-31`
  return vacationBlocks(request).reduce((sum,b)=>{const start=b.start_date<ys?ys:b.start_date,end=b.end_date>ye?ye:b.end_date;return end>=start?sum+(daysBetween(start,end)+1)*fraction:sum},0)
}
function vacationRequestUnits(request,types){
  const type=vacationTypeFor(types,request?.vacation_type_id),fraction=Number(type?.day_fraction||((request?.half_day_period)?0.5:1))
  return vacationBlocks(request).reduce((sum,b)=>sum+(daysBetween(b.start_date,b.end_date)+1)*fraction,0)
}
function VacationTypeBadge({request,types}){
  const type=vacationTypeFor(types,request?.vacation_type_id),name=type?.name||'Vacaciones',color=type?.color||'#0C66E4'
  const half=request?.half_day_period==='first_half'?' · 1ª mitad':request?.half_day_period==='second_half'?' · 2ª mitad':''
  return <span className="vacation-type-badge" style={{'--vacation-type-color':color}}><i></i>{name}{half}</span>
}

function VacationTimeline({requests=[],members=[],today,types=[]}){
  const [range,setRange]=useState('4w'),[cursor,setCursor]=useState(today||dateKey(new Date()))
  const start=new Date(`${cursor}T12:00:00`)
  const addRange=(date,key)=>{const d=new Date(date);if(key.endsWith('w'))d.setDate(d.getDate()+Number(key.slice(0,-1))*7);else d.setMonth(d.getMonth()+Number(key.slice(0,-1)));return d}
  const endExclusive=addRange(start,range),end=new Date(endExclusive);end.setDate(end.getDate()-1)
  const span=daysBetween(cursor,dateKey(end))+1,days=Array.from({length:span},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d})
  const dayWidth=span<=8?70:span<=30?34:span<=45?26:span<=60?22:span<=95?16:11,cellStyle={gridTemplateColumns:`repeat(${span},${dayWidth}px)`}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),position=block=>{const from=daysBetween(cursor,block.start_date),to=daysBetween(cursor,block.end_date);if(to<0||from>=span)return null;return {start:clamp(from,0,span-1)+1,end:clamp(to,0,span-1)+2,leftCut:from<0,rightCut:to>=span}}
  const returnPos=block=>{if(!block.return_date)return null;const n=daysBetween(cursor,block.return_date);return n<0||n>=span?null:n+1}
  const visible=(requests||[]).filter(r=>['approved','pending'].includes(r.status)&&vacationBlocks(r).some(b=>position(b))).sort((a,b)=>String(vacationStart(a)).localeCompare(String(vacationStart(b))))
  const monthGroups=[];days.forEach((d,i)=>{const key=`${d.getFullYear()}-${d.getMonth()}`,last=monthGroups.at(-1);if(last?.key===key)last.count++;else monthGroups.push({key,label:new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(d),start:i+1,count:1})})
  const nameFor=id=>members.find(m=>m.user_id===id)?.profile?.full_name||members.find(m=>m.user_id===id)?.profile?.email||'Colaborador'
  const rangeLabel={'1w':'1 semana','4w':'4 semanas','6w':'6 semanas','8w':'8 semanas','1m':'1 mes','2m':'2 meses','3m':'3 meses','6m':'6 meses'}[range]
  const shift=dir=>{const d=new Date(start);if(range.endsWith('w'))d.setDate(d.getDate()+dir*Number(range.slice(0,-1))*7);else d.setMonth(d.getMonth()+dir*Number(range.slice(0,-1)));setCursor(dateKey(d))}
  return <section className="workspace-panel vacation-timeline-panel">
    <div className="vacation-timeline-toolbar"><div className="vacation-timeline-title"><h3>Proyección de vacaciones</h3><p>{formatDate(cursor)} → {formatDate(dateKey(end))} · {rangeLabel} · aprobadas y pendientes</p></div><div className="vacation-timeline-controls"><label><span>Desde</span><input type="date" value={cursor} onChange={e=>e.target.value&&setCursor(e.target.value)}/></label><select aria-label="Rango de proyección" value={range} onChange={e=>setRange(e.target.value)}><optgroup label="Semanas"><option value="1w">1 semana</option><option value="4w">4 semanas</option><option value="6w">6 semanas</option><option value="8w">8 semanas</option></optgroup><optgroup label="Meses"><option value="1m">1 mes</option><option value="2m">2 meses</option><option value="3m">3 meses</option><option value="6m">6 meses</option></optgroup></select><button type="button" className="secondary-button compact" title="Periodo anterior" onClick={()=>shift(-1)}><Icon name="lucide:chevron-left"/></button><button type="button" className="secondary-button compact" onClick={()=>setCursor(today||dateKey(new Date()))}>Hoy</button><button type="button" className="secondary-button compact" title="Periodo siguiente" onClick={()=>shift(1)}><Icon name="lucide:chevron-right"/></button></div></div>
    <div className="vacation-timeline-legend"><span><i className="approved"></i>Aprobada</span><span><i className="pending"></i>Pendiente</span><span><i className="return"></i>Reincorporación</span></div>
    <div className="gantt-scroll vacation-timeline-scroll"><div className="gantt-canvas vacation-timeline-canvas" style={{'--gantt-days':span,'--gantt-day-width':`${dayWidth}px`}}>
      <div className="gantt-month-header"><div className="gantt-label gantt-label-head">Integrante / solicitud</div><div className="gantt-days gantt-month-grid" style={cellStyle}>{monthGroups.map(g=><span key={g.key} style={{gridColumn:`${g.start}/span ${g.count}`}}>{g.label}</span>)}</div></div>
      <div className="gantt-header"><div className="gantt-label gantt-label-head"><span>Ausencia</span><small>{visible.length} visibles</small></div><div className="gantt-days gantt-days-head" style={cellStyle}>{days.map(d=><span key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===(today||dateKey(new Date()))?'today':''}`}><b>{d.getDate()}</b><small>{new Intl.DateTimeFormat('es-MX',{weekday:'narrow'}).format(d)}</small></span>)}</div></div>
      {visible.length===0&&<div className="gantt-empty"><Icon name="lucide:calendar-off"/><span>No hay solicitudes aprobadas o pendientes dentro del periodo visible.</span></div>}
      {visible.map(r=>{const t=vacationTypeFor(types,r.vacation_type_id);return <div className="gantt-row vacation-timeline-row" key={r.id}><div className="gantt-label vacation-timeline-label"><span className="avatar sm">{initials(nameFor(r.user_id))}</span><div><b>{nameFor(r.user_id)}</b><small>{t?.name||'Vacaciones'} · {vacationRequestUnits(r,types)} día(s) · {r.status==='approved'?'Aprobada':'Pendiente'}</small></div></div><div className="gantt-days gantt-track" style={cellStyle}>{days.map(d=><i key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===(today||dateKey(new Date()))?'today':''}`}></i>)}{vacationBlocks(r).map((b,i)=>{const pos=position(b),rp=returnPos(b);return <React.Fragment key={b.id||i}>{pos&&<span className={`vacation-timeline-bar ${r.status} ${pos.leftCut?'cut-left':''} ${pos.rightCut?'cut-right':''}`} style={{gridColumn:`${pos.start}/${pos.end}`}} title={`${t?.name||'Vacaciones'} · Bloque ${i+1}: ${formatDate(b.start_date)} → ${formatDate(b.end_date)} · Reincorporación ${formatDate(b.return_date)}`}><b>{vacationBlocks(r).length>1?`B${i+1}`:''}</b></span>}{rp&&<span className="vacation-return-marker" style={{gridColumn:`${rp}/${rp+1}`}} title={`Reincorporación ${formatDate(b.return_date)}`}><Icon name="lucide:log-in" size={11}/></span>}</React.Fragment>})}</div></div>})}
    </div></div>
  </section>
}

function VacationsView({liveRevision=0,workspace,requests=[],members=[],tickets=[],sprints=[],session,settings,canRequest=false,canViewProjection=false,canManage=false,onRefresh,toast}){
  const tz=settings?.timezone||'America/Merida',today=dateKeyAtZone(new Date(),tz),currentYear=Number(today.slice(0,4))
  const blankBlock=()=>({id:crypto.randomUUID(),start_date:'',end_date:'',return_date:''})
  const [requestOpen,setRequestOpen]=useState(false),[requestBlocks,setRequestBlocks]=useState(()=>[blankBlock()]),[reason,setReason]=useState(''),[requestTypeId,setRequestTypeId]=useState(''),[halfDayPeriod,setHalfDayPeriod]=useState('')
  const [analysisMap,setAnalysisMap]=useState({}),[analyzing,setAnalyzing]=useState(null),[decision,setDecision]=useState(null)
  const [vacationTypes,setVacationTypes]=useState([]),[vacationBalances,setVacationBalances]=useState([]),[vacationMetaError,setVacationMetaError]=useState(''),[vacationMetaLoading,setVacationMetaLoading]=useState(true)
  const [balanceYear,setBalanceYear]=useState(currentYear),[balanceEditor,setBalanceEditor]=useState(null),[typeEditor,setTypeEditor]=useState(null),[typeDelete,setTypeDelete]=useState(null)
  const allowedVacationTabs=()=>['mine',...(canManage?['requests']:[]),...(canViewProjection||canManage?['projection']:[]),...(canManage?['control','types']:[])]
  const initialVacationTab=()=>{try{const requested=new URL(window.location.href).searchParams.get('tab');return allowedVacationTabs().includes(requested)?requested:(canManage?'requests':'mine')}catch{return canManage?'requests':'mine'}}
  const [sectionTab,setSectionTab]=useState(initialVacationTab)
  const [requestFilter,setRequestFilter]=useState(()=>canManage?'pending':'mine')
  const selectSectionTab=(next,{replace=false}={})=>{if(!allowedVacationTabs().includes(next))return;setSectionTab(next);try{const url=new URL(window.location.href);url.searchParams.set('view','vacations');url.searchParams.set('tab',next);window.history[replace?'replaceState':'pushState']({view:'vacations',tab:next},document.title,url.toString())}catch{}}
  const memberName=id=>members.find(m=>m.user_id===id)?.profile?.full_name||members.find(m=>m.user_id===id)?.profile?.email||'Colaborador'
  const loadVacationMeta=async()=>{setVacationMetaLoading(true);try{const [typesRes,balancesRes,ownBalancesRes]=await Promise.all([db.from('vacation_types').select('*').eq('workspace_id',workspace.id).order('sort_order').order('name'),db.from('vacation_balances').select('*').eq('workspace_id',workspace.id),db.from('vacation_balances').select('*').eq('workspace_id',workspace.id).eq('user_id',session.user.id)]);if(typesRes.error)throw typesRes.error;if(balancesRes.error&&ownBalancesRes.error)throw balancesRes.error;const merged=new Map();for(const row of balancesRes.data||[])merged.set(`${row.user_id}:${row.year}`,row);for(const row of ownBalancesRes.data||[])merged.set(`${row.user_id}:${row.year}`,row);setVacationMetaError(balancesRes.error?`La consulta general de saldos falló; se cargó tu saldo individual: ${balancesRes.error.message}`:'');setVacationTypes(typesRes.data||[]);setVacationBalances([...merged.values()])}catch(error){setVacationMetaError(error?.message||String(error))}finally{setVacationMetaLoading(false)}}
  useEffect(()=>{loadVacationMeta()},[workspace.id,liveRevision])
  useEffect(()=>{if(!requestTypeId){const first=vacationTypes.find(t=>t.active&&t.code==='vacation')||vacationTypes.find(t=>t.active);if(first)setRequestTypeId(first.id)}},[vacationTypes,requestTypeId])
  useEffect(()=>{setRequestFilter(canManage?'pending':'mine');const allowed=allowedVacationTabs();if(!allowed.includes(sectionTab))selectSectionTab(canManage?'requests':'mine',{replace:true})},[workspace.id,canManage,canViewProjection])
  useEffect(()=>{const onPop=()=>{try{const requested=new URL(window.location.href).searchParams.get('tab');if(allowedVacationTabs().includes(requested))setSectionTab(requested)}catch{}};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[canManage,canViewProjection])
  const activeTypes=vacationTypes.filter(t=>t.active),selectedType=vacationTypeFor(vacationTypes,requestTypeId)
  const approved=requests.filter(r=>r.status==='approved'),pending=requests.filter(r=>r.status==='pending')
  const outToday=approved.filter(r=>vacationOccursOn(r,today))
  const approvedUpcoming=approved.filter(r=>vacationEnd(r)>=today)
  const mine=requests.filter(r=>r.user_id===session.user.id).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))
  const allSorted=[...requests].sort((a,b)=>{const rank={pending:0,approved:1,rejected:2,cancelled:3};return (rank[a.status]??9)-(rank[b.status]??9)||String(b.created_at||b.start_date||'').localeCompare(String(a.created_at||a.start_date||''))})
  const requestGroups={pending, today:outToday, upcoming:approvedUpcoming, mine, all:allSorted}
  const visibleRequests=requestGroups[requestFilter]||allSorted
  const requestTabs=[['pending','Pendientes',pending.length,'lucide:clock-3'],['today','Fuera hoy',outToday.length,'lucide:calendar-off'],['upcoming','Aprobadas próximas',approvedUpcoming.length,'lucide:calendar-check-2'],['mine','Mis solicitudes',mine.length,'lucide:user-round-check'],['all','Ver todo',requests.length,'lucide:list-filter']]
  const balanceSummary=(userId,year)=>{const row=vacationBalances.find(b=>b.user_id===userId&&Number(b.year)===Number(year)),allowed=Number(row?.allowed_days??settings?.vacation_default_annual_days??12),adjustment=Number(row?.adjustment_used_days||0),occupied=requests.filter(r=>r.user_id===userId&&['pending','approved'].includes(r.status)).reduce((n,r)=>n+vacationRequestUnitsForYear(r,vacationTypes,year,{deductOnly:true}),0);return {row,allowed,adjustment,occupied,available:Math.round((allowed-adjustment-occupied)*100)/100,loading:vacationMetaLoading&&!row,source:row?'individual':'workspace_default'}}
  const typeUsage=(userId,year)=>vacationTypes.map(type=>({type,units:requests.filter(r=>r.user_id===userId&&r.vacation_type_id===type.id&&['pending','approved'].includes(r.status)).reduce((n,r)=>n+vacationRequestUnitsForYear(r,vacationTypes,year),0)})).filter(x=>x.units>0)
  const myBalance=balanceSummary(session.user.id,currentYear),myTypeUsage=typeUsage(session.user.id,currentYear)
  const analysisFor=r=>analysisMap[r.id]||((r.ai_analyzed_at&&r.ai_analysis&&Object.keys(r.ai_analysis).length)?r.ai_analysis:null)
  const analysisTimestamp=r=>analysisMap[r.id]?._analyzed_at||r.ai_analyzed_at||null
  const analysisFresh=r=>{const raw=analysisTimestamp(r);if(!raw)return false;const analyzedAt=new Date(raw);if(Number.isNaN(analyzedAt.getTime())||Date.now()-analyzedAt.getTime()>12*3600*1000)return false;const changedTicket=tickets.some(t=>t.workspace_id===workspace.id&&(t.dev_owner_id===r.user_id||t.qa_owner_id===r.user_id)&&t.status!=='closed'&&t.updated_at&&new Date(t.updated_at)>analyzedAt),changedSprint=sprints.some(sp=>sp.workspace_id===workspace.id&&['active','planned'].includes(sp.status)&&vacationBlocks(r).some(b=>sp.start_date<=b.end_date&&sp.end_date>=b.start_date)&&sp.updated_at&&new Date(sp.updated_at)>analyzedAt),changedAvailability=requests.some(v=>v.id!==r.id&&v.status==='approved'&&vacationRangesOverlap(v,r)&&v.updated_at&&new Date(v.updated_at)>analyzedAt);return !(changedTicket||changedSprint||changedAvailability)}
  const analyze=async r=>{setAnalyzing(r.id);try{const {data,error}=await db.functions.invoke('vacation-impact-assistant',{body:{request_id:r.id,workspace_id:r.workspace_id||workspace.id,user_id:r.user_id,start_date:vacationStart(r),end_date:vacationEnd(r)}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));const next=data?.analysis&&typeof data.analysis==='object'?data.analysis:{risk:data?.snapshot?.risk_score>=65?'high':data?.snapshot?.risk_score>=35?'medium':'low',recommendation:data?.recommendation==='avoid'?'decline':data?.recommendation==='review'?'review':'approve',summary:data?.analysis||'',metrics:data?.snapshot||{}};setAnalysisMap(x=>({...x,[r.id]:{...next,_analyzed_at:data?.analyzed_at||new Date().toISOString()}}));await onRefresh();toast('success','Análisis de impacto actualizado. Es una sugerencia y no condiciona la decisión.')}catch(err){toast('error',err.message||String(err))}finally{setAnalyzing(null)}}
  const saveDecision=async(note)=>{const {item,status}=decision;const {error}=await db.from('vacation_requests').update({status,decision_note:String(note||'').trim()||null,decision_by:session.user.id,decided_at:new Date().toISOString()}).eq('id',item.id);if(error)throw error;setDecision(null);await onRefresh();await loadVacationMeta();toast('success',status==='approved'?'Ausencia aprobada. La sugerencia IA no condiciona esta decisión.':'Solicitud rechazada y notificada.')}
  const patchBlock=(id,data)=>setRequestBlocks(list=>list.map(b=>b.id===id?{...b,...data}:b))
  const resetRequest=()=>{setRequestBlocks([blankBlock()]);setReason('');setHalfDayPeriod('');const first=vacationTypes.find(t=>t.active&&t.code==='vacation')||vacationTypes.find(t=>t.active);setRequestTypeId(first?.id||'')}
  const requestUnitsForBlocks=(blocks,type,year)=>{if(!type)return 0;const ys=`${year}-01-01`,ye=`${year}-12-31`;return blocks.reduce((n,b)=>{const s=b.start_date<ys?ys:b.start_date,e=b.end_date>ye?ye:b.end_date;return e>=s?n+(daysBetween(s,e)+1)*Number(type.day_fraction||1):n},0)}
  const submitRequest=async()=>{
    if(vacationMetaLoading)throw new Error('Espera a que termine de cargar el saldo de vacaciones antes de enviar la solicitud.')
    if(!selectedType||!selectedType.active)throw new Error('Selecciona un tipo de ausencia válido.')
    const blocks=requestBlocks.map(b=>({...b,start_date:String(b.start_date||''),end_date:String(b.end_date||''),return_date:String(b.return_date||'')}))
    if(!blocks.length||blocks.some(b=>!b.start_date||!b.end_date||!b.return_date))throw new Error('Completa inicio, fin y fecha de reincorporación de todos los bloques.')
    for(const b of blocks){if(b.end_date<b.start_date)throw new Error('La fecha final no puede ser anterior al inicio.');if(b.return_date<=b.end_date)throw new Error('La fecha de reincorporación debe ser posterior al último día de ausencia.');if(b.start_date<today)throw new Error('No puedes solicitar un bloque con fecha de inicio anterior a hoy.');if(Number(selectedType.day_fraction)===0.5&&b.start_date!==b.end_date)throw new Error('El tipo Medio día requiere que inicio y fin sean el mismo día.')}
    if((selectedType.requires_half_day_period||Number(selectedType.day_fraction)===0.5)&&!['first_half','second_half'].includes(halfDayPeriod))throw new Error('Selecciona si el medio día corresponde a la primera o segunda mitad.')
    const sorted=[...blocks].sort((a,b)=>a.start_date.localeCompare(b.start_date));for(let i=1;i<sorted.length;i++)if(sorted[i].start_date<=sorted[i-1].end_date)throw new Error('Los bloques de una misma solicitud no pueden traslaparse.')
    const totalCalendarDays=blocks.reduce((n,b)=>n+daysBetween(b.start_date,b.end_date)+1,0);if(totalCalendarDays>61)throw new Error('La suma de los bloques no puede superar 61 días de ausencia.')
    if(selectedType.deducts_from_balance){for(let year=Number(sorted[0].start_date.slice(0,4));year<=Number(sorted.at(-1).end_date.slice(0,4));year++){const requested=requestUnitsForBlocks(blocks,selectedType,year),balance=balanceSummary(session.user.id,year);if(requested>Math.max(0,balance.available)+0.0001)throw new Error(`Saldo insuficiente para ${year}: tienes ${Math.max(0,balance.available)} día(s) disponible(s) y esta solicitud requiere ${requested}.`)}}
    const startDate=sorted[0].start_date,endDate=[...blocks].sort((a,b)=>b.end_date.localeCompare(a.end_date))[0].end_date,returnDate=[...blocks].sort((a,b)=>b.return_date.localeCompare(a.return_date))[0].return_date
    const {error}=await db.from('vacation_requests').insert({workspace_id:workspace.id,user_id:session.user.id,start_date:startDate,end_date:endDate,return_date:returnDate,date_blocks:blocks.map((b,i)=>({id:b.id||`block-${i+1}`,start_date:b.start_date,end_date:b.end_date,return_date:b.return_date})),vacation_type_id:selectedType.id,half_day_period:(selectedType.requires_half_day_period||Number(selectedType.day_fraction)===0.5)?halfDayPeriod:null,reason:reason.trim()||null,status:'pending'});if(error)throw error
    setRequestOpen(false);resetRequest();setRequestFilter('mine');await onRefresh();await loadVacationMeta();toast('success',`Solicitud enviada: ${selectedType.name} · ${blocks.length} ${blocks.length===1?'bloque':'bloques'}.`)
  }
  const cancel=async r=>{const {error}=await db.from('vacation_requests').update({status:'cancelled'}).eq('id',r.id);if(error)return toast('error',error.message);await onRefresh();await loadVacationMeta();toast('success','Solicitud cancelada.')}
  const saveType=async()=>{const f=typeEditor;if(!f)return;const payload={workspace_id:workspace.id,code:String(f.code||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''),name:String(f.name||'').trim(),description:String(f.description||'').trim()||null,deducts_from_balance:!!f.deducts_from_balance,day_fraction:Number(f.day_fraction)===0.5?0.5:1,requires_half_day_period:Number(f.day_fraction)===0.5,color:f.color||'#0C66E4',sort_order:Number(f.sort_order)||0,active:f.active!==false};if(!payload.name||!payload.code)throw new Error('Nombre y código son obligatorios.');const query=f.id?db.from('vacation_types').update(payload).eq('id',f.id):db.from('vacation_types').insert(payload);const {error}=await query;if(error)throw error;setTypeEditor(null);await loadVacationMeta();toast('success',f.id?'Tipo de ausencia actualizado.':'Tipo de ausencia creado.')}
  const removeType=async type=>{const {count,error:countError}=await db.from('vacation_requests').select('id',{count:'exact',head:true}).eq('vacation_type_id',type.id);if(countError)throw countError;if((count||0)>0){const {error}=await db.from('vacation_types').update({active:false}).eq('id',type.id);if(error)throw error;toast('success','El tipo tiene histórico y fue desactivado.')}else{const {error}=await db.from('vacation_types').delete().eq('id',type.id);if(error)throw error;toast('success','Tipo de ausencia eliminado.')}setTypeDelete(null);await loadVacationMeta()}
  const parseHalfDayNumber=value=>{const normalized=String(value??'').trim().replace(',','.');const n=Number(normalized);return Number.isFinite(n)?Math.round(n*2)/2:NaN}
  const saveBalance=async()=>{const f=balanceEditor;if(!f)return;const allowed=parseHalfDayNumber(f.allowed_days),adjustment=parseHalfDayNumber(f.adjustment_used_days);if(!Number.isFinite(allowed)||allowed<0||allowed>365||!Number.isFinite(adjustment)||adjustment<0||adjustment>365)throw new Error('Los días permitidos y el ajuste deben ser valores entre 0 y 365, admitiendo medios días como 0.5.');const {data,error}=await db.from('vacation_balances').upsert({workspace_id:workspace.id,user_id:f.user_id,year:Number(f.year),allowed_days:allowed,adjustment_used_days:adjustment,note:String(f.note||'').trim()||null,updated_by:session.user.id},{onConflict:'workspace_id,user_id,year'}).select('*').single();if(error)throw error;if(data)setVacationBalances(rows=>[...rows.filter(x=>!(x.user_id===data.user_id&&Number(x.year)===Number(data.year))),data]);setBalanceEditor(null);await loadVacationMeta();toast('success',`Saldo actualizado: ${allowed} permitidos · ${adjustment} ajuste usado.`)}
  const renderRequestCard=r=>{const analysis=analysisFor(r),fresh=analysisFresh(r),isMine=r.user_id===session.user.id,isPending=r.status==='pending';return <article className={`vacation-approval-card request-status-${r.status}`} key={r.id}><div className="vacation-approval-head"><span className="avatar">{initials(memberName(r.user_id))}</span><div><h4>{memberName(r.user_id)}</h4><div className="vacation-request-type-line"><VacationTypeBadge request={r} types={vacationTypes}/><b>{vacationRequestUnits(r,vacationTypes)} día(s)</b><VacationStatusBadge status={r.status}/></div><p>{vacationBlocksLabel(r)} · {r.reason||'Sin motivo adicional'}</p></div>{isPending?<VacationRiskBadge risk={analysis?.risk}/>:null}</div>{isPending&&canManage&&(analysis?<div className={`vacation-ai-analysis risk-${analysis.risk||r.ai_risk}`}><div className="vacation-ai-title"><Icon name="lucide:sparkles"/><span><b>Sugerencia del asistente</b><small>{analysis.recommendation==='approve'?'Aprobar':analysis.recommendation==='approve_with_conditions'?'Aprobar con condiciones':analysis.recommendation==='decline'?'No aprobar por ahora':'Revisión manual recomendada'}</small></span></div><p>{analysis.summary||r.ai_summary}</p>{analysis.metrics&&<div className="vacation-impact-metrics"><span><b>{analysis.metrics.affected_tickets||0}</b> tickets afectados</span><span><b>{analysis.metrics.story_points||0}</b> story points</span><span><b>{analysis.metrics.in_progress||0}</b> en curso</span><span><b>{analysis.metrics.simultaneous_absences||0}</b> ausencias simultáneas</span></div>}{analysis.reasons?.length>0&&<div className="vacation-ai-columns"><div><b>Factores de riesgo</b>{analysis.reasons.map((x,i)=><span key={i}><Icon name="lucide:dot"/>{x}</span>)}</div><div><b>Mitigaciones</b>{(analysis.mitigations||[]).map((x,i)=><span key={i}><Icon name="lucide:check"/>{x}</span>)}</div></div>}</div>:<div className="vacation-ai-pending optional"><Icon name="lucide:bot"/><span><b>Análisis de impacto opcional</b><small>Puedes solicitar una proyección de riesgo antes de decidir, pero aprobar o rechazar queda bajo criterio del responsable.</small></span></div>)}{isPending&&canManage&&analysis&&!fresh&&<div className="vacation-analysis-stale optional"><Icon name="lucide:refresh-cw"/><span><b>La sugerencia IA puede estar desactualizada.</b><small>Puedes reanalizar si necesitas una proyección actual, pero esto no bloquea la aprobación.</small></span></div>}{r.decision_note&&r.status!=='pending'&&<div className="vacation-decision-note"><Icon name="lucide:message-square-text"/><span><b>Nota de decisión</b><small>{r.decision_note}</small></span></div>}<div className="vacation-approval-actions">{isPending&&canManage&&<><button type="button" className="secondary-button" disabled={analyzing===r.id} onClick={()=>analyze(r)}><Icon name={analyzing===r.id?'lucide:loader-circle':'lucide:sparkles'}/>{analyzing===r.id?'Analizando…':analysis?'Reanalizar impacto':'Analizar impacto con IA'}</button><button type="button" className="danger-text-button" onClick={()=>setDecision({item:r,status:'rejected'})}><Icon name="lucide:x"/> Rechazar</button><button type="button" className="primary" onClick={()=>setDecision({item:r,status:'approved'})}><Icon name="lucide:check"/> Aprobar</button></>}{isPending&&isMine&&!canManage&&<button type="button" className="danger-text-button" onClick={()=>cancel(r)}><Icon name="lucide:x"/> Cancelar solicitud</button>}</div></article>}
  const sectionTabs=[
    ['mine','lucide:user-round-check','Mis Vacaciones',mine.length],
    ...(canManage?[['requests','lucide:inbox','Solicitudes',pending.length]]:[]),
    ...((canViewProjection||canManage)?[['projection','lucide:gantt-chart-square','Proyección de Vacaciones',approvedUpcoming.length]]:[]),
    ...(canManage?[['control','lucide:users-round','Control por Integrante',members.filter(m=>m.active!==false).length],['types','lucide:tags','Tipos de Vacaciones',vacationTypes.filter(t=>t.active).length]]:[])
  ]
  const switchRequestFilter=filter=>{setRequestFilter(filter);if(canManage&&sectionTab!=='requests')selectSectionTab('requests')}
  return <div className="page vacations-page"><PageHeader eyebrow="Gestión de equipo" title="Vacaciones" subtitle="Solicitudes, saldos, tipos de ausencia y proyección contra entregables del sprint." icon="lucide:calendar-days" action={canRequest?<button className="primary" onClick={()=>{resetRequest();setRequestOpen(true)}}><Icon name="lucide:calendar-plus-2"/> Solicitar ausencia</button>:null}/>
    {vacationMetaError&&<div className="error vacation-schema-error"><Icon name="lucide:database-zap"/><span><b>Falta aplicar la actualización de Vacaciones.</b><small>{vacationMetaError}</small></span></div>}
    <nav className="vacation-section-tabs" role="tablist" aria-label="Secciones de Vacaciones">{sectionTabs.map(([key,icon,label,count])=><button type="button" role="tab" aria-selected={sectionTab===key} className={sectionTab===key?'active':''} key={key} onClick={()=>selectSectionTab(key)}><Icon name={icon}/><span>{label}</span>{Number.isFinite(Number(count))&&<em>{count}</em>}</button>)}</nav>

    {sectionTab==='mine'&&<>
      <section className="workspace-panel vacation-balance-panel"><div className="panel-heading"><div><h3>Mi saldo {currentYear}</h3><p>Las solicitudes pendientes y aprobadas que descuentan saldo se consideran días ocupados.</p></div><span className={`vacation-balance-available ${myBalance.available<0?'negative':''}`}><small>Disponibles</small><b>{myBalance.loading?'…':myBalance.available}</b></span></div><div className="vacation-balance-grid"><div><small>Vacaciones permitidas</small><b>{myBalance.loading?'…':myBalance.allowed}</b></div><div><small>Días ocupados</small><b>{myBalance.occupied}</b></div><div><small>Ajuste de días usados</small><b>{myBalance.adjustment}</b></div><div><small>Días disponibles</small><b>{myBalance.loading?'…':myBalance.available}</b></div></div>{myTypeUsage.length>0&&<div className="vacation-type-counters"><b>Registro por tipo</b>{myTypeUsage.map(x=><span key={x.type.id} style={{'--vacation-type-color':x.type.color}}><i></i>{x.type.name}: <strong>{x.units}</strong> día(s)</span>)}</div>}</section>
      <section className="workspace-panel vacation-requests-primary"><div className="panel-heading vacation-requests-heading"><div><h3>Mis solicitudes</h3><p>Consulta tus solicitudes, periodos, estatus y decisiones.</p></div><span className="readonly-chip"><Icon name="lucide:user-round-check"/> {mine.length} solicitud(es)</span></div><div className="vacation-approval-list priority-list">{mine.length===0&&<div className="compact-empty"><Icon name="lucide:calendar-search"/><span>No tienes solicitudes registradas.</span></div>}{mine.map(renderRequestCard)}</div></section>
    </>}

    {sectionTab==='requests'&&canManage&&<>
      <div className="metric-grid four vacation-metrics"><Metric label="Fuera hoy" value={outToday.length} icon="lucide:calendar-off" tone="orange" active={requestFilter==='today'} onClick={()=>switchRequestFilter('today')}/><Metric label="Pendientes" value={pending.length} icon="lucide:clock-3" tone="purple" active={requestFilter==='pending'} onClick={()=>switchRequestFilter('pending')}/><Metric label="Aprobadas próximas" value={approvedUpcoming.length} icon="lucide:calendar-check-2" tone="green" active={requestFilter==='upcoming'} onClick={()=>switchRequestFilter('upcoming')}/><Metric label="Mis solicitudes" value={mine.length} icon="lucide:user-round-check" tone="blue" onClick={()=>selectSectionTab('mine')}/></div>
      <section className="workspace-panel vacation-requests-primary"><div className="panel-heading vacation-requests-heading"><div><h3>Solicitudes de vacaciones / ausencias</h3><p>Atiende primero las pendientes. El análisis de IA es una sugerencia de riesgo y nunca condiciona la aprobación.</p></div><span className="readonly-chip"><Icon name="lucide:radio"/> Actualización en tiempo real</span></div><div className="vacation-request-tabs" role="tablist">{requestTabs.filter(([key])=>key!=='mine').map(([key,label,count,icon])=><button type="button" role="tab" aria-selected={requestFilter===key} className={requestFilter===key?'active':''} key={key} onClick={()=>setRequestFilter(key)}><Icon name={icon}/><span>{label}</span><b>{count}</b></button>)}</div><div className="vacation-approval-list priority-list">{visibleRequests.length===0&&<div className="compact-empty"><Icon name="lucide:calendar-search"/><span>No hay solicitudes para este filtro.</span></div>}{visibleRequests.map(renderRequestCard)}</div></section>
    </>}

    {sectionTab==='projection'&&(canViewProjection||canManage)&&<>{outToday.length>0&&<div className="vacation-out-today"><span className="vacation-out-icon"><Icon name="lucide:calendar-off"/></span><div><b>{outToday.length===1?'1 integrante está fuera hoy':`${outToday.length} integrantes están fuera hoy`}</b><p>{outToday.map(r=>memberName(r.user_id)).join(' · ')}</p><small>Considera estas ausencias antes de asignar solicitudes, dependencias o revisiones.</small></div></div>}<VacationTimeline requests={requests} members={members} today={today} types={vacationTypes}/></>}

    {sectionTab==='control'&&canManage&&<section className="workspace-panel vacation-balance-admin"><div className="settings-list-head"><div><h3>Control de vacaciones por integrante</h3><p>Los días ocupados se calculan automáticamente; Ajuste permite registrar vacaciones ya usadas fuera del sistema.</p></div><label className="vacation-year-control">Periodo<select value={balanceYear} onChange={e=>setBalanceYear(Number(e.target.value))}>{[currentYear-1,currentYear,currentYear+1].map(y=><option key={y} value={y}>{y}</option>)}</select></label></div><div className="vacation-balance-table"><div className="vacation-balance-head"><span>Integrante</span><span>Permitidos</span><span>Ocupados</span><span>Ajuste usado</span><span>Disponibles</span><span></span></div>{members.filter(m=>m.active!==false).map(m=>{const b=balanceSummary(m.user_id,balanceYear);return <div className="vacation-balance-row" key={m.user_id}><div className="staff-person"><span className="avatar sm">{initials(memberName(m.user_id))}</span><span><b>{memberName(m.user_id)}</b><small>{m.profile?.email||''}</small></span></div><b>{b.allowed}</b><b>{b.occupied}</b><b>{b.adjustment}</b><b className={b.available<0?'negative-text':''}>{b.available}</b><button type="button" className="secondary-button compact" onClick={()=>setBalanceEditor({user_id:m.user_id,year:balanceYear,allowed_days:b.allowed,adjustment_used_days:b.adjustment,note:b.row?.note||'',name:memberName(m.user_id)})}><Icon name="lucide:pencil"/> Ajustar</button></div>})}</div></section>}

    {sectionTab==='types'&&canManage&&<section className="workspace-panel vacation-types-admin"><div className="settings-list-head"><div><h3>Tipos de vacaciones / ausencias</h3><p>Define qué tipos descuentan del saldo y cuáles se registran únicamente como ausencia o compensación.</p></div><button type="button" className="primary compact" onClick={()=>setTypeEditor({name:'',code:'',description:'',deducts_from_balance:true,day_fraction:1,requires_half_day_period:false,color:'#0C66E4',sort_order:vacationTypes.length*10+10,active:true})}><Icon name="lucide:plus"/> Nuevo tipo</button></div><div className="vacation-type-admin-grid">{vacationTypes.map(t=><article className={`vacation-type-admin-card ${t.active?'':'inactive'}`} key={t.id}><div className="vacation-type-admin-head"><span className="vacation-type-dot" style={{background:t.color}}></span><div><b>{t.name}</b><small>{t.code}</small></div><span className={`settings-status ${t.active?'on':'off'}`}>{t.active?'Activo':'Inactivo'}</span></div><p>{t.description||'Sin descripción.'}</p><div className="vacation-type-admin-meta"><span>{Number(t.day_fraction)===0.5?'0.5 día por bloque':'1 día por día'}</span><span>{t.deducts_from_balance?'Descuenta saldo':'No descuenta saldo'}</span>{t.requires_half_day_period&&<span>Requiere mitad del día</span>}</div><div className="row-actions"><button type="button" onClick={()=>setTypeEditor({...t,day_fraction:Number(t.day_fraction)})}><Icon name="lucide:pencil"/>Editar</button>{t.code!=='vacation'&&<button type="button" className="danger-text" onClick={()=>setTypeDelete(t)}><Icon name="lucide:trash-2"/>Eliminar</button>}</div></article>)}</div></section>}
    {requestOpen&&<Modal title="Solicitar vacaciones / ausencia" subtitle="Puedes solicitar desde un día, varios bloques no consecutivos o un medio día según el tipo seleccionado." onClose={()=>{setRequestOpen(false);resetRequest()}} size="lg"><AsyncForm onSubmit={submitRequest} submitLabel="Enviar solicitud"><div className="form-grid"><label>Tipo de ausencia<select required value={requestTypeId} onChange={e=>{const id=e.target.value,next=vacationTypeFor(vacationTypes,id);setRequestTypeId(id);setHalfDayPeriod('');if(Number(next?.day_fraction)===0.5)setRequestBlocks(list=>list.map(b=>({...b,end_date:b.start_date||b.end_date,return_date:(b.start_date||b.end_date)?addDaysKey(b.start_date||b.end_date,1):b.return_date})))}}><option value="">Seleccionar…</option>{activeTypes.map(t=><option value={t.id} key={t.id}>{t.name}{t.deducts_from_balance?' · descuenta saldo':' · no descuenta'}</option>)}</select></label>{selectedType&&(selectedType.requires_half_day_period||Number(selectedType.day_fraction)===0.5)&&<label>Mitad del día<select required value={halfDayPeriod} onChange={e=>setHalfDayPeriod(e.target.value)}><option value="">Seleccionar…</option><option value="first_half">Primera mitad del día</option><option value="second_half">Segunda mitad del día</option></select></label>}</div>{selectedType&&<div className="vacation-request-balance-preview"><span><small>Saldo disponible {currentYear}</small><b>{myBalance.loading?'Cargando…':`${myBalance.available} día(s)`}</b></span><span><small>Este tipo</small><b>{selectedType.deducts_from_balance?'Descuenta del saldo':'No descuenta del saldo'}</b></span><span><small>Unidad</small><b>{Number(selectedType.day_fraction)===0.5?'0.5 día':'1 día'}</b></span></div>}<div className="vacation-blocks-editor"><div className="vacation-blocks-heading"><div><b>Periodos solicitados</b><small>Se permite un mínimo de 1 día. Los bloques no pueden traslaparse.</small></div><button type="button" className="secondary-button compact" disabled={requestBlocks.length>=8} onClick={()=>setRequestBlocks(x=>[...x,blankBlock()])}><Icon name="lucide:plus"/> Agregar bloque</button></div>{requestBlocks.map((b,i)=><section className="vacation-request-block" key={b.id}><div className="vacation-request-block-head"><b>Bloque {i+1}</b>{requestBlocks.length>1&&<button type="button" className="icon-button danger-text" title="Eliminar bloque" onClick={()=>setRequestBlocks(x=>x.filter(y=>y.id!==b.id))}><Icon name="lucide:trash-2"/></button>}</div><div className="vacation-block-grid"><label>Fecha de inicio<input type="date" required min={today} value={b.start_date} onChange={e=>{const start=e.target.value;patchBlock(b.id,{start_date:start,end_date:Number(selectedType?.day_fraction)===0.5?start:(b.end_date&&b.end_date<start?start:b.end_date),return_date:b.return_date&&b.return_date<=start?'':b.return_date})}}/></label><label>Fecha final<input type="date" required disabled={Number(selectedType?.day_fraction)===0.5} min={b.start_date||today} value={Number(selectedType?.day_fraction)===0.5?b.start_date:b.end_date} onChange={e=>{const end=e.target.value;patchBlock(b.id,{end_date:end,return_date:!b.return_date||b.return_date<=end?addDaysKey(end,1):b.return_date})}}/></label><label>Fecha de reincorporación<input type="date" required min={(Number(selectedType?.day_fraction)===0.5?b.start_date:b.end_date)?addDaysKey(Number(selectedType?.day_fraction)===0.5?b.start_date:b.end_date,1):b.start_date||today} value={b.return_date} onChange={e=>patchBlock(b.id,{return_date:e.target.value})}/></label></div>{b.start_date&&(b.end_date||Number(selectedType?.day_fraction)===0.5)&&<small className="vacation-block-summary"><Icon name="lucide:calendar-range"/> {(daysBetween(b.start_date,Number(selectedType?.day_fraction)===0.5?b.start_date:b.end_date)+1)*Number(selectedType?.day_fraction||1)} día(s) · reincorporación {b.return_date?formatDate(b.return_date):'pendiente'}</small>}</section>)}</div><label>Motivo / notas <span className="optional">Opcional</span><textarea rows="4" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Contexto útil para planear cobertura o handoff."/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={()=>{setRequestOpen(false);resetRequest()}}>Cancelar</button></div></AsyncForm></Modal>}
    {decision&&<VacationDecisionModal item={decision.item} status={decision.status} onClose={()=>setDecision(null)} onSave={saveDecision}/>} 
    {balanceEditor&&<Modal title="Ajustar saldo de vacaciones" subtitle={`${balanceEditor.name} · ${balanceEditor.year}`} onClose={()=>setBalanceEditor(null)}><AsyncForm onSubmit={saveBalance} submitLabel="Guardar saldo"><div className="form-grid"><label>Vacaciones permitidas<input type="text" inputMode="decimal" value={balanceEditor.allowed_days} onChange={e=>setBalanceEditor(x=>({...x,allowed_days:e.target.value}))} placeholder="Ej. 12 o 12.5"/></label><label>Ajuste de días usados<input type="text" inputMode="decimal" value={balanceEditor.adjustment_used_days} onChange={e=>setBalanceEditor(x=>({...x,adjustment_used_days:e.target.value}))} placeholder="Ej. 0.5"/></label></div><div className="notice neutral-notice"><Icon name="lucide:calculator"/><span>Admite medios días con 0.5 o 0,5. Los días ocupados por solicitudes se calculan automáticamente; usa Ajuste para vacaciones ya disfrutadas fuera del sistema.</span></div><label>Nota <span className="optional">Opcional</span><textarea rows="3" value={balanceEditor.note} onChange={e=>setBalanceEditor(x=>({...x,note:e.target.value}))}/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={()=>setBalanceEditor(null)}>Cancelar</button></div></AsyncForm></Modal>}
    {typeEditor&&<Modal title={typeEditor.id?'Editar tipo de ausencia':'Nuevo tipo de ausencia'} subtitle="Controla cómo se registra y si descuenta del saldo anual." onClose={()=>setTypeEditor(null)}><AsyncForm onSubmit={saveType} submitLabel={typeEditor.id?'Guardar cambios':'Crear tipo'}><div className="form-grid"><label>Nombre<input value={typeEditor.name} onChange={e=>setTypeEditor(x=>({...x,name:e.target.value,code:x.id?x.code:(x.code||e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'_'))}))} required placeholder="Ej. Permiso personal"/></label><label>Código<input value={typeEditor.code} onChange={e=>setTypeEditor(x=>({...x,code:e.target.value}))} required disabled={!!typeEditor.id} placeholder="permiso_personal"/></label><label>Unidad<select value={String(typeEditor.day_fraction)} onChange={e=>setTypeEditor(x=>({...x,day_fraction:Number(e.target.value),requires_half_day_period:Number(e.target.value)===0.5}))}><option value="1">Día completo</option><option value="0.5">Medio día</option></select></label><label>Color<input type="color" value={typeEditor.color||'#0C66E4'} onChange={e=>setTypeEditor(x=>({...x,color:e.target.value}))}/></label></div><label>Descripción<textarea rows="3" value={typeEditor.description||''} onChange={e=>setTypeEditor(x=>({...x,description:e.target.value}))}/></label><div className="toggle-list vacation-type-switches"><Toggle label="Descontar del saldo anual" description="Al activarlo, los días aprobados se restan de las vacaciones disponibles del colaborador." checked={!!typeEditor.deducts_from_balance} onChange={value=>setTypeEditor(x=>({...x,deducts_from_balance:value}))}/><Toggle label="Tipo activo" description="Mantén activo este tipo para permitir nuevas solicitudes; al desactivarlo se conserva el historial existente." checked={typeEditor.active!==false} onChange={value=>setTypeEditor(x=>({...x,active:value}))}/></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={()=>setTypeEditor(null)}>Cancelar</button></div></AsyncForm></Modal>}
    {typeDelete&&<ConfirmModal title={`Eliminar ${typeDelete.name}`} message="Si este tipo ya tiene solicitudes, se desactivará para conservar el histórico. Si nunca se ha usado, se eliminará definitivamente." danger onClose={()=>setTypeDelete(null)} onConfirm={()=>removeType(typeDelete)}/>} 
  </div>
}

function InlineCredentials({credentials,onClose}){const [copied,setCopied]=useState(false),url=credentials.platform_url||'https://jiratrobbu.vercel.app/';const copy=async()=>{await navigator.clipboard.writeText(`Jira Interno TROBBU\nPlataforma: ${url}\nCorreo: ${credentials.email}\nContraseña temporal: ${credentials.temporary_password}`);setCopied(true);setTimeout(()=>setCopied(false),1500)};return <div className="inline-credentials"><span><small>Plataforma</small><a href={url} target="_blank" rel="noreferrer">{url}</a></span><span><small>Correo</small><b>{credentials.email}</b></span><span><small>Contraseña temporal</small><code>{credentials.temporary_password}</code></span><button type="button" className="primary compact" onClick={copy}><Icon name={copied?'lucide:check':'lucide:copy'}/>{copied?'Copiado':'Copiar acceso'}</button><button type="button" className="icon-button" onClick={onClose}><Icon name="lucide:x"/></button></div>}


function useUrlTab(viewKey,defaultTab,allowedTabs){
  const allowed=Array.isArray(allowedTabs)?allowedTabs:[]
  const read=()=>{try{const url=new URL(window.location.href),value=url.searchParams.get('tab');return allowed.includes(value)?value:defaultTab}catch{return defaultTab}}
  const [tab,setTabState]=useState(read)
  const setTab=value=>{const next=allowed.includes(value)?value:defaultTab;setTabState(next);try{const url=new URL(window.location.href);url.searchParams.set('view',viewKey);url.searchParams.set('tab',next);window.history.pushState({view:viewKey,tab:next},document.title,url.toString())}catch{}}
  useEffect(()=>{const onPop=()=>setTabState(read());window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[])
  useEffect(()=>{if(!allowed.includes(tab))setTabState(defaultTab)},[allowed.join('|')])
  return [tab,setTab]
}

function StaffRolesView({workspace,members,products,memberProductAccess,roleTemplates,canManage,isSuperadmin,session,onInvite,onMember,onRoleCreate,onRoleEdit,onRoleDelete}){
  const [tab,setTab]=useUrlTab('team','staff',['staff','roles'])
  const accessFor=m=>m.role==='superadmin'||m.all_products ? products : products.filter(p=>memberProductAccess.some(x=>x.user_id===m.user_id&&x.product_id===p.id))
  const orderedRoles=[...roleTemplates].sort((a,b)=>Number(b.protected)-Number(a.protected)||Number(b.is_system)-Number(a.is_system)||a.name.localeCompare(b.name))
  const systemRoles=orderedRoles.filter(r=>['consulta','dev','qa','pm','admin','superadmin'].includes(r.code))
  return <div className="page"><PageHeader title="Staff y Roles" subtitle={`Control de acceso de ${workspace.name}: rol, permisos y productos autorizados.`} icon="lucide:users-round" action={canManage?<button className="primary" onClick={onInvite}><Icon name="lucide:user-plus"/> Agregar Staff</button>:null}/>
    <div className="workspace-scope-strip"><Icon name="lucide:layers-3"/><span><b>Workspace activo: {workspace.name}</b><small>Cada colaborador, rol y producto de esta vista pertenece únicamente a este workspace.</small></span></div>
    <div className="staff-tabs"><button type="button" className={tab==='staff'?'active':''} onClick={()=>setTab('staff')}><Icon name="lucide:users"/> Staff <em>{members.length}</em></button><button type="button" className={tab==='roles'?'active':''} onClick={()=>setTab('roles')}><Icon name="lucide:shield-check"/> Roles <em>{roleTemplates.length}</em></button></div>
    {tab==='staff'&&<section className="workspace-panel staff-panel"><div className="staff-table-head"><span>COLABORADOR</span><span>ROL</span><span>PRODUCTOS</span><span>ESTADO</span><span></span></div><div className="staff-list">{members.map(m=>{const editable=canManage&&(isSuperadmin||m.role!=='superadmin'||m.user_id===session.user.id),scope=accessFor(m);return <div className={`staff-row ${m.active?'':'inactive'}`} key={m.user_id}><div className="staff-person"><span className="avatar">{initials(m.profile?.full_name)}</span><span><b>{m.profile?.full_name||'Usuario'}{m.user_id===session.user.id&&<small> Tú</small>}</b><small>{m.profile?.job_title||m.profile?.email||'Colaborador del workspace'}</small>{m.helpdesk_routing_description&&<small className="staff-routing-note"><Icon name="lucide:route" size={11}/>{m.helpdesk_routing_description}</small>}{m.helpdesk_auto_assign_enabled&&<small className="staff-routing-capacity"><Icon name="lucide:bot" size={11}/> Auto · diario {m.helpdesk_daily_limit??'workspace'} · activos {m.helpdesk_active_limit??'workspace'}</small>}</span></div><span><em className={`role-pill role-${m.role}`}>{roleDisplayName(m)}</em></span><div className="staff-products">{roleIsHelpdeskRequester(m.role_template)?<span className="scope-portal"><Icon name="lucide:life-buoy"/> Portal Helpdesk · sin productos</span>:m.role==='superadmin'||m.all_products?<span className="scope-all"><Icon name="lucide:boxes"/> Todos los productos</span>:scope.length?<>{scope.slice(0,2).map(p=><span key={p.id}>{p.name}</span>)}{scope.length>2&&<em>+{scope.length-2}</em>}</>:<span className="scope-none">Sin productos</span>}</div><span className={`staff-status ${m.active?'active':'off'}`}><i></i>{m.active?'Activo':'Desactivado'}</span><span>{editable&&<button type="button" className="secondary-button compact" onClick={()=>onMember(m)}><Icon name="lucide:sliders-horizontal"/> Datos y accesos</button>}</span></div>})}</div></section>}
    {tab==='roles'&&<><section className="workspace-panel roles-admin-panel"><div className="settings-list-head"><div><h3>Roles del workspace</h3><p>Edita permisos base, crea roles personalizados o elimina roles que ya no estén asignados.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onRoleCreate}><Icon name="lucide:plus"/> Nuevo rol</button>}</div><div className="roles-card-grid">{orderedRoles.map(role=>{const perms=roleDefinitionPermissions(role),count=PERMISSION_DEFS.filter(([k])=>perms[k]).length,assigned=members.filter(m=>m.role_id===role.id).length;return <article className={`role-admin-card ${role.protected?'protected':''}`} key={role.id}><div className="role-admin-head"><span className={`role-admin-icon role-${role.base_role}`}><Icon name={role.protected?'lucide:crown':'lucide:shield-check'}/></span><div><b>{role.name}</b><small>{role.is_system?'Rol base':'Rol personalizado'} · {assigned} asignado{assigned===1?'':'s'}</small></div>{role.protected&&<span className="readonly-chip"><Icon name="lucide:lock"/> Protegido</span>}</div><p>{role.description||'Sin descripción.'}</p><div className="role-admin-meta"><span><b>{count}</b> permisos activos</span><span>Base: <b>{ROLE_LABELS[role.base_role]||role.base_role}</b></span></div>{canManage&&<div className="row-actions"><button type="button" onClick={()=>onRoleEdit(role)} disabled={role.protected}><Icon name="lucide:pencil"/> Editar</button><button type="button" className="danger-text" onClick={()=>onRoleDelete(role)} disabled={role.protected}><Icon name="lucide:trash-2"/> Eliminar</button></div>}</article>})}</div></section>
      <section className="workspace-panel role-matrix-wrap"><div className="panel-heading"><div><h3>Matriz de roles base</h3><p>Comparación rápida de las seis plantillas estándar del workspace.</p></div></div><div className="role-matrix"><div className="role-matrix-head"><span>Permiso</span>{systemRoles.map(r=><b key={r.id}>{r.name}</b>)}</div>{PERMISSION_DEFS.map(([key,label,icon])=><div className="role-matrix-row" key={key}><span><Icon name={icon} size={15}/>{label}</span>{systemRoles.map(r=>{const yes=!!roleDefinitionPermissions(r)[key];return <i key={r.id} className={yes?'yes':'no'}><Icon name={yes?'lucide:check':'lucide:minus'} size={14}/></i>})}</div>)}</div><div className="role-note"><Icon name="lucide:info"/><span><b>Superadmin</b> siempre conserva todos los accesos y no puede eliminarse. Los demás roles pueden ajustarse en este workspace.</span></div></section></>}
  </div>
}

function SettingsView({workspace,settings,products,sprints,departments,requestTypes,emailQueue,emailProviderStatus,canManageSettings,canManageProducts,canPlan,canDeleteWorkspace,onWorkspaceEdit,onWorkspaceConfig,onWorkspaceDelete,onSettingsSaved,onProductCreate,onProductEdit,onProductDelete,onSprintCreate,onSprintEdit,onSprintDelete,onDepartmentCreate,onDepartmentEdit,onDepartmentDelete,onRequestTypeCreate,onRequestTypeEdit,onRequestTypeDelete,onProcessEmails,toast}){
  const [tab,setTab]=useUrlTab('settings','workspace',['workspace','products','sprints','helpdesk','notifications'])
  const tabs=[
    ['workspace','lucide:building-2','Workspace'],
    ['products','lucide:boxes','Productos'],
    ['sprints','lucide:calendar-range','Sprints'],
    ['helpdesk','lucide:life-buoy','Helpdesk'],
    ['notifications','lucide:bell-ring','Notificaciones']
  ]
  return <div className="page"><PageHeader title="Configuración" subtitle="Gestiona el espacio, productos, sprints, Helpdesk y notificaciones." icon="lucide:settings"/>
    <section className="workspace-panel settings-panel">
      <div className="settings-tabs">{tabs.map(([key,icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon name={icon} size={16}/>{label}</button>)}</div>
      {tab==='workspace'&&<WorkspaceSettings workspace={workspace} settings={settings} canManage={canManageSettings} canDelete={canDeleteWorkspace} onEdit={onWorkspaceEdit} onConfig={onWorkspaceConfig} onDelete={onWorkspaceDelete}/>}
      {tab==='products'&&<EntitySettings title="Productos" subtitle="Tableros separados para cada producto." items={products} canManage={canManageProducts} onCreate={onProductCreate} render={p=><><div><b>{p.name}</b><span>{p.key} · {p.description||'Sin descripción'}</span></div><div className="row-actions">{canManageProducts&&<><button onClick={()=>onProductEdit(p)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onProductDelete(p)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='sprints'&&<EntitySettings title="Sprints" subtitle="Planeación y periodos de trabajo." items={sprints} canManage={canPlan} onCreate={onSprintCreate} render={x=><><div><b>{x.name}</b><span>{x.status} · {formatDate(x.start_date)} — {formatDate(x.end_date)}</span></div><div className="row-actions">{canPlan&&<><button onClick={()=>onSprintEdit(x)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onSprintDelete(x)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='helpdesk'&&<HelpdeskSettings settings={settings} departments={departments} requestTypes={requestTypes} canManage={canManageSettings} onDepartmentCreate={onDepartmentCreate} onDepartmentEdit={onDepartmentEdit} onDepartmentDelete={onDepartmentDelete} onRequestTypeCreate={onRequestTypeCreate} onRequestTypeEdit={onRequestTypeEdit} onRequestTypeDelete={onRequestTypeDelete}/>}
      {tab==='notifications'&&<NotificationSettings settings={settings} queue={emailQueue} providerStatus={emailProviderStatus} canManage={canManageSettings} onProcess={onProcessEmails} toast={toast}/>}
    </section>
  </div>
}

function WorkspaceSettings({workspace,settings,canManage,canDelete,onEdit,onConfig,onDelete}){
  const coverSettings=normalizeKnowledgeCoverSettings(settings?.knowledge_cover_templates)
  return <div className="settings-content">
    <div className="settings-card">
      <div className="settings-card-head"><div><h3>{workspace.name}</h3><p>Datos generales, SLA y funciones habilitadas del espacio.</p></div>{canManage&&<div className="row-actions"><button className="secondary-button" onClick={onEdit}><Icon name="lucide:pencil"/> Editar nombre</button><button className="primary compact" onClick={onConfig}><Icon name="lucide:sliders-horizontal"/> Editar configuración</button></div>}</div>
      <div className="settings-summary-grid"><DetailRow label="Zona horaria">{settings?.timezone||'America/Merida'}</DetailRow><DetailRow label="Duración de sprint">{settings?.default_sprint_days||14} días</DetailRow><DetailRow label="Correo de soporte">{settings?.support_email||'Sin configurar'}</DetailRow><DetailRow label="SLA primera respuesta">{settings?.sla_first_response_hours||4} h</DetailRow><DetailRow label="SLA resolución">{settings?.sla_resolution_hours||24} h</DetailRow><DetailRow label="Notificaciones in-app"><span className={`settings-status ${settings?.in_app_notifications?'on':'off'}`}>{settings?.in_app_notifications?'Activas':'Desactivadas'}</span></DetailRow><DetailRow label="Notificaciones por correo"><span className={`settings-status ${settings?.email_notifications?'on':'off'}`}>{settings?.email_notifications?'Activas':'Desactivadas'}</span></DetailRow><DetailRow label="Helpdesk"><span className={`settings-status ${settings?.helpdesk_enabled?'on':'off'}`}>{settings?.helpdesk_enabled?'Habilitado':'Deshabilitado'}</span></DetailRow><DetailRow label="Autoasignación Helpdesk"><span className={`settings-status ${settings?.helpdesk_auto_assignment_enabled!==false?'on':'off'}`}>{settings?.helpdesk_auto_assignment_enabled!==false?'Activa':'Desactivada'}</span></DetailRow><DetailRow label="Capacidad por defecto">{settings?.helpdesk_default_daily_limit??4}/día · {settings?.helpdesk_default_active_limit??4} activos</DetailRow></div>
      {canDelete&&<div className="settings-actions"><button className="danger-outline" onClick={onDelete}><Icon name="lucide:trash-2"/> Eliminar workspace</button></div>}
    </div>
    <div className="settings-card knowledge-cover-overview">
      <div className="settings-card-head"><div><h3>Plantillas de portada Knowledge</h3><p>Identidad visual global aplicada a portada, vista previa e impresión/PDF de todos los artículos.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onConfig}><Icon name="lucide:palette"/> Configurar portadas</button>}</div>
      <div className="knowledge-cover-overview-grid">{KNOWLEDGE_COVER_TEMPLATES.map(t=>{const theme=coverSettings[t.value];return <article className="knowledge-cover-overview-card" key={t.value}><div className={`knowledge-cover-setting-preview template-${t.value}`} style={knowledgeCoverStyle(coverSettings,t.value)}><span>{t.label}</span><b>Documento ejecutivo</b><small>{t.description}</small></div><div className="knowledge-cover-overview-meta"><b>{t.label}</b><span>{theme.title_font} · {theme.body_font}</span><div className="knowledge-cover-swatches"><i style={{background:theme.background}} title={`Fondo ${theme.background}`}></i><i style={{background:theme.background_alt}} title={`Fondo final ${theme.background_alt}`}></i><i style={{background:theme.text}} title={`Texto ${theme.text}`}></i><i style={{background:theme.accent}} title={`Acento ${theme.accent}`}></i></div></div></article>})}</div>
    </div>
  </div>
}

function HelpdeskSettings({settings,departments,requestTypes=[],canManage,onDepartmentCreate,onDepartmentEdit,onDepartmentDelete,onRequestTypeCreate,onRequestTypeEdit,onRequestTypeDelete}){
  const [subTab,setSubTab]=useState('departments')
  return <div className="settings-content">
    <div className="helpdesk-settings-head"><div><h3>Configuración de Helpdesk</h3><p>SLA operativo: {settings?.sla_first_response_hours||4}h primera respuesta / {settings?.sla_resolution_hours||24}h resolución.</p></div></div>
    <div className="helpdesk-settings-tabs"><button type="button" className={subTab==='departments'?'active':''} onClick={()=>setSubTab('departments')}><Icon name="lucide:building-2"/> Departamentos <em>{departments.length}</em></button><button type="button" className={subTab==='types'?'active':''} onClick={()=>setSubTab('types')}><Icon name="lucide:tags"/> Tipos de solicitudes <em>{requestTypes.length}</em></button></div>
    {subTab==='departments'&&<><div className="settings-list-head"><div><h3>Departamentos solicitantes</h3><p>Áreas disponibles para clasificar y canalizar solicitudes.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onDepartmentCreate}><Icon name="lucide:plus"/> Nueva área</button>}</div><div className="entity-list">{departments.length===0&&<div className="empty-inline">Sin áreas configuradas.</div>}{departments.map(d=><div className="entity-row" key={d.id}><div className="department-entity"><span className="dept-dot large" style={{background:d.color||'#D4DCE0'}}></span><div><b>{d.name}</b><span>{d.active?'Disponible para solicitudes':'Área desactivada'}</span></div></div><div className="row-actions"><span className={`settings-status ${d.active?'on':'off'}`}>{d.active?'Activo':'Inactivo'}</span>{canManage&&<><button type="button" onClick={()=>onDepartmentEdit(d)}><Icon name="lucide:pencil"/>Editar</button><button type="button" className="danger-text" onClick={()=>onDepartmentDelete(d)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></div>)}</div></>}
    {subTab==='types'&&<><div className="settings-list-head"><div><h3>Tipos de solicitudes</h3><p>Catálogo escalable para segmentar soporte, incidencias, requerimientos y cualquier clasificación futura.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onRequestTypeCreate}><Icon name="lucide:plus"/> Nuevo tipo</button>}</div><div className="entity-list request-type-list">{requestTypes.length===0&&<div className="empty-inline">Sin tipos configurados.</div>}{requestTypes.map(type=><div className="entity-row request-type-row" key={type.id}><div className="request-type-entity"><span className="request-type-icon" style={{background:`${type.color||'#0D47A1'}18`,color:type.color||'#0D47A1'}}><Icon name={type.icon||'lucide:ticket'}/></span><div><b>{type.name}</b><span>{type.description||'Sin descripción'}</span><small><code>{type.code}</code> · Orden {type.sort_order}</small></div></div><div className="row-actions"><span className={`settings-status ${type.active?'on':'off'}`}>{type.active?'Activo':'Inactivo'}</span>{canManage&&<><button type="button" onClick={()=>onRequestTypeEdit(type)}><Icon name="lucide:pencil"/>Editar</button><button type="button" className="danger-text" onClick={()=>onRequestTypeDelete(type)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></div>)}</div><div className="notice request-type-note"><Icon name="lucide:info"/><span><b>Los tipos desactivados se conservan en el histórico.</b> Solo los tipos activos pueden seleccionarse en nuevas solicitudes.</span></div></>}
  </div>
}

function NotificationSettings({settings,queue,providerStatus,canManage,onProcess,toast}){
  const [processing,setProcessing]=useState(false)
  const [provider,setProvider]=useState(providerStatus?.provider||null)
  useEffect(()=>setProvider(providerStatus?.provider||null),[providerStatus?.provider])
  const pending=queue.filter(q=>q.status==='pending').length
  const failed=queue.filter(q=>q.status==='failed').length
  const sent=queue.filter(q=>q.status==='sent').length
  const run=async()=>{setProcessing(true);try{const data=await onProcess();setProvider(data?.provider||null);if(data?.configured===false)toast('error','Correo operativo sin proveedor configurado. Agrega Resend o Mailgun en los secretos de Supabase.');else toast('success',`Correos procesados: ${data?.sent||0} enviados, ${data?.failed||0} fallidos.`)}catch(e){toast('error',e.message||String(e))}finally{setProcessing(false)}}
  return <div className="settings-content"><div className="settings-card"><div className="settings-card-head"><div><h3>Canales de notificación</h3><p>Estado de notificaciones dentro de la plataforma y cola de correo.</p></div></div><div className="notification-health-grid"><div><span>In-app</span><b className={settings?.in_app_notifications?'ok':'off'}>{settings?.in_app_notifications?'Activo':'Desactivado'}</b></div><div><span>Email</span><b className={settings?.email_notifications?'ok':'off'}>{settings?.email_notifications?'Activo':'Desactivado'}</b></div><div><span>Pendientes</span><strong>{pending}</strong></div><div><span>Enviados</span><strong>{sent}</strong></div><div><span>Fallidos</span><strong>{failed}</strong></div></div><div className="notification-coverage"><h4>Cobertura de eventos</h4><div className="notification-coverage-grid"><div><Icon name="lucide:ticket"/><span><b>Tickets</b><small>Creación, asignación, estados, comentarios, evidencias y movimientos de sprint.</small></span></div><div><Icon name="lucide:life-buoy"/><span><b>Helpdesk</b><small>Solicitudes, asignaciones, estados, comentarios, evidencias y decisiones.</small></span></div><div><Icon name="lucide:calendar-range"/><span><b>Sprints</b><small>Creación, cambios de planeación, comentarios y evidencias.</small></span></div><div><Icon name="lucide:book-open-text"/><span><b>Knowledge</b><small>Borradores, publicaciones y restauraciones de artículos.</small></span></div><div><Icon name="lucide:users-round"/><span><b>Staff</b><small>Altas y cambios de rol, permisos o alcance.</small></span></div></div></div>{failed>0&&<div className="error subtle"><Icon name="lucide:triangle-alert"/><span>{queue.find(q=>q.status==='failed')?.last_error||'Hay correos fallidos pendientes de reintento.'}</span></div>}{providerStatus?.configured===false&&<div className="notice provider-warning"><Icon name="lucide:mail-warning"/><span><b>Proveedor de correo no configurado.</b> Las notificaciones dentro de la plataforma funcionan; para enviar emails configura Resend o Mailgun como secretos de Supabase.</span></div>}<div className="settings-actions">{provider&&<span className="provider-chip"><Icon name="lucide:mail-check"/>Proveedor: {provider}</span>}{providerStatus?.configured&&<span className="settings-status on">Proveedor listo</span>}{canManage&&settings?.email_notifications&&<button className="primary" onClick={run} disabled={processing||providerStatus?.configured===false}><Icon name="lucide:send"/>{processing?'Procesando…':'Procesar cola de correo'}</button>}</div></div></div>
}

function Toggle({label,description,checked,onChange,disabled}){return <label className={`toggle-row ${disabled?'disabled':''}`}><span className="toggle-copy"><b>{label}</b>{description&&<small>{description}</small>}</span><button type="button" role="switch" aria-checked={!!checked} className={`switch ${checked?'on':''}`} onClick={()=>!disabled&&onChange(!checked)}><i></i></button></label>}
function EntitySettings({title,subtitle,items,canManage,onCreate,render}){return <div className="settings-content"><div className="settings-list-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{canManage&&<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button>}</div><div className="entity-list">{items.length===0&&<div className="empty-inline">Sin registros todavía.</div>}{items.map(item=><div className="entity-row" key={item.id}>{render(item)}</div>)}</div></div>}

function NotificationsDrawer({notifications,locale='es',onClose,onMark,onMarkAll,onDelete,onClearRead,onOpen}){
  const [confirmAction,setConfirmAction]=useState(null),[category,setCategory]=useState('all')
  const unread=notifications.filter(n=>!n.read_at).length,read=notifications.length-unread
  const categories=[['all','lucide:inbox',locale==='en'?'All':'Todas'],['tickets','lucide:ticket','Tickets'],['helpdesk','lucide:life-buoy','Helpdesk'],['sprints','lucide:calendar-range','Sprints'],['knowledge','lucide:book-open-text','Knowledge'],['vacations','lucide:calendar-off',locale==='en'?'Time off':'Vacaciones'],['staff','lucide:users-round','Staff']]
  const filtered=category==='all'?notifications:notifications.filter(n=>notificationCategory(n)===category)
  return <>
    <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer notification-drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">{locale==='en'?'ACTIVITY CENTER':'CENTRO DE ACTIVIDAD'}</span><h2>{locale==='en'?'Notifications':'Notificaciones'}</h2><p>{locale==='en'?`${unread} unread · ${read} read`:`${unread} sin leer · ${read} leídas`}</p></div><button className="icon-button" onClick={onClose}><Icon name="lucide:x"/></button></div><div className="drawer-toolbar"><button className="text-button" onClick={onMarkAll} disabled={!unread}>{locale==='en'?'Mark all as read':'Marcar todas como leídas'}</button><button className="text-button danger-text" onClick={()=>setConfirmAction({type:'clear-read'})} disabled={!read}>{locale==='en'?'Delete read':'Eliminar leídas'}</button></div><div className="notification-filterbar" role="tablist" aria-label={locale==='en'?'Notification categories':'Categorías de notificaciones'}>{categories.map(([key,icon,label])=>{const count=key==='all'?notifications.length:notifications.filter(n=>notificationCategory(n)===key).length;return <button type="button" key={key} className={category===key?'active':''} onClick={()=>setCategory(key)}><Icon name={icon} size={14}/><span>{label}</span>{count>0&&<em>{count}</em>}</button>})}</div><div className="notification-list">{filtered.length===0&&<div className="empty-notifications"><Icon name="lucide:bell-off" size={30}/><b>{locale==='en'?'No notifications':'Sin notificaciones'}</b><span>{locale==='en'?'New assignments, comments, articles and requests will appear here.':'Las asignaciones, comentarios, artículos y solicitudes aparecerán aquí.'}</span></div>}{filtered.map(n=>{const copy=notificationCopy(n,locale);return <div key={n.id} className={`notification-item ${n.read_at?'':'unread'} category-${notificationCategory(n)}`}><button className="notification-main" onClick={()=>{onMark(n.id,true);onOpen(n)}}><span className="notification-icon"><Icon name={notificationIcon(n)} /></span><div><b>{copy.title}</b><p>{copy.body}</p><small>{formatDateTimeLocale(n.created_at,locale)}</small></div>{!n.read_at&&<i></i>}</button><div className="notification-actions"><button className="icon-button" title={n.read_at?(locale==='en'?'Mark as unread':'Marcar como no leída'):(locale==='en'?'Mark as read':'Marcar como leída')} onClick={()=>onMark(n.id,!n.read_at)}><Icon name={n.read_at?'lucide:mail':'lucide:mail-open'} size={15}/></button><button className="icon-button danger-text" title={locale==='en'?'Delete notification':'Eliminar notificación'} onClick={()=>setConfirmAction({type:'delete',notification:n})}><Icon name="lucide:trash-2" size={15}/></button></div></div>})}</div></aside></div>
    {confirmAction?.type==='delete'&&<ConfirmModal title={locale==='en'?'Delete notification':'Eliminar notificación'} message={locale==='en'?'This notification will be permanently removed from your activity center.':'La notificación se eliminará definitivamente de tu centro de actividad.'} danger onClose={()=>setConfirmAction(null)} onConfirm={async()=>{await onDelete(confirmAction.notification.id);setConfirmAction(null)}}/>}
    {confirmAction?.type==='clear-read'&&<ConfirmModal title={locale==='en'?'Delete read notifications':'Eliminar notificaciones leídas'} message={locale==='en'?`${read} read notifications will be deleted. This action cannot be undone.`:`Se eliminarán ${read} notificaciones leídas. Esta acción no se puede deshacer.`} danger onClose={()=>setConfirmAction(null)} onConfirm={async()=>{await onClearRead();setConfirmAction(null)}}/>}
  </>
}


function KnowledgeCategoryModal({initial=null,onClose,onSave}){
  const presets=['lucide:folder','lucide:monitor-cog','lucide:concierge-bell','lucide:workflow','lucide:shield-check','lucide:list-checks','lucide:calendar-check','lucide:briefcase-business','lucide:book-open','lucide:landmark']
  const [f,setF]=useState({name:initial?.name||'',code:initial?.code||'',description:initial?.description||'',icon:initial?.icon||'lucide:folder',color:initial?.color||'#4D5A51',sort_order:initial?.sort_order??100})
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const submit=async e=>{e.preventDefault();setError('');const name=f.name.trim();if(name.length<2){setError('Escribe un nombre válido para la categoría.');return}const code=(f.code.trim()||knowledgeSlug(name));if(!code){setError('Escribe un código válido.');return}setSaving(true);try{await onSave({...f,name,code:knowledgeSlug(code),description:f.description.trim()||null,sort_order:Number(f.sort_order)||100});onClose()}catch(err){setError(err.message||String(err));setSaving(false)}}
  return <Modal title={initial?'Editar categoría':'Nueva categoría'} subtitle="Las categorías son el primer nivel de organización de Knowledge. Cada artículo debe pertenecer a una." onClose={onClose} size="md"><form className="form knowledge-category-form" onSubmit={submit}><div className="form-body"><div className="form-grid"><label>Nombre<input autoFocus required value={f.name} onChange={e=>{set('name',e.target.value);if(!initial&&!f.code)set('code',knowledgeSlug(e.target.value))}} placeholder="Ej. Operaciones"/></label><label>Código<input required value={f.code} onChange={e=>set('code',knowledgeSlug(e.target.value))} placeholder="operaciones"/></label><label>Orden<input type="number" min="0" max="9999" value={f.sort_order} onChange={e=>set('sort_order',e.target.value)}/></label><label>Color<div className="knowledge-category-color"><input type="color" value={f.color} onChange={e=>set('color',e.target.value)}/><input value={f.color} pattern="#[0-9A-Fa-f]{6}" onChange={e=>set('color',e.target.value)} /></div></label></div><label>Descripción<textarea rows="3" value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Qué tipo de información debe guardarse aquí."/></label><fieldset className="knowledge-icon-picker"><legend>Icono</legend><div>{presets.map(icon=><button type="button" key={icon} className={f.icon===icon?'active':''} onClick={()=>set('icon',icon)} title={icon}><Icon name={icon}/></button>)}</div></fieldset>{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}</div><div className="form-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}><Icon name={initial?'lucide:save':'lucide:folder-plus'}/>{saving?'Guardando…':initial?'Guardar categoría':'Crear categoría'}</button></div></form></Modal>
}
function KnowledgeCategoryDeleteModal({category,categories,articles,onClose,onConfirm}){
  const used=articles.filter(a=>a.category_id===category.id).length
  const alternatives=categories.filter(c=>c.id!==category.id),fallback=alternatives.find(c=>c.code==='general')||alternatives[0]||null
  const [replacement,setReplacement]=useState(fallback?.id||''),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const submit=async()=>{setError('');if(used>0&&!replacement){setError('Selecciona una categoría destino antes de eliminar.');return}setSaving(true);try{await onConfirm(replacement||null);onClose()}catch(err){setError(err.message||String(err));setSaving(false)}}
  return <Modal title="Eliminar categoría" subtitle={category.name} onClose={onClose} size="sm"><div className="form-body"><div className="danger-card"><Icon name="lucide:triangle-alert"/><div><b>{used?`${used} artículo${used===1?'':'s'} usan esta categoría.`:'Esta categoría no contiene artículos.'}</b><p>{used?'Antes de eliminarla, el sistema moverá artículos y todo su histórico de versiones a la categoría elegida.':'La categoría se eliminará de Knowledge.'}</p></div></div>{used>0&&<label>Mover contenido a<select value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">Selecciona una categoría</option>{alternatives.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}</div><div className="form-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="button" className="danger-button" onClick={submit} disabled={saving||used>0&&!replacement}><Icon name="lucide:trash-2"/>{saving?'Eliminando…':'Eliminar categoría'}</button></div></Modal>
}

function KnowledgeNewVersionModal({article,onClose,onSave}){
  const [note,setNote]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const submit=async e=>{e?.preventDefault?.();setError('');if(!note.trim()){setError('Describe por qué se crea esta nueva versión.');return}setSaving(true);try{await onSave(note.trim())}catch(err){setError(err.message||String(err));setSaving(false)}}
  return <Modal title="Crear nueva versión" subtitle={`La versión pública de “${article.title}” seguirá visible mientras trabajas este borrador.`} onClose={onClose} size="sm"><form className="form" onSubmit={submit}><div className="form-body"><div className="versioning-info"><Icon name="lucide:git-branch-plus"/><div><b>Nueva versión en borrador</b><p>Los lectores seguirán viendo la versión activa hasta que publiques este borrador.</p></div></div><label>Motivo de la nueva versión<textarea rows="4" required value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej. Se actualiza el flujo de pagos y se agregan nuevas capturas."/></label>{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}</div><div className="form-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}><Icon name="lucide:git-branch-plus"/>{saving?'Creando…':'Crear borrador'}</button></div></form></Modal>
}
function ModalRouter(props){const {modal,setModal}=props;const close=()=>setModal(null)
  if(modal.type==='knowledge-category-create') return <KnowledgeCategoryModal onClose={close} onSave={async f=>{const {error}=await db.from('knowledge_categories').insert({...f,workspace_id:props.workspace.id,active:true});if(error)throw error;await props.refresh();props.toast('success','Categoría creada. Ya puedes crear artículos dentro de ella.')}}/>
  if(modal.type==='knowledge-category-edit') return <KnowledgeCategoryModal initial={modal.category} onClose={close} onSave={async f=>{const {error}=await db.from('knowledge_categories').update(f).eq('id',modal.category.id);if(error)throw error;await props.refresh();props.toast('success','Categoría actualizada.')}}/>
  if(modal.type==='knowledge-category-delete') return <KnowledgeCategoryDeleteModal category={modal.category} categories={props.knowledgeCategories||[]} articles={props.knowledgeArticles||[]} onClose={close} onConfirm={async replacement=>{const {error}=await db.rpc('delete_knowledge_category',{p_category_id:modal.category.id,p_replacement_id:replacement});if(error)throw error;await props.refresh();props.toast('success','Categoría eliminada y contenido reclasificado.')}}/>
  if(modal.type==='knowledge-new-version') return <KnowledgeNewVersionModal article={modal.article} onClose={close} onSave={note=>props.createKnowledgeVersion(modal.article,note)}/>
  if(modal.type==='workspace-create') return props.canCreateWorkspace?<WorkspaceModal title="Crear espacio de trabajo" onClose={close} onSave={async f=>{await props.createWorkspace(f);close()}}/>:<ConfirmModal title="Acceso restringido" message="Solo Admin, PM o Superadmin pueden crear espacios de trabajo." onClose={close} onConfirm={close}/>
  if(modal.type==='workspace-switch') return <WorkspaceSwitcherModal workspaces={props.workspaces} current={props.workspace} canCreate={props.canCreateWorkspace} onClose={close} onSelect={w=>{props.setWorkspace(w);close()}} onCreate={()=>setModal({type:'workspace-create'})}/>
  if(modal.type==='workspace-edit') return <WorkspaceModal title="Editar espacio" initial={{name:props.workspace.name}} onClose={close} onSave={async f=>{const {error}=await db.from('workspaces').update({name:f.name}).eq('id',props.workspace.id);if(error)throw error;await props.loadMemberships(props.workspace.id);props.toast('success','Workspace actualizado.');close()}}/>
  if(modal.type==='workspace-config') return <WorkspaceConfigModal liveRevision={props.liveRevision?.staff||0} workspace={props.workspace} settings={props.settings} onClose={close} onSaved={async()=>{await props.refresh();props.toast('success','Configuración guardada.');close()}}/>
  if(modal.type==='workspace-delete' && props.isSuperadmin) return <ConfirmModal title="Eliminar workspace" message="Se eliminarán productos, sprints, tickets, Helpdesk y configuración de este espacio. Esta acción no se puede deshacer." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('workspaces').delete().eq('id',props.workspace.id);if(error)throw error;await props.loadMemberships();props.toast('success','Workspace eliminado.');close()}}/>

  if(modal.type==='ticket-create') return <TicketModal title="Crear ticket" workspace={props.workspace} knowledgeArticles={props.knowledgeArticles} locale={props.locale} reporterMode={!props.canWork} products={props.products} sprints={props.sprints} members={props.members} modules={props.modules} tags={props.tags} ticketTagLinks={props.ticketTagLinks} customFields={props.customFields} customFieldProducts={props.customFieldProducts} customValues={props.customValues} onClose={close} onSave={async f=>{await props.saveTicket(f);close()}}/>
  if(modal.type==='ticket-edit' && props.canWork) return <TicketModal title={`Editar ${modal.ticket.ticket_key}`} workspace={props.workspace} knowledgeArticles={props.knowledgeArticles} locale={props.locale} ticket={modal.ticket} products={props.products} sprints={props.sprints} members={props.members} modules={props.modules} tags={props.tags} ticketTagLinks={props.ticketTagLinks} customFields={props.customFields} customFieldProducts={props.customFieldProducts} customValues={props.customValues} onClose={close} onSave={async f=>{await props.saveTicket(f,modal.ticket);close()}}/>
  if(modal.type==='ticket-detail') return <TicketDetailModal liveRevision={props.liveRevision?.tickets||0} workspace={props.workspace} ticket={modal.ticket} tickets={props.tickets} products={props.products} members={props.members} modules={props.modules} tags={props.tags} ticketTagLinks={props.ticketTagLinks} ticketLinks={props.ticketLinks} customFields={props.customFields} customValues={props.customValues} session={props.session} canWork={props.canWork} canManage={props.canManage} onClose={close} onEdit={()=>setModal({type:'ticket-edit',ticket:modal.ticket})} onPlan={()=>setModal({type:'ticket-plan',ticket:modal.ticket})} onLink={()=>setModal({type:'ticket-link',ticket:modal.ticket})} onOpenRelated={ticket=>setModal({type:'ticket-detail',ticket})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='ticket-link') return <TicketLinkModal ticket={modal.ticket} tickets={props.tickets} products={props.products} existing={props.ticketLinks} onClose={close} onSave={async f=>{const direction=f.link_type==='blocked_by';const row={workspace_id:props.workspace.id,source_ticket_id:direction?f.other_ticket_id:modal.ticket.id,target_ticket_id:direction?modal.ticket.id:f.other_ticket_id,link_type:direction?'blocks':f.link_type,note:f.note||null,created_by:props.session.user.id};const {error}=await db.from('ticket_links').insert(row);if(error)throw error;await props.refresh();props.toast('success','Relación creada.');close()}}/>
  if(modal.type==='dependency-override') return <DependencyOverrideModal ticket={modal.ticket} status={modal.status} onClose={close} onSave={async note=>{const {error}=await db.rpc('transition_ticket_status',{p_ticket_id:modal.ticket.id,p_status:modal.status,p_override_blockers:true,p_note:note});if(error)throw error;await props.refresh();props.toast('success','Avance forzado y registrado en actividad.');close()}}/>
  if(modal.type==='ticket-actions'){
    const actions=[['lucide:eye','Ver detalle',()=>setModal({type:'ticket-detail',ticket:modal.ticket})]]
    if(props.canWork) actions.push(['lucide:pencil','Editar ticket',()=>setModal({type:'ticket-edit',ticket:modal.ticket})])
    if(props.canPlan) actions.push(['lucide:calendar-plus','Planificar / cambiar sprint',()=>setModal({type:'ticket-plan',ticket:modal.ticket})])
    if(props.canDeleteTicket) actions.push(['lucide:trash-2','Eliminar ticket',()=>setModal({type:'ticket-delete',ticket:modal.ticket}),'danger'])
    return <ActionSheet title={modal.ticket.ticket_key} subtitle={modal.ticket.title} onClose={close} actions={actions}/>
  }
  if(modal.type==='ticket-delete') return <ConfirmModal title={`Eliminar ${modal.ticket.ticket_key}`} message={`¿Deseas eliminar “${modal.ticket.title}”? También se eliminarán comentarios, evidencias e historial asociado.`} danger onClose={close} onConfirm={async()=>{await props.deleteTicket(modal.ticket);close()}}/>
  if(modal.type==='ticket-filters') return <TicketFilterModal filters={props.filters} members={props.members} sprints={props.sprints} modules={props.modules} tags={props.tags} onClose={close} onApply={f=>{props.setFilters(f);close()}}/>
  if(modal.type==='ticket-plan') return <PlanTicketModal ticket={modal.ticket} sprints={props.sprints} onClose={close} onSave={async sprintId=>{await props.planTicket(modal.ticket,sprintId);close()}}/>

  if(modal.type==='backlog-import') return <BacklogImportModal workspace={props.workspace} products={props.products} members={props.members} session={props.session} onClose={close} onImported={async result=>{await props.refresh();props.toast('success',`${result.imported} tickets importados al Backlog.`);close()}}/>
  if(modal.type==='sprint-create') return <SprintModal title="Nuevo sprint" onClose={close} onSave={async f=>{const {error}=await db.from('sprints').insert({...f,workspace_id:props.workspace.id,created_by:props.session.user.id,start_date:f.start_date||null,end_date:f.end_date||null});if(error)throw error;await props.refresh();props.toast('success','Sprint creado.');close()}}/>
  if(modal.type==='sprint-edit') return <SprintModal title="Editar sprint" initial={modal.sprint} onClose={close} onSave={async f=>{const {error}=await db.from('sprints').update({...f,start_date:f.start_date||null,end_date:f.end_date||null}).eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint actualizado.');close()}}/>
  if(modal.type==='sprint-detail') return <SprintDetailModal liveRevision={props.liveRevision?.sprints||0} workspace={props.workspace} sprint={modal.sprint} tickets={props.tickets} products={props.products} members={props.members} session={props.session} canWork={props.canWork} canPlan={props.canPlan} onClose={close} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={()=>setModal({type:'sprint-edit',sprint:modal.sprint})} onRollover={()=>setModal({type:'sprint-rollover',sprint:modal.sprint})} onBacklog={async ticket=>{await props.planTicket(ticket,'')}} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='sprint-rollover') return <SprintRolloverModal sprint={modal.sprint} sprints={props.sprints} tickets={props.tickets} onClose={close} onSave={async nextId=>{await props.closeSprintAndRollover(modal.sprint,nextId);close()}}/>
  if(modal.type==='sprint-delete') return <ConfirmModal title="Eliminar sprint" message="Los tickets del sprint quedarán sin sprint. Para conservar el flujo recomendado usa “Cerrar / trasladar” desde Backlog." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('sprints').delete().eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint eliminado.');close()}}/>

  if(modal.type==='help-create') return <HelpdeskModal title="Nueva solicitud de Helpdesk" workspace={props.workspace} knowledgeArticles={props.knowledgeArticles} locale={props.locale} departments={props.departments} requestTypes={props.requestTypes} products={props.helpdeskProducts||props.products} members={props.members} vacationRequests={props.vacationRequests} timeZone={props.settings?.timezone||'America/Merida'} session={props.session} canWork={props.canManageHelpdesk} onClose={close} onSave={async f=>{await props.saveHelpdesk(f);close()}}/>
  if(modal.type==='help-edit') return <HelpdeskModal title={`Editar ${modal.item.ticket_key}`} workspace={props.workspace} knowledgeArticles={props.knowledgeArticles} locale={props.locale} item={modal.item} departments={props.departments} requestTypes={props.requestTypes} products={props.helpdeskProducts||props.products} members={props.members} vacationRequests={props.vacationRequests} timeZone={props.settings?.timezone||'America/Merida'} session={props.session} canWork={props.canManageHelpdesk} onClose={close} onSave={async f=>{await props.saveHelpdesk(f,modal.item);close()}}/>
  if(modal.type==='help-detail') return <HelpdeskDetailModal liveRevision={props.liveRevision?.helpdesk||0} workspace={props.workspace} item={modal.item} departments={props.departments} requestTypes={props.requestTypes} products={props.helpdeskProducts||props.products} members={props.members} session={props.session} canWork={props.canManageHelpdesk||modal.item.assigned_to===props.session.user.id} canManage={props.canPlan} canManageHelpdesk={props.canManageHelpdesk} onClose={close} onEdit={()=>setModal({type:'help-edit',item:modal.item})} onDecision={()=>setModal({type:'help-requirement-decision',item:modal.item})} onAssign={()=>setModal({type:'help-assign',item:modal.item})} onStatusChange={status=>props.changeHelpdeskStatus(modal.item,status)} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='help-actions'){
    const requirement=isProposalCategory(modal.item.category)
    const actions=[['lucide:eye','Ver solicitud',()=>setModal({type:'help-detail',item:modal.item})]]
    if(requirement&&props.canPlan&&(modal.item.proposal_status||'pending')==='pending') actions.push(['lucide:gavel','Evaluar requerimiento',()=>setModal({type:'help-requirement-decision',item:modal.item})])
    const canRedirect=!requirement&&modal.item.assigned_to===props.session.user.id
    if((props.canManageHelpdesk||canRedirect)&&!requirement)actions.push(['lucide:user-round-cog',canRedirect&&!props.canManageHelpdesk?'Redirigir solicitud':modal.item.assigned_to?'Reasignar solicitud':'Asignar ahora',()=>setModal({type:'help-assign',item:modal.item})])
    if(props.canManageHelpdesk&&!requirement)actions.push(['lucide:pencil','Editar solicitud',()=>setModal({type:'help-edit',item:modal.item})])
    if(props.canManageHelpdesk) actions.push(['lucide:trash-2','Eliminar solicitud',()=>setModal({type:'help-delete',item:modal.item}),'danger'])
    return <ActionSheet title={modal.item.ticket_key} subtitle={modal.item.subject} onClose={close} actions={actions}/>
  }
  if(modal.type==='help-assign') return <HelpdeskAssignModal item={modal.item} members={props.members} vacationRequests={props.vacationRequests} timeZone={props.settings?.timezone||'America/Merida'} currentUserId={props.session.user.id} onClose={close} onSave={async(assigneeId,comment)=>{const {error}=await db.rpc('assign_helpdesk_ticket',{p_ticket_id:modal.item.id,p_assignee:assigneeId,p_comment:comment||null});if(error)throw error;await props.refresh();props.toast('success',modal.item.assigned_to===props.session.user.id?'Solicitud redirigida correctamente.':'Solicitud asignada correctamente.');close()}}/>
  if(modal.type==='help-requirement-decision') return <RequirementDecisionModal item={modal.item} products={props.products} initialDecision={modal.decision||'accepted_backlog'} onClose={close} onSave={async(decision,productId,note)=>{await props.decideRequirement(modal.item,decision,productId,note);close()}}/>
  if(modal.type==='help-delete') return <ConfirmModal title={`Eliminar ${modal.item.ticket_key}`} message={`¿Deseas eliminar “${modal.item.subject}”?`} danger onClose={close} onConfirm={async()=>{await props.deleteHelpdesk(modal.item);close()}}/>
  if(modal.type==='help-filters') return <HelpFilterModal filters={props.helpFilters} departments={props.departments} requestTypes={props.requestTypes} products={props.helpdeskProducts||props.products} members={props.members} onClose={close} onApply={f=>{props.setHelpFilters({...f,quick:'all'});close()}}/>

  if(modal.type==='invite') return <InviteModal workspace={props.workspace} products={props.products} members={props.members} roleTemplates={props.roleTemplates} isSuperadmin={props.isSuperadmin} onClose={close} onSaved={async result=>{await props.loadMemberships(props.workspace.id);await props.refresh();if(result?.temporary_password){setModal({type:'temporary-credentials',credentials:result});return}props.toast('success',result?.invitation_sent?'Invitación enviada y accesos configurados.':'Usuario y accesos configurados.');close()}}/>
  if(modal.type==='temporary-credentials') return <TemporaryCredentialsModal credentials={modal.credentials} onClose={close}/>
  if(modal.type==='member-edit') return <MemberModal liveRevision={props.liveRevision?.helpdesk||0} workspace={props.workspace} members={props.members} member={{...modal.member,product_ids:props.memberProductAccess.filter(x=>x.user_id===modal.member.user_id).map(x=>x.product_id)}} products={props.products} roleTemplates={props.roleTemplates} session={props.session} isSuperadmin={props.isSuperadmin} onClose={close} onRemove={()=>setModal({type:'member-remove',member:modal.member})} onSave={async f=>{const selected=props.roleTemplates.find(r=>r.id===f.role_id);if(!selected)throw new Error('Selecciona un rol válido.');const allProducts=selected.code==='superadmin'?true:!!f.all_products;const permissions=selected.code==='superadmin'?{}:f.permissions;const {error}=await db.from('workspace_members').update({role_id:f.role_id,role:selected.base_role,active:f.active,all_products:allProducts,permissions,helpdesk_routing_description:f.helpdesk_routing_description||null,helpdesk_auto_assign_enabled:!!f.helpdesk_auto_assign_enabled,helpdesk_daily_limit:f.helpdesk_daily_limit===''||f.helpdesk_daily_limit==null?null:Number(f.helpdesk_daily_limit),helpdesk_active_limit:f.helpdesk_active_limit===''||f.helpdesk_active_limit==null?null:Number(f.helpdesk_active_limit),helpdesk_overflow_mode:f.helpdesk_overflow_mode||'inherit',helpdesk_overflow_user_id:f.helpdesk_overflow_user_id||null}).eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;const del=await db.from('workspace_member_products').delete().eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(del.error)throw del.error;if(!allProducts&&f.product_ids.length){const ins=await db.from('workspace_member_products').insert(f.product_ids.map(product_id=>({workspace_id:props.workspace.id,user_id:modal.member.user_id,product_id})));if(ins.error)throw ins.error}await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Rol, permisos y productos actualizados.');close()}}/>
  if(modal.type==='member-remove') return <ConfirmModal title="Retirar colaborador" message={`¿Deseas retirar a ${modal.member.profile?.full_name||'este colaborador'} de ${props.workspace.name}? Perderá acceso a este workspace, pero sus tickets e historial se conservarán.`} danger onClose={close} onConfirm={async()=>{if(modal.member.user_id===props.session.user.id)throw new Error('No puedes retirarte a ti mismo desde esta pantalla.');const {error}=await db.from('workspace_members').delete().eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Colaborador retirado del workspace.');close()}}/>
  if(modal.type==='role-create') return <RoleModal workspace={props.workspace} roleTemplates={props.roleTemplates} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_roles').insert({...f,workspace_id:props.workspace.id,is_system:false,protected:false});if(error)throw error;await props.refresh();props.toast('success','Rol creado.');close()}}/>
  if(modal.type==='role-edit') return <RoleModal workspace={props.workspace} initial={modal.role} roleTemplates={props.roleTemplates} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_roles').update(f).eq('id',modal.role.id);if(error)throw error;await props.refresh();props.toast('success','Rol actualizado.');close()}}/>
  if(modal.type==='role-delete') return <ConfirmModal title={`Eliminar rol ${modal.role.name}`} message="Solo se puede eliminar un rol si no está asignado a ningún colaborador. Los roles Superadmin están protegidos." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('workspace_roles').delete().eq('id',modal.role.id);if(error)throw error;await props.refresh();props.toast('success','Rol eliminado.');close()}}/>

  if(modal.type==='module-create') return <ModuleModal title="Nuevo módulo / grupo" onClose={close} onSave={async f=>{const {error}=await db.from('ticket_modules').insert({...f,workspace_id:props.workspace.id,module_key:'',created_by:props.session.user.id});if(error)throw error;await props.refresh();props.toast('success','Módulo creado.');close()}}/>
  if(modal.type==='module-edit') return <ModuleModal title={`Editar ${modal.module.module_key}`} initial={modal.module} onClose={close} onSave={async f=>{const {error}=await db.from('ticket_modules').update(f).eq('id',modal.module.id);if(error)throw error;await props.refresh();props.toast('success','Módulo actualizado.');close()}}/>
  if(modal.type==='module-delete') return <ConfirmModal title={`Eliminar ${modal.module.name}`} message="Los tickets conservarán su información pero quedarán sin módulo." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('ticket_modules').delete().eq('id',modal.module.id);if(error)throw error;await props.refresh();props.toast('success','Módulo eliminado.');close()}}/>
  if(modal.type==='tag-create') return <TagModal title="Nueva tag" onClose={close} onSave={async f=>{const {error}=await db.from('ticket_tags').insert({...f,workspace_id:props.workspace.id,slug:'',created_by:props.session.user.id});if(error)throw error;await props.refresh();props.toast('success','Tag creada.');close()}}/>
  if(modal.type==='tag-edit') return <TagModal title={`Editar ${modal.tag.name}`} initial={modal.tag} onClose={close} onSave={async f=>{const {error}=await db.from('ticket_tags').update(f).eq('id',modal.tag.id);if(error)throw error;await props.refresh();props.toast('success','Tag actualizada.');close()}}/>
  if(modal.type==='tag-delete') return <ConfirmModal title={`Eliminar tag ${modal.tag.name}`} message="Se retirará esta tag de todos los tickets relacionados." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('ticket_tags').delete().eq('id',modal.tag.id);if(error)throw error;await props.refresh();props.toast('success','Tag eliminada.');close()}}/>
  if(modal.type==='field-create') return <CustomFieldModal title="Nuevo campo personalizado" products={props.products} onClose={close} onSave={async f=>{const {product_ids=[],...row}=f;const {data,error}=await db.from('custom_ticket_fields').insert({...row,workspace_id:props.workspace.id,field_key:'',created_by:props.session.user.id}).select('*').single();if(error)throw error;if(!row.applies_to_all_products&&product_ids.length){const a=await db.from('custom_ticket_field_products').insert(product_ids.map(product_id=>({workspace_id:props.workspace.id,field_id:data.id,product_id})));if(a.error)throw a.error}await props.refresh();props.toast('success','Campo personalizado creado.');close()}}/>
  if(modal.type==='field-edit') return <CustomFieldModal title={`Editar ${modal.field.name}`} initial={{...modal.field,product_ids:props.customFieldProducts.filter(x=>x.field_id===modal.field.id).map(x=>x.product_id)}} products={props.products} onClose={close} onSave={async f=>{const {product_ids=[],...row}=f;const {error}=await db.from('custom_ticket_fields').update(row).eq('id',modal.field.id);if(error)throw error;const del=await db.from('custom_ticket_field_products').delete().eq('field_id',modal.field.id);if(del.error)throw del.error;if(!row.applies_to_all_products&&product_ids.length){const a=await db.from('custom_ticket_field_products').insert(product_ids.map(product_id=>({workspace_id:props.workspace.id,field_id:modal.field.id,product_id})));if(a.error)throw a.error}await props.refresh();props.toast('success','Campo actualizado.');close()}}/>
  if(modal.type==='field-delete') return <ConfirmModal title={`Eliminar campo ${modal.field.name}`} message="Se eliminarán los valores de este campo en los tickets." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('custom_ticket_fields').delete().eq('id',modal.field.id);if(error)throw error;await props.refresh();props.toast('success','Campo eliminado.');close()}}/>

  if(modal.type==='product-create') return <ProductModal title="Nuevo producto" onClose={close} onSave={async f=>{const {error}=await db.from('products').insert({...f,workspace_id:props.workspace.id,board_order:props.products.length+1});if(error)throw error;await props.refresh();props.toast('success','Producto creado.');close()}}/>
  if(modal.type==='product-edit') return <ProductModal title="Editar producto" initial={modal.product} onClose={close} onSave={async f=>{const {error}=await db.from('products').update(f).eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto actualizado.');close()}}/>
  if(modal.type==='product-delete') return <ConfirmModal title="Eliminar producto" message="No podrás eliminar un producto si tiene tickets asociados. Reasigna o elimina esos tickets primero." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('products').delete().eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto eliminado.');close()}}/>

  if(modal.type==='request-type-create') return <RequestTypeModal title="Nuevo tipo de solicitud" requestTypes={props.requestTypes} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_request_types').insert({...f,workspace_id:props.workspace.id,created_by:props.session.user.id});if(error)throw error;await props.refresh();props.toast('success','Tipo de solicitud creado.');close()}}/>
  if(modal.type==='request-type-edit') return <RequestTypeModal title="Editar tipo de solicitud" initial={modal.requestType} requestTypes={props.requestTypes} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_request_types').update(f).eq('id',modal.requestType.id);if(error)throw error;await props.refresh();props.toast('success','Tipo de solicitud actualizado.');close()}}/>
  if(modal.type==='request-type-delete'){
    const used=props.helpdesk?.filter?.(h=>h.request_type_id===modal.requestType.id)?.length||0
    if(used>0) return <ConfirmModal title="Desactivar tipo de solicitud" message={`“${modal.requestType.name}” tiene ${used} solicitud${used===1?'':'es'} asociada${used===1?'':'s'}. Para conservar el histórico se desactivará en lugar de eliminarse.`} onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_request_types').update({active:false}).eq('id',modal.requestType.id);if(error)throw error;await props.refresh();props.toast('success','Tipo desactivado; el histórico se conserva.');close()}}/>
    return <ConfirmModal title="Eliminar tipo de solicitud" message={`Se eliminará “${modal.requestType.name}”. Esta acción solo está disponible porque todavía no tiene solicitudes asociadas.`} danger onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_request_types').delete().eq('id',modal.requestType.id);if(error)throw error;await props.refresh();props.toast('success','Tipo de solicitud eliminado.');close()}}/>
  }
  if(modal.type==='department-create') return <DepartmentModal title="Nueva área de Helpdesk" onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_departments').insert({...f,workspace_id:props.workspace.id});if(error)throw error;await props.refresh();props.toast('success','Área creada.');close()}}/>
  if(modal.type==='department-edit') return <DepartmentModal title="Editar área de Helpdesk" initial={modal.department} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_departments').update(f).eq('id',modal.department.id);if(error)throw error;await props.refresh();props.toast('success','Área actualizada.');close()}}/>
  if(modal.type==='department-delete') return <ConfirmModal title="Eliminar área" message="Las solicitudes existentes conservarán el ticket, pero quedarán sin área asignada." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_departments').delete().eq('id',modal.department.id);if(error)throw error;await props.refresh();props.toast('success','Área eliminada.');close()}}/>
  if(modal.type==='knowledge-delete') return <ConfirmModal title="Eliminar artículo" message={`¿Deseas eliminar “${modal.article.title}”? También se eliminarán las imágenes almacenadas para este artículo.`} danger onClose={close} onConfirm={async()=>{const {data:media,error:mediaError}=await db.from('knowledge_media').select('*').eq('article_id',modal.article.id);if(mediaError)throw mediaError;if(media?.length)await deleteKnowledgeMediaRows(media);const {error}=await db.from('knowledge_articles').delete().eq('id',modal.article.id);if(error)throw error;await props.refresh();props.toast('success','Artículo y multimedia eliminados.');close()}}/>
  return null
}

function Modal({title,subtitle,onClose,children,size='md'}){return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">JIRA INTERNO</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} title="Cerrar" aria-label="Cerrar modal"><Icon name="lucide:x"/></button></div>{children}</div></div>}
function AsyncForm({onSubmit,children,submitLabel='Guardar',danger=false}){
  const [error,setError]=useState(''),[saving,setSaving]=useState(false)
  const go=async e=>{e.preventDefault();setSaving(true);setError('');try{await onSubmit()}catch(err){setError(err.message||String(err))}finally{setSaving(false)}}
  const list=React.Children.toArray(children)
  const secondary=list.filter(child=>child?.props?.className==='modal-secondary')
  const content=list.filter(child=>child?.props?.className!=='modal-secondary')
  return <form className="form modal-form" onSubmit={go}><div className="form-body">{content}{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}</div><div className="form-footer"><div className="form-footer-left">{secondary.flatMap(x=>React.Children.toArray(x.props.children))}</div><div className="modal-actions"><button type="submit" className={danger?'danger-button':'primary'} disabled={saving}>{saving?'Procesando…':submitLabel}</button></div></div></form>
}

function ConfirmModal({title,message,danger,onClose,onConfirm}){return <Modal title={title} onClose={onClose} size="sm"><AsyncForm onSubmit={onConfirm} submitLabel={danger?'Eliminar definitivamente':'Confirmar'} danger={danger}><div className="confirm-box"><span className={danger?'danger-icon':'info-icon'}><Icon name={danger?'lucide:triangle-alert':'lucide:circle-help'} size={26}/></span><p>{message}</p></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function ActionSheet({title,subtitle,onClose,actions}){return <Modal title={title} subtitle={subtitle} onClose={onClose} size="sm"><div className="action-sheet">{actions.map(([icon,label,fn,tone])=><button key={label} className={tone==='danger'?'danger-action':''} onClick={fn}><Icon name={icon}/><span>{label}</span><Icon name="lucide:chevron-right" size={16}/></button>)}</div></Modal>}

function WorkspaceModal({title,initial,onClose,onSave}){const [name,setName]=useState(initial?.name||'');return <Modal title={title} subtitle="Los datos y permisos permanecerán aislados por espacio." onClose={onClose}><AsyncForm onSubmit={()=>onSave({name:name.trim()})} submitLabel="Guardar workspace"><label>Nombre del workspace<input autoFocus value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Desarrollo TROBBU"/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function WorkspaceConfigModal({liveRevision=0,workspace,settings,onClose,onSaved}){
  const [f,setF]=useState({
    timezone:settings?.timezone||'America/Merida',default_sprint_days:settings?.default_sprint_days||14,support_email:settings?.support_email||'',
    sla_first_response_hours:settings?.sla_first_response_hours||4,sla_resolution_hours:settings?.sla_resolution_hours||24,
    in_app_notifications:settings?.in_app_notifications??true,email_notifications:settings?.email_notifications??true,helpdesk_enabled:settings?.helpdesk_enabled??true,
    helpdesk_auto_assignment_enabled:settings?.helpdesk_auto_assignment_enabled??true,
    helpdesk_default_daily_limit:settings?.helpdesk_default_daily_limit??4,
    helpdesk_default_active_limit:settings?.helpdesk_default_active_limit??4,
    helpdesk_default_overflow_mode:settings?.helpdesk_default_overflow_mode||'fallback',
    helpdesk_default_overflow_user_id:settings?.helpdesk_default_overflow_user_id||'',
    knowledge_cover_templates:normalizeKnowledgeCoverSettings(settings?.knowledge_cover_templates)
  })
  const [routingMembers,setRoutingMembers]=useState([])
  useEffect(()=>{let live=true;(async()=>{const {data}=await db.from('workspace_members').select('user_id,role,role_id,active,helpdesk_auto_assign_enabled').eq('workspace_id',workspace.id).eq('active',true);if(!live)return;const ids=(data||[]).map(x=>x.user_id);const {data:profiles}=ids.length?await db.from('profiles').select('id,full_name,email').in('id',ids):{data:[]};const pm=new Map((profiles||[]).map(x=>[x.id,x]));setRoutingMembers((data||[]).filter(x=>x.role!=='consulta').map(x=>({...x,profile:pm.get(x.user_id)})))} )();return()=>{live=false}},[workspace.id,liveRevision])
  const setCover=(template,key,value)=>setF(x=>({...x,knowledge_cover_templates:{...x.knowledge_cover_templates,[template]:{...x.knowledge_cover_templates[template],[key]:value}}}))
  const resetCoverTemplates=()=>setF(x=>({...x,knowledge_cover_templates:normalizeKnowledgeCoverSettings(DEFAULT_KNOWLEDGE_COVER_SETTINGS)}))
  return <Modal title="Editar configuración" subtitle={`Preferencias operativas de ${workspace.name}.`} onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{
    const sprintDays=Number(f.default_sprint_days),first=Number(f.sla_first_response_hours),resolution=Number(f.sla_resolution_hours),daily=Number(f.helpdesk_default_daily_limit),active=Number(f.helpdesk_default_active_limit)
    if(!f.timezone.trim())throw new Error('La zona horaria es obligatoria.');try{new Intl.DateTimeFormat('es-MX',{timeZone:f.timezone.trim()}).format(new Date())}catch{throw new Error('Ingresa una zona horaria IANA válida, por ejemplo America/Merida.')}
    if(sprintDays<1||sprintDays>90)throw new Error('La duración del sprint debe estar entre 1 y 90 días.');if(first<1||first>720)throw new Error('El SLA de primera respuesta debe estar entre 1 y 720 horas.');if(resolution<1||resolution>2160)throw new Error('El SLA de resolución debe estar entre 1 y 2160 horas.');if(daily<0||daily>500||active<0||active>500)throw new Error('Los límites de Helpdesk deben estar entre 0 y 500.')
    const {error}=await db.from('workspace_settings').update({timezone:f.timezone.trim(),default_sprint_days:sprintDays,support_email:f.support_email.trim()||null,sla_first_response_hours:first,sla_resolution_hours:resolution,in_app_notifications:!!f.in_app_notifications,email_notifications:!!f.email_notifications,helpdesk_enabled:!!f.helpdesk_enabled,helpdesk_auto_assignment_enabled:!!f.helpdesk_auto_assignment_enabled,helpdesk_default_daily_limit:daily,helpdesk_default_active_limit:active,helpdesk_default_overflow_mode:f.helpdesk_default_overflow_mode,helpdesk_default_overflow_user_id:f.helpdesk_default_overflow_user_id||null,knowledge_cover_templates:normalizeKnowledgeCoverSettings(f.knowledge_cover_templates)}).eq('workspace_id',workspace.id);if(error)throw error;await onSaved()
  }} submitLabel="Guardar configuración">
    <div className="form-section"><h4>Operación</h4><div className="form-grid"><label>Zona horaria<input value={f.timezone} onChange={e=>setF({...f,timezone:e.target.value})} required/></label><label>Duración de sprint (días)<input type="number" min="1" max="90" value={f.default_sprint_days} onChange={e=>setF({...f,default_sprint_days:e.target.value})}/></label><label>Correo de soporte<input type="email" value={f.support_email} onChange={e=>setF({...f,support_email:e.target.value})} placeholder="soporte@trobbu.com"/></label><label>SLA primera respuesta (hrs)<input type="number" min="1" max="720" value={f.sla_first_response_hours} onChange={e=>setF({...f,sla_first_response_hours:e.target.value})}/></label><label>SLA resolución (hrs)<input type="number" min="1" max="2160" value={f.sla_resolution_hours} onChange={e=>setF({...f,sla_resolution_hours:e.target.value})}/></label></div></div>
    <div className="form-section"><div className="routing-config-head"><div><h4>Asignación automática Helpdesk</h4><p>Reglas base usadas cuando un colaborador no define límites o respaldo propios.</p></div><Toggle label="Autoasignación activa" checked={!!f.helpdesk_auto_assignment_enabled} onChange={v=>setF({...f,helpdesk_auto_assignment_enabled:v})}/></div><div className="form-grid"><label>Máximo de asignaciones por día<input type="number" min="0" max="500" value={f.helpdesk_default_daily_limit} onChange={e=>setF({...f,helpdesk_default_daily_limit:e.target.value})}/><small className="field-help">0 = sin límite.</small></label><label>Máximo de tickets activos<input type="number" min="0" max="500" value={f.helpdesk_default_active_limit} onChange={e=>setF({...f,helpdesk_default_active_limit:e.target.value})}/><small className="field-help">Se libera al cerrar o redirigir.</small></label><label>Cuando se alcanza el límite<select value={f.helpdesk_default_overflow_mode} onChange={e=>setF({...f,helpdesk_default_overflow_mode:e.target.value})}><option value="fallback">Asignar a respaldo</option><option value="next_available">Siguiente disponible</option><option value="queue">Dejar en cola</option></select></label>{f.helpdesk_default_overflow_mode==='fallback'&&<label>Responsable de respaldo<select value={f.helpdesk_default_overflow_user_id} onChange={e=>setF({...f,helpdesk_default_overflow_user_id:e.target.value})}><option value="">Sin respaldo</option>{routingMembers.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||m.profile?.email||'Usuario'}</option>)}</select></label>}</div><div className="notice"><Icon name="lucide:bot"/><span>El asistente analiza asunto, descripción, tipo, departamento y producto contra la descripción de responsabilidades de Staff. Si falla la IA, se usa un enrutamiento local y la cola automática.</span></div></div>
    <div className="form-section knowledge-cover-settings"><div className="knowledge-cover-settings-head"><div><h4>Plantillas de portada Knowledge</h4><p>Define la identidad visual global. Los artículos existentes conservan la plantilla elegida y adoptan estos parámetros al abrirse, previsualizarse o exportarse.</p></div><button type="button" className="secondary-button compact" onClick={resetCoverTemplates}><Icon name="lucide:rotate-ccw"/> Restablecer</button></div><div className="knowledge-cover-settings-grid">{KNOWLEDGE_COVER_TEMPLATES.map(t=>{const theme=f.knowledge_cover_templates[t.value];return <article className="knowledge-cover-setting-card" key={t.value}><div className={`knowledge-cover-setting-preview template-${t.value}`} style={knowledgeCoverStyle(f.knowledge_cover_templates,t.value)}><span>{t.label}</span><b>Documento ejecutivo</b><small>{t.description}</small></div><div className="knowledge-cover-setting-fields"><label>Fondo<input type="color" value={theme.background} onChange={e=>setCover(t.value,'background',e.target.value.toUpperCase())}/></label><label>Fondo final<input type="color" value={theme.background_alt} onChange={e=>setCover(t.value,'background_alt',e.target.value.toUpperCase())}/></label><label>Texto<input type="color" value={theme.text} onChange={e=>setCover(t.value,'text',e.target.value.toUpperCase())}/></label><label>Acento<input type="color" value={theme.accent} onChange={e=>setCover(t.value,'accent',e.target.value.toUpperCase())}/></label><label>Borde<input type="color" value={theme.border} onChange={e=>setCover(t.value,'border',e.target.value.toUpperCase())}/></label><label>Fuente del título<select value={theme.title_font} onChange={e=>setCover(t.value,'title_font',e.target.value)}>{KNOWLEDGE_COVER_FONTS.map(font=><option value={font} key={font}>{font}</option>)}</select></label><label>Fuente del contenido<select value={theme.body_font} onChange={e=>setCover(t.value,'body_font',e.target.value)}>{KNOWLEDGE_COVER_FONTS.map(font=><option value={font} key={font}>{font}</option>)}</select></label></div></article>})}</div></div>
    <div className="form-section"><h4>Funciones</h4><div className="toggle-list"><Toggle label="Notificaciones dentro de la plataforma" checked={!!f.in_app_notifications} onChange={v=>setF({...f,in_app_notifications:v})}/><Toggle label="Notificaciones por correo" checked={!!f.email_notifications} onChange={v=>setF({...f,email_notifications:v})}/><Toggle label="Helpdesk habilitado" checked={!!f.helpdesk_enabled} onChange={v=>setF({...f,helpdesk_enabled:v})}/></div></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function WorkspaceSwitcherModal({workspaces,current,canCreate=false,onClose,onSelect,onCreate}){return <Modal title="Cambiar espacio de trabajo" subtitle="Selecciona el contexto que deseas administrar." onClose={onClose}><div className="form-body switcher-body"><div className="workspace-list">{workspaces.map(w=><button type="button" key={w.id} className={w.id===current?.id?'active':''} onClick={()=>onSelect(w)}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{w.name}</b><span>{ROLE_LABELS[w.role]||w.role}</span></div>{w.id===current?.id&&<Icon name="lucide:check"/>}</button>)}</div></div><div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>{canCreate&&<div className="modal-actions"><button type="button" className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear otro workspace</button></div>}</div></Modal>}

function TicketModal({title,workspace,knowledgeArticles=[],locale='es',ticket,products,sprints,members,modules=[],tags=[],ticketTagLinks=[],customFields=[],customFieldProducts=[],customValues=[],reporterMode=false,onClose,onSave}){
  const initialCustom={}
  customValues.filter(v=>v.ticket_id===ticket?.id).forEach(v=>initialCustom[v.field_id]=v.value)
  const [f,setF]=useState({
    product_id:ticket?.product_id||products[0]?.id||'',module_id:ticket?.module_id||'',tag_ids:ticketTagLinks.filter(x=>x.ticket_id===ticket?.id).map(x=>x.tag_id),custom_values:initialCustom,
    sprint_id:ticket?.sprint_id||'',title:ticket?.title||'',description:ticket?.description||'',type:ticket?.type||'task',priority:ticket?.priority||'medium',status:ticket?.status||'backlog',dev_owner_id:ticket?.dev_owner_id||'',qa_owner_id:ticket?.qa_owner_id||'',story_points:ticket?.story_points??'',start_date:ticket?.start_date||'',due_date:ticket?.due_date||'',attachment_files:[]
  })
  const [attachmentError,setAttachmentError]=useState('')
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const setCustom=(id,v)=>setF(x=>({...x,custom_values:{...x.custom_values,[id]:v}}))
  const toggleTag=id=>set('tag_ids',f.tag_ids.includes(id)?f.tag_ids.filter(x=>x!==id):[...f.tag_ids,id])
  const memberHasProduct=m=>m.role==='superadmin'||m.all_products||m.product_ids?.includes(f.product_id)
  const devs=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).edit_tickets&&memberHasProduct(m))
  const qas=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).qa_review&&memberHasProduct(m))
  const fields=customFields.filter(cf=>cf.active&&(cf.applies_to_all_products||customFieldProducts.some(fp=>fp.field_id===cf.id&&fp.product_id===f.product_id)))
  const activeModules=modules.filter(m=>m.active||m.id===ticket?.module_id)
  const activeTags=tags.filter(t=>t.active||f.tag_ids.includes(t.id))
  const validate=()=>{
    for(const field of fields){const v=f.custom_values[field.id],empty=v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);if(field.required&&empty)throw new Error(`Completa el campo obligatorio: ${field.name}.`)}
    return onSave(f)
  }
  return <Modal title={title} subtitle={reporterMode?'Envía una solicitud documentada al Backlog. El equipo definirá sprint, responsables y fechas.':'Define alcance, clasificación, documentación y ciclo de entrega.'} onClose={onClose} size="xl"><AsyncForm onSubmit={validate} submitLabel={ticket?'Guardar cambios':reporterMode?'Enviar al Backlog':'Crear ticket'}>
    <div className="form-section"><h4>Información principal</h4><label>Título<input value={f.title} onChange={e=>set('title',e.target.value)} required placeholder="Describe el trabajo en una frase"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Contexto, criterios de aceptación, pasos para reproducir…"/></label><KnowledgeSuggestions workspace={workspace} locale={locale} title={f.title} description={f.description} articles={knowledgeArticles}/></div>
    <div className="form-section"><h4>Clasificación y agrupación</h4><div className="form-grid">
      <label>Producto<select value={f.product_id} onChange={e=>set('product_id',e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Módulo / Grupo<select value={f.module_id} onChange={e=>set('module_id',e.target.value)}><option value="">Sin módulo</option>{activeModules.map(m=><option key={m.id} value={m.id}>{m.module_key} · {m.name}</option>)}</select></label>
      <label>Tipo<select value={f.type} onChange={e=>set('type',e.target.value)}>{TYPES.map(x=><option key={x} value={x}>{TYPE_LABELS[x]}</option>)}</select></label>
      <label>Prioridad<select value={f.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(x=><option key={x} value={x}>{PRIORITY_LABELS[x]}</option>)}</select></label>
    </div>
    <div className="tag-picker"><span className="field-label">Tags</span><div className="tag-chip-grid">{activeTags.length?activeTags.map(tag=><button type="button" key={tag.id} className={`tag-choice ${f.tag_ids.includes(tag.id)?'selected':''}`} onClick={()=>toggleTag(tag.id)} style={{'--tag-color':tag.color}}><span></span>{tag.name}<Icon name={f.tag_ids.includes(tag.id)?'lucide:check':'lucide:plus'} size={13}/></button>):<small className="muted">No hay tags configuradas.</small>}</div></div>
    {reporterMode&&<div className="notice"><Icon name="lucide:inbox"/><span>El ticket se creará en <b>Backlog</b>, sin responsables, sprint ni fechas. Módulo, tags y campos documentales sí se conservarán.</span></div>}</div>
    {!reporterMode&&<div className="form-section"><h4>Planeación</h4><div className="form-grid">
      <label>Sprint<select value={f.sprint_id} onChange={e=>set('sprint_id',e.target.value)}><option value="">Sin sprint / Backlog</option>{sprints.filter(s=>s.status!=='completed'||s.id===ticket?.sprint_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Estado<select value={f.status} onChange={e=>set('status',e.target.value)}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
      <label>Story Points<select value={f.story_points} onChange={e=>set('story_points',e.target.value)}><option value="">Sin estimar</option>{STORY_POINTS.map(sp=><option key={sp} value={sp}>{sp} · {STORY_POINT_LABELS[sp]}</option>)}</select><small>Complejidad relativa 1–5; no representa horas. <a href="./Story_Points_1_a_5_TROBBU.pdf" target="_blank" rel="noreferrer">Ver escala y ejemplos</a>.</small></label>
      <label>Responsable Dev<select value={f.dev_owner_id} onChange={e=>set('dev_owner_id',e.target.value)}><option value="">Sin asignar</option>{devs.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label>
      <label>Responsable QA<select value={f.qa_owner_id} onChange={e=>set('qa_owner_id',e.target.value)}><option value="">Sin asignar</option>{qas.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label>
      <label>Fecha de inicio<input type="date" value={f.start_date} onChange={e=>set('start_date',e.target.value)}/></label><label>Fecha de entrega<input type="date" min={f.start_date||undefined} value={f.due_date} onChange={e=>set('due_date',e.target.value)}/></label>
    </div></div>}
    <div className="form-section"><div className="section-heading"><div><h4>Archivos adjuntos</h4><p>Opcional · imágenes, PDF, CSV, Excel, Word, PowerPoint y formatos OpenDocument.</p></div><span className="evidence-counter">{f.attachment_files.length}/5</span></div><label className="helpdesk-evidence-picker"><input type="file" accept={ATTACHMENT_ACCEPT} multiple onChange={e=>{try{set('attachment_files',validateAttachmentSelection(e.target.files));setAttachmentError('')}catch(err){e.target.value='';set('attachment_files',[]);setAttachmentError(err.message||String(err))}}}/><span className="helpdesk-evidence-picker-icon"><Icon name="lucide:paperclip" size={24}/></span><span><b>{f.attachment_files.length?'Cambiar archivos':'Seleccionar archivos'}</b><small>Imágenes hasta 15 MB y documentos hasta 25 MB · máximo 5 archivos.</small></span></label>{attachmentError&&<div className="error compact-error"><Icon name="lucide:triangle-alert"/>{attachmentError}</div>}{f.attachment_files.length>0&&<div className="helpdesk-evidence-selection">{f.attachment_files.map((file,index)=><div key={`${file.name}-${file.size}-${index}`}><span><Icon name={attachmentIcon(file)}/><b title={file.name}>{file.name}</b><small>{fileSizeLabel(file.size)}</small></span><button type="button" className="icon-button" title="Quitar archivo" onClick={()=>set('attachment_files',f.attachment_files.filter((_,i)=>i!==index))}><Icon name="lucide:x"/></button></div>)}</div>}</div>
    {fields.length>0&&<div className="form-section"><div className="section-heading"><div><h4>Campos adicionales</h4><p>Documentación específica configurada para este workspace/producto.</p></div></div><div className="form-grid custom-field-form">{fields.map(field=><CustomFieldInput key={field.id} field={field} value={f.custom_values[field.id]} onChange={v=>setCustom(field.id,v)}/>)}</div></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function EvidenceKind({kind='comment'}){
  const map={comment:['Comentario','lucide:message-square'],review:['Revisión','lucide:search-check'],rejection:['Rechazo','lucide:circle-x'],fix:['Fix / Corrección','lucide:wrench'],closure:['Cierre','lucide:badge-check']}
  const row=map[kind]||map.comment
  return <span className={`evidence-kind evidence-${kind}`}><Icon name={row[1]} size={12}/>{row[0]}</span>
}

function EvidenceGallery({rows,session,canManage,onDelete}){
  if(!rows?.length)return null
  return <div className="evidence-gallery">{rows.map(row=>{const image=isImageAttachment({name:row.file_name,type:row.mime_type});return <figure className={`evidence-card ${image?'image':'document'}`} key={row.id}>{row.signed_url?(image?<a href={row.signed_url} target="_blank" rel="noreferrer"><img src={row.signed_url} alt={row.file_name}/></a>:<a className="document-preview" href={row.signed_url} target="_blank" rel="noreferrer"><Icon name={attachmentIcon(row)} size={30}/><span>Abrir archivo</span></a>):<div className="evidence-missing"><Icon name={image?'lucide:image-off':attachmentIcon(row)} size={28}/></div>}<figcaption><span><b>{row.file_name}</b><small>{evidenceLabel(row.evidence_type)} · {row.size_bytes?fileSizeLabel(row.size_bytes)+' · ':''}{formatDateTime(row.created_at)}</small></span>{(row.uploaded_by===session.user.id||canManage)&&<button type="button" className="icon-button danger-text" title="Eliminar evidencia" onClick={()=>onDelete(row)}><Icon name="lucide:trash-2" size={14}/></button>}</figcaption></figure>})}</div>
}

function EvidenceCommentModal({title,initial,onClose,onSave,allowFiles=false}){
  const [body,setBody]=useState(initial?.body||'')
  const [kind,setKind]=useState(initial?.kind||'comment')
  const [files,setFiles]=useState([])
  const [fileError,setFileError]=useState('')
  return <Modal title={title} subtitle="Documenta revisión, rechazo, solicitud de fixes o cierre del trabajo." onClose={onClose}><AsyncForm onSubmit={()=>{const clean=body.trim();if(!clean&&!files.length)throw new Error('Escribe un comentario o adjunta al menos un archivo.');return onSave({body:clean||'Archivo adjunto',kind,files})}} submitLabel="Guardar evidencia">
    <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="comment">Comentario general</option><option value="review">Revisión</option><option value="rejection">Rechazo</option><option value="fix">Fix / Corrección</option><option value="closure">Cierre</option></select></label>
    <label>Comentario <span className="optional">Opcional si adjuntas archivo</span><textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} placeholder="Describe la revisión, hallazgo, corrección o criterio de cierre…"/></label>
    {allowFiles&&<div className="form-section evidence-file-section"><div className="section-heading compact-heading"><div><h4>Archivos adjuntos</h4><p>Imágenes, PDF, CSV, Excel, Word, PowerPoint y formatos OpenDocument.</p></div><span className="evidence-counter">{files.length}/5</span></div><label className="helpdesk-evidence-picker"><input type="file" accept={ATTACHMENT_ACCEPT} multiple onChange={e=>{try{setFiles(validateAttachmentSelection(e.target.files));setFileError('')}catch(err){e.target.value='';setFiles([]);setFileError(err.message||String(err))}}}/><span className="helpdesk-evidence-picker-icon"><Icon name="lucide:paperclip" size={24}/></span><span><b>{files.length?'Cambiar archivos':'Seleccionar archivos'}</b><small>Imágenes hasta 15 MB y documentos hasta 25 MB · máximo 5 archivos.</small></span></label>{files.length>0&&<div className="helpdesk-evidence-selection">{files.map((file,index)=><div key={`${file.name}-${file.size}-${index}`}><span><Icon name={attachmentIcon(file)}/><b title={file.name}>{file.name}</b><small>{fileSizeLabel(file.size)}</small></span><button type="button" className="icon-button" title="Quitar archivo" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><Icon name="lucide:x"/></button></div>)}</div>}{fileError&&<small className="field-error">{fileError}</small>}<small className="field-help">Las imágenes se comprimen automáticamente; los documentos se conservan sin alterar.</small></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function TicketDetailModal({workspace,ticket,tickets,products,members,modules=[],tags=[],ticketTagLinks=[],ticketLinks=[],customFields=[],customValues=[],session,canWork,canManage,liveRevision=0,onClose,onEdit,onPlan,onLink,onOpenRelated,onRefresh,toast}){
  const [comments,setComments]=useState([])
  const [activity,setActivity]=useState([])
  const [attachments,setAttachments]=useState([])
  const [detailCounts,setDetailCounts]=useState({comments:0,activity:0,attachments:0})
  const [tab,setTab]=useState('comments')
  const [commentModal,setCommentModal]=useState(null)
  const load=async()=>{
    const [c,a,e,cc,ac,ec]=await Promise.all([
      db.from('ticket_comments').select('*').eq('ticket_id',ticket.id).order('created_at'),
      db.from('ticket_activity').select('*').eq('ticket_id',ticket.id).order('created_at',{ascending:false}),
      db.from('ticket_attachments').select('*').eq('ticket_id',ticket.id).order('created_at'),
      exactRelationCount('ticket_comments','ticket_id',ticket.id),
      exactRelationCount('ticket_activity','ticket_id',ticket.id),
      exactRelationCount('ticket_attachments','ticket_id',ticket.id)
    ])
    if(c.error) toast('error',c.error.message); else setComments(c.data||[])
    if(a.error) toast('error',a.error.message); else setActivity(a.data||[])
    if(e.error) toast('error',e.error.message); else setAttachments(await signedEvidenceRows(e.data||[]))
    setDetailCounts({comments:Math.max(Number(cc.count||0),(c.data||[]).length),activity:Math.max(Number(ac.count||0),(a.data||[]).length),attachments:Math.max(Number(ec.count||0),(e.data||[]).length)})
  }
  useEffect(()=>{load()},[ticket.id,liveRevision])
  useResilientLiveRefresh(load,`ticket:${ticket.id}`,30000)
  const addComment=async({body,kind,files})=>{
    body=String(body||'').trim();if(!body&&!(files?.length))throw new Error('Escribe un comentario o adjunta al menos un archivo.');body=body||'Archivo adjunto'
    const {data,error}=await db.from('ticket_comments').insert({ticket_id:ticket.id,author_id:session.user.id,body,kind:kind||'comment'}).select('*').single()
    if(error)throw error
    try{await uploadEvidenceFiles({workspaceId:workspace.id,scope:'tickets',parentId:ticket.id,commentId:data.id,files,evidenceType:kind==='comment'?'general':kind,userId:session.user.id,compress:true})}catch(err){await db.from('ticket_comments').delete().eq('id',data.id);throw err}
    await load();toast('success','Comentario y evidencia agregados.')
  }
  const editComment=async(comment,{body,kind})=>{const {error}=await db.from('ticket_comments').update({body:String(body||'').trim(),kind:kind||'comment'}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const deleteComment=async comment=>{const {error}=await db.from('ticket_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado. Las evidencias se conservan en el historial.')}
  const deleteEvidence=async row=>{const {error:se}=await db.storage.from('jira-evidence').remove([row.storage_path]);if(se)throw se;const {error}=await db.from('ticket_attachments').delete().eq('id',row.id);if(error)throw error;await load();toast('success','Evidencia eliminada.')}
  const product=products.find(p=>p.id===ticket.product_id)
  const activityPerson=id=>members.find(m=>m.user_id===id)?.profile?.full_name||members.find(m=>m.user_id===id)?.profile?.email||id||'Sin asignar'
  const activityCopy=a=>a.action==='dev_assignee_changed'?`Responsable Dev: ${activityPerson(a.from_value)} → ${activityPerson(a.to_value)}`:a.action==='qa_assignee_changed'?`Responsable QA: ${activityPerson(a.from_value)} → ${activityPerson(a.to_value)}`:null
  const dev=members.find(m=>m.user_id===ticket.dev_owner_id)?.profile?.full_name||'Sin asignar'
  const qa=members.find(m=>m.user_id===ticket.qa_owner_id)?.profile?.full_name||'Sin asignar'
  const module=modules.find(m=>m.id===ticket.module_id)
  const ticketTags=ticketTagLinks.filter(x=>x.ticket_id===ticket.id).map(x=>tags.find(t=>t.id===x.tag_id)).filter(Boolean)
  const fieldRows=customFields.filter(f=>f.active).map(field=>({field,value:customValues.find(v=>v.ticket_id===ticket.id&&v.field_id===field.id)?.value})).filter(x=>x.value!==undefined&&x.value!==null&&x.value!==''&&(!Array.isArray(x.value)||x.value.length))
  const relations=ticketLinks.filter(l=>l.source_ticket_id===ticket.id||l.target_ticket_id===ticket.id).map(link=>{const outgoing=link.source_ticket_id===ticket.id;const other=tickets.find(t=>t.id===(outgoing?link.target_ticket_id:link.source_ticket_id));let label=LINK_LABELS[link.link_type]||link.link_type;if(link.link_type==='blocks'&&!outgoing)label='Está bloqueado por';if(link.link_type==='follows'&&!outgoing)label='Es seguido por';return {...link,outgoing,other,label}})
  const blockerRelations=relations.filter(r=>r.link_type==='blocks'&&!r.outgoing&&!['qa_passed','closed'].includes(r.other?.status))
  const deleteRelation=async row=>{const {error}=await db.from('ticket_links').delete().eq('id',row.id);if(error)return toast('error',error.message);await onRefresh();toast('success','Relación eliminada.')}
  const unlinked=attachments.filter(a=>!a.comment_id)
  return <><Modal title={`${ticket.ticket_key} · ${ticket.title}`} subtitle={product?.name} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main">
    <div className="detail-description"><h4>Descripción</h4><p>{ticket.description||'Sin descripción.'}</p></div>
    {blockerRelations.length>0&&<div className="blocked-banner"><Icon name="lucide:lock-keyhole"/><div><b>Ticket bloqueado</b><p>Debe liberarse {blockerRelations.map(r=>r.other?.ticket_key).filter(Boolean).join(', ')} antes de continuar.</p></div></div>}
    {(module||ticketTags.length>0)&&<div className="ticket-metadata-panel"><div><span className="field-label">Módulo / Grupo</span>{module?<span className="module-chip" style={{'--module-color':module.color}}><i></i>{module.module_key} · {module.name}</span>:<span className="muted">Sin módulo</span>}</div><div><span className="field-label">Tags</span><div className="tag-chip-grid compact">{ticketTags.length?ticketTags.map(tag=><span className="tag-display" key={tag.id} style={{'--tag-color':tag.color}}><i></i>{tag.name}</span>):<span className="muted">Sin tags</span>}</div></div></div>}
    {fieldRows.length>0&&<div className="custom-values-panel"><h4>Campos adicionales</h4><div className="custom-value-grid">{fieldRows.map(({field,value})=><div key={field.id}><span>{field.name}</span><b>{Array.isArray(value)?value.join(', '):field.field_type==='boolean'?(value?'Sí':'No'):String(value)}</b></div>)}</div></div>}
    <div className="relations-panel"><div className="section-heading"><div><h4>Relaciones</h4><p>Dependencias, seguimiento y referencias entre tickets.</p></div>{canWork&&<button type="button" className="secondary-button compact" onClick={onLink}><Icon name="lucide:git-branch-plus"/> Relacionar</button>}</div>{relations.length===0?<p className="muted">Este ticket todavía no tiene relaciones.</p>:<div className="relation-list">{relations.map(r=><div className={`relation-row ${r.link_type==='blocks'?'dependency':''}`} key={r.id}><span className="relation-type">{r.label}</span><button type="button" className="relation-ticket" onClick={()=>r.other&&onOpenRelated(r.other)}><b>{r.other?.ticket_key||'Ticket'}</b><span>{r.other?.title||'No disponible'}</span>{r.other&&<StatusBadge status={r.other.status}/>}</button>{canWork&&<button type="button" className="icon-button danger-text" onClick={()=>deleteRelation(r)} title="Eliminar relación"><Icon name="lucide:unlink" size={15}/></button>}</div>)}</div>}</div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Revisión y evidencias <em>{detailCounts.comments+detailCounts.attachments}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Actividad <em>{detailCounts.activity}</em></button></div>
    {tab==='comments'?<><div className="comment-list">{comments.length===0&&unlinked.length===0&&<p className="muted">Todavía no hay comentarios ni evidencias.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario',own=c.author_id===session.user.id,files=attachments.filter(a=>a.comment_id===c.id);return <div className={`comment evidence-comment kind-${c.kind||'comment'}`} key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><div className="comment-kind-row"><b>{author}</b><EvidenceKind kind={c.kind}/></div><small>{formatDateTime(c.created_at)}</small></div>{(own||canManage)&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c,own})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p><EvidenceGallery rows={files} session={session} canManage={canManage} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div></div>})}{unlinked.length>0&&<div className="standalone-evidence"><h4>Evidencias conservadas</h4><EvidenceGallery rows={unlinked} session={session} canManage={canManage} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div>}</div>{canWork?<div className="comment-create-row"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:paperclip"/> Agregar revisión / evidencia</button></div>:<div className="notice"><Icon name="lucide:eye"/> Tu rol tiene acceso de solo lectura a la revisión del ticket.</div>}</>:<div className="activity-list">{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{a.action==='created'?'Ticket creado':'Cambio de '+a.action.replaceAll('_',' ')}</b><p>{activityCopy(a)||<>{a.from_value&&`${a.from_value} → `}{a.to_value}</>}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{canWork&&<button type="button" className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar ticket</button>}{canManage&&<button type="button" className="secondary-button full" onClick={onPlan}><Icon name="lucide:calendar-plus"/> Planificar sprint</button>}<DetailRow label="Estado"><StatusBadge status={ticket.status}/></DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span></DetailRow><DetailRow label="Dev">{dev}</DetailRow><DetailRow label="QA">{qa}</DetailRow><DetailRow label="Story points">{ticket.story_points?<span className="sp-pill">{ticket.story_points} · {STORY_POINT_LABELS[ticket.story_points]}</span>:'—'}</DetailRow><DetailRow label="Inicio">{formatDate(ticket.start_date)}</DetailRow><DetailRow label="Entrega">{formatDate(ticket.due_date)}</DetailRow><DetailRow label="Actualizado">{formatDateTime(ticket.updated_at)}</DetailRow></aside></div></Modal>
    {commentModal?.type==='create'&&<EvidenceCommentModal title="Agregar revisión / evidencia" initial={{body:'',kind:'comment'}} allowFiles onClose={()=>setCommentModal(null)} onSave={async data=>{await addComment(data);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario" subtitle="Selecciona una acción" onClose={()=>setCommentModal(null)} actions={[...(commentModal.own?[['lucide:pencil','Editar comentario',()=>setCommentModal({type:'edit',comment:commentModal.comment})]]:[]),['lucide:trash-2','Eliminar comentario',()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>}
    {commentModal?.type==='edit'&&<EvidenceCommentModal title="Editar comentario" initial={{body:commentModal.comment.body,kind:commentModal.comment.kind||'comment'}} onClose={()=>setCommentModal(null)} onSave={async data=>{await editComment(commentModal.comment,data);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="El texto se eliminará. Los archivos adjuntos se conservarán en el historial del ticket." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteComment(commentModal.comment);setCommentModal(null)}}/>}
    {commentModal?.type==='delete-evidence'&&<ConfirmModal title="Eliminar evidencia" message={`Se eliminará “${commentModal.row.file_name}” de forma permanente.`} danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteEvidence(commentModal.row);setCommentModal(null)}}/>}
  </>
}

function DetailRow({label,children}){return <div className="detail-row"><span>{label}</span><div>{children}</div></div>}

function CustomFieldInput({field,value,onChange}){
  const options=Array.isArray(field.options)?field.options:[]
  const label=<>{field.name}{field.required&&<b className="required-star"> *</b>}</>
  if(field.field_type==='textarea')return <label>{label}<textarea rows="3" value={value??''} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder||''}/></label>
  if(field.field_type==='number')return <label>{label}<input type="number" value={value??''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))} placeholder={field.placeholder||''}/></label>
  if(field.field_type==='date')return <label>{label}<input type="date" value={value??''} onChange={e=>onChange(e.target.value)}/></label>
  if(field.field_type==='boolean')return <label>{label}<select value={value===true?'true':value===false?'false':''} onChange={e=>onChange(e.target.value===''?'':e.target.value==='true')}><option value="">Selecciona…</option><option value="true">Sí</option><option value="false">No</option></select></label>
  if(field.field_type==='select')return <label>{label}<select value={value??''} onChange={e=>onChange(e.target.value)}><option value="">Selecciona…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
  if(field.field_type==='multiselect')return <div className="field-multiselect"><span className="field-label">{label}</span><div className="check-chip-grid">{options.map(o=>{const selected=Array.isArray(value)&&value.includes(o);return <button type="button" key={o} className={selected?'selected':''} onClick={()=>onChange(selected?value.filter(x=>x!==o):[...(Array.isArray(value)?value:[]),o])}><Icon name={selected?'lucide:check-square-2':'lucide:square'} size={15}/>{o}</button>})}</div></div>
  return <label>{label}<input type={field.field_type==='url'?'url':'text'} value={value??''} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder||''}/></label>
}

function TicketRelationPicker({ticket,tickets,products,existing=[],value,onChange}){
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false)
  const relatedIds=new Set((existing||[]).filter(l=>l.source_ticket_id===ticket.id||l.target_ticket_id===ticket.id).map(l=>l.source_ticket_id===ticket.id?l.target_ticket_id:l.source_ticket_id))
  const selected=tickets.find(t=>t.id===value)||null
  const text=String(query||'').trim().toLowerCase()
  const options=tickets.filter(t=>t.id!==ticket.id).filter(t=>!text||`${t.ticket_key} ${t.title} ${products.find(p=>p.id===t.product_id)?.name||''} ${statusLabel(t.status)}`.toLowerCase().includes(text)).sort((a,b)=>Number(a.status==='closed')-Number(b.status==='closed')||String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,80)
  const choose=t=>{onChange(t.id);setQuery(`${t.ticket_key} · ${t.title}`);setOpen(false)}
  return <div className="ticket-relation-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}>
    <div className="ticket-relation-search"><Icon name="lucide:search"/><input value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);if(selected&&e.target.value!==`${selected.ticket_key} · ${selected.title}`)onChange('')}} placeholder="Buscar por clave, título, producto o estado…"/><Icon name="lucide:chevron-down"/></div>
    {selected&&<div className="ticket-relation-selected"><span><b>{selected.ticket_key}</b><small>{selected.title}</small></span><span><StatusBadge status={selected.status}/>{products.find(p=>p.id===selected.product_id)&&<em>{products.find(p=>p.id===selected.product_id)?.name}</em>}</span></div>}
    {open&&<div className="ticket-relation-options">{options.length===0&&<div className="ticket-relation-empty"><Icon name="lucide:search-x"/><span>No se encontraron tickets.</span></div>}{options.map(t=>{const product=products.find(p=>p.id===t.product_id),already=relatedIds.has(t.id);return <button type="button" key={t.id} disabled={already} className={already?'already-related':''} onMouseDown={e=>e.preventDefault()} onClick={()=>!already&&choose(t)}><span><b>{t.ticket_key}</b><strong>{t.title}</strong><small>{product?.name||'Sin producto'}{already?' · Ya relacionado':''}</small></span><StatusBadge status={t.status}/></button>})}</div>}
    <small className="field-help">Puedes relacionar tickets activos, en curso o cerrados. Los cerrados se muestran después de los activos para facilitar la búsqueda.</small>
  </div>
}
function TicketLinkModal({ticket,tickets,products,existing,onClose,onSave}){
  const [f,setF]=useState({link_type:'blocks',other_ticket_id:'',note:''})
  return <Modal title={`Relacionar ${ticket.ticket_key}`} subtitle="Crea dependencias, referencias o continuidad entre tickets activos o históricos." onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(!f.other_ticket_id)throw new Error('Selecciona el ticket relacionado.');return onSave(f)}} submitLabel="Crear relación">
    <div className="relation-explainer"><Icon name="lucide:git-fork"/><div><b>Las dependencias Bloquea / Está bloqueado por son funcionales.</b><p>El ticket dependiente no puede avanzar hasta que el bloqueador llegue a QA aprobado o Cerrado.</p></div></div>
    <div className="relation-form-stack"><label>Relación<select value={f.link_type} onChange={e=>setF({...f,link_type:e.target.value})}>{LINK_TYPES.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Ticket relacionado<TicketRelationPicker ticket={ticket} tickets={tickets} products={products} existing={existing} value={f.other_ticket_id} onChange={id=>setF({...f,other_ticket_id:id})}/></label></div>
    <label>Nota de relación<textarea rows="3" value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="Ej. La API debe estar liberada antes de iniciar esta vista."/></label>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function DependencyOverrideModal({ticket,status,onClose,onSave}){const [note,setNote]=useState('');return <Modal title="Forzar avance de ticket bloqueado" subtitle={`${ticket.ticket_key} tiene dependencias pendientes. Esta excepción quedará registrada.`} onClose={onClose} size="sm"><AsyncForm onSubmit={()=>{if(note.trim().length<5)throw new Error('Indica el motivo del override.');return onSave(note.trim())}} submitLabel="Forzar avance"><div className="warning-panel"><Icon name="lucide:triangle-alert"/><div><b>Excepción administrativa</b><p>Solo Admin/Superadmin puede continuar sin liberar todos los bloqueadores.</p></div></div><label>Motivo<textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} placeholder="Explica por qué puede continuar…" required/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function ModuleModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',description:initial?.description||'',color:initial?.color||'#4D5A51',active:initial?.active??true});return <Modal title={title} subtitle="Agrupa tickets individuales bajo una iniciativa medible, incluso entre productos." onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,name:f.name.trim()})} submitLabel="Guardar módulo"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Cuponera Digital"/></label><label>Descripción<textarea rows="4" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Objetivo y alcance del módulo…"/></label><div className="form-grid"><label>Color<input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Módulo activo" checked={f.active} onChange={v=>setF({...f,active:v})}/></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function TagModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',description:initial?.description||'',color:initial?.color||'#0D47A1',active:initial?.active??true});return <Modal title={title} subtitle="Etiqueta reutilizable para clasificar y filtrar tickets." onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,name:f.name.trim()})} submitLabel="Guardar tag"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Pagos MSI"/></label><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label><div className="form-grid"><label>Color<input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Tag activa" checked={f.active} onChange={v=>setF({...f,active:v})}/></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function CustomFieldModal({title,initial,products,onClose,onSave}){
  const [f,setF]=useState({name:initial?.name||'',description:initial?.description||'',field_type:initial?.field_type||'text',required:initial?.required??false,placeholder:initial?.placeholder||'',options:Array.isArray(initial?.options)?initial.options.join('\n'):'',applies_to_all_products:initial?.applies_to_all_products??true,product_ids:initial?.product_ids||[],sort_order:initial?.sort_order??100,active:initial?.active??true})
  const toggleProduct=id=>setF(x=>({...x,product_ids:x.product_ids.includes(id)?x.product_ids.filter(v=>v!==id):[...x.product_ids,id]}))
  return <Modal title={title} subtitle="Agrega documentación estructurada al ticket sin modificar su esquema cada vez." onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(!f.applies_to_all_products&&!f.product_ids.length)throw new Error('Selecciona al menos un producto.');const options=['select','multiselect'].includes(f.field_type)?f.options.split('\n').map(x=>x.trim()).filter(Boolean):[];if(['select','multiselect'].includes(f.field_type)&&!options.length)throw new Error('Agrega al menos una opción.');return onSave({...f,name:f.name.trim(),options})}} submitLabel="Guardar campo"><div className="form-grid"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Ambiente"/></label><label>Tipo<select value={f.field_type} onChange={e=>setF({...f,field_type:e.target.value})}>{CUSTOM_FIELD_TYPES.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Orden<input type="number" value={f.sort_order} onChange={e=>setF({...f,sort_order:Number(e.target.value)||100})}/></label><label>Placeholder<input value={f.placeholder} onChange={e=>setF({...f,placeholder:e.target.value})}/></label></div><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>{['select','multiselect'].includes(f.field_type)&&<label>Opciones · una por línea<textarea rows="5" value={f.options} onChange={e=>setF({...f,options:e.target.value})} placeholder={'Producción\nStaging\nDesarrollo'}/></label>}<div className="toggle-list"><Toggle label="Campo obligatorio" checked={f.required} onChange={v=>setF({...f,required:v})}/><Toggle label="Aplicar a todos los productos" checked={f.applies_to_all_products} onChange={v=>setF({...f,applies_to_all_products:v})}/><Toggle label="Campo activo" checked={f.active} onChange={v=>setF({...f,active:v})}/></div>{!f.applies_to_all_products&&<div className="product-checkbox-grid">{products.map(p=><button type="button" key={p.id} className={f.product_ids.includes(p.id)?'selected':''} onClick={()=>toggleProduct(p.id)}><Icon name={f.product_ids.includes(p.id)?'lucide:check-square-2':'lucide:square'} size={16}/><span><b>{p.name}</b><small>{p.key}</small></span></button>)}</div>}<div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>
}

function TicketCatalogsView({workspace,modules,moduleStats=[],tags,customFields,tickets,ticketTagLinks,canManage,onModuleCreate,onModuleEdit,onModuleDelete,onTagCreate,onTagEdit,onTagDelete,onFieldCreate,onFieldEdit,onFieldDelete}){
  const [tab,setTab]=useState('modules')
  return <div className="page"><PageHeader eyebrow="Configuración de tickets" title="Campos, módulos y tags" subtitle="Estructura la información de los tickets sin perder flexibilidad." icon="lucide:tags"/><div className="content-card catalog-shell"><div className="settings-tabs"><button className={tab==='modules'?'active':''} onClick={()=>setTab('modules')}>Módulos <em>{modules.length}</em></button><button className={tab==='tags'?'active':''} onClick={()=>setTab('tags')}>Tags <em>{tags.length}</em></button><button className={tab==='fields'?'active':''} onClick={()=>setTab('fields')}>Campos adicionales <em>{customFields.length}</em></button></div>
  {tab==='modules'&&<div className="catalog-content"><div className="settings-list-head"><div><h3>Módulos / Grupos</h3><p>Agrupan varios tickets bajo una iniciativa medible. Un ticket puede tener un módulo principal.</p></div><button className="primary compact" onClick={onModuleCreate}><Icon name="lucide:plus"/> Nuevo módulo</button></div><div className="catalog-grid">{modules.map(m=>{const rows=tickets.filter(t=>t.module_id===m.id),stats=moduleStats.find(x=>x.module_id===m.id)||{},ticketCount=Number(stats.ticket_count??rows.length),activityCount=Number(stats.activity_count||0),articleCount=Number(stats.article_count||0),pct=rows.length?Math.round(rows.reduce((a,t)=>a+ticketProgress(t.status),0)/rows.length):0;return <div className="catalog-card" key={m.id}><div className="catalog-title"><span className="color-dot" style={{background:m.color}}></span><div><b>{m.module_key} · {m.name}</b><p>{m.description||'Sin descripción'}</p></div></div><div className="catalog-metrics module-count-metrics"><span><b>{ticketCount}</b> tickets</span><span><b>{activityCount}</b> actividades</span><span><b>{articleCount}</b> artículos</span><span><b>{rows.reduce((a,t)=>a+(Number(t.story_points)||1),0)}</b> SP</span><span><b>{pct}%</b> avance</span></div><div className="row-actions"><button onClick={()=>onModuleEdit(m)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onModuleDelete(m)}><Icon name="lucide:trash-2"/>Eliminar</button></div></div>})}{!modules.length&&<div className="empty-inline">Aún no hay módulos. Crea uno para agrupar trabajo transversal.</div>}</div></div>}
  {tab==='tags'&&<div className="catalog-content"><div className="settings-list-head"><div><h3>Tags</h3><p>Clasificación flexible y múltiple para filtros y búsqueda.</p></div><button className="primary compact" onClick={onTagCreate}><Icon name="lucide:plus"/> Nueva tag</button></div><div className="catalog-grid">{tags.map(tag=>{const count=ticketTagLinks.filter(x=>x.tag_id===tag.id).length;return <div className="catalog-card" key={tag.id}><div className="catalog-title"><span className="color-dot" style={{background:tag.color}}></span><div><b>{tag.name}</b><p>{tag.description||tag.slug}</p></div></div><div className="catalog-metrics"><span><b>{count}</b> tickets</span><span>{tag.active?'Activa':'Inactiva'}</span></div><div className="row-actions"><button onClick={()=>onTagEdit(tag)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onTagDelete(tag)}><Icon name="lucide:trash-2"/>Eliminar</button></div></div>})}{!tags.length&&<div className="empty-inline">Sin tags configuradas.</div>}</div></div>}
  {tab==='fields'&&<div className="catalog-content"><div className="settings-list-head"><div><h3>Campos adicionales</h3><p>Campos estructurados que se solicitan en el ticket según producto.</p></div><button className="primary compact" onClick={onFieldCreate}><Icon name="lucide:plus"/> Nuevo campo</button></div><div className="entity-list">{customFields.map(f=><div className="entity-row" key={f.id}><div><b>{f.name}</b><span>{CUSTOM_FIELD_TYPE_LABELS[f.field_type]} · {f.required?'Obligatorio':'Opcional'} · {f.applies_to_all_products?'Todos los productos':'Productos seleccionados'}</span></div><div className="row-actions"><span className={`settings-status ${f.active?'on':'off'}`}>{f.active?'Activo':'Inactivo'}</span><button onClick={()=>onFieldEdit(f)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onFieldDelete(f)}><Icon name="lucide:trash-2"/>Eliminar</button></div></div>)}{!customFields.length&&<div className="empty-inline">No hay campos adicionales todavía.</div>}</div></div>}</div></div>
}

function MetricProgress({value}){const v=Math.max(0,Math.min(100,Number(value)||0));return <div className="metric-progress"><span style={{width:`${v}%`}}></span></div>}

function ReportsView({workspace,products,modules,tickets,sprints,toast}){
  const [metrics,setMetrics]=useState(null),[question,setQuestion]=useState('Dime cómo vamos al día de hoy con los 3 productos y qué se proyecta finalizar esta semana.'),[answer,setAnswer]=useState(''),[mode,setMode]=useState('chat'),[loading,setLoading]=useState(false),[provider,setProvider]=useState('')
  const load=async()=>{const {data,error}=await db.rpc('get_workspace_progress_report',{p_workspace:workspace.id,p_as_of:dateKey(new Date())});if(error)toast('error',error.message);else setMetrics(data)}
  useEffect(()=>{load()},[workspace.id,tickets.length,sprints.length])
  const ask=async(nextMode=mode,nextQuestion=question)=>{setLoading(true);try{const {data,error}=await db.functions.invoke('trobbu-ai-report',{body:{workspace_id:workspace.id,question:nextQuestion,mode:nextMode}});if(error)throw error;setAnswer(data?.content||'');setProvider(data?.provider||'deterministic');setMode(nextMode)}catch(e){toast('error',e.message||String(e))}finally{setLoading(false)}}
  const ps=metrics?.products||[],totals=metrics?.totals||{},active=metrics?.active_sprints||[],mods=metrics?.modules||[]
  return <div className="page"><PageHeader eyebrow="Inteligencia operativa" title="Reportes / TROBBU AI" subtitle="Avance determinístico, proyección de entrega y análisis ejecutivo del workspace." icon="lucide:chart-no-axes-combined" action={<button className="secondary-button" onClick={()=>window.print()}><Icon name="lucide:printer"/> Imprimir / PDF</button>}/><div className="report-layout"><section className="report-main"><div className="report-summary-grid"><div className="report-kpi"><span>Avance general</span><strong>{Number(totals.progress_percent||0).toFixed(1)}%</strong><MetricProgress value={totals.progress_percent}/></div><div className="report-kpi"><span>Tickets</span><strong>{totals.total_tickets||0}</strong><small>{totals.closed||0} cerrados · {totals.backlog||0} Backlog</small></div><div className="report-kpi warning"><span>Bloqueados</span><strong>{totals.blocked||0}</strong><small>{totals.overdue||0} vencidos</small></div><div className="report-kpi"><span>Proyección semanal</span><strong>{totals.due_this_week||0}</strong><small>entregas hasta {metrics?.week_end?formatDate(metrics.week_end):'—'}</small></div></div><div className="content-card report-products"><div className="section-heading"><div><h3>Avance por producto</h3><p>Promedio ponderado por Story Points; si un ticket no está estimado usa peso 1.</p></div></div><div className="product-report-grid">{ps.map(p=><div className="product-report-card" key={p.id}><div className="product-report-head"><div><b>{p.name}</b><span>{p.key}</span></div><strong>{Number(p.progress_percent||0).toFixed(1)}%</strong></div><MetricProgress value={p.progress_percent}/><div className="product-report-metrics"><span>{p.total_tickets} tickets</span><span>{p.total_sp} SP</span><span>{p.due_this_week} esta semana</span><span>{p.blocked} bloqueados</span></div></div>)}</div></div>{active.length>0&&<div className="content-card report-sprints"><div className="section-heading"><div><h3>Sprint y proyección de cierre</h3><p>Compromiso actual, pendientes y actividades con fecha objetivo antes del cierre.</p></div></div><div className="sprint-report-grid">{active.map(s=><div className="sprint-report-card" key={s.id}><div className="product-report-head"><div><b>{s.name}</b><span>{s.end_date?`Cierra ${formatDate(s.end_date)}`:'Sin fecha de cierre'}</span></div><strong>{Number(s.progress_percent||0).toFixed(1)}%</strong></div><MetricProgress value={s.progress_percent}/><div className="sprint-report-stats"><span><b>{s.completed||0}</b><small>Completados</small></span><span><b>{s.remaining||0}</b><small>Pendientes</small></span><span><b>{s.completed_sp||0}/{s.total_sp||0}</b><small>SP completados</small></span><span><b>{s.planned_by_sprint_end||0}</b><small>Previstos al cierre</small></span><span className={s.blocked?'danger-text':''}><b>{s.blocked||0}</b><small>Bloqueados</small></span></div></div>)}</div></div>}<div className="content-card report-modules"><div className="section-heading"><div><h3>Módulos con trabajo</h3><p>Cuánto trabajo consumió cada iniciativa agrupada.</p></div></div><div className="module-report-list">{mods.length?mods.map(m=><div key={m.id}><span className="module-chip" style={{'--module-color':m.color}}><i></i>{m.module_key} · {m.name}</span><MetricProgress value={m.progress_percent}/><b>{m.progress_percent}% · {m.total_tickets} tickets · {m.total_sp} SP</b></div>):<p className="muted">Todavía no hay módulos con tickets.</p>}</div></div></section><aside className="ai-panel content-card"><div className="ai-panel-head"><span className="ai-orb"><Icon name="lucide:sparkles"/></span><div><h3>TROBBU AI</h3><p>Pregunta por avance, sprint, entregas, riesgos o módulos.</p></div></div><div className="ai-quick"><button onClick={()=>ask('chat','Dime cómo vamos al día de hoy con los 3 productos y qué se proyecta finalizar esta semana.')}>Estado de productos</button><button onClick={()=>ask('executive','Genera un reporte ejecutivo del estado del workspace, avance por producto, sprint, bloqueos y próximos pasos.')}>Reporte ejecutivo</button><button onClick={()=>ask('infographic','Genera el contenido ejecutivo en formato breve de infografía con KPIs, productos, riesgos y entregas próximas.')}>Infografía</button></div><label>Consulta<textarea rows="5" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ej. ¿Cómo vamos con Web Administrativa y qué riesgo existe para cerrar el sprint?"/></label><button className="primary full" disabled={loading||!question.trim()} onClick={()=>ask(mode,question)}><Icon name="lucide:sparkles"/>{loading?'Analizando…':'Generar análisis'}</button>{answer&&<div className="ai-answer"><div className="ai-answer-meta"><span>{provider?.startsWith('deterministic')?'Análisis del sistema':'TROBBU AI'}</span><button type="button" className="text-button" onClick={()=>navigator.clipboard?.writeText(answer)}>Copiar</button></div><pre>{answer}</pre></div>}<div className="ai-data-note"><Icon name="lucide:shield-check"/><span>Los porcentajes y KPIs los calcula Supabase. La IA solo interpreta esos datos y no puede inventar métricas.</span></div></aside></div></div>
}


function TicketFilterModal({filters,members,sprints,modules=[],tags=[],onClose,onApply}){const [f,setF]=useState({...filters});const reset={status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'};return <Modal title="Filtros de tickets" subtitle="Combina criterios para encontrar exactamente lo que necesitas." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Responsable<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos</option>{sprints.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label><label>Tipo<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="all">Todos</option>{TYPES.map(t=><option value={t} key={t}>{TYPE_LABELS[t]}</option>)}</select></label><label>Módulo<select value={f.module||'all'} onChange={e=>setF({...f,module:e.target.value})}><option value="all">Todos</option><option value="">Sin módulo</option>{modules.map(m=><option value={m.id} key={m.id}>{m.module_key} · {m.name}</option>)}</select></label><label>Tag<select value={f.tag||'all'} onChange={e=>setF({...f,tag:e.target.value})}><option value="all">Todas</option>{tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="text-button" onClick={()=>setF(reset)}>Restablecer</button><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function PlanTicketModal({ticket,sprints,onClose,onSave}){
  const [sprintId,setSprintId]=useState(ticket.sprint_id||'')
  const available=sprints.filter(s=>s.status!=='completed'||s.id===ticket.sprint_id)
  return <Modal title={`Planificar ${ticket.ticket_key}`} subtitle="Mueve el ticket a un sprint o regresa el trabajo al Backlog." onClose={onClose} size="sm"><AsyncForm onSubmit={()=>onSave(sprintId)} submitLabel="Guardar planificación">
    <label>Destino<select value={sprintId} onChange={e=>setSprintId(e.target.value)}><option value="">Backlog · Sin sprint</option>{available.map(s=><option value={s.id} key={s.id}>{s.name} · {s.status==='active'?'Activo':'Planeado'}</option>)}</select></label>
    <div className="notice"><Icon name="lucide:list-todo"/><span>{sprintId?'El ticket quedará comprometido en el sprint seleccionado.':'El ticket quedará pendiente de planificación en Backlog.'}</span></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function SprintRolloverModal({sprint,sprints,tickets,onClose,onSave}){
  const options=sprints.filter(s=>s.id!==sprint.id&&s.status!=='completed').sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')))
  const [nextId,setNextId]=useState(options[0]?.id||'')
  const unresolved=tickets.filter(t=>t.sprint_id===sprint.id&&!['qa_passed','closed'].includes(t.status))
  return <Modal title={`Cerrar ${sprint.name}`} subtitle="Los tickets resueltos permanecen en el sprint cerrado. Decide qué hacer con los pendientes." onClose={onClose}><AsyncForm onSubmit={()=>onSave(nextId)} submitLabel="Cerrar sprint y trasladar">
    <div className="rollover-summary"><span><Icon name="lucide:circle-dashed"/></span><div><b>{unresolved.length} tickets no resueltos</b><p>Se trasladarán de forma atómica para no perder seguimiento.</p></div></div>
    <label>Destino de pendientes<select value={nextId} onChange={e=>setNextId(e.target.value)}><option value="">Regresar al Backlog</option>{options.map(s=><option key={s.id} value={s.id}>{s.name} · {s.status==='active'?'Activo':'Planeado'}</option>)}</select></label>
    {unresolved.length>0&&<div className="rollover-ticket-list">{unresolved.slice(0,8).map(t=><span key={t.id}><b>{t.ticket_key}</b>{t.title}</span>)}{unresolved.length>8&&<small>+{unresolved.length-8} tickets adicionales</small>}</div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function SprintDetailModal({workspace,sprint,tickets,products,members,session,canWork,canPlan,liveRevision=0,onClose,onTicket,onEdit,onRollover,onBacklog,onRefresh,toast}){
  const [comments,setComments]=useState([])
  const [attachments,setAttachments]=useState([])
  const [detailCounts,setDetailCounts]=useState({comments:0,attachments:0})
  const [commentModal,setCommentModal]=useState(null)
  const [productFilter,setProductFilter]=useState('all')
  const allRows=tickets.filter(t=>t.sprint_id===sprint.id)
  const sprintProductIds=[...new Set(allRows.map(t=>t.product_id).filter(Boolean))]
  const rows=allRows.filter(t=>productFilter==='all'||t.product_id===productFilter)
  const done=rows.filter(t=>['qa_passed','closed'].includes(t.status)).length
  const unresolved=rows.length-done
  const pct=rows.length?Math.round(done/rows.length*100):0
  const load=async()=>{
    const [c,e,cc,ec]=await Promise.all([
      db.from('sprint_comments').select('*').eq('sprint_id',sprint.id).order('created_at'),
      db.from('sprint_attachments').select('*').eq('sprint_id',sprint.id).order('created_at'),
      exactRelationCount('sprint_comments','sprint_id',sprint.id),
      exactRelationCount('sprint_attachments','sprint_id',sprint.id)
    ])
    if(c.error)toast('error',c.error.message);else setComments(c.data||[])
    if(e.error)toast('error',e.error.message);else setAttachments(await signedEvidenceRows(e.data||[]))
    setDetailCounts({comments:Math.max(Number(cc.count||0),(c.data||[]).length),attachments:Math.max(Number(ec.count||0),(e.data||[]).length)})
  }
  useEffect(()=>{setProductFilter('all');load()},[sprint.id,liveRevision])
  useResilientLiveRefresh(load,`sprint:${sprint.id}`,30000)
  const add=async({body,kind,files})=>{body=String(body||'').trim();if(!body&&!(files?.length))throw new Error('Escribe un comentario o adjunta al menos un archivo.');body=body||'Archivo adjunto';const {data,error}=await db.from('sprint_comments').insert({sprint_id:sprint.id,author_id:session.user.id,body,kind:kind||'comment'}).select('*').single();if(error)throw error;try{await uploadEvidenceFiles({workspaceId:workspace.id,scope:'sprints',parentId:sprint.id,commentId:data.id,files,evidenceType:kind==='comment'?'general':kind,userId:session.user.id,compress:true})}catch(err){await db.from('sprint_comments').delete().eq('id',data.id);throw err}await load();toast('success',files?.length?'Comentario y archivos del sprint agregados.':'Comentario del sprint agregado.')}
  const edit=async(comment,data)=>{const {error}=await db.from('sprint_comments').update({body:String(data.body||'').trim(),kind:data.kind||'comment'}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const removeComment=async comment=>{const {error}=await db.from('sprint_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado.')}
  const removeEvidence=async row=>{const {error:se}=await db.storage.from('jira-evidence').remove([row.storage_path]);if(se)throw se;const {error}=await db.from('sprint_attachments').delete().eq('id',row.id);if(error)throw error;await load();toast('success','Evidencia eliminada.')}
  const unlinked=attachments.filter(a=>!a.comment_id)
  return <><Modal title={sprint.name} subtitle={`${formatDate(sprint.start_date)} → ${formatDate(sprint.end_date)}`} onClose={onClose} size="xl"><div className="sprint-detail-layout"><div className="sprint-detail-main"><div className="sprint-detail-hero"><div><span className={`sprint-status ${sprint.status}`}>{sprint.status==='active'?'Activo':sprint.status==='completed'?'Completado':'Planeado'}</span><h3>{sprint.goal||'Sin objetivo definido'}</h3><p>{sprint.details||'Sin detalles adicionales.'}</p></div><div className="sprint-ring"><b>{pct}%</b><small>{done}/{rows.length} resueltos</small></div></div><div className="sprint-ticket-section"><div className="section-heading sprint-activity-heading"><div><h4>Actividades del sprint</h4><p>{unresolved} pendientes · {done} resueltas · {rows.length} de {allRows.length} actividades</p></div><label className="sprint-product-filter"><span>Producto</span><select value={productFilter} onChange={e=>setProductFilter(e.target.value)}><option value="all">Todos los productos ({allRows.length})</option>{sprintProductIds.map(id=>{const p=products.find(x=>x.id===id),count=allRows.filter(t=>t.product_id===id).length;return <option key={id} value={id}>{p?.name||'Producto'} ({count})</option>})}</select></label></div><div className="sprint-ticket-table sprint-ticket-scroll">{rows.length===0&&<div className="compact-empty"><Icon name="lucide:inbox"/><span>{productFilter==='all'?'Este sprint todavía no tiene tickets.':'No hay actividades de este producto en el sprint.'}</span></div>}{rows.map(t=>{const p=products.find(x=>x.id===t.product_id);return <div className="sprint-ticket-row" key={t.id}><button type="button" className="sprint-ticket-open" onClick={()=>onTicket(t)}><span><small>{t.ticket_key} · {p?.name||'Producto'}</small><b>{t.title}</b></span><StatusBadge status={t.status}/><time>{formatDate(t.due_date)}</time><Icon name="lucide:chevron-right"/></button>{canPlan&&sprint.status!=='completed'&&<button type="button" className="sprint-backlog-button" onClick={async()=>{try{await onBacklog(t)}catch(err){toast('error',err.message||String(err))}}} title="Mover a Backlog"><Icon name="lucide:undo-2"/><span>Backlog</span></button>}</div>})}</div></div><div className="sprint-review-section"><div className="section-heading"><div><h4>Comentarios y evidencias <em className="section-counter">{detailCounts.comments+detailCounts.attachments}</em></h4><p>Documenta revisión, rechazo, fixes y cierre del sprint.</p></div>{canWork&&<button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:paperclip"/> Agregar comentario / archivo</button>}</div><div className="comment-list sprint-comments-scroll">{comments.length===0&&unlinked.length===0&&<p className="muted">Sin comentarios ni evidencias del sprint.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario',own=c.author_id===session.user.id,files=attachments.filter(a=>a.comment_id===c.id);return <div className="comment evidence-comment" key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><div className="comment-kind-row"><b>{author}</b><EvidenceKind kind={c.kind}/></div><small>{formatDateTime(c.created_at)}</small></div>{(own||canPlan)&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c,own})}><Icon name="lucide:ellipsis"/></button>}</div><p>{c.body}</p><EvidenceGallery rows={files} session={session} canManage={canPlan} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div></div>})}{unlinked.length>0&&<EvidenceGallery rows={unlinked} session={session} canManage={canPlan} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/>}</div></div></div><aside className="sprint-detail-aside"><div className="sprint-side-stat"><span>Tickets visibles</span><b>{rows.length}<small> / {allRows.length}</small></b></div><div className="sprint-side-stat"><span>No resueltos</span><b>{unresolved}</b></div><div className="sprint-side-stat"><span>Story points</span><b>{rows.reduce((a,t)=>a+Number(t.story_points||0),0)}</b></div>{canPlan&&<><button type="button" className="secondary-button full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar sprint</button>{sprint.status!=='completed'&&<button type="button" className="primary full" onClick={onRollover}><Icon name="lucide:arrow-right-circle"/> Cerrar / trasladar</button>}</>}</aside></div></Modal>
    {commentModal?.type==='create'&&<EvidenceCommentModal title="Comentario / evidencia del sprint" initial={{body:'',kind:'review'}} allowFiles onClose={()=>setCommentModal(null)} onSave={async data=>{await add(data);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario del sprint" onClose={()=>setCommentModal(null)} actions={[...(commentModal.own?[['lucide:pencil','Editar',()=>setCommentModal({type:'edit',comment:commentModal.comment})]]:[]),['lucide:trash-2','Eliminar',()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>}
    {commentModal?.type==='edit'&&<EvidenceCommentModal title="Editar comentario" initial={{body:commentModal.comment.body,kind:commentModal.comment.kind||'comment'}} onClose={()=>setCommentModal(null)} onSave={async data=>{await edit(commentModal.comment,data);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="El comentario se eliminará; sus archivos adjuntos quedarán conservados en el historial del sprint." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await removeComment(commentModal.comment);setCommentModal(null)}}/>}
    {commentModal?.type==='delete-evidence'&&<ConfirmModal title="Eliminar evidencia" message={`Se eliminará “${commentModal.row.file_name}”.`} danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await removeEvidence(commentModal.row);setCommentModal(null)}}/>}
  </>
}

function HelpdeskModal({title,workspace,knowledgeArticles=[],locale='es',item,departments,requestTypes=[],products=[],members,vacationRequests=[],timeZone='America/Merida',session,canWork,onClose,onSave}){
  const isCreate=!item
  const [f,setF]=useState({department_id:item?.department_id||departments.find(d=>d.active)?.id||'',request_type_id:item?.request_type_id||requestTypes.find(x=>x.active)?.id||'',product_id:item?.product_id||'',subject:item?.subject||'',description:item?.description||'',requester_name:item?.requester_name||session.user.user_metadata?.full_name||'',requester_email:item?.requester_email||session.user.email||'',category:item?.category||'general',priority:item?.priority||'medium',status:normalizeHelpdeskStatus(item?.status)||'created',assigned_to:item?.assigned_to||'',source:item?.source||'portal',due_at:toLocalDateTimeInput(item?.due_at)})
  const [evidenceFiles,setEvidenceFiles]=useState([]),[evidenceError,setEvidenceError]=useState('')
  const evidenceBytes=evidenceFiles.reduce((sum,file)=>sum+Number(file.size||0),0)
  const selectEvidence=files=>{setEvidenceFiles(validateAttachmentSelection(files));setEvidenceError('')}
  const activeDepartments=departments.filter(d=>d.active||d.id===item?.department_id)
  const assignees=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).manage_helpdesk).map(m=>({...m,out_today:vacationUserIsOutToday(vacationRequests,m.user_id,timeZone)}))
  const activeRequestTypes=requestTypes.filter(x=>x.active||x.id===item?.request_type_id)
  const selectedRequestType=requestTypes.find(x=>x.id===f.request_type_id)
  const isRequirement=selectedRequestType?.code==='requirement'||(!selectedRequestType&&isProposalCategory(f.category))
  const internalMode=!isCreate&&canWork&&!isRequirement
  return <Modal title={title} subtitle={isCreate?'Registra la solicitud y, si aplica, adjunta imágenes o documentos. Las imágenes se optimizan antes de almacenarse.':isRequirement?'Revisa la propuesta; su decisión se gestiona desde Evaluar requerimiento.':'Canaliza la solicitud y actualiza su atención interna.'} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave({...f,source:isCreate?'portal':f.source,status:isCreate||isRequirement?'created':f.status,assigned_to:isCreate||isRequirement?'':f.assigned_to,due_at:isCreate||isRequirement?'':f.due_at,evidence_files:isCreate?evidenceFiles:[]})} submitLabel={item?'Guardar cambios':'Crear solicitud'}>
    <div className="form-section"><h4>Solicitud</h4><label>Asunto<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required placeholder="¿Qué necesitas o qué quieres proponer?"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>setF({...f,description:e.target.value})} required placeholder="Contexto, impacto, pasos, evidencia y resultado esperado…"/></label><KnowledgeSuggestions workspace={workspace} locale={locale} title={f.subject} description={f.description} productId={f.product_id} departmentId={f.department_id} requestTypeId={f.request_type_id} articles={knowledgeArticles}/><div className="form-grid"><label>Departamento solicitante<select value={f.department_id} onChange={e=>setF({...f,department_id:e.target.value})} required><option value="" disabled>Selecciona un departamento</option>{activeDepartments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Tipo de solicitud<select value={f.request_type_id} onChange={e=>setF({...f,request_type_id:e.target.value})} required disabled={!!item&&isProposalCategory(item.category)}><option value="" disabled>Selecciona un tipo</option>{activeRequestTypes.map(type=><option value={type.id} key={type.id}>{type.name}</option>)}</select></label><label>Producto <span className="optional">Opcional</span><select value={f.product_id} onChange={e=>setF({...f,product_id:e.target.value})}><option value="">Sin producto específico</option>{products.map(p=><option value={p.id} key={p.id}>{p.name} · {p.key}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label>{!isCreate&&canWork&&<label>Origen<select value={f.source} onChange={e=>setF({...f,source:e.target.value})}><option value="internal">Interno</option><option value="portal">Portal</option><option value="email">Correo</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option></select></label>}</div></div>
    <div className="form-section"><h4>Solicitante</h4><div className="form-grid"><label>Solicitante<input value={f.requester_name} onChange={e=>setF({...f,requester_name:e.target.value})} readOnly={isCreate}/></label><label>Correo<input type="email" value={f.requester_email} onChange={e=>setF({...f,requester_email:e.target.value})} readOnly={isCreate}/></label></div>{isCreate&&<small className="section-help">Se toma de la sesión actual para conservar la trazabilidad de quién realizó la solicitud.</small>}</div>
    {isCreate&&<div className="form-section helpdesk-create-evidence"><div className="section-heading compact-heading"><div><h4>Archivos adjuntos</h4><p>Opcional · agrega hasta 5 imágenes o documentos que ayuden a documentar el reporte.</p></div><span className="evidence-counter">{evidenceFiles.length}/5</span></div><label className="helpdesk-evidence-picker"><input type="file" accept={ATTACHMENT_ACCEPT} multiple onChange={e=>{try{selectEvidence(e.target.files)}catch(err){e.target.value='';setEvidenceFiles([]);setEvidenceError(err.message||String(err))}}}/><span className="helpdesk-evidence-picker-icon"><Icon name="lucide:paperclip" size={24}/></span><span><b>{evidenceFiles.length?'Cambiar archivos':'Seleccionar archivos'}</b><small>Imágenes hasta 15 MB y documentos hasta 25 MB · máximo 5 archivos.</small></span></label>{evidenceError&&<div className="error compact-error"><Icon name="lucide:triangle-alert"/>{evidenceError}</div>}{evidenceFiles.length>0&&<div className="helpdesk-evidence-selection">{evidenceFiles.map((file,index)=><div key={`${file.name}-${file.size}-${index}`}><span><Icon name={attachmentIcon(file)}/><b title={file.name}>{file.name}</b><small>{fileSizeLabel(file.size)}</small></span><button type="button" className="icon-button" title="Quitar archivo" onClick={()=>setEvidenceFiles(files=>files.filter((_,i)=>i!==index))}><Icon name="lucide:x"/></button></div>)}<small className="field-help">{fileSizeLabel(evidenceBytes)} seleccionados. Las imágenes se comprimen y los documentos se conservan sin alterar.</small></div>}<div className="compression-notice"><Icon name="lucide:shrink"/><div><b>Storage privado y optimización automática</b><span>La base de datos almacena solo metadatos; las imágenes se optimizan y los documentos se conservan en Storage privado mediante URL firmada.</span></div></div></div>}
    {isRequirement?<div className="requirement-notice"><Icon name="lucide:lightbulb"/><span><b>Propuesta de producto · sin SLA operativo.</b><small>PM/Admin/Superadmin decidirá posteriormente si pasa a Backlog o si se rechaza con una nota para el solicitante.</small></span></div>:internalMode?<div className="form-section internal-section"><h4>Atención interna</h4><div className="form-grid"><label>Asignado a<select value={f.assigned_to} onChange={e=>setF({...f,assigned_to:e.target.value})}><option value="">Sin asignar</option>{assignees.map(m=><option value={m.user_id} key={m.user_id} disabled={m.out_today&&m.user_id!==f.assigned_to}>{m.profile?.full_name||'Usuario'}{m.out_today?' · Fuera hoy':''}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Fecha objetivo<input type="datetime-local" value={f.due_at} onChange={e=>setF({...f,due_at:e.target.value})}/></label></div></div>:<div className="notice routing-notice"><Icon name="lucide:route"/><span><b>{isCreate?'Se enviará sin asignar para canalización.':'Canalización administrada por la mesa.'}</b><small>PM/Admin/Superadmin define responsable, estado y fecha objetivo después de revisar la solicitud.</small></span></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function HelpdeskDetailModal({workspace,item,departments,requestTypes=[],products=[],members,session,canWork,canManage,canManageHelpdesk,liveRevision=0,onClose,onEdit,onDecision,onAssign,onStatusChange,onRefresh,toast}){
  const [comments,setComments]=useState([]),[activity,setActivity]=useState([]),[attachments,setAttachments]=useState([]),[detailCounts,setDetailCounts]=useState({comments:0,activity:0,attachments:0}),[tab,setTab]=useState('comments'),[commentModal,setCommentModal]=useState(null),[workflowBusy,setWorkflowBusy]=useState(false)
  const requirement=isProposalCategory(item.category)
  const requestType=requestTypes.find(x=>x.id===item.request_type_id)
  const product=products.find(x=>x.id===item.product_id)
  const load=async()=>{const [c,a,e,cc,ac,ec]=await Promise.all([db.from('helpdesk_comments').select('*').eq('helpdesk_ticket_id',item.id).order('created_at'),db.from('helpdesk_activity').select('*').eq('helpdesk_ticket_id',item.id).order('created_at',{ascending:false}),db.from('helpdesk_attachments').select('*').eq('helpdesk_ticket_id',item.id).order('created_at'),exactRelationCount('helpdesk_comments','helpdesk_ticket_id',item.id),exactRelationCount('helpdesk_activity','helpdesk_ticket_id',item.id),exactRelationCount('helpdesk_attachments','helpdesk_ticket_id',item.id)]);if(c.error)toast('error',c.error.message);else setComments(c.data||[]);if(a.error)toast('error',a.error.message);else setActivity(a.data||[]);if(e.error)toast('error',e.error.message);else setAttachments(await signedEvidenceRows(e.data||[]));setDetailCounts({comments:Math.max(Number(cc.count||0),(c.data||[]).length),activity:Math.max(Number(ac.count||0),(a.data||[]).length),attachments:Math.max(Number(ec.count||0),(e.data||[]).length)})}
  useEffect(()=>{load()},[item.id,liveRevision])
  useResilientLiveRefresh(load,`helpdesk:${item.id}`,30000)
  const runStatus=async status=>{setWorkflowBusy(true);try{await onStatusChange?.(status);await load()}catch(err){toast('error',err.message||String(err))}finally{setWorkflowBusy(false)}}
  const addComment=async({body,files})=>{body=String(body||'').trim();if(!body&&!(files?.length))throw new Error('Escribe un comentario o adjunta al menos un archivo.');body=body||'Archivo adjunto';const {data,error}=await db.from('helpdesk_comments').insert({helpdesk_ticket_id:item.id,author_id:session.user.id,body}).select('*').single();if(error)throw error;try{await uploadEvidenceFiles({workspaceId:workspace.id,scope:'helpdesk',parentId:item.id,commentId:data.id,files,evidenceType:'general',userId:session.user.id,compress:true})}catch(err){await db.from('helpdesk_comments').delete().eq('id',data.id);throw err}await load();toast('success',files?.length?'Comentario y evidencias agregados.':'Comentario agregado.')}
  const editComment=async(comment,text)=>{const {error}=await db.from('helpdesk_comments').update({body:String(text||'').trim()}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const deleteComment=async comment=>{const {error}=await db.from('helpdesk_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado. Las evidencias se conservan en el historial.')}
  const deleteEvidence=async row=>{const {error:se}=await db.storage.from('jira-evidence').remove([row.storage_path]);if(se)throw se;const {error}=await db.from('helpdesk_attachments').delete().eq('id',row.id);if(error)throw error;await load();toast('success','Evidencia eliminada.')}
  const unlinked=attachments.filter(a=>!a.comment_id)
  const dep=departments.find(d=>d.id===item.department_id),owner=members.find(m=>m.user_id===item.assigned_to)?.profile?.full_name||'Sin asignar'
  const status=normalizeHelpdeskStatus(item.status)
  const isRequester=item.requester_user_id===session.user.id
  const isAssignee=item.assigned_to===session.user.id
  const canRedirect=isAssignee&&!requirement
  const mayAssign=(canManageHelpdesk&&!requirement)||canRedirect
  const mayEdit=canManageHelpdesk&&!requirement
  const order=['created','review','attended','closed'],current=Math.max(0,order.indexOf(status))
  const assigneeNext=isAssignee&&!canManageHelpdesk&&!requirement?(status==='created'?'review':status==='review'?'attended':null):null
  const requesterCanClose=isRequester&&!requirement&&status==='attended'
  const managerCanClose=canManageHelpdesk&&!requirement&&status==='attended'
  const activityTitle=a=>a.action==='created'?'Solicitud creada':a.action==='status_changed'?'Cambio de estado':a.action==='assigned'?'Asignación':a.action==='requirement_decision'?'Decisión del requerimiento':'Actividad'
  return <><Modal title={`${item.ticket_key} · ${item.subject}`} subtitle={`${dep?.name||'Helpdesk'} · ${requestType?.name||helpCategoryLabel(item.category)}`} onClose={onClose} size="xl"><div className="detail-grid helpdesk-detail-grid"><div className="detail-main helpdesk-detail-main">
    {requirement?<div className="requirement-detail-hero"><div><span className="eyebrow">NUEVO REQUERIMIENTO</span><h3>{requirementStatusLabel(item.proposal_status)}</h3><p>{item.proposal_status==='pending'?'Pendiente de evaluación por PM/Admin/Superadmin.':item.proposal_status==='accepted_backlog'?`Aceptado para desarrollo futuro${item.converted_ticket_key?` como ${item.converted_ticket_key}`:''}.`:'La sugerencia fue descartada y devuelta al solicitante.'}</p></div><RequirementBadge status={item.proposal_status}/>{item.decision_note&&<div className="decision-note"><b>Nota de decisión</b><p>{item.decision_note}</p></div>}</div>:<div className="helpdesk-detail-progress"><div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<current?'done':''} ${i===current?'current':''}`}><i>{i<current?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div></div>}
    <div className="detail-description"><h4>Descripción de la solicitud</h4><p>{item.description||'Sin descripción.'}</p></div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comentarios <em>{detailCounts.comments}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Seguimiento <em>{detailCounts.activity}</em></button></div>
    {tab==='comments'?<><div className="comment-list helpdesk-comments-scroll">{comments.length===0&&unlinked.length===0&&<p className="muted">Todavía no hay comentarios ni evidencias.</p>}{comments.map(c=>{const member=members.find(m=>m.user_id===c.author_id),author=c.author_name||member?.profile?.full_name||(c.author_id===session.user.id?session.user.user_metadata?.full_name||session.user.email:'Usuario'),authorEmail=c.author_email||member?.profile?.email||(c.author_id===session.user.id?session.user.email:''),own=c.author_id===session.user.id,files=attachments.filter(a=>a.comment_id===c.id);return <div className="comment evidence-comment helpdesk-comment-card" key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><b>{author}</b>{authorEmail&&<span className="comment-author-email">{authorEmail}</span>}<small>{formatDateTime(c.created_at)}</small></div>{own&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p><EvidenceGallery rows={files} session={session} canManage={canWork} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div></div>})}{unlinked.length>0&&<div className="standalone-evidence"><h4>Evidencias conservadas</h4><EvidenceGallery rows={unlinked} session={session} canManage={canWork} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div>}</div><div className="comment-create-row helpdesk-comment-create"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:paperclip"/> Agregar comentario / evidencia</button></div></>:<div className="activity-list">{activity.length===0&&<p className="muted">Sin movimientos registrados.</p>}{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{activityTitle(a)}</b><p>{a.action==='status_changed'?`${helpStatusLabel(a.from_value)} → ${helpStatusLabel(a.to_value)}`:a.action==='requirement_decision'?(a.to_value?.startsWith('accepted_backlog')?'Aceptado a Backlog':'Sugerencia rechazada'):a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{assigneeNext&&<button type="button" className="primary full" disabled={workflowBusy} onClick={()=>runStatus(assigneeNext)}><Icon name={assigneeNext==='review'?'lucide:search-check':'lucide:headset'}/>{workflowBusy?'Actualizando…':assigneeNext==='review'?'Iniciar revisión':'Marcar como Atendido'}</button>}{requesterCanClose&&<button type="button" className="primary full success-action" disabled={workflowBusy} onClick={()=>runStatus('closed')}><Icon name="lucide:badge-check"/>{workflowBusy?'Cerrando…':'Confirmar solución y cerrar'}</button>}{managerCanClose&&<button type="button" className="secondary-button full" disabled={workflowBusy} onClick={()=>runStatus('closed')}><Icon name="lucide:badge-check"/> Cerrar solicitud</button>}{mayAssign&&<button type="button" className={item.assigned_to?'secondary-button full':'primary full'} onClick={onAssign}><Icon name={item.assigned_to===session.user.id&&!canManageHelpdesk?'lucide:forward':'lucide:user-plus'}/> {item.assigned_to===session.user.id&&!canManageHelpdesk?'Redirigir solicitud':item.assigned_to?'Reasignar':'Asignar ahora'}</button>}{mayEdit&&<button type="button" className="secondary-button full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar solicitud</button>}{requirement&&canManage&&(item.proposal_status||'pending')==='pending'&&<button type="button" className="primary full" onClick={onDecision}><Icon name="lucide:gavel"/> Evaluar requerimiento</button>}<DetailRow label={requirement?'Decisión':'Estado'}>{requirement?<RequirementBadge status={item.proposal_status}/>:<HelpStatusBadge status={status}/>}</DetailRow><DetailRow label="Tipo de solicitud">{requestType?.name||helpCategoryLabel(item.category)}</DetailRow><DetailRow label="Producto">{product?.name||'—'}</DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${item.priority}`}>{PRIORITY_LABELS[item.priority]}</span></DetailRow><DetailRow label="Departamento">{dep?.name||'—'}</DetailRow>{!requirement&&<><DetailRow label="Asignado">{owner}</DetailRow><DetailRow label="Origen asignación">{item.assignment_source==='auto_ai'?'IA':item.assignment_source==='auto_rules'?'Reglas automáticas':item.assignment_source==='overflow'?'Overflow':item.assignment_source==='queue'?'Cola':item.assignment_source==='redirect'?'Redirección':'Manual'}</DetailRow>{item.assignment_reason&&<DetailRow label="Motivo asignación"><span className="routing-reason-copy">{item.assignment_reason}</span></DetailRow>}{item.assignment_source==='queue'&&<DetailRow label="Cola"><span className="assignment-queue-badge"><Icon name="lucide:clock-3" size={12}/> Esperando capacidad</span></DetailRow>}</>}<DetailRow label="Solicitante">{item.requester_name||'—'}</DetailRow><DetailRow label="Correo">{item.requester_email||'—'}</DetailRow><DetailRow label="Creado">{formatDateTime(item.created_at)}</DetailRow>{requirement?<><DetailRow label="Decisión">{formatDateTime(item.decision_at)}</DetailRow>{item.converted_ticket_key&&<DetailRow label="Ticket Backlog"><b>{item.converted_ticket_key}</b></DetailRow>}</>:<><DetailRow label="En revisión">{formatDateTime(item.reviewed_at)}</DetailRow><DetailRow label="Atendido">{formatDateTime(item.attended_at)}</DetailRow><DetailRow label="Objetivo SLA">{formatDateTime(item.due_at)}</DetailRow><DetailRow label="Cerrado">{formatDateTime(item.closed_at)}</DetailRow></>}</aside></div></Modal>
    {commentModal?.type==='create'&&<HelpdeskCommentModal title="Agregar comentario / evidencia" onClose={()=>setCommentModal(null)} onSave={async data=>{await addComment(data);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario" subtitle="Selecciona una acción" onClose={()=>setCommentModal(null)} actions={[["lucide:pencil","Editar comentario",()=>setCommentModal({type:'edit',comment:commentModal.comment})],["lucide:trash-2","Eliminar comentario",()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>}
    {commentModal?.type==='edit'&&<CommentEditModal title="Editar comentario" initial={commentModal.comment.body} onClose={()=>setCommentModal(null)} onSave={async text=>{await editComment(commentModal.comment,text);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="El texto se eliminará. Los archivos adjuntos quedarán conservados en el historial de la solicitud." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteComment(commentModal.comment);setCommentModal(null)}}/>}
    {commentModal?.type==='delete-evidence'&&<ConfirmModal title="Eliminar evidencia" message={`Se eliminará “${commentModal.row.file_name}” de forma permanente.`} danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteEvidence(commentModal.row);setCommentModal(null)}}/>}
  </>
}
function HelpdeskAssignModal({item,members,vacationRequests=[],timeZone='America/Merida',currentUserId,onClose,onSave}){
  const assignees=members.filter(m=>m.active&&!roleIsHelpdeskRequester(m.role_template)&&m.role!=='consulta').map(m=>({...m,out_today:vacationUserIsOutToday(vacationRequests,m.user_id,timeZone)}))
  const redirecting=item.assigned_to===currentUserId
  const sorted=[...assignees].sort((a,b)=>Number(Boolean(b.helpdesk_auto_assign_enabled))-Number(Boolean(a.helpdesk_auto_assign_enabled))||(a.profile?.full_name||'').localeCompare(b.profile?.full_name||''))
  const [assigneeId,setAssigneeId]=useState(item.assigned_to||sorted[0]?.user_id||'')
  const [comment,setComment]=useState('')
  return <Modal title={redirecting?`Redirigir ${item.ticket_key}`:item.assigned_to?`Reasignar ${item.ticket_key}`:`Asignar ${item.ticket_key}`} subtitle={redirecting?'Si la asignación automática no corresponde contigo, redirige la solicitud a la persona adecuada.':'Selecciona quién atenderá la solicitud. Puedes agregar contexto para el responsable.'} onClose={onClose} size="sm"><AsyncForm onSubmit={()=>{if(!assigneeId)throw new Error('Selecciona un responsable.');if(redirecting&&assigneeId===currentUserId)throw new Error('Selecciona otro responsable para redirigir la solicitud.');return onSave(assigneeId,comment.trim())}} submitLabel={redirecting?'Redirigir solicitud':item.assigned_to?'Reasignar solicitud':'Asignar ahora'}>
    <label>Responsable<select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} required><option value="" disabled>Selecciona un responsable</option>{sorted.map(m=><option value={m.user_id} key={m.user_id} disabled={m.out_today&&m.user_id!==item.assigned_to}>{m.profile?.full_name||m.profile?.email||'Usuario'}{m.helpdesk_auto_assign_enabled?' · Auto':''}{m.out_today?' · Fuera hoy':''}</option>)}</select></label>
    <label>Comentario <span className="optional">Opcional</span><textarea rows="4" value={comment} onChange={e=>setComment(e.target.value)} placeholder={redirecting?'Ej. La solicitud corresponde a integraciones / accesos / reservaciones…':'Contexto, instrucción o nota para quien atenderá la solicitud…'}/></label>
    <div className="notice"><Icon name={redirecting?'lucide:route':'lucide:bell-ring'}/><span>{redirecting?'La redirección quedará registrada en el historial. El nuevo responsable recibirá la notificación correspondiente.':'El responsable recibirá la notificación de asignación. El comentario, si lo agregas, quedará en el historial de la solicitud.'}</span></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function HelpdeskCommentModal({title,onClose,onSave}){
  const [body,setBody]=useState(''),[files,setFiles]=useState([]),[fileError,setFileError]=useState('')
  const total=files.reduce((n,f)=>n+f.size,0)
  return <Modal title={title} subtitle="Adjunta imágenes o documentos; las imágenes se optimizan antes de almacenarse." onClose={onClose} size="sm"><AsyncForm onSubmit={()=>{const clean=body.trim();if(!clean&&!files.length)throw new Error('Escribe un comentario o adjunta al menos un archivo.');return onSave({body:clean||'Archivo adjunto',files})}} submitLabel="Guardar comentario">
    <label>Comentario <span className="optional">Opcional si adjuntas archivo</span><textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} placeholder="Describe el hallazgo, seguimiento o evidencia…"/></label>
    <label>Archivos adjuntos <span className="optional">Opcional · hasta 5</span><input type="file" accept={ATTACHMENT_ACCEPT} multiple onChange={e=>{try{setFiles(validateAttachmentSelection(e.target.files));setFileError('')}catch(err){e.target.value='';setFiles([]);setFileError(err.message||String(err))}}}/>{files.length>0&&<small className="field-help">{files.length} archivo{files.length===1?'':'s'} · {fileSizeLabel(total)} total.</small>}{fileError&&<small className="field-error">{fileError}</small>}</label>
    <div className="compression-notice"><Icon name="lucide:paperclip"/><div><b>Storage privado</b><span>Las imágenes se comprimen en el navegador; PDF, CSV, Excel, Word, PowerPoint y OpenDocument se conservan intactos.</span></div></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function RequirementDecisionModal({item,products,initialDecision='accepted_backlog',onClose,onSave}){
  const [decision,setDecision]=useState(initialDecision==='rejected'?'rejected':'accepted_backlog'),[productId,setProductId]=useState((item.product_id&&products.some(p=>p.id===item.product_id)?item.product_id:'')||products[0]?.id||''),[note,setNote]=useState('')
  const accepting=decision==='accepted_backlog'
  return <Modal title={`Evaluar ${item.ticket_key}`} subtitle="Decide si el requerimiento entra al Backlog o se devuelve como sugerencia rechazada." onClose={onClose} size="md"><AsyncForm onSubmit={()=>{if(accepting&&!productId)throw new Error('Selecciona el producto.');if(!accepting&&!note.trim())throw new Error('Indica el motivo del rechazo.');return onSave(decision,productId,note.trim())}} submitLabel={accepting?'Aceptar a Backlog':'Rechazar sugerencia'} danger={!accepting}>
    <div className="decision-choice"><button type="button" className={accepting?'active accept':''} onClick={()=>setDecision('accepted_backlog')}><Icon name="lucide:list-plus"/><span><b>Aceptar a Backlog</b><small>Crear un ticket de mejora para desarrollo futuro.</small></span></button><button type="button" className={!accepting?'active reject':''} onClick={()=>setDecision('rejected')}><Icon name="lucide:circle-x"/><span><b>Sugerencia rechazada</b><small>Descartar por alcance, prioridad o porque no corresponde al proyecto.</small></span></button></div>
    {accepting&&<label>Producto destino {item.product_id&&<span className="optional">· sugerido desde Helpdesk</span>}<select value={productId} onChange={e=>setProductId(e.target.value)} required><option value="" disabled>Selecciona un producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label>{accepting?'Nota de decisión (opcional)':'Motivo del rechazo'}<textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} required={!accepting} placeholder={accepting?'Contexto para el equipo de producto…':'Explica al solicitante por qué no se incorporará…'}/></label>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function HelpFilterModal({filters,departments,requestTypes=[],products=[],members,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de Helpdesk" onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Tipo de solicitud<select value={f.requestType||'all'} onChange={e=>setF({...f,requestType:e.target.value})}><option value="all">Todos</option>{requestTypes.map(type=><option value={type.id} key={type.id}>{type.name}</option>)}</select></label><label>Área<select value={f.department} onChange={e=>setF({...f,department:e.target.value})}><option value="all">Todas</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Producto<select value={f.product||'all'} onChange={e=>setF({...f,product:e.target.value})}><option value="all">Todos</option>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Asignado<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function ProductScopeEditor({products,role,allProducts,setAllProducts,selected,setSelected,disabled=false}){
  const forced=role==='superadmin'
  const all=forced||allProducts
  const toggle=id=>setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])
  return <div className="access-section"><div className="access-section-head"><div><h4>Productos autorizados</h4><p>Define qué productos puede consultar y operar dentro de este workspace.</p></div>{forced&&<span className="readonly-chip"><Icon name="lucide:lock"/> Todos por rol</span>}</div>{!forced&&<div className="scope-choice"><button type="button" className={all?'active':''} disabled={disabled} onClick={()=>setAllProducts(true)}><Icon name="lucide:boxes"/><span><b>Todos</b><small>Incluye productos nuevos automáticamente</small></span></button><button type="button" className={!all?'active':''} disabled={disabled} onClick={()=>setAllProducts(false)}><Icon name="lucide:list-checks"/><span><b>Seleccionados</b><small>Limita el acceso a productos concretos</small></span></button></div>}{!all&&<div className="product-access-grid">{products.map(p=><label key={p.id} className={selected.includes(p.id)?'checked':''}><input type="checkbox" checked={selected.includes(p.id)} disabled={disabled} onChange={()=>toggle(p.id)}/><span><b>{p.name}</b><small>{p.key}</small></span><Icon name={selected.includes(p.id)?'lucide:circle-check':'lucide:circle'} /></label>)}</div>}</div>
}

function PermissionEditor({role,roleDef,permissions,setPermissions,disabled=false}){
  const defaults=roleDefinitionPermissions(roleDef||{base_role:role,code:role})
  const effective={...defaults,...permissions}
  const protectedRole=role==='superadmin'||roleDef?.code==='superadmin'
  const set=(key,value)=>{const next={...permissions};if(value===defaults[key])delete next[key];else next[key]=value;setPermissions(next)}
  return <div className="access-section"><div className="access-section-head"><div><h4>Permisos efectivos</h4><p>El rol define la base. Puedes ajustar excepciones por usuario.</p></div>{protectedRole&&<span className="readonly-chip"><Icon name="lucide:crown"/> Acceso total</span>}</div><div className="permission-grid">{PERMISSION_DEFS.map(([key,label,icon])=><label key={key} className={effective[key]?'on':''}><span><Icon name={icon}/><b>{label}</b></span><button type="button" className={`switch ${effective[key]?'on':''}`} disabled={disabled||protectedRole} onClick={()=>set(key,!effective[key])}><i></i></button></label>)}</div></div>
}


function WorkspaceAccessSummary({workspace}){return <div className="form-section workspace-access-summary"><h4>Workspace</h4><div className="notice"><Icon name="lucide:layers-3"/><span><b>{workspace.name}</b><small>Estos accesos aplican únicamente dentro de este espacio de trabajo.</small></span></div></div>}

function HelpdeskRoutingFields({members=[],currentUserId=null,description,setDescription,autoAssign,setAutoAssign,dailyLimit,setDailyLimit,activeLimit,setActiveLimit,overflowMode,setOverflowMode,overflowUserId,setOverflowUserId,capacity=null,disabled=false}){
  const backups=members.filter(m=>m.active&&m.user_id!==currentUserId&&!roleIsHelpdeskRequester(m.role_template)&&m.role!=='consulta')
  return <div className="form-section helpdesk-routing-config"><div className="routing-config-head"><div><h4>Perfil para asignación Helpdesk</h4><p>Esta descripción ayuda al asistente a identificar qué tipo de solicitudes atiende esta persona.</p></div><Toggle label="Elegible para autoasignación" checked={!!autoAssign} onChange={setAutoAssign} disabled={disabled}/></div><label>Descripción / nota de referencia {autoAssign?<span className="required-hint">Obligatoria para autoasignación</span>:<span className="optional">Opcional</span>}<textarea rows="4" value={description} disabled={disabled} required={!!autoAssign} minLength={autoAssign?12:undefined} onChange={e=>setDescription(e.target.value)} placeholder="Ej. Atiende accesos, contraseñas, altas de usuarios, permisos y soporte de Web Administrativa…"/><small className="field-help">Incluye sistemas, módulos, solicitudes y temas que normalmente resuelve. El asistente usa este texto como contexto.</small></label><div className="form-grid"><label>Límite diario <span className="optional">Vacío = regla del workspace</span><input type="number" min="0" max="500" value={dailyLimit} disabled={disabled} onChange={e=>setDailyLimit(e.target.value)} placeholder="4"/><small className="field-help">0 = sin límite diario.</small></label><label>Límite de tickets activos <span className="optional">Vacío = regla del workspace</span><input type="number" min="0" max="500" value={activeLimit} disabled={disabled} onChange={e=>setActiveLimit(e.target.value)} placeholder="4"/><small className="field-help">Al resolver o redirigir trabajo se libera capacidad activa.</small></label><label>Al alcanzar el límite<select value={overflowMode} disabled={disabled} onChange={e=>setOverflowMode(e.target.value)}><option value="inherit">Usar regla del workspace</option><option value="fallback">Asignar a respaldo</option><option value="next_available">Siguiente disponible</option><option value="queue">Dejar en cola</option></select></label>{overflowMode==='fallback'&&<label>Responsable de respaldo<select value={overflowUserId} disabled={disabled} onChange={e=>setOverflowUserId(e.target.value)}><option value="">Usar respaldo del workspace</option>{backups.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.profile?.email||'Usuario'}</option>)}</select></label>}</div>{capacity&&<div className={`routing-capacity-summary ${capacity.available?'ok':'full'}`}><Icon name={capacity.available?'lucide:gauge':'lucide:traffic-cone'}/><span><b>Capacidad actual</b><small>Hoy: {capacity.daily_count}/{capacity.daily_limit===0?'∞':capacity.daily_limit} asignaciones · Activos: {capacity.active_count}/{capacity.active_limit===0?'∞':capacity.active_limit}</small></span></div>}<div className="notice subtle-routing-note"><Icon name="lucide:route"/><span>Si una autoasignación no corresponde, el responsable puede usar <b>Redirigir solicitud</b> para enviarla a la persona correcta.</span></div></div>
}

function InviteModal({workspace,products,members=[],roleTemplates,isSuperadmin,onClose,onSaved}){
  const available=roleTemplates.filter(r=>r.active&&(isSuperadmin||r.code!=='superadmin'))
  const portalRole=available.find(r=>r.code==='helpdesk_requester')
  const defaultTeamRole=available.find(r=>r.code==='consulta')||available.find(r=>r.code!=='helpdesk_requester')||available[0]
  const [accessMode,setAccessMode]=useState('team')
  const [credentialMode,setCredentialMode]=useState('password'),[password,setPassword]=useState(()=>generateAccessPassword()),[showPassword,setShowPassword]=useState(false)
  const [email,setEmail]=useState(''),[name,setName]=useState(''),[roleId,setRoleId]=useState(defaultTeamRole?.id||'')
  const [allProducts,setAllProducts]=useState(true),[productIds,setProductIds]=useState(products.map(p=>p.id)),[permissions,setPermissions]=useState({})
  const [routingDescription,setRoutingDescription]=useState(''),[autoAssign,setAutoAssign]=useState(false),[dailyLimit,setDailyLimit]=useState(''),[activeLimit,setActiveLimit]=useState(''),[overflowMode,setOverflowMode]=useState('inherit'),[overflowUserId,setOverflowUserId]=useState('')
  const selectedRole=accessMode==='portal'&&portalRole?portalRole:available.find(r=>r.id===roleId)||defaultTeamRole
  const needsProducts=roleNeedsProducts(selectedRole,permissions)
  const changeMode=mode=>{setAccessMode(mode);setPermissions({});if(mode==='portal'&&portalRole){setRoleId(portalRole.id);setAllProducts(false);setProductIds([]);setAutoAssign(false)}else{setRoleId(defaultTeamRole?.id||'');setAllProducts(true);setProductIds(products.map(p=>p.id))}}
  const changeRole=value=>{setRoleId(value);setPermissions({});const next=available.find(r=>r.id===value);if(next?.code==='superadmin')setAllProducts(true)}
  return <Modal title="Agregar Staff" subtitle="Define el acceso al workspace y entrega credenciales desde el momento del alta." onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{if(!selectedRole)throw new Error('Selecciona un rol.');if(autoAssign&&accessMode==='team'&&routingDescription.trim().length<12)throw new Error('Describe con al menos 12 caracteres qué temas atiende este usuario para habilitar la autoasignación.');if(credentialMode==='password'&&password.length<10)throw new Error('La contraseña inicial debe tener al menos 10 caracteres.');if(needsProducts&&!allProducts&&selectedRole.code!=='superadmin'&&!productIds.length)throw new Error('Selecciona al menos un producto o habilita Todos.');const finalAll=needsProducts?(selectedRole.code==='superadmin'?true:allProducts):false;const finalProducts=needsProducts?productIds:[];const {data,error}=await db.functions.invoke('invite-member',{body:{email,full_name:name.trim()||null,role_id:selectedRole.id,role:selectedRole.code,workspace_id:workspace.id,redirect_to:getAppUrl(),all_products:finalAll,product_ids:finalProducts,permissions:accessMode==='portal'?{}:permissions,auth_mode:credentialMode,password:credentialMode==='password'?password:null,helpdesk_routing_description:accessMode==='team'?routingDescription.trim()||null:null,helpdesk_auto_assign_enabled:accessMode==='team'?!!autoAssign:false,helpdesk_daily_limit:dailyLimit===''?null:Number(dailyLimit),helpdesk_active_limit:activeLimit===''?null:Number(activeLimit),helpdesk_overflow_mode:overflowMode||'inherit',helpdesk_overflow_user_id:overflowUserId||null}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));await onSaved({...data,email})}} submitLabel={credentialMode==='password'?"Crear usuario y mostrar claves":"Enviar invitación"}>
    <WorkspaceAccessSummary workspace={workspace}/>
    {portalRole&&<div className="form-section"><h4>Tipo de acceso</h4><div className="staff-access-mode"><button type="button" className={accessMode==='team'?'active':''} onClick={()=>changeMode('team')}><Icon name="lucide:panels-top-left"/><span><b>Equipo de producto</b><small>Tableros, tickets, QA, sprints o administración según rol.</small></span></button><button type="button" className={accessMode==='portal'?'active portal':''} onClick={()=>changeMode('portal')}><Icon name="lucide:life-buoy"/><span><b>Portal administrativo Helpdesk</b><small>Solo crea y consulta sus solicitudes. Sin productos ni tableros.</small></span></button></div></div>}
    <div className="form-section"><h4>Colaborador</h4><div className="form-grid"><label>Nombre <span className="optional">Opcional</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label><label>Correo<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="colaborador@trobbu.com"/></label>{accessMode==='team'&&<label>Rol<select value={roleId} onChange={e=>changeRole(e.target.value)} required>{available.filter(r=>r.code!=='helpdesk_requester').map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><small className="field-help">{selectedRole?.description||ROLE_DESCRIPTIONS[selectedRole?.base_role]}</small></label>}</div></div>
    <div className="form-section credential-section"><h4>Credenciales iniciales</h4><div className="credential-mode-choice"><button type="button" className={credentialMode==='password'?'active':''} onClick={()=>setCredentialMode('password')}><Icon name="lucide:key-round"/><span><b>Crear con contraseña</b><small>Acceso inmediato y claves visibles al finalizar.</small></span></button><button type="button" className={credentialMode==='invite'?'active':''} onClick={()=>setCredentialMode('invite')}><Icon name="lucide:mail-plus"/><span><b>Enviar invitación</b><small>El usuario configura su acceso desde el correo.</small></span></button></div>{credentialMode==='password'&&<label>Contraseña inicial<div className="password-create-row"><input type={showPassword?'text':'password'} autoComplete="new-password" minLength="10" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 10 caracteres"/><button type="button" className="secondary-button compact" onClick={()=>setShowPassword(v=>!v)}><Icon name={showPassword?'lucide:eye-off':'lucide:eye'}/>{showPassword?'Ocultar':'Ver'}</button><button type="button" className="secondary-button compact" onClick={()=>{setPassword(generateAccessPassword());setShowPassword(true)}}><Icon name="lucide:refresh-cw"/>Generar</button></div></label>}</div>
    {accessMode==='team'&&<HelpdeskRoutingFields members={members} description={routingDescription} setDescription={setRoutingDescription} autoAssign={autoAssign} setAutoAssign={setAutoAssign} dailyLimit={dailyLimit} setDailyLimit={setDailyLimit} activeLimit={activeLimit} setActiveLimit={setActiveLimit} overflowMode={overflowMode} setOverflowMode={setOverflowMode} overflowUserId={overflowUserId} setOverflowUserId={setOverflowUserId}/>}
    {accessMode==='portal'?<div className="portal-access-summary"><Icon name="lucide:shield-check"/><div><b>Acceso sin productos</b><p>Podrá crear y consultar únicamente sus propias solicitudes.</p></div></div>:<>{needsProducts&&<ProductScopeEditor products={products} role={selectedRole?.code||selectedRole?.base_role} allProducts={allProducts} setAllProducts={setAllProducts} selected={productIds} setSelected={setProductIds}/>}<PermissionEditor role={selectedRole?.base_role} roleDef={selectedRole} permissions={permissions} setPermissions={setPermissions}/></>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function MemberModal({liveRevision=0,workspace,members=[],member,products,roleTemplates,session,isSuperadmin,onClose,onSave,onRemove}){
  const available=roleTemplates.filter(r=>r.active&&(isSuperadmin||r.code!=='superadmin'))
  const initialRole=roleTemplates.find(r=>r.id===member.role_id)||roleTemplates.find(r=>r.code===member.role)||available[0]
  const [roleId,setRoleId]=useState(initialRole?.id||''),[active,setActive]=useState(member.active),[allProducts,setAllProducts]=useState(member.role==='superadmin'||!!member.all_products),[productIds,setProductIds]=useState(member.product_ids||[]),[permissions,setPermissions]=useState(member.permissions||{}),[fullName,setFullName]=useState(member.profile?.full_name||''),[email,setEmail]=useState(member.profile?.email||''),[jobTitle,setJobTitle]=useState(member.profile?.job_title||''),[resetting,setResetting]=useState(false),[credentialResult,setCredentialResult]=useState(null),[credentialError,setCredentialError]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[showNewPassword,setShowNewPassword]=useState(false),[savingPassword,setSavingPassword]=useState(false),[passwordMessage,setPasswordMessage]=useState('')
  const [routingDescription,setRoutingDescription]=useState(member.helpdesk_routing_description||''),[autoAssign,setAutoAssign]=useState(!!member.helpdesk_auto_assign_enabled),[dailyLimit,setDailyLimit]=useState(member.helpdesk_daily_limit??''),[activeLimit,setActiveLimit]=useState(member.helpdesk_active_limit??''),[overflowMode,setOverflowMode]=useState(member.helpdesk_overflow_mode||'inherit'),[overflowUserId,setOverflowUserId]=useState(member.helpdesk_overflow_user_id||''),[capacity,setCapacity]=useState(null)
  const self=member.user_id===session.user.id
  const selectedRole=roleTemplates.find(r=>r.id===roleId)||initialRole
  const portal=roleIsHelpdeskRequester(selectedRole),needsProducts=roleNeedsProducts(selectedRole,permissions)
  useEffect(()=>{let live=true;db.rpc('get_helpdesk_member_capacity',{p_workspace:workspace.id,p_user:member.user_id}).then(({data})=>{if(live&&data)setCapacity(data)});return()=>{live=false}},[workspace.id,member.user_id,liveRevision])
  const changeRole=value=>{setRoleId(value);setPermissions({});const next=roleTemplates.find(r=>r.id===value);if(next?.code==='superadmin')setAllProducts(true);if(roleIsHelpdeskRequester(next)){setAllProducts(false);setProductIds([]);setAutoAssign(false)}}
  return <Modal title="Datos y accesos del colaborador" subtitle={member.profile?.full_name||'Usuario'} onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{if(!selectedRole)throw new Error('Selecciona un rol.');if(autoAssign&&!portal&&routingDescription.trim().length<12)throw new Error('Describe con al menos 12 caracteres qué temas atiende este usuario para habilitar la autoasignación.');if(needsProducts&&!allProducts&&selectedRole.code!=='superadmin'&&!productIds.length)throw new Error('Selecciona al menos un producto o habilita Todos.');if(!email.trim())throw new Error('El correo es obligatorio.');const {data,error}=await db.functions.invoke('manage-member',{body:{action:'update_profile',workspace_id:workspace.id,user_id:member.user_id,full_name:fullName,email:email,job_title:jobTitle}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));return onSave({role_id:selectedRole.id,role:selectedRole.base_role,active,all_products:needsProducts?(selectedRole.code==='superadmin'?true:allProducts):false,product_ids:needsProducts?productIds:[],permissions:selectedRole.code==='superadmin'||portal?{}:permissions,helpdesk_routing_description:routingDescription.trim()||null,helpdesk_auto_assign_enabled:portal?false:!!autoAssign,helpdesk_daily_limit:dailyLimit,helpdesk_active_limit:activeLimit,helpdesk_overflow_mode:overflowMode,helpdesk_overflow_user_id:overflowUserId||null})}} submitLabel="Guardar datos y accesos">
    <WorkspaceAccessSummary workspace={workspace}/>
    <div className="form-section"><h4>Datos del usuario</h4><div className="form-grid"><label>Nombre<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nombre y apellido"/></label><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@trobbu.com"/></label><label>Puesto <span className="optional">Opcional</span><input value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="Ej. Desarrollador Frontend"/></label></div><div className="member-credential-tools"><div><b>Acceso a la plataforma</b><small>Por seguridad la contraseña actual no puede recuperarse. Puedes generar una nueva contraseña temporal para compartirla.</small></div><button type="button" className="secondary-button" disabled={resetting} onClick={async()=>{setCredentialError('');setResetting(true);try{const {data,error}=await db.functions.invoke('manage-member',{body:{action:'reset_credentials',workspace_id:workspace.id,user_id:member.user_id,email}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));setCredentialResult(data)}catch(err){setCredentialError(err.message||String(err))}finally{setResetting(false)}}}><Icon name="lucide:key-round"/>{resetting?'Generando…':'Regenerar y copiar acceso'}</button></div>{credentialError&&<div className="error"><Icon name="lucide:triangle-alert"/>{credentialError}</div>}{credentialResult&&<InlineCredentials credentials={credentialResult} onClose={()=>setCredentialResult(null)}/>}<div className="member-password-editor"><div className="member-password-copy"><b>Asignar una contraseña nueva</b><small>Úsalo cuando el usuario no pueda recuperar su acceso. La contraseña se actualiza desde la función segura de administración, nunca desde el navegador con una service key.</small></div><div className="password-reset-grid"><label>Nueva contraseña<div className="password-create-row"><input type={showNewPassword?'text':'password'} autoComplete="new-password" value={newPassword} minLength="10" onChange={e=>{setNewPassword(e.target.value);setPasswordMessage('')}} placeholder="Mínimo 10 caracteres"/><button type="button" className="secondary-button compact" onClick={()=>setShowNewPassword(v=>!v)}><Icon name={showNewPassword?'lucide:eye-off':'lucide:eye'}/>{showNewPassword?'Ocultar':'Ver'}</button><button type="button" className="secondary-button compact" onClick={()=>{const next=generateAccessPassword();setNewPassword(next);setConfirmPassword(next);setShowNewPassword(true)}}><Icon name="lucide:refresh-cw"/>Generar</button></div></label><label>Confirmar contraseña<input type={showNewPassword?'text':'password'} autoComplete="new-password" value={confirmPassword} minLength="10" onChange={e=>{setConfirmPassword(e.target.value);setPasswordMessage('')}} placeholder="Repite la nueva contraseña"/></label></div><button type="button" className="secondary-button" disabled={savingPassword||!newPassword||!confirmPassword} onClick={async()=>{setCredentialError('');setPasswordMessage('');if(newPassword.length<10){setCredentialError('La nueva contraseña debe tener al menos 10 caracteres.');return}if(newPassword!==confirmPassword){setCredentialError('Las contraseñas no coinciden.');return}setSavingPassword(true);try{const {data,error}=await db.functions.invoke('manage-member',{body:{action:'set_password',workspace_id:workspace.id,user_id:member.user_id,email,new_password:newPassword}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));setNewPassword('');setConfirmPassword('');setPasswordMessage('Contraseña actualizada correctamente. Ya puedes proporcionar la nueva clave al usuario.')}catch(err){setCredentialError(err.message||String(err))}finally{setSavingPassword(false)}}}><Icon name="lucide:shield-check"/>{savingPassword?'Actualizando…':'Actualizar contraseña'}</button>{passwordMessage&&<div className="success-inline"><Icon name="lucide:circle-check"/>{passwordMessage}</div>}</div></div>
    <div className="form-section"><h4>Rol y estado</h4><div className="form-grid"><label>Rol<select value={roleId} onChange={e=>changeRole(e.target.value)} disabled={self&&member.role==='superadmin'}>{available.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><small className="field-help">{selectedRole?.description||ROLE_DESCRIPTIONS[selectedRole?.base_role]}</small></label><div><Toggle label="Acceso activo" checked={active} onChange={setActive} disabled={self}/></div></div>{self&&member.role==='superadmin'&&<div className="notice"><Icon name="lucide:crown"/><span>Tu Superadmin conserva siempre acceso total.</span></div>}</div>
    {!portal&&<HelpdeskRoutingFields members={members} currentUserId={member.user_id} description={routingDescription} setDescription={setRoutingDescription} autoAssign={autoAssign} setAutoAssign={setAutoAssign} dailyLimit={dailyLimit} setDailyLimit={setDailyLimit} activeLimit={activeLimit} setActiveLimit={setActiveLimit} overflowMode={overflowMode} setOverflowMode={setOverflowMode} overflowUserId={overflowUserId} setOverflowUserId={setOverflowUserId} capacity={capacity}/>}
    {portal?<div className="portal-access-summary"><Icon name="lucide:life-buoy"/><div><b>Portal administrativo Helpdesk</b><p>Este colaborador no recibe autoasignaciones y solo verá sus propias solicitudes.</p></div></div>:<>{needsProducts&&<ProductScopeEditor products={products} role={selectedRole?.code||selectedRole?.base_role} allProducts={allProducts} setAllProducts={setAllProducts} selected={productIds} setSelected={setProductIds} disabled={self&&member.role==='superadmin'}/>}<PermissionEditor role={selectedRole?.base_role} roleDef={selectedRole} permissions={permissions} setPermissions={setPermissions} disabled={self&&member.role==='superadmin'}/></>}
    <div className="modal-secondary">{!self&&<button type="button" className="danger-text-button" onClick={onRemove}><Icon name="lucide:user-minus"/> Retirar del workspace</button>}<button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function TemporaryCredentialsModal({credentials,onClose}){
  const [copied,setCopied]=useState(false)
  const platformUrl='https://jiratrobbu.vercel.app/'
  const passwordLabel=credentials.credential_mode==='password'?'Contraseña inicial':'Contraseña temporal'
  const copy=async()=>{await navigator.clipboard.writeText(`Jira Interno TROBBU\nPlataforma: ${platformUrl}\nCorreo: ${credentials.email}\n${passwordLabel}: ${credentials.temporary_password}`);setCopied(true);setTimeout(()=>setCopied(false),1600)}
  return <Modal title="Usuario creado" subtitle={credentials.credential_mode==='password'?'Acceso creado correctamente. Comparte estas claves de forma segura.':'La invitación no pudo enviarse y se generó un acceso temporal de respaldo.'} onClose={onClose} size="sm"><div className="credential-card"><span><small>Plataforma</small><a className="credential-platform-link" href={platformUrl} target="_blank" rel="noreferrer">{platformUrl}</a></span><span><small>Correo</small><b>{credentials.email}</b></span><span><small>{passwordLabel}</small><code>{credentials.temporary_password}</code></span><div className="notice"><Icon name="lucide:shield-alert"/><span>Al copiar se incluyen enlace, correo y contraseña. Compártelos de forma segura y pide al colaborador cambiar su contraseña después de iniciar sesión.</span></div></div><div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cerrar</button></div><div className="modal-actions"><button type="button" className="primary" onClick={copy}><Icon name={copied?'lucide:check':'lucide:copy'}/>{copied?'Copiado':'Copiar credenciales + enlace'}</button></div></div></Modal>
}

function RoleModal({workspace,initial,roleTemplates,onClose,onSave}){
  const system=!!initial?.is_system
  const protectedRole=!!initial?.protected
  const [name,setName]=useState(initial?.name||'')
  const [description,setDescription]=useState(initial?.description||'')
  const [baseRole,setBaseRole]=useState(initial?.base_role||'consulta')
  const initialPerms=initial?roleDefinitionPermissions(initial):{...ROLE_DEFAULTS.consulta}
  const [permissions,setPermissions]=useState(initialPerms)
  const [active,setActive]=useState(initial?.active??true)
  const setPerm=(key,value)=>setPermissions(p=>({...p,[key]:value}))
  return <Modal title={initial?'Editar rol':'Nuevo rol'} subtitle={`Rol disponible únicamente dentro de ${workspace.name}.`} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(protectedRole)throw new Error('Superadmin es un rol protegido.');const code=initial?.code||slugify(name).replace(/-/g,'_').slice(0,40);if(!name.trim())throw new Error('El nombre es obligatorio.');if(!code)throw new Error('No se pudo generar una clave válida para el rol.');if(!initial&&roleTemplates.some(r=>r.code===code))throw new Error('Ya existe un rol con una clave equivalente.');const base=ROLE_DEFAULTS[baseRole]||ROLE_DEFAULTS.consulta;const overrides={};PERMISSION_DEFS.forEach(([k])=>{if(permissions[k]!==base[k])overrides[k]=!!permissions[k]});return onSave({name:name.trim(),description:description.trim()||null,code,base_role:baseRole,permissions:overrides,active})}} submitLabel={initial?'Guardar rol':'Crear rol'}>
    <WorkspaceAccessSummary workspace={workspace}/>
    <div className="form-section"><h4>Definición</h4><div className="form-grid"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required disabled={protectedRole}/></label><label>Base<select value={baseRole} onChange={e=>{const v=e.target.value;setBaseRole(v);setPermissions({...ROLE_DEFAULTS[v]})}} disabled={system||protectedRole}><option value="consulta">Consulta</option><option value="dev">Dev</option><option value="qa">QA</option><option value="pm">PM</option><option value="admin">Admin</option></select></label></div><label>Descripción<textarea rows="3" value={description} onChange={e=>setDescription(e.target.value)} disabled={protectedRole}/></label><Toggle label="Rol activo" checked={active} onChange={setActive} disabled={protectedRole}/></div>
    <div className="access-section"><div className="access-section-head"><div><h4>Permisos del rol</h4><p>Estos permisos serán la base para todos los colaboradores que utilicen este rol.</p></div></div><div className="permission-grid">{PERMISSION_DEFS.map(([key,label,icon])=><label key={key} className={permissions[key]?'on':''}><span><Icon name={icon}/><b>{label}</b></span><button type="button" className={`switch ${permissions[key]?'on':''}`} disabled={protectedRole} onClick={()=>setPerm(key,!permissions[key])}><i></i></button></label>)}</div></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function ProductModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',key:initial?.key||'',description:initial?.description||''});return <Modal title={title} onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,key:f.key.trim().toUpperCase()})} submitLabel="Guardar producto"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></label><label>Clave<input value={f.key} onChange={e=>setF({...f,key:e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,6)})} required placeholder="WEB"/></label><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function SprintModal({title,initial,onClose,onSave}){
  const [f,setF]=useState({name:initial?.name||'',goal:initial?.goal||'',details:initial?.details||'',start_date:initial?.start_date||'',end_date:initial?.end_date||'',status:initial?.status||'planned'})
  return <Modal title={title} subtitle="Define objetivo, alcance y ventana de trabajo del sprint." onClose={onClose}><AsyncForm onSubmit={()=>onSave(f)} submitLabel="Guardar sprint">
    <label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Sprint 14 · Noviembre"/></label>
    <label>Objetivo<textarea rows="3" value={f.goal} onChange={e=>setF({...f,goal:e.target.value})} placeholder="Resultado que debe lograr el ciclo."/></label>
    <label>Detalles y criterios<textarea rows="5" value={f.details} onChange={e=>setF({...f,details:e.target.value})} placeholder="Alcance, dependencias, criterios de salida, notas de planeación…"/></label>
    <div className="form-grid"><label>Inicio<input type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})}/></label><label>Fin<input type="date" min={f.start_date||undefined} value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})}/></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="planned">Planeado</option><option value="active">Activo</option><option value="completed">Completado</option></select></label></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function RequestTypeModal({title,initial,requestTypes=[],onClose,onSave}){
  const [f,setF]=useState({name:initial?.name||'',code:initial?.code||'',description:initial?.description||'',color:initial?.color||'#0D47A1',icon:initial?.icon||'lucide:ticket',sort_order:initial?.sort_order??100,active:initial?.active??true})
  const updateName=value=>setF(prev=>({...prev,name:value,code:initial?prev.code:slugify(value).replace(/-/g,'_').slice(0,40)}))
  return <Modal title={title} subtitle="Define una clasificación reutilizable para solicitudes y reportes de Helpdesk." onClose={onClose} size="md"><AsyncForm onSubmit={()=>{const name=f.name.trim(),code=f.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40);if(!name)throw new Error('El nombre es obligatorio.');if(code.length<2)throw new Error('El código debe tener al menos 2 caracteres.');if(requestTypes.some(x=>x.id!==initial?.id&&importNorm(x.name)===importNorm(name)))throw new Error('Ya existe un tipo con ese nombre.');if(requestTypes.some(x=>x.id!==initial?.id&&x.code===code))throw new Error('Ya existe un tipo con ese código.');return onSave({...f,name,code,description:f.description.trim()||null,sort_order:Number(f.sort_order)||100})}} submitLabel="Guardar tipo"><div className="form-grid"><label>Nombre<input value={f.name} onChange={e=>updateName(e.target.value)} required placeholder="Ej. Soporte técnico"/></label><label>Código<input value={f.code} onChange={e=>setF({...f,code:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40)})} required placeholder="soporte_tecnico"/></label><label>Icono Iconify<input value={f.icon} onChange={e=>setF({...f,icon:e.target.value})} placeholder="lucide:headphones"/></label><label>Color<input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></label><label>Orden<input type="number" min="1" max="9999" value={f.sort_order} onChange={e=>setF({...f,sort_order:e.target.value})}/></label></div><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Cuándo debe utilizarse este tipo de solicitud."/></label><Toggle label="Tipo activo" checked={!!f.active} onChange={v=>setF({...f,active:v})}/><div className="request-type-preview"><span className="request-type-icon" style={{background:`${f.color}18`,color:f.color}}><Icon name={f.icon||'lucide:ticket'}/></span><span><b>{f.name||'Vista previa'}</b><small>{f.code||'codigo_tipo'}</small></span></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>
}

function DepartmentModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',color:initial?.color||'#0D47A1',active:initial?.active??true});return <Modal title={title} subtitle="Configura cómo se clasifica el origen de las solicitudes de Helpdesk." onClose={onClose}><AsyncForm onSubmit={()=>onSave(f)} submitLabel="Guardar área"><label>Nombre del área<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Recursos Humanos"/></label><label>Color<input type="color" value={f.color||'#0D47A1'} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Área activa" checked={!!f.active} onChange={v=>setF({...f,active:v})}/><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function CommentEditModal({title,initial,onClose,onSave}){const [body,setBody]=useState(initial||'');return <Modal title={title} subtitle="Actualiza el contenido sin perder el contexto del ticket." onClose={onClose} size="sm"><AsyncForm onSubmit={()=>onSave(body)} submitLabel="Guardar comentario"><label>Comentario<textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} required/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}


ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
