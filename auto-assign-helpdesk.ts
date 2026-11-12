import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};
const PROPOSAL=new Set(["module","feature","new_requirement"]);
const STOP=new Set(["para","como","este","esta","estos","estas","ticket","helpdesk","solicitud","reporte","usuario","sistema","necesito","quiero","error","from","with","that","this","request","ticket","helpdesk"]);

const normalize=(v:string)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokens=(v:string)=>[...new Set(normalize(v).split(/\s+/).filter(x=>x.length>=4&&!STOP.has(x)))];
function localScore(ticket:string,profile:string){const p=normalize(profile);return tokens(ticket).reduce((n,t)=>n+(p.includes(t)?1:0),0)}
function extractText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")return c.text;return ""}
function localDateKey(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date),map=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${map.year}-${map.month}-${map.day}`}
function vacationBlocks(v:any){const raw=Array.isArray(v?.date_blocks)?v.date_blocks:[];const blocks=raw.map((b:any)=>({start_date:String(b?.start_date||"").slice(0,10),end_date:String(b?.end_date||"").slice(0,10)})).filter((b:any)=>b.start_date&&b.end_date);return blocks.length?blocks:(v?.start_date&&v?.end_date?[{start_date:String(v.start_date).slice(0,10),end_date:String(v.end_date).slice(0,10)}]:[])}
function absentOn(v:any,key:string){return vacationBlocks(v).some((b:any)=>b.start_date<=key&&b.end_date>=key)}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:jsonHeaders});
    const body=await req.json();
    const ticketId=String(body.ticket_id||"");
    if(!ticketId)throw new Error("ticket_id is required");

    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser(token);
    if(userError||!userData.user)return new Response(JSON.stringify({error:"Invalid session"}),{status:401,headers:jsonHeaders});

    const {data:ticket,error:tErr}=await admin.from("helpdesk_tickets").select("*").eq("id",ticketId).maybeSingle();
    if(tErr)throw tErr;
    if(!ticket)throw new Error("Helpdesk ticket not found");
    const {data:membership}=await admin.from("workspace_members").select("*").eq("workspace_id",ticket.workspace_id).eq("user_id",userData.user.id).eq("active",true).maybeSingle();
    if(!membership)return new Response(JSON.stringify({error:"Workspace access required"}),{status:403,headers:jsonHeaders});
    if(body.manual_trigger===true){
      const {data:callerRole}=membership.role_id?await admin.from("workspace_roles").select("code,base_role,permissions").eq("id",membership.role_id).maybeSingle():{data:null};
      const explicit=typeof membership.permissions?.manage_helpdesk==="boolean"?membership.permissions.manage_helpdesk:typeof callerRole?.permissions?.manage_helpdesk==="boolean"?callerRole.permissions.manage_helpdesk:null;
      const base=String(callerRole?.base_role||membership.role||"");
      const allowed=explicit===null?["superadmin","admin","pm"].includes(base)||callerRole?.code==="superadmin":explicit;
      if(!allowed)return new Response(JSON.stringify({error:"No tienes permiso para ejecutar la autoasignación manual."}),{status:403,headers:jsonHeaders});
    }
    if(PROPOSAL.has(ticket.category))return new Response(JSON.stringify({ok:true,assigned:false,skipped:"proposal"}),{headers:jsonHeaders});
    if(ticket.assigned_to)return new Response(JSON.stringify({ok:true,assigned:true,user_id:ticket.assigned_to,skipped:"already_assigned"}),{headers:jsonHeaders});

    const [{data:settings},{data:members},{data:requestType},{data:department},{data:product}]=await Promise.all([
      admin.from("workspace_settings").select("*").eq("workspace_id",ticket.workspace_id).maybeSingle(),
      admin.from("workspace_members").select("*").eq("workspace_id",ticket.workspace_id).eq("active",true),
      ticket.request_type_id?admin.from("helpdesk_request_types").select("name").eq("id",ticket.request_type_id).maybeSingle():Promise.resolve({data:null}),
      ticket.department_id?admin.from("helpdesk_departments").select("name").eq("id",ticket.department_id).maybeSingle():Promise.resolve({data:null}),
      ticket.product_id?admin.from("products").select("name").eq("id",ticket.product_id).maybeSingle():Promise.resolve({data:null}),
    ]);
    if(settings?.helpdesk_auto_assignment_enabled===false)return new Response(JSON.stringify({ok:true,assigned:false,skipped:"disabled"}),{headers:jsonHeaders});
    const ids=(members||[]).map((m:any)=>m.user_id);
    const roleIds=(members||[]).map((m:any)=>m.role_id).filter(Boolean);
    const tz=settings?.timezone||"America/Merida",today=localDateKey(new Date(),tz);
    const [{data:profiles},{data:roles},{data:logs},{data:activeTickets},{data:vacations}]=await Promise.all([
      ids.length?admin.from("profiles").select("id,full_name,email,job_title").in("id",ids):Promise.resolve({data:[]}),
      roleIds.length?admin.from("workspace_roles").select("id,code,name,description,base_role").in("id",roleIds):Promise.resolve({data:[]}),
      ids.length?admin.from("helpdesk_assignment_log").select("assigned_user_id,created_at").eq("workspace_id",ticket.workspace_id).in("assigned_user_id",ids).gte("created_at",new Date(Date.now()-48*3600*1000).toISOString()):Promise.resolve({data:[]}),
      ids.length?admin.from("helpdesk_tickets").select("assigned_to,status,category").eq("workspace_id",ticket.workspace_id).in("assigned_to",ids).neq("status","closed"):Promise.resolve({data:[]}),
      ids.length?admin.from("vacation_requests").select("user_id,start_date,end_date,return_date,date_blocks,status").eq("workspace_id",ticket.workspace_id).eq("status","approved").lte("start_date",today).gte("end_date",today).in("user_id",ids):Promise.resolve({data:[]}),
    ]);
    const profileMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
    const roleMap=new Map((roles||[]).map((r:any)=>[r.id,r]));
    const dailyCount=(uid:string)=>(logs||[]).filter((l:any)=>l.assigned_user_id===uid&&localDateKey(new Date(l.created_at),tz)===today).length;
    const activeCount=(uid:string)=>(activeTickets||[]).filter((h:any)=>h.assigned_to===uid&&!PROPOSAL.has(h.category)).length;
    const ticketContext=[ticket.subject,ticket.description,requestType?.name,department?.name,product?.name,ticket.category,ticket.priority].filter(Boolean).join(" ");
    const defaultDaily=Number(settings?.helpdesk_default_daily_limit??4),defaultActive=Number(settings?.helpdesk_default_active_limit??4);

    const candidates=(members||[]).map((m:any)=>{
      const role=roleMap.get(m.role_id)||{} as any;
      const profile=profileMap.get(m.user_id)||{} as any;
      const base=String(role.base_role||m.role||"");
      const absentToday=(vacations||[]).some((v:any)=>v.user_id===m.user_id&&absentOn(v,today));
      const eligible=!!m.helpdesk_auto_assign_enabled&&!absentToday&&role.code!=="helpdesk_requester"&&base!=="consulta"&&m.user_id!==ticket.requester_user_id;
      const dailyLimit=m.helpdesk_daily_limit==null?defaultDaily:Number(m.helpdesk_daily_limit);
      const activeLimit=m.helpdesk_active_limit==null?defaultActive:Number(m.helpdesk_active_limit);
      const d=dailyCount(m.user_id),a=activeCount(m.user_id);
      const available=(dailyLimit===0||d<dailyLimit)&&(activeLimit===0||a<activeLimit);
      const context=[m.helpdesk_routing_description,profile.job_title,role.name,role.description,base].filter(Boolean).join(" ");
      return {user_id:m.user_id,name:profile.full_name||profile.email||"User",context,eligible,absent_today:absentToday,available,daily_count:d,active_count:a,daily_limit:dailyLimit,active_limit:activeLimit,overflow_mode:(m.helpdesk_overflow_mode&&m.helpdesk_overflow_mode!=="inherit")?m.helpdesk_overflow_mode:(settings?.helpdesk_default_overflow_mode||"fallback"),overflow_user_id:m.helpdesk_overflow_user_id||settings?.helpdesk_default_overflow_user_id||null,score:localScore(ticketContext,context)};
    }).filter((x:any)=>x.eligible);

    if(!candidates.length){
      return new Response(JSON.stringify({ok:true,assigned:false,queued:true,reason:"no_eligible_candidates"}),{headers:jsonHeaders});
    }

    let chosen:any=null,reason="",confidence=0,provider="local";
    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(apiKey){
      try{
        const model=Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-6.1-sol";
        const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"developer",content:"You route internal TROBBU Helpdesk requests. Choose the staff member whose responsibility description clearly matches the request. Consider meaning, request type, department and product. Do not choose based on name. If no candidate is a reliable functional match, return user_id null instead of forcing an assignment. Capacity is informational: choose the best functional owner even if at capacity; overflow rules are applied afterwards. Return JSON only: {\"user_id\":\"uuid-or-null\",\"reason\":\"short Spanish explanation\",\"confidence\":0.0}. Use only the candidate IDs provided. Confidence below 0.45 means there is no reliable match."},{role:"user",content:`Request: ${ticketContext}\nCandidates: ${JSON.stringify(candidates.map((c:any)=>({user_id:c.user_id,responsibilities:c.context,daily_count:c.daily_count,daily_limit:c.daily_limit,active_count:c.active_count,active_limit:c.active_limit})))}`}],text:{format:{type:"json_object"}}})});
        const payload=await res.json();
        if(res.ok){const parsed=JSON.parse(extractText(payload));const parsedConfidence=Math.max(0,Math.min(1,Number(parsed.confidence)||0));const candidate=parsed?.user_id?candidates.find((c:any)=>c.user_id===parsed.user_id)||null:null;if(candidate&&parsedConfidence>=0.45){chosen=candidate;reason=String(parsed.reason||"").slice(0,900);confidence=parsedConfidence;provider=`openai:${model}`}else if(parsedConfidence<0.45||!parsed?.user_id){return new Response(JSON.stringify({ok:true,assigned:false,queued:true,provider:`openai:${model}`,reason:"no_routing_match",confidence:parsedConfidence,detail:String(parsed.reason||"No existe una coincidencia funcional suficientemente confiable.").slice(0,900)}),{headers:jsonHeaders})}}
      }catch{}
    }
    if(!chosen){chosen=[...candidates].sort((a:any,b:any)=>b.score-a.score||a.daily_count-b.daily_count||a.active_count-b.active_count)[0];if(!chosen||chosen.score<=0)return new Response(JSON.stringify({ok:true,assigned:false,queued:true,provider:"local",reason:"no_routing_match"}),{headers:jsonHeaders});reason="Coincidencia local entre el contenido de la solicitud y la descripción de responsabilidades.";confidence=Math.min(.75,.35+chosen.score*.08);provider="local"}

    let target=chosen;
    let source="auto_ai";
    if(!chosen.available){
      if(chosen.overflow_mode==="queue"){
        return new Response(JSON.stringify({ok:true,assigned:false,queued:true,suggested_user_id:chosen.user_id,provider,reason:"capacity_queue"}),{headers:jsonHeaders});
      }
      if(chosen.overflow_mode==="fallback"){
        const fb=candidates.find((c:any)=>c.user_id===chosen.overflow_user_id&&c.available) || candidates.find((c:any)=>c.user_id===settings?.helpdesk_default_overflow_user_id&&c.available);
        if(!fb)return new Response(JSON.stringify({ok:true,assigned:false,queued:true,suggested_user_id:chosen.user_id,provider,reason:"fallback_unavailable"}),{headers:jsonHeaders});
        target=fb;source="overflow";reason=`${chosen.name} alcanzó su límite; se asignó al respaldo ${fb.name}. ${reason}`.slice(0,900);confidence=Math.min(confidence,.45);
      }else{
        const next=[...candidates].filter((c:any)=>c.available&&c.user_id!==chosen.user_id&&c.score>0).sort((a:any,b:any)=>b.score-a.score||a.daily_count-b.daily_count)[0];
        if(!next)return new Response(JSON.stringify({ok:true,assigned:false,queued:true,suggested_user_id:chosen.user_id,provider,reason:"no_available_candidate"}),{headers:jsonHeaders});
        target=next;source="overflow";reason=`${chosen.name} alcanzó su límite; se asignó al siguiente integrante disponible, ${next.name}. ${reason}`.slice(0,900);confidence=Math.min(confidence,.55);
      }
    }

    const {data:applied,error:applyError}=await admin.rpc("apply_helpdesk_auto_assignment",{p_ticket_id:ticket.id,p_assignee:target.user_id,p_reason:reason,p_confidence:confidence,p_source:source});
    if(applyError)throw applyError;
    console.log(JSON.stringify({event:"helpdesk_auto_assignment",ticket_id:ticket.id,provider,selected_user_id:target.user_id,source,confidence,assigned:applied?.assigned===true}));
    return new Response(JSON.stringify({ok:true,provider,assignee:{user_id:target.user_id,name:target.name},...applied}),{headers:jsonHeaders});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    console.error("auto-assign-helpdesk:",message);
    return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders});
  }
});
