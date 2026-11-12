import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const PLATFORM_URL = "https://jiratrobbu.vercel.app/";

type Locale = "es" | "en";
type QueueRow = {
  id: number;
  event_type: string;
  category?: string | null;
  recipient_user_id: string | null;
  recipient_email: string | null;
  payload: Record<string, any> | null;
  ticket_id: string | null;
  attempts: number;
};

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] || c));

function statusLabel(value: unknown, locale: Locale) {
  const v = String(value ?? "");
  const es: Record<string,string> = {backlog:"Backlog",todo:"Por hacer",in_progress:"En curso",dev_done:"Dev terminado",qa_review:"Revisión QA",qa_rejected:"QA rechazado",qa_passed:"QA aprobado",closed:"Cerrado",created:"Creado",review:"En revisión",attended:"Atendido",active:"Activo",planned:"Planeado",completed:"Completado"};
  const en: Record<string,string> = {backlog:"Backlog",todo:"To do",in_progress:"In progress",dev_done:"Dev done",qa_review:"QA review",qa_rejected:"QA rejected",qa_passed:"QA approved",closed:"Closed",created:"Created",review:"In review",attended:"Attended",active:"Active",planned:"Planned",completed:"Completed"};
  return (locale === "en" ? en : es)[v] || v;
}

function eventCopy(eventType: string, payload: Record<string, any> | null, locale: Locale) {
  const p = payload || {};
  const m = p.metadata || {};
  const en = locale === "en";
  const key = m.ticket_key || m.helpdesk_key || "";
  const title = m.ticket_title || m.subject || m.sprint_name || m.article_title || p.title || "Jira Interno";
  const fromStatus = statusLabel(m.from_status, locale);
  const toStatus = statusLabel(m.to_status, locale);
  const version = m.version_number ? `v${m.version_number}` : "";
  const fallback = { title: String(p.title || eventType), body: String(p.body || "") };

  const copies: Record<string,{title:string;body:string}> = {
    ticket_created: en ? {title:`New ticket ${key}`,body:String(title)} : {title:`Nuevo ticket ${key}`,body:String(title)},
    assigned_dev: en ? {title:`${key} assigned to Development`,body:String(title)} : {title:`${key} asignado a Desarrollo`,body:String(title)},
    assigned_qa: en ? {title:`${key} assigned to QA`,body:String(title)} : {title:`${key} asignado a QA`,body:String(title)},
    ticket_status: en ? {title:`${key} updated`,body:`Status changed from ${fromStatus} to ${toStatus}.`} : {title:`${key} actualizado`,body:`El estado cambió de ${fromStatus} a ${toStatus}.`},
    qa_rejected: en ? {title:`${key} returned by QA`,body:"Corrections are required before the next QA review."} : {title:`${key} regresado por QA`,body:"Requiere correcciones antes de volver a revisión."},
    qa_passed: en ? {title:`${key} approved by QA`,body:"The QA review was approved."} : {title:`${key} aprobado por QA`,body:"La revisión QA fue aprobada."},
    ticket_closed: en ? {title:`${key} closed`,body:"The ticket was completely closed."} : {title:`${key} cerrado`,body:"El ticket fue cerrado completamente."},
    ticket_comment: en ? {title:`${key} · new comment`,body:String(m.comment_preview || p.body || "A new comment was added.")} : {title:`${key} · nuevo comentario`,body:String(m.comment_preview || p.body || "Se agregó un nuevo comentario.")},
    ticket_evidence: en ? {title:`${key} · new evidence`,body:String(m.file_name || "New evidence was attached.")} : {title:`${key} · nueva evidencia`,body:String(m.file_name || "Se agregó nueva evidencia.")},
    ticket_sprint: en ? {title:`${key} · sprint updated`,body:m.sprint_id ? `Moved to ${m.sprint_name || "sprint"}.` : `Moved back to Backlog from ${m.old_sprint_name || "sprint"}.`} : {title:`${key} · sprint actualizado`,body:m.sprint_id ? `Movido a ${m.sprint_name || "sprint"}.` : `Regresó a Backlog desde ${m.old_sprint_name || "sprint"}.`},
    helpdesk_created: en ? {title:`Request created ${key}`,body:String(title)} : {title:`Solicitud creada ${key}`,body:String(title)},
    helpdesk_new: en ? {title:`New Helpdesk request ${key}`,body:String(title)} : {title:`Nueva solicitud Helpdesk ${key}`,body:String(title)},
    helpdesk_status: en ? {title:`${key} updated`,body:`Request status changed to ${toStatus}.`} : {title:`${key} actualizado`,body:`El estado de la solicitud cambió a ${toStatus}.`},
    helpdesk_assigned: en ? {title:`${key} assigned to you`,body:String(title)} : {title:`${key} asignado`,body:String(title)},
    helpdesk_comment: en ? {title:`${key} · new comment`,body:String(m.comment_preview || p.body || "A new comment was added.")} : {title:`${key} · nuevo comentario`,body:String(m.comment_preview || p.body || "Se agregó un nuevo comentario.")},
    helpdesk_evidence: en ? {title:`${key} · new evidence`,body:String(m.file_name || "New evidence was attached.")} : {title:`${key} · nueva evidencia`,body:String(m.file_name || "Se agregó nueva evidencia.")},
    helpdesk_requirement_decision: en ? {title:`${key} · requirement decision`,body:m.decision === "accepted_backlog" ? `Accepted into Backlog as ${m.converted_ticket_key || "a ticket"}.` : `The proposal was rejected. ${m.note || ""}`} : {title:`${key} · decisión de requerimiento`,body:m.decision === "accepted_backlog" ? `Aceptado a Backlog como ${m.converted_ticket_key || "ticket"}.` : `La propuesta fue rechazada. ${m.note || ""}`},
    sprint_created: en ? {title:`New sprint · ${m.sprint_name || title}`,body:"A new sprint was created."} : {title:`Nuevo sprint · ${m.sprint_name || title}`,body:"Se creó un nuevo sprint."},
    sprint_updated: en ? {title:`${m.sprint_name || title} updated`,body:m.status ? `Sprint status: ${statusLabel(m.status,locale)}.` : "Sprint planning was updated."} : {title:`${m.sprint_name || title} actualizado`,body:m.status ? `Estado del sprint: ${statusLabel(m.status,locale)}.` : "Se actualizó la planeación del sprint."},
    sprint_comment: en ? {title:`${m.sprint_name || title} · new comment`,body:String(m.comment_preview || p.body || "A new sprint comment was added.")} : {title:`${m.sprint_name || title} · nuevo comentario`,body:String(m.comment_preview || p.body || "Se agregó un comentario al sprint.")},
    sprint_evidence: en ? {title:`${m.sprint_name || title} · new evidence`,body:String(m.file_name || "New sprint evidence was attached.")} : {title:`${m.sprint_name || title} · nueva evidencia`,body:String(m.file_name || "Se agregó evidencia al sprint.")},
    knowledge_draft: en ? {title:`New Knowledge draft · ${m.article_title || title}`,body:`${version} · ${p.body || "A new draft version was created."}`} : {title:`Nuevo borrador Knowledge · ${m.article_title || title}`,body:`${version} · ${p.body || "Se creó una nueva versión en borrador."}`},
    knowledge_published: en ? {title:`New article published · ${m.article_title || title}`,body:`${version} is now the active public version.`} : {title:`Nuevo artículo publicado · ${m.article_title || title}`,body:`${version} ahora es la versión pública activa.`},
    knowledge_restored: en ? {title:`Article version restored · ${m.article_title || title}`,body:`${version} is public again.`} : {title:`Versión de artículo restaurada · ${m.article_title || title}`,body:`${version} vuelve a ser pública.`},
    member_added: en ? {title:"Workspace access enabled",body:`You were added with role ${m.role || "member"}.`} : {title:"Acceso al workspace habilitado",body:`Fuiste agregado con rol ${m.role || "miembro"}.`},
    member_access_updated: en ? {title:"Your access was updated",body:m.active === false ? "Your workspace access was disabled." : "Your role, permissions, or product scope was updated."} : {title:"Tus accesos fueron actualizados",body:m.active === false ? "Tu acceso al workspace fue desactivado." : "Tu rol, permisos o alcance de productos fue actualizado."},
  };
  return copies[eventType] || fallback;
}

function resourceUrl(row: QueueRow) {
  const m = row.payload?.metadata || {};
  if (m.entity_type === "knowledge" && (m.article_id || m.entity_id)) return `${PLATFORM_URL}?knowledge=${encodeURIComponent(String(m.article_id || m.entity_id))}`;
  if (m.entity_type === "helpdesk" && (m.entity_id || row.payload?.helpdesk_ticket_id)) return `${PLATFORM_URL}?helpdesk=${encodeURIComponent(String(m.entity_id || row.payload?.helpdesk_ticket_id))}`;
  if (m.entity_type === "sprint" && m.entity_id) return `${PLATFORM_URL}?sprint=${encodeURIComponent(String(m.entity_id))}`;
  if (m.entity_type === "ticket" && (m.entity_id || row.ticket_id)) return `${PLATFORM_URL}?ticket=${encodeURIComponent(String(m.entity_id || row.ticket_id))}`;
  if (m.entity_type === "staff") return `${PLATFORM_URL}?view=team`;
  return PLATFORM_URL;
}

function emailHtml(row: QueueRow, locale: Locale, copy: {title:string;body:string}) {
  const en = locale === "en";
  const m = row.payload?.metadata || {};
  const category = String(row.category || m.category || "system");
  const categoryLabels: Record<string,[string,string]> = {
    tickets:["Tickets","Tickets"],helpdesk:["Helpdesk","Helpdesk"],sprints:["Sprints","Sprints"],knowledge:["Knowledge","Knowledge"],staff:["Staff","Staff"],system:["Sistema","System"]
  };
  const categoryLabel=(categoryLabels[category]||categoryLabels.system)[en?1:0];
  const cta = en ? "Open in Jira Interno" : "Abrir en Jira Interno";
  const footer = en ? "This notification was generated by Jira Interno TROBBU." : "Esta notificación fue generada por Jira Interno TROBBU.";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#172B4D;background:#F6F7F8;padding:28px;margin:0"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #D4DCE0;border-radius:14px;overflow:hidden"><div style="padding:22px 28px;border-bottom:1px solid #E6E9EE"><div style="font-size:11px;font-weight:800;color:#4D5A51;letter-spacing:.09em">TROBBU · JIRA INTERNO · ${esc(categoryLabel).toUpperCase()}</div><h2 style="margin:10px 0 0;font-size:22px;line-height:1.3">${esc(copy.title)}</h2></div><div style="padding:26px 28px"><p style="font-size:15px;line-height:1.6;color:#42526E;margin:0 0 22px">${esc(copy.body)}</p><a href="${esc(resourceUrl(row))}" style="display:inline-block;background:#0C66E4;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px">${esc(cta)}</a></div><div style="padding:16px 28px;background:#FAFBFC;color:#6B778C;font-size:11px">${esc(footer)}</div></div></body></html>`;
}

async function sendWithResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
  if (!response.ok) throw new Error(`Resend: ${await response.text()}`);
}
async function sendWithMailgun(apiKey:string,domain:string,baseUrl:string,from:string,to:string,subject:string,html:string){const form=new FormData();form.set("from",from);form.set("to",to);form.set("subject",subject);form.set("html",html);const response=await fetch(`${baseUrl.replace(/\/$/,"")}/v3/${domain}/messages`,{method:"POST",headers:{"Authorization":`Basic ${btoa(`api:${apiKey}`)}`},body:form});if(!response.ok)throw new Error(`Mailgun: ${await response.text()}`)}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")??"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
    const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await admin.auth.getUser(token);if(userError||!userData.user)throw new Error("Invalid session");
    const {workspace_id,status_only=false}=await req.json();if(!workspace_id)throw new Error("workspace_id is required");
    const {data:membership}=await admin.from("workspace_members").select("role,active").eq("workspace_id",workspace_id).eq("user_id",userData.user.id).maybeSingle();
    if(!membership?.active)return new Response(JSON.stringify({error:"Forbidden"}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
    const {data:settings}=await admin.from("workspace_settings").select("email_notifications").eq("workspace_id",workspace_id).maybeSingle();
    const resendKey=Deno.env.get("RESEND_API_KEY"),mailgunKey=Deno.env.get("MAILGUN_API_KEY"),mailgunDomain=Deno.env.get("MAILGUN_DOMAIN"),mailgunBaseUrl=Deno.env.get("MAILGUN_BASE_URL")??"https://api.mailgun.net";
    const emailFrom=Deno.env.get("EMAIL_FROM")??(mailgunDomain?`Jira Interno TROBBU <jira@${mailgunDomain}>`:"");
    const provider=resendKey?"resend":(mailgunKey&&mailgunDomain?"mailgun":null);
    if(status_only)return new Response(JSON.stringify({ok:true,configured:Boolean(provider&&emailFrom),provider,email_notifications:settings?.email_notifications!==false}),{headers:{...cors,"Content-Type":"application/json"}});
    if(settings&&settings.email_notifications===false)return new Response(JSON.stringify({ok:true,skipped:true,reason:"email_notifications_disabled",configured:Boolean(provider&&emailFrom),provider}),{headers:{...cors,"Content-Type":"application/json"}});

    const {data:rows,error:rowsError}=await admin.from("notification_outbox").select("id,event_type,category,recipient_user_id,recipient_email,payload,ticket_id,attempts,status").eq("workspace_id",workspace_id).in("status",["pending","failed"]).lt("attempts",3).order("created_at",{ascending:true}).limit(50);
    if(rowsError)throw rowsError;
    if(!provider||!emailFrom)return new Response(JSON.stringify({ok:false,configured:false,provider:null,pending:rows?.length??0,required:["RESEND_API_KEY + EMAIL_FROM","or MAILGUN_API_KEY + MAILGUN_DOMAIN (+ optional EMAIL_FROM)"]}),{headers:{...cors,"Content-Type":"application/json"}});

    let sent=0,failed=0;
    for(const raw of rows??[]){const row=raw as QueueRow;const attempt=Number(row.attempts??0)+1;await admin.from("notification_outbox").update({status:"processing",attempts:attempt}).eq("id",row.id);
      try{
        let recipient=row.recipient_email;let locale:Locale="es";
        if(row.recipient_user_id){const [{data:profile},{data:recipientData}]=await Promise.all([admin.from("profiles").select("locale,email").eq("id",row.recipient_user_id).maybeSingle(),admin.auth.admin.getUserById(row.recipient_user_id)]);locale=profile?.locale==="en"?"en":"es";recipient=recipient||profile?.email||recipientData.user?.email||null;}
        if(!recipient)throw new Error("Recipient email not found");
        const copy=eventCopy(row.event_type,row.payload,locale);const subject=`[Jira Interno] ${copy.title}`;const html=emailHtml(row,locale,copy);
        if(provider==="resend")await sendWithResend(resendKey!,emailFrom,recipient,subject,html);else await sendWithMailgun(mailgunKey!,mailgunDomain!,mailgunBaseUrl,emailFrom,recipient,subject,html);
        await admin.from("notification_outbox").update({status:"sent",sent_at:new Date().toISOString(),last_error:null}).eq("id",row.id);sent++;
      }catch(error){await admin.from("notification_outbox").update({status:"failed",last_error:error instanceof Error?error.message:"Unknown error"}).eq("id",row.id);failed++;}
    }
    return new Response(JSON.stringify({ok:true,configured:true,provider,sent,failed}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:"Unknown error"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
