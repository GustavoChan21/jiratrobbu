import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};
const STOP=new Set(["para","como","este","esta","estos","estas","desde","hasta","sobre","entre","cuando","donde","cual","cuales","quiero","necesito","solicitud","ticket","helpdesk","problema","error","favor","puedo","hacer","tengo","usuario","sistema","reporte","the","and","with","from","that","this","have","need","request","issue","please","user","system"]);
const GENERIC=new Set(["crear","creacion","nuevo","nueva","agregar","anadir","editar","actualizar","cambiar","configurar","configuracion","gestionar","gestion","ver","abrir","usar","uso","admin","administrador","administrativo","panel","perfil","pantalla","modulo","apartado","seccion","opcion","flujo","proceso","create","creation","new","add","edit","update","change","configure","configuration","manage","management","view","open","use","administrator","profile","screen","module","section","flow","process"]);

const norm=(v:any)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const stem=(value:string)=>{let x=value;if(x.length>6&&x.endsWith("es"))x=x.slice(0,-2);else if(x.length>5&&x.endsWith("s"))x=x.slice(0,-1);return x};
const tokens=(v:any)=>Array.from(new Set(norm(v).split(/\s+/).filter((x:string)=>x.length>=3&&!STOP.has(x)).map(stem).filter(Boolean)));
const set=(v:any)=>new Set(tokens(v));
const clean=(v:any,n=260)=>{const s=String(v||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1)+"…":s};
const extract=(p:any)=>{if(typeof p?.output_text==="string")return p.output_text;for(const i of p?.output||[])for(const c of i?.content||[])if(typeof c?.text==="string")return c.text;return ""};
const parse=(s:string)=>{try{return JSON.parse(s)}catch{return null}};
const tokenMatch=(target:Set<string>,anchor:string)=>{if(target.has(anchor))return true;for(const item of target){if(Math.min(item.length,anchor.length)>=5&&(item.startsWith(anchor)||anchor.startsWith(item)))return true}return false};

function localScore(a:any,query:string,context:string,productId:string){
  const anchors=tokens(query).filter(x=>!GENERIC.has(x));
  const contextAnchors=tokens(context).filter(x=>!GENERIC.has(x));
  if(!anchors.length)return {relevance:0,matched:[],coverage:0,primaryMatches:0,titleHits:0,tagHits:0,categoryHits:0,contextMatches:0};
  const title=set(a.title),tags=set((a.tags||[]).join(" ")),summary=set(a.summary),content=set(String(a.content||"").slice(0,60000)),category=set(`${a.category_name||""} ${a.category_description||""}`);
  let score=0,titleHits=0,tagHits=0,categoryHits=0,contextMatches=0;const matched:string[]=[];
  for(const w of anchors){
    let hit=false;
    if(tokenMatch(title,w)){score+=12;titleHits++;hit=true}
    if(tokenMatch(tags,w)){score+=10;tagHits++;hit=true}
    if(tokenMatch(category,w)){score+=8;categoryHits++;hit=true}
    if(tokenMatch(summary,w)){score+=6;hit=true}
    if(tokenMatch(content,w)){score+=2;hit=true}
    if(hit)matched.push(w);
  }
  for(const w of contextAnchors){
    if(tokenMatch(category,w)||tokenMatch(tags,w)||tokenMatch(title,w)){score+=2;contextMatches++}
  }
  const coverage=matched.length/anchors.length;
  if(productId&&a.product_id===productId)score+=8;
  if(productId&&a.product_id&&a.product_id!==productId)score-=4;
  const relevance=Math.max(0,Math.min(.98,(score/40)*.55+coverage*.45));
  return {relevance,matched,coverage,primaryMatches:matched.length,titleHits,tagHits,categoryHits,contextMatches};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:jsonHeaders});
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const title=String(body.title||"").slice(0,500);
    const description=String(body.description||"").slice(0,6000);
    const productId=String(body.product_id||"");
    const departmentId=String(body.department_id||"");
    const requestTypeId=String(body.request_type_id||"");
    const language=String(body.language||"es")==="en"?"en":"es";
    if(!workspaceId)throw new Error("workspace_id is required");

    const subject=title.trim(),detail=description.trim(),mode=detail.length>=12?"full":"title";
    if(subject.length<5&&detail.length<12)return new Response(JSON.stringify({ok:true,provider:"idle",mode,message:"",articles:[],evaluated:0,published_articles:0}),{headers:jsonHeaders});

    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:user,error:userError}=await client.auth.getUser(token);
    if(userError||!user.user)throw new Error("Invalid session");

    const [{data:articles,error},{data:categories},departmentResult,requestTypeResult]=await Promise.all([
      client.from("knowledge_articles").select("id,title,summary,content,tags,product_id,module_id,category_id,active_version_id,default_language").eq("workspace_id",workspaceId).eq("status","published").not("active_version_id","is",null).limit(250),
      client.from("knowledge_categories").select("id,name,description").eq("workspace_id",workspaceId).eq("active",true).limit(250),
      departmentId?client.from("helpdesk_departments").select("id,name").eq("workspace_id",workspaceId).eq("id",departmentId).maybeSingle():Promise.resolve({data:null,error:null}),
      requestTypeId?client.from("helpdesk_request_types").select("id,name,description,code").eq("workspace_id",workspaceId).eq("id",requestTypeId).maybeSingle():Promise.resolve({data:null,error:null})
    ]);
    if(error)throw error;

    const ids=(articles||[]).map((a:any)=>a.active_version_id).filter(Boolean);
    let versionMap=new Map<string,any>();
    if(ids.length){
      const {data:versions,error:versionError}=await client.from("knowledge_article_versions")
        .select("id,article_id,title,summary,content,tags,product_id,module_id,category_id,status,version_number")
        .eq("workspace_id",workspaceId).eq("status","published").in("id",ids);
      if(versionError)throw versionError;
      versionMap=new Map((versions||[]).map((v:any)=>[v.id,v]));
    }
    const categoryMap=new Map<string,any>((categories||[]).map((c:any)=>[c.id,c]));
    const department=departmentResult?.data||null,requestType=requestTypeResult?.data||null;
    const context=[department?.name,requestType?.name,requestType?.description,requestType?.code].filter(Boolean).join(" ");
    const query=(title+" "+description).trim();
    const queryAnchors=tokens(query).filter(x=>!GENERIC.has(x));
    if(!queryAnchors.length)return new Response(JSON.stringify({ok:true,provider:"deterministic",mode,message:"",articles:[],evaluated:0,published_articles:(articles||[]).length}),{headers:jsonHeaders});

    const scored=(articles||[]).map((article:any)=>{
      const version=versionMap.get(article.active_version_id);
      if(!version||version.article_id!==article.id)return null;
      const category=categoryMap.get(version.category_id||article.category_id)||null;
      const source={...article,...version,id:article.id,active_version_id:article.active_version_id,category_name:category?.name||"",category_description:category?.description||""};
      return {...source,...localScore(source,query,context,productId)};
    }).filter(Boolean).sort((a:any,b:any)=>b.relevance-a.relevance);

    const deterministic=scored.filter((a:any)=>{
      const strongFieldHits=a.titleHits+a.tagHits+a.categoryHits;
      return mode==="title"
        ? a.primaryMatches>0&&strongFieldHits>0&&a.relevance>=.64
        : a.primaryMatches>0&&a.coverage>=.28&&a.relevance>=.58;
    }).slice(0,3).map((a:any)=>({...a,reason:`Coincidencia específica en: ${a.matched.slice(0,5).join(", ")}${a.category_name?` · Categoría ${a.category_name}`:""}`}));

    let candidates=scored.filter((a:any)=>a.primaryMatches>0||a.contextMatches>0||(productId&&a.product_id===productId)).slice(0,12);
    if(candidates.length<4&&scored.length<=12){const seen=new Set(candidates.map((x:any)=>x.id));candidates=[...candidates,...scored.filter((x:any)=>!seen.has(x.id)).slice(0,12-candidates.length)]}

    const gatewayKey=Deno.env.get("AI_GATEWAY_API_KEY");
    const openaiKey=Deno.env.get("OPENAI_API_KEY");
    const aiConfigured=Boolean(gatewayKey||openaiKey);
    let provider=aiConfigured?"deterministic-fallback":"deterministic",aiError="",relevant:any[]=deterministic;

    if(candidates.length&&aiConfigured){
      const gateway=Boolean(gatewayKey),key=gatewayKey||openaiKey!;
      const model=gateway?(Deno.env.get("TROBBU_AI_MODEL")||"openai/gpt-6.1-sol"):(Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-6.1-sol");
      const endpoint=gateway?"https://ai-gateway.vercel.sh/v1/responses":"https://api.openai.com/v1/responses";
      try{
        const compact=candidates.map((a:any)=>({id:a.id,title:a.title,category:a.category_name||null,summary:clean(a.summary,500),tags:a.tags,product_id:a.product_id,matched_terms:a.matched,content_evidence:clean(a.content,1800),local_relevance:Number(a.relevance.toFixed(3))}));
        const requestContext={mode,title:subject,description:detail||null,department:department?.name||null,request_type:requestType?.name||null,product_id:productId||null};
        const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},body:JSON.stringify({model,input:[
          {role:"developer",content:"You are TROBBU Knowledge relevance judge for Helpdesk self-service. Recommend only ACTIVE PUBLISHED articles that materially answer the request. The request title alone is valid evidence; description, department, request type and product only refine it. Article category, title and tags are strong evidence. Generic words such as create, admin, panel, profile, edit, configure or module never justify a match by themselves. Use only supplied candidates. Returning zero matches is correct when evidence is weak. Return JSON only: {\"matches\":[{\"id\":\"uuid\",\"relevant\":true,\"relevance\":0.0,\"reason\":\"specific Spanish reason\"}],\"message\":\"short Spanish message\"}. Relevant requires relevance >= 0.72. Maximum 3 matches."},
          {role:"user",content:"Helpdesk request: "+JSON.stringify(requestContext)+"\nPublished Knowledge candidates: "+JSON.stringify(compact)}
        ],text:{format:{type:"json_object"}}})});
        const payload=await res.json();
        if(!res.ok)throw new Error(payload?.error?.message||payload?.message||`AI HTTP ${res.status}`);
        const parsed=parse(extract(payload));
        if(!Array.isArray(parsed?.matches))throw new Error("AI response did not include matches");
        const byId=new Map<string,any>(candidates.map((a:any)=>[a.id,a]));
        relevant=parsed.matches.map((m:any)=>{
          const a=byId.get(String(m.id)),rel=Math.max(0,Math.min(1,Number(m.relevance)||0));
          return a&&m.relevant===true&&rel>=.72?{...a,relevance:rel,reason:String(m.reason||"").slice(0,300)}:null;
        }).filter(Boolean).sort((a:any,b:any)=>b.relevance-a.relevance).slice(0,3);
        provider=gateway?"vercel-ai-gateway:"+model:"openai:"+model;
      }catch(e){
        aiError=e instanceof Error?e.message:String(e);provider="deterministic-fallback";
        console.warn("knowledge assistant AI fallback",aiError);
      }
    }

    const message=relevant.length
      ? (language==="en"?"I found published Knowledge articles specifically related to this request.":"Encontré artículos publicados de Knowledge relacionados específicamente con esta solicitud.")
      : mode==="full"?(language==="en"?"No published Knowledge article has enough specific relevance.":"No encontré un artículo publicado de Knowledge con relevancia específica suficiente."):"";

    console.log(JSON.stringify({event:"knowledge_assistant_result",provider,mode,ai_configured:aiConfigured,ai_error:aiError||null,published_articles:scored.length,evaluated:candidates.length,relevant:relevant.length,anchors:queryAnchors}));
    return new Response(JSON.stringify({ok:true,provider,mode,ai_configured:aiConfigured,message,evaluated:candidates.length,published_articles:scored.length,articles:relevant.map((a:any)=>({
      id:a.id,active_version_id:a.active_version_id,title:a.title,summary:clean(a.summary||a.content,240),tags:a.tags,product_id:a.product_id,module_id:a.module_id,category_id:a.category_id,category_name:a.category_name,relevance:Number(a.relevance.toFixed(3)),match_reason:a.reason,matched_terms:a.matched
    }))}),{headers:jsonHeaders});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    console.error("trobbu-knowledge-assistant:",message);
    return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders});
  }
});
