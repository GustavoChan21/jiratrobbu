import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};
type Block={start_date:string;end_date:string;return_date?:string};
const dayMs=86400000;
const days=(a:string,b:string)=>Math.max(1,Math.round((new Date(`${b}T12:00:00Z`).getTime()-new Date(`${a}T12:00:00Z`).getTime())/dayMs)+1);
const overlaps=(a:{start_date:string,end_date:string},b:{start_date:string,end_date:string})=>a.start_date<=b.end_date&&a.end_date>=b.start_date;
const blocksFor=(v:any):Block[]=>{
  const raw=Array.isArray(v?.date_blocks)?v.date_blocks:[];
  const normalized=raw.map((b:any)=>({start_date:String(b?.start_date||'').slice(0,10),end_date:String(b?.end_date||'').slice(0,10),return_date:String(b?.return_date||'').slice(0,10)})).filter((b:Block)=>b.start_date&&b.end_date&&b.end_date>=b.start_date);
  if(normalized.length)return normalized;
  const start=String(v?.start_date||'').slice(0,10),end=String(v?.end_date||'').slice(0,10);
  return start&&end?[{start_date:start,end_date:end,return_date:String(v?.return_date||'').slice(0,10)}]:[];
};
const extractText=(payload:any)=>{if(typeof payload?.output_text==='string')return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')return c.text;return ''};
const safeJson=(text:string)=>{try{return JSON.parse(text)}catch{return null}};

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const token=(req.headers.get('Authorization')||'').replace('Bearer ','');
    if(!token)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:jsonHeaders});
    const body=await req.json();
    const requestId=String(body?.request_id||'');
    if(!requestId)throw new Error('request_id is required');
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await client.auth.getUser(token);
    if(authError||!auth.user)return new Response(JSON.stringify({error:'Invalid session'}),{status:401,headers:jsonHeaders});
    const {data:vac,error:vacError}=await admin.from('vacation_requests').select('*').eq('id',requestId).maybeSingle();
    if(vacError)throw vacError;if(!vac)throw new Error('Vacation request not found');
    const {data:member}=await admin.from('workspace_members').select('*').eq('workspace_id',vac.workspace_id).eq('user_id',auth.user.id).eq('active',true).maybeSingle();
    const {data:role}=member?.role_id?await admin.from('workspace_roles').select('code,base_role,permissions').eq('id',member.role_id).maybeSingle():{data:null};
    const explicitBoolean=(value:any)=>typeof value==='boolean'?value:null;
    const defaultManage=(base:any)=>['superadmin','admin','pm'].includes(String(base||''));
    const memberOverride=explicitBoolean(member?.permissions?.manage_vacations);
    const roleOverride=explicitBoolean(role?.permissions?.manage_vacations);
    const resolvedManage=member?.role==='superadmin'?true:memberOverride!==null?memberOverride:(role?.code==='superadmin'||role?.base_role==='superadmin')?true:roleOverride!==null?roleOverride:defaultManage(role?.base_role||member?.role);
    const canManage=Boolean(member&&resolvedManage);
    if(!canManage)return new Response(JSON.stringify({error:'No tienes permiso para analizar vacaciones.'}),{status:403,headers:jsonHeaders});
    const blocks=blocksFor(vac);if(!blocks.length)throw new Error('Vacation request has no valid date blocks');
    const start=[...blocks].sort((a,b)=>a.start_date.localeCompare(b.start_date))[0].start_date;
    const end=[...blocks].sort((a,b)=>b.end_date.localeCompare(a.end_date))[0].end_date;
    const [{data:profile},{data:type},{data:sprintRows},{data:ticketRows},{data:absenceRows}]=await Promise.all([
      admin.from('profiles').select('full_name,email,job_title').eq('id',vac.user_id).maybeSingle(),
      vac.vacation_type_id?admin.from('vacation_types').select('name,code,deducts_from_balance,day_fraction').eq('id',vac.vacation_type_id).maybeSingle():Promise.resolve({data:null}),
      admin.from('sprints').select('id,name,status,start_date,end_date,goal').eq('workspace_id',vac.workspace_id).lte('start_date',end).gte('end_date',start).in('status',['active','planned']),
      admin.from('tickets').select('id,ticket_key,title,status,story_points,priority,start_date,due_date,sprint_id,dev_owner_id,qa_owner_id').eq('workspace_id',vac.workspace_id).or(`dev_owner_id.eq.${vac.user_id},qa_owner_id.eq.${vac.user_id}`).neq('status','closed'),
      admin.from('vacation_requests').select('id,user_id,start_date,end_date,date_blocks,status').eq('workspace_id',vac.workspace_id).eq('status','approved').neq('id',vac.id).lte('start_date',end).gte('end_date',start)
    ]);
    const sprints=(sprintRows||[]).filter((s:any)=>blocks.some(b=>overlaps({start_date:s.start_date,end_date:s.end_date},b)));
    const sprintIds=new Set(sprints.map((s:any)=>s.id));
    const affected=(ticketRows||[]).filter((t:any)=>t.sprint_id&&sprintIds.has(t.sprint_id)||blocks.some(b=>overlaps({start_date:t.start_date||t.due_date||b.start_date,end_date:t.due_date||t.start_date||b.end_date},b)));
    const simultaneous=(absenceRows||[]).filter((v:any)=>blocksFor(v).some(other=>blocks.some(b=>overlaps(other,b))));
    const storyPoints=affected.reduce((n:number,t:any)=>n+Number(t.story_points||0),0);
    const inProgress=affected.filter((t:any)=>['in_progress','dev_done','qa_review','qa_rejected'].includes(t.status)).length;
    const blockers=affected.filter((t:any)=>['blocker','highest'].includes(String(t.priority||'').toLowerCase())).length;
    const duration=Number(vac.absence_days||0)||blocks.reduce((n,b)=>n+days(b.start_date,b.end_date),0);
    let score=Math.min(4,affected.length)*12+Math.min(12,storyPoints)*2+inProgress*8+blockers*15+Math.min(3,simultaneous.length)*8+(duration>=5?12:duration>=3?6:0);
    const localRisk=score>=70?'critical':score>=48?'high':score>=24?'medium':'low';
    let result:any={risk:localRisk,recommendation:localRisk==='critical'?'decline':localRisk==='high'?'review':localRisk==='medium'?'approve_with_conditions':'approve',summary:affected.length?`${type?.name||'Ausencia'} de ${duration} día(s): ${affected.length} entregable(s), ${storyPoints} story points y ${inProgress} actividad(es) en curso coinciden con la ausencia.`:`No se detectaron entregables abiertos del integrante dentro de los bloques solicitados.`,reasons:[],mitigations:[]};
    if(affected.length)result.reasons.push(`${affected.length} ticket(s) abiertos coinciden con la ausencia.`);if(inProgress)result.reasons.push(`${inProgress} actividad(es) están en curso.`);if(blockers)result.reasons.push(`${blockers} actividad(es) son bloqueantes o de prioridad muy alta.`);if(simultaneous.length)result.reasons.push(`${simultaneous.length} ausencia(s) aprobada(s) coinciden con el periodo.`);
    if(affected.length)result.mitigations.push('Dejar handoff o reasignación de los tickets afectados antes de la ausencia.');if(inProgress)result.mitigations.push('Confirmar avance y siguiente responsable de cada actividad en curso.');if(simultaneous.length)result.mitigations.push('Validar cobertura en los días con ausencias simultáneas.');
    const gatewayKey=Deno.env.get('AI_GATEWAY_API_KEY'),openaiKey=Deno.env.get('OPENAI_API_KEY');
    let provider='deterministic',aiError='';
    if(gatewayKey||openaiKey){
      const isGateway=Boolean(gatewayKey),key=gatewayKey||openaiKey!,model=isGateway?(Deno.env.get('TROBBU_AI_MODEL')||'openai/gpt-6.1-sol'):(Deno.env.get('TROBBU_OPENAI_MODEL')||'gpt-6.1-sol'),endpoint=isGateway?'https://ai-gateway.vercel.sh/v1/responses':'https://api.openai.com/v1/responses';
      try{
        const context={employee:profile||{id:vac.user_id},absence:{type:type?.name||null,half_day_period:vac.half_day_period||null,blocks,duration_days:duration,charged_days:Number(vac.charged_days||0)},sprints,affected_tickets:affected,simultaneous_absences:simultaneous.length,local_risk:localRisk};
        const res=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'developer',content:'You are a delivery-risk assistant for TROBBU. The approval decision belongs to the human approver. Provide only an advisory risk projection and practical mitigations. Use only supplied data. Return JSON: {"risk":"low|medium|high|critical","recommendation":"approve|approve_with_conditions|review|decline","summary":"Spanish summary","reasons":[],"mitigations":[]}.'},{role:'user',content:JSON.stringify(context)}],text:{format:{type:'json_object'}}})});
        const payload=await res.json();
        if(!res.ok)throw new Error(payload?.error?.message||payload?.message||`AI HTTP ${res.status}`);
        const parsed=safeJson(extractText(payload));
        if(!parsed?.risk||!parsed?.recommendation)throw new Error('La respuesta de IA no incluyó risk/recommendation válidos.');
        result={...result,...parsed};provider=isGateway?`vercel-ai-gateway:${model}`:`openai:${model}`;
      }catch(error){aiError=error instanceof Error?error.message:String(error);provider='deterministic-fallback';console.warn('vacation AI fallback',aiError)}
    }
    const analysis={...result,provider,ai_configured:Boolean(gatewayKey||openaiKey),...(aiError?{ai_error:aiError}:{}),metrics:{affected_tickets:affected.length,story_points:storyPoints,in_progress:inProgress,blockers,simultaneous_absences:simultaneous.length,duration_days:duration,charged_days:Number(vac.charged_days||0),blocks:blocks.length},date_blocks:blocks};
    const analyzedAt=new Date().toISOString();
    const {error:saveError}=await admin.from('vacation_requests').update({ai_risk:result.risk,ai_recommendation:result.recommendation,ai_summary:String(result.summary||'').slice(0,2000),ai_analysis:analysis,ai_analyzed_at:analyzedAt}).eq('id',vac.id);
    if(saveError)throw saveError;
    return new Response(JSON.stringify({ok:true,analysis,analyzed_at:analyzedAt}),{headers:jsonHeaders});
  }catch(error){const message=error instanceof Error?error.message:'Unknown error';console.error('vacation-impact-assistant:',message);return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders})}
});
