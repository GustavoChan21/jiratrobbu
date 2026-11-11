import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};
const STOP=new Set([
  "para","como","este","esta","estos","estas","desde","hasta","ticket","helpdesk","solicitud","reporte","usuario","sistema","necesito","quiero","favor","problema","error","apoyo","ayuda","tengo","puedo","hacer","sobre","entre","porque","cuando","donde","cual","unos","unas","del","las","los","una","uno","que","con","sin","por",
  "from","with","that","this","request","ticket","helpdesk","please","need","want","issue","problem","support","system","user","the","and","for","can","how","what","when","where"
]);
const norm=(v:string)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokenList=(v:string)=>norm(v).split(/\s+/).filter(x=>x.length>=3&&!STOP.has(x));
const unique=(xs:string[])=>[...new Set(xs)];
const stem=(w:string)=>w.length>6?w.slice(0,Math.max(4,w.length-2)):w;
const setWithStems=(v:string)=>new Set(unique(tokenList(v).flatMap(w=>[w,stem(w)])));
const cleanSnippet=(v:any,max=260)=>{const text=String(v||"").replace(/\\n/g," ").replace(/\r?\n/g," ").replace(/\s+/g," ").trim();return text.length>max?text.slice(0,max-1).trimEnd()+"…":text};
function extractText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")return c.text;return ""}
function safeJson(text:string){try{return JSON.parse(text)}catch{return null}}

function lexicalScore(a:any,query:string,productId:string){
  const q=unique(tokenList(query));
  if(!q.length)return {score:0,coverage:0,strong:0,matched:[] as string[]};
  const fields={title:setWithStems(a.title||""),tags:setWithStems((a.tags||[]).join(" ")),summary:setWithStems(a.summary||""),content:setWithStems(String(a.content||"").slice(0,16000))};
  let score=0,strong=0;const matched:string[]=[];
  for(const raw of q){const w=stem(raw);let hit=false;if(fields.title.has(raw)||fields.title.has(w)){score+=9;strong++;hit=true}if(fields.tags.has(raw)||fields.tags.has(w)){score+=7;strong++;hit=true}if(fields.summary.has(raw)||fields.summary.has(w)){score+=4;hit=true}if(fields.content.has(raw)||fields.content.has(w)){score+=1.25;hit=true}if(hit)matched.push(raw)}
  const normalizedQuery=norm(query),titlePhrase=norm(a.title||"");
  if(titlePhrase.length>5&&normalizedQuery.includes(titlePhrase)){score+=14;strong+=2}
  if(productId&&a.product_id===productId){score+=7;strong+=1}
  else if(productId&&a.product_id&&a.product_id!==productId){score-=2.5}
  const coverage=matched.length/Math.max(1,q.length);
  score+=coverage*10;
  return {score:Math.max(0,score),coverage,strong,matched:unique(matched)};
}
function deterministicRelevance(x:any){
  const raw=(x.score/34)+(x.coverage*.52)+(Math.min(x.strong,3)*.08);
  return Math.max(0,Math.min(.92,raw));
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:jsonHeaders});
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const title=String(body.title||"").slice(0,500),description=String(body.description||"").slice(0,5000);
    const productId=String(body.product_id||"");
    const departmentId=String(body.department_id||""),requestTypeId=String(body.request_type_id||"");
    const language=String(body.language||"es")==="en"?"en":"es";
    if(!workspaceId)throw new Error("workspace_id is required");
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser(token);if(userError||!userData.user)throw new Error("Invalid session");
    const [{data:articles,error},{data:department},{data:requestType},{data:product}]=await Promise.all([
      client.from("knowledge_articles").select("id,title,summary,content,tags,product_id,module_id,category_id,updated_at,active_version_id,default_language").eq("workspace_id",workspaceId).eq("status","published").limit(250),
      departmentId?client.from("helpdesk_departments").select("name").eq("id",departmentId).maybeSingle():Promise.resolve({data:null}),
      requestTypeId?client.from("helpdesk_request_types").select("name").eq("id",requestTypeId).maybeSingle():Promise.resolve({data:null}),
      productId?client.from("products").select("name").eq("id",productId).maybeSingle():Promise.resolve({data:null})
    ]);if(error)throw error;
    const versionIds=(articles||[]).map((a:any)=>a.active_version_id).filter(Boolean);let translationMap=new Map<string,any>();
    if(versionIds.length){const {data:translations}=await client.from("knowledge_version_translations").select("*").eq("workspace_id",workspaceId).eq("language",language).in("version_id",versionIds);translationMap=new Map((translations||[]).map((t:any)=>[t.version_id,t]))}
    const localized=(articles||[]).map((a:any)=>{const t=translationMap.get(a.active_version_id);return t?{...a,title:t.title,summary:t.summary,content:t.content,tags:t.tags||a.tags,translation_cached:true}:{...a,translation_cached:false}});
    const query=[title,description,department?.name,requestType?.name,product?.name].filter(Boolean).join(" ").trim();
    if(tokenList(query).length<2)return new Response(JSON.stringify({ok:true,message:"",provider:"deterministic",language,articles:[],evaluated:0}),{headers:jsonHeaders});

    let candidates=localized.map((a:any)=>{const m=lexicalScore(a,query,productId);return {...a,...m,local_relevance:deterministicRelevance(m)}})
      .filter((a:any)=>a.strong>0||a.coverage>=.2||a.local_relevance>=.34)
      .sort((a:any,b:any)=>b.local_relevance-a.local_relevance||b.score-a.score).slice(0,12);

    let provider="deterministic",ranked:any[]=candidates.map((a:any)=>({...a,relevance:a.local_relevance,reason:"Coincidencia por título, etiquetas y contenido."}));
    const gatewayKey=Deno.env.get("AI_GATEWAY_API_KEY"),openaiKey=Deno.env.get("OPENAI_API_KEY");
    if(candidates.length&&(gatewayKey||openaiKey)){
      const isGateway=Boolean(gatewayKey),apiKey=gatewayKey||openaiKey!;
      const model=isGateway?(Deno.env.get("TROBBU_AI_MODEL")||"openai/gpt-6.1-sol"):(Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-6.1-sol");
      const endpoint=isGateway?"https://ai-gateway.vercel.sh/v1/responses":"https://api.openai.com/v1/responses";
      try{
        const requestContext={subject:title,description,department:department?.name||null,request_type:requestType?.name||null,product:product?.name||null};
        const compact=candidates.map((a:any)=>({id:a.id,title:a.title,summary:a.summary,tags:a.tags,product_match:!!productId&&a.product_id===productId,content_preview:cleanSnippet(a.content,1100),local_relevance:Number(a.local_relevance.toFixed(3))}));
        const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:[
          {role:"developer",content:`You are TROBBU's internal Knowledge relevance judge. Determine whether each candidate article genuinely helps resolve the Helpdesk request. Semantic meaning matters more than shared generic words. Reject articles that are only tangential, from an unrelated workflow, or merely share broad terms. It is valid and preferred to return no relevant articles. Return JSON only with shape {"summary":"short ${language==="en"?"English":"Spanish"} sentence","matches":[{"id":"uuid","relevant":true,"relevance":0.0,"reason":"short reason"}]}. relevance is 0..1. Only mark relevant when >=0.58. Never invent facts outside candidate content.`},
          {role:"user",content:`Request context: ${JSON.stringify(requestContext)}\nCandidate articles: ${JSON.stringify(compact)}`}
        ],text:{format:{type:"json_object"}}})});
        const payload=await res.json();
        if(res.ok){const parsed=safeJson(extractText(payload));if(parsed?.matches&&Array.isArray(parsed.matches)){const map=new Map(parsed.matches.map((m:any)=>[String(m.id),m]));ranked=candidates.map((a:any)=>{const r:any=map.get(a.id)||{};const relevance=Math.max(0,Math.min(1,Number(r.relevance)||0));return {...a,relevance,relevant:r.relevant===true&&relevance>=.58,reason:String(r.reason||"").slice(0,260)}}).sort((a:any,b:any)=>b.relevance-a.relevance);provider=isGateway?`vercel-ai-gateway:${model}`:`openai:${model}`;(ranked as any).summary=String(parsed.summary||"")}}
      }catch(error){console.warn("knowledge AI rerank fallback",error instanceof Error?error.message:String(error))}
    }

    const relevant=ranked.filter((a:any)=>provider==="deterministic"?a.relevance>=.42:(a.relevant===true&&a.relevance>=.58)).slice(0,3);
    const message=relevant.length
      ? (provider==="deterministic"?(language==="en"?"I found Knowledge articles with a meaningful match to this request. Review them before creating the ticket.":"Encontré artículos de Knowledge con una coincidencia relevante para esta solicitud. Revísalos antes de crear el ticket."):(ranked as any).summary|| (language==="en"?"These articles are meaningfully related to your request.":"Estos artículos sí tienen relación significativa con tu solicitud."))
      : (language==="en"?"I did not find a Knowledge article with enough relevance to recommend. You can continue creating the ticket.":"No encontré un artículo de Knowledge con relevancia suficiente para recomendar. Puedes continuar creando el ticket.");
    console.log(JSON.stringify({event:"knowledge_assistant_result",provider,language,evaluated:candidates.length,relevant:relevant.length,product_id:productId||null}));
    return new Response(JSON.stringify({ok:true,message,provider,language,evaluated:candidates.length,articles:relevant.map((a:any)=>({id:a.id,title:a.title,summary:cleanSnippet(a.summary||a.content,240),tags:a.tags,product_id:a.product_id,module_id:a.module_id,category_id:a.category_id,relevance:Number(a.relevance.toFixed(3)),match_reason:a.reason,translation_cached:a.translation_cached}))}),{headers:jsonHeaders});
  }catch(error){const message=error instanceof Error?error.message:"Unknown error";console.error("trobbu-knowledge-assistant:",message);return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders})}
});
