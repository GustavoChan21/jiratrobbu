import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};
const PERMISSIONS=["view_dashboard","view_tickets","create_tickets","edit_tickets","delete_tickets","manage_sprints","qa_review","manage_helpdesk","manage_staff","manage_products","manage_ticket_fields","manage_settings","view_knowledge","create_knowledge","edit_knowledge","delete_knowledge","view_vacations","request_vacations","manage_vacations"];
function defaults(role:string){
  if(role==="superadmin"||role==="admin")return Object.fromEntries(PERMISSIONS.map(k=>[k,true]));
  if(role==="pm")return {view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:true,manage_sprints:true,qa_review:true,manage_helpdesk:true,manage_ticket_fields:true,view_knowledge:true,create_knowledge:true,edit_knowledge:true,view_vacations:true,request_vacations:true,manage_vacations:true};
  if(role==="dev")return {view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,view_knowledge:true,view_vacations:true,request_vacations:true};
  if(role==="qa")return {view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,qa_review:true,view_knowledge:true,view_vacations:true,request_vacations:true};
  return {view_dashboard:true,view_tickets:true,view_knowledge:true,view_vacations:true};
}
function hasPermission(member:any,role:any,key:string){
  if(member?.role==="superadmin"||role?.code==="superadmin")return true;
  if(typeof member?.permissions?.[key]==="boolean")return member.permissions[key];
  if(typeof role?.permissions?.[key]==="boolean")return role.permissions[key];
  return Boolean((defaults(role?.base_role||member?.role||"consulta") as any)[key]);
}
function extractText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")return c.text;return ""}
function safeJson(text:string){try{return JSON.parse(text)}catch{return null}}
function dateRangeDays(start:string,end:string){return Math.max(1,Math.round((new Date(`${end}T12:00:00Z`).getTime()-new Date(`${start}T12:00:00Z`).getTime())/86400000)+1)}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:jsonHeaders});
    const body=await req.json(),requestId=String(body.request_id||"");if(!requestId)throw new Error("request_id is required");
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser(token);if(userError||!userData.user)return new Response(JSON.stringify({error:"Invalid session"}),{status:401,headers:jsonHeaders});
    const {data:vac,error:vErr}=await admin.from("vacation_requests").select("*").eq("id",requestId).maybeSingle();if(vErr)throw vErr;if(!vac)throw new Error("Vacation request not found");
    const {data:caller}=await admin.from("workspace_members").select("*").eq("workspace_id",vac.workspace_id).eq("user_id",userData.user.id).eq("active",true).maybeSingle();
    const {data:callerRole}=caller?.role_id?await admin.from("workspace_roles").select("*").eq("id",caller.role_id).maybeSingle():{data:null};
    if(!caller||!hasPermission(caller,callerRole,"manage_vacations"))return new Response(JSON.stringify({error:"No tienes permiso para analizar o aprobar vacaciones."}),{status:403,headers:jsonHeaders});

    const [{data:profile},{data:sprints},{data:tickets},{data:overlaps},{data:links}]=await Promise.all([
      admin.from("profiles").select("id,full_name,email,job_title").eq("id",vac.user_id).maybeSingle(),
      admin.from("sprints").select("id,name,status,start_date,end_date,goal").eq("workspace_id",vac.workspace_id).lte("start_date",vac.end_date).gte("end_date",vac.start_date).in("status",["active","planned"]),
      admin.from("tickets").select("id,ticket_key,title,status,story_points,due_date,start_date,sprint_id,product_id,dev_owner_id,qa_owner_id,priority").eq("workspace_id",vac.workspace_id).or(`dev_owner_id.eq.${vac.user_id},qa_owner_id.eq.${vac.user_id}`).neq("status","closed"),
      admin.from("vacation_requests").select("id,user_id,start_date,end_date,status").eq("workspace_id",vac.workspace_id).eq("status","approved").neq("id",vac.id).lte("start_date",vac.end_date).gte("end_date",vac.start_date),
      admin.from("ticket_links").select("source_ticket_id,target_ticket_id,link_type").eq("workspace_id",vac.workspace_id)
    ]);
    const sprintIds=new Set((sprints||[]).map((s:any)=>s.id));
    const affected=(tickets||[]).filter((t:any)=>sprintIds.has(t.sprint_id)||(!t.sprint_id&&t.due_date&&t.due_date>=vac.start_date&&t.due_date<=vac.end_date));
    const points=affected.reduce((n:number,t:any)=>n+Number(t.story_points||0),0),blockers=affected.filter((t:any)=>["blocker","highest"].includes(t.priority)).length;
    const inProgress=affected.filter((t:any)=>["in_progress","dev_done","qa_review","qa_rejected"].includes(t.status)).length;
    const linkedIds=new Set<string>();for(const l of links||[]){if(affected.some((t:any)=>t.id===l.source_ticket_id||t.id===l.target_ticket_id)){linkedIds.add(l.source_ticket_id);linkedIds.add(l.target_ticket_id)}}
    const duration=dateRangeDays(vac.start_date,vac.end_date);
    let riskScore=0;riskScore+=Math.min(4,affected.length)*12;riskScore+=Math.min(12,points)*2;riskScore+=inProgress*8;riskScore+=blockers*15;riskScore+=Math.min(3,(overlaps||[]).length)*8;riskScore+=duration>=5?12:duration>=3?6:0;riskScore+=linkedIds.size?8:0;
    const localRisk=riskScore>=70?"critical":riskScore>=48?"high":riskScore>=24?"medium":"low";
    let result:any={risk:localRisk,recommendation:localRisk==="critical"?"decline":localRisk==="high"?"review":localRisk==="medium"?"approve_with_conditions":"approve",summary:affected.length?`La ausencia coincide con ${affected.length} entregable(s) abierto(s), ${points} story points y ${inProgress} actividad(es) en curso.`:"No se detectaron entregables abiertos del integrante dentro del periodo solicitado.",reasons:[],mitigations:[]};
    if(affected.length)result.reasons.push(`${affected.length} ticket(s) abiertos dentro de sprints o fechas afectadas.`);if(inProgress)result.reasons.push(`${inProgress} actividad(es) ya están en curso.`);if(blockers)result.reasons.push(`${blockers} actividad(es) tienen prioridad muy alta o bloqueante.`);if((overlaps||[]).length)result.reasons.push(`${overlaps.length} ausencia(s) aprobada(s) se traslapan en el equipo.`);if(linkedIds.size)result.reasons.push("Hay dependencias entre tickets que pueden amplificar el impacto.");
    if(affected.length)result.mitigations.push("Reasignar o dejar handoff documentado de los tickets afectados antes de iniciar la ausencia.");if(inProgress)result.mitigations.push("Confirmar avance real y próximo responsable de cada actividad en curso.");if((overlaps||[]).length)result.mitigations.push("Validar cobertura del equipo durante los días con ausencias simultáneas.");

    const gatewayKey=Deno.env.get("AI_GATEWAY_API_KEY"),openaiKey=Deno.env.get("OPENAI_API_KEY");
    if(gatewayKey||openaiKey){
      const isGateway=Boolean(gatewayKey),apiKey=gatewayKey||openaiKey!,model=isGateway?(Deno.env.get("TROBBU_AI_MODEL")||"openai/gpt-6.1-sol"):(Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-6.1-sol"),endpoint=isGateway?"https://ai-gateway.vercel.sh/v1/responses":"https://api.openai.com/v1/responses";
      try{
        const context={employee:{name:profile?.full_name||profile?.email||vac.user_id,job_title:profile?.job_title||null},vacation:{start_date:vac.start_date,end_date:vac.end_date,duration_days:duration},sprints:sprints||[],affected_tickets:affected.map((t:any)=>({ticket_key:t.ticket_key,title:t.title,status:t.status,story_points:t.story_points,priority:t.priority,due_date:t.due_date,sprint_id:t.sprint_id,role:t.dev_owner_id===vac.user_id&&t.qa_owner_id===vac.user_id?"dev+qa":t.dev_owner_id===vac.user_id?"dev":"qa"})),simultaneous_absences:(overlaps||[]).length,local_risk:localRisk};
        const res=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"developer",content:"You are a delivery-risk assistant for TROBBU. Evaluate whether approving a vacation request could compromise active/planned sprint deliverables. Be conservative but practical. Use only the provided data. Do not treat vacation as inherently negative. Return JSON only: {\"risk\":\"low|medium|high|critical\",\"recommendation\":\"approve|approve_with_conditions|review|decline\",\"summary\":\"concise Spanish explanation\",\"reasons\":[\"...\"],\"mitigations\":[\"...\"]}. Prefer mitigations and handoff when risk can be reduced."},{role:"user",content:JSON.stringify(context)}],text:{format:{type:"json_object"}}})});
        const payload=await res.json();if(res.ok){const parsed=safeJson(extractText(payload));if(parsed?.risk&&parsed?.recommendation){result={...result,...parsed,provider:isGateway?`vercel-ai-gateway:${model}`:`openai:${model}`}}}
      }catch(error){console.warn("vacation AI fallback",error instanceof Error?error.message:String(error))}
    }
    const allowedRisk=new Set(["low","medium","high","critical"]),allowedRec=new Set(["approve","approve_with_conditions","review","decline"]);if(!allowedRisk.has(result.risk))result.risk=localRisk;if(!allowedRec.has(result.recommendation))result.recommendation=localRisk==="low"?"approve":"review";
    const analysis={...result,metrics:{affected_tickets:affected.length,story_points:points,in_progress:inProgress,blockers,simultaneous_absences:(overlaps||[]).length,duration_days:duration},affected_tickets:affected.map((t:any)=>({id:t.id,ticket_key:t.ticket_key,title:t.title,status:t.status,story_points:t.story_points,priority:t.priority,due_date:t.due_date})),sprints:(sprints||[]).map((s:any)=>({id:s.id,name:s.name,status:s.status,start_date:s.start_date,end_date:s.end_date}))};
    const analyzedAt=new Date().toISOString();
    const {error:saveError}=await admin.from("vacation_requests").update({ai_risk:result.risk,ai_recommendation:result.recommendation,ai_summary:String(result.summary||"").slice(0,2000),ai_analysis:analysis,ai_analyzed_at:analyzedAt}).eq("id",vac.id);if(saveError)throw saveError;
    return new Response(JSON.stringify({ok:true,analysis,analyzed_at:analyzedAt}),{headers:jsonHeaders});
  }catch(error){const message=error instanceof Error?error.message:"Unknown error";console.error("vacation-impact-assistant:",message);return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders})}
});
