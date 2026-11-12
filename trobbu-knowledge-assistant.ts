import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};
const STOP=new Set([
  "para","como","este","esta","estos","estas","desde","hasta","ticket","helpdesk","solicitud","reporte","usuario","sistema","necesito","quiero","favor","problema","error","apoyo","ayuda","tengo","puedo","hacer","sobre","entre","porque","cuando","donde","cual","unos","unas","del","las","los","una","uno","que","con","sin","por",
  "from","with","that","this","request","ticket","helpdesk","please","need","want","issue","problem","support","system","user","the","and","for","can","how","what","when","where"
]);
// Generic UI/action words are useful as weak context, but must never be enough
// to recommend an article by themselves.
const GENERIC=new Set([
  "crear","creacion","nuevo","nueva","agregar","anadir","editar","actualizar","cambiar","configurar","configuracion","gestionar","gestion","ver","abrir","usar","uso",
  "admin","administrador","administrativo","panel","perfil","pantalla","modulo","apartado","seccion","opcion","flujo","proceso",
  "create","creation","new","add","edit","update","change","configure","configuration","manage","management","view","open","use","admin","administrator","panel","profile","screen","module","section","flow","process"
]);
const norm=(v:string)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokenList=(v:string)=>norm(v).split(/\s+/).filter(x=>x.length>=3&&!STOP.has(x));
const unique=(xs:string[])=>[...new Set(xs)];
const stem=(w:string)=>w.length>6?w.slice(0,Math.max(4,w.length-2)):w;
const variants=(w:string)=>unique([w,stem(w)]);
const setWithStems=(v:string)=>new Set(unique(tokenList(v).flatMap(variants)));
const cleanSnippet=(v:any,max=260)=>{const text=String(v||"").replace(/\\n/g," ").replace(/\r?\n/g," ").replace(/\s+/g," ").trim();return text.length>max?text.slice(0,max-1).trimEnd()+"…":text};
function extractText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")return c.text;return ""}
function safeJson(text:string){try{return JSON.parse(text)}catch{return null}}
function intersects(field:Set<string>,token:string){return variants(token).some(v=>field.has(v))}
function countTokenMatches(text:string,tokens:string[]){const set=setWithStems(text);return tokens.filter(t=>intersects(set,t)).length}
function evidenceFromContent(content:string,anchors:string[],max=1050){
  const raw=String(content||"").replace(/\r/g,"").trim();if(!raw)return "";
  const chunks=raw.split(/\n{2,}|(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
  const scored=chunks.map((text,i)=>({text,i,hits:countTokenMatches(text,anchors)})).filter(x=>x.hits>0)
    .sort((a,b)=>b.hits-a.hits||a.i-b.i).slice(0,4).sort((a,b)=>a.i-b.i).map(x=>x.text);
  const chosen=(scored.length?scored:[raw.slice(0,max)]).join(" … ");return cleanSnippet(chosen,max);
}

function lexicalScore(a:any,requestText:string,contextText:string,productId:string){
  const q=unique(tokenList(requestText)),anchors=q.filter(w=>!GENERIC.has(w));
  const contextTokens=unique(tokenList(contextText));
  if(!q.length)return {score:0,coverage:0,anchorCoverage:0,strong:0,anchorStrong:0,matched:[] as string[],matchedAnchors:[] as string[],anchors};
  const fields={title:setWithStems(a.title||""),tags:setWithStems((a.tags||[]).join(" ")),summary:setWithStems(a.summary||""),content:setWithStems(String(a.content||"").slice(0,40000))};
  let score=0,strong=0,anchorStrong=0;const matched:string[]=[],matchedAnchors:string[]=[];
  for(const raw of q){
    const generic=GENERIC.has(raw);let hit=false,anchorHit=false;
    if(intersects(fields.title,raw)){score+=generic?2.2:10;strong++;hit=true;if(!generic){anchorStrong++;anchorHit=true}}
    if(intersects(fields.tags,raw)){score+=generic?1.7:8;strong++;hit=true;if(!generic){anchorStrong++;anchorHit=true}}
    if(intersects(fields.summary,raw)){score+=generic?1.1:5;hit=true;if(!generic){anchorStrong++;anchorHit=true}}
    if(intersects(fields.content,raw)){score+=(generic ? 0.25 : 1.6);hit=true;if(!generic)anchorHit=true}
    if(hit)matched.push(raw);if(anchorHit)matchedAnchors.push(raw);
  }
  // Context can boost a candidate but can never create a candidate without a real request anchor.
  const contextSet=new Set(contextTokens.flatMap(variants));
  const articleMeta=setWithStems(`${a.title||""} ${(a.tags||[]).join(" ")} ${a.summary||""}`);
  const contextHits=[...contextSet].filter(t=>articleMeta.has(t)).length;score+=Math.min(4,contextHits*.8);
  if(productId&&a.product_id===productId){score+=7;strong+=1}
  else if(productId&&a.product_id&&a.product_id!==productId){score-=7}
  const coverage=unique(matched).length/Math.max(1,q.length),anchorCoverage=anchors.length?unique(matchedAnchors).length/anchors.length:0;
  score+=coverage*8+anchorCoverage*14;
  return {score:Math.max(0,score),coverage,anchorCoverage,strong,anchorStrong,matched:unique(matched),matchedAnchors:unique(matchedAnchors),anchors};
}
function deterministicRelevance(x:any){
  const scoreNorm=Math.min(1,x.score/42),strongNorm=Math.min(1,x.anchorStrong/2);
  return Math.max(0,Math.min(.94,scoreNorm*.34+x.anchorCoverage*.38+strongNorm*.2+x.coverage*.08));
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
      client.from("knowledge_articles").select("id,title,summary,content,tags,product_id,module_id,category_id,updated_at,active_version_id,default_language").eq("workspace_id",workspaceId).eq("status","published").not("active_version_id","is",null).limit(250),
      departmentId?client.from("helpdesk_departments").select("name").eq("id",departmentId).maybeSingle():Promise.resolve({data:null}),
      requestTypeId?client.from("helpdesk_request_types").select("name").eq("id",requestTypeId).maybeSingle():Promise.resolve({data:null}),
      productId?client.from("products").select("name").eq("id",productId).maybeSingle():Promise.resolve({data:null})
    ]);if(error)throw error;
    const versionIds=(articles||[]).map((a:any)=>a.active_version_id).filter(Boolean);let translationMap=new Map<string,any>(),versionMap=new Map<string,any>();
    if(versionIds.length){
      const [{data:publishedVersions},{data:translations}]=await Promise.all([
        client.from("knowledge_article_versions").select("id,article_id,title,summary,content,tags,product_id,module_id,category_id,status,version_number").eq("workspace_id",workspaceId).eq("status","published").in("id",versionIds),
        client.from("knowledge_version_translations").select("*").eq("workspace_id",workspaceId).eq("language",language).in("version_id",versionIds)
      ]);
      versionMap=new Map((publishedVersions||[]).map((v:any)=>[v.id,v]));translationMap=new Map((translations||[]).map((t:any)=>[t.version_id,t]));
    }
    const localized=(articles||[]).map((a:any)=>{const published=versionMap.get(a.active_version_id)||a,t=translationMap.get(a.active_version_id),source={...a,...published,id:a.id,active_version_id:a.active_version_id};return t?{...source,title:t.title,summary:t.summary,content:t.content,tags:t.tags||source.tags,translation_cached:true}:{...source,translation_cached:false}});
    const requestText=[title,description].filter(Boolean).join(" ").trim();
    const contextText=[department?.name,requestType?.name,product?.name].filter(Boolean).join(" ").trim();
    const requestTokens=unique(tokenList(requestText)),anchors=requestTokens.filter(x=>!GENERIC.has(x));
    if(!requestTokens.length||(!anchors.length&&requestTokens.length<2))return new Response(JSON.stringify({ok:true,message:"",provider:"deterministic",language,articles:[],evaluated:0}),{headers:jsonHeaders});

    let candidates=localized.map((a:any)=>{const m=lexicalScore(a,requestText,contextText,productId);return {...a,...m,local_relevance:deterministicRelevance(m),content_evidence:evidenceFromContent(a.content||"",m.matchedAnchors)}})
      .filter((a:any)=>a.anchors.length?a.matchedAnchors.length>0:(a.strong>=2&&a.coverage>=.5))
      .filter((a:any)=>a.anchorCoverage>=.34||a.anchorStrong>0||a.local_relevance>=.58)
      .sort((a:any,b:any)=>b.local_relevance-a.local_relevance||b.score-a.score).slice(0,10);

    let provider="deterministic",ranked:any[]=candidates.map((a:any)=>({...a,relevance:a.local_relevance,reason:`Coincidencia en ${a.matchedAnchors.slice(0,3).join(", ")||"contenido específico"}; se validó título, etiquetas, resumen y contenido completo.`}));
    const gatewayKey=Deno.env.get("AI_GATEWAY_API_KEY"),openaiKey=Deno.env.get("OPENAI_API_KEY");
    if(candidates.length&&(gatewayKey||openaiKey)){
      const isGateway=Boolean(gatewayKey),apiKey=gatewayKey||openaiKey!;
      const model=isGateway?(Deno.env.get("TROBBU_AI_MODEL")||"openai/gpt-6.1-sol"):(Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-6.1-sol");
      const endpoint=isGateway?"https://ai-gateway.vercel.sh/v1/responses":"https://api.openai.com/v1/responses";
      try{
        const requestContext={subject:title,description,department:department?.name||null,request_type:requestType?.name||null,product:product?.name||null,request_anchor_terms:anchors};
        const compact=candidates.map((a:any)=>({id:a.id,title:a.title,summary:a.summary,tags:a.tags,product_match:!!productId&&a.product_id===productId,matched_anchor_terms:a.matchedAnchors,content_evidence:a.content_evidence,local_relevance:Number(a.local_relevance.toFixed(3))}));
        const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:[
          {role:"developer",content:`You are TROBBU's internal Knowledge relevance judge. Recommend an article only when it can materially help solve the Helpdesk request. The local stage already scanned each article's complete searchable content and supplied the strongest evidence excerpts. Generic action/UI words such as create, admin, panel, profile, edit, configure, or module are never sufficient evidence. Require a semantic match to the request's anchor concepts and reject tangential workflows even when titles sound similar. It is valid and preferred to return no articles. Return JSON only: {"summary":"short ${language==="en"?"English":"Spanish"} sentence","matches":[{"id":"uuid","relevant":true,"relevance":0.0,"reason":"specific evidence-based reason"}]}. Only mark relevant when relevance >= 0.68. Never invent facts outside the supplied article evidence.`},
          {role:"user",content:`Request context: ${JSON.stringify(requestContext)}\nCandidate articles: ${JSON.stringify(compact)}`}
        ],text:{format:{type:"json_object"}}})});
        const payload=await res.json();
        if(res.ok){const parsed=safeJson(extractText(payload));if(parsed?.matches&&Array.isArray(parsed.matches)){const map=new Map(parsed.matches.map((m:any)=>[String(m.id),m]));ranked=candidates.map((a:any)=>{const r:any=map.get(a.id)||{};const relevance=Math.max(0,Math.min(1,Number(r.relevance)||0));return {...a,relevance,relevant:r.relevant===true&&relevance>=.68,reason:String(r.reason||"").slice(0,260)}}).sort((a:any,b:any)=>b.relevance-a.relevance);provider=isGateway?`vercel-ai-gateway:${model}`:`openai:${model}`;(ranked as any).summary=String(parsed.summary||"")}}
      }catch(error){console.warn("knowledge AI rerank fallback",error instanceof Error?error.message:String(error))}
    }

    const relevant=ranked.filter((a:any)=>provider==="deterministic"?(a.relevance>=.66&&a.matchedAnchors.length>0&&a.anchorCoverage>=.34):(a.relevant===true&&a.relevance>=.68)).slice(0,3);
    const message=relevant.length
      ? (provider==="deterministic"?(language==="en"?"I found Knowledge articles with specific content matching the request. Review them before creating the ticket.":"Encontré artículos de Knowledge con contenido específico relacionado con la solicitud. Revísalos antes de crear el ticket."):(ranked as any).summary|| (language==="en"?"These articles contain evidence meaningfully related to your request.":"Estos artículos contienen evidencia realmente relacionada con tu solicitud."))
      : (language==="en"?"I did not find a Knowledge article with enough specific relevance to recommend. You can continue creating the ticket.":"No encontré un artículo de Knowledge con relevancia específica suficiente para recomendar. Puedes continuar creando el ticket.");
    console.log(JSON.stringify({event:"knowledge_assistant_result",provider,language,evaluated:candidates.length,relevant:relevant.length,product_id:productId||null,anchors}));
    return new Response(JSON.stringify({ok:true,message,provider,language,evaluated:candidates.length,articles:relevant.map((a:any)=>({id:a.id,title:a.title,summary:cleanSnippet(a.summary||a.content_evidence||a.content,240),tags:a.tags,product_id:a.product_id,module_id:a.module_id,category_id:a.category_id,relevance:Number(a.relevance.toFixed(3)),match_reason:a.reason,matched_terms:a.matchedAnchors,translation_cached:a.translation_cached,active_version_id:a.active_version_id}))}),{headers:jsonHeaders});
  }catch(error){const message=error instanceof Error?error.message:"Unknown error";console.error("trobbu-knowledge-assistant:",message);return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders})}
});
