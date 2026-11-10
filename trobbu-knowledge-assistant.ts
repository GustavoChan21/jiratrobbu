import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const words=(v:string)=>new Set(norm(v).split(/\s+/).filter(x=>x.length>2));
function scoreArticle(a:any,q:string){const qWords=words(q);if(!qWords.size)return 0;const title=words(a.title||"");const summary=words(a.summary||"");const tags=words((a.tags||[]).join(" "));const content=words(String(a.content||"").slice(0,12000));let s=0;qWords.forEach(w=>{if(title.has(w))s+=6;if(tags.has(w))s+=5;if(summary.has(w))s+=3;if(content.has(w))s+=1});return s}
function extractText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")return c.text;return ""}
const cleanSnippet=(v:any,max=220)=>{const text=String(v||"").replace(/\\n/g," ").replace(/\r?\n/g," ").replace(/\s+/g," ").trim();return text.length>max?text.slice(0,max-1).trimEnd()+"…":text}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
    const body=await req.json();const workspaceId=String(body.workspace_id||"");const title=String(body.title||"").slice(0,500);const description=String(body.description||"").slice(0,4000);const language=String(body.language||"es")==="en"?"en":"es";if(!workspaceId)throw new Error("workspace_id is required");
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser(token);if(userError||!userData.user)throw new Error("Invalid session");
    const {data,error}=await client.from("knowledge_articles").select("id,title,summary,content,tags,product_id,module_id,updated_at,active_version_id,default_language").eq("workspace_id",workspaceId).eq("status","published").limit(100);if(error)throw error;
    const versionIds=(data||[]).map(a=>a.active_version_id).filter(Boolean);let translationMap=new Map<string,any>();if(versionIds.length){const {data:translations}=await client.from("knowledge_version_translations").select("*").eq("workspace_id",workspaceId).eq("language",language).in("version_id",versionIds);translationMap=new Map((translations||[]).map((t:any)=>[t.version_id,t]))}
    const localized=(data||[]).map(a=>{const t=translationMap.get(a.active_version_id);return t?{...a,title:t.title,summary:t.summary,content:t.content,tags:t.tags||a.tags,translation_cached:true}:{...a,translation_cached:false}});
    const query=`${title} ${description}`.trim();
    let candidates=localized.map(a=>({...a,score:scoreArticle(a,query)})).filter(a=>a.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
    let message=candidates.length?(language==="en"?"I found related articles that may resolve your question before you create the ticket.":"Encontré artículos relacionados que podrían resolver tu duda antes de crear el ticket."):(language==="en"?"I did not find a clearly related article; you can continue creating the ticket.":"No encontré un artículo claramente relacionado; puedes continuar con el ticket.");
    let provider="deterministic";
    const gatewayKey=Deno.env.get("AI_GATEWAY_API_KEY"),openaiKey=Deno.env.get("OPENAI_API_KEY");
    if(candidates.length&&(gatewayKey||openaiKey)){
      const isGateway=Boolean(gatewayKey),apiKey=gatewayKey||openaiKey!;const model=isGateway?(Deno.env.get("TROBBU_AI_MODEL")||"openai/gpt-5.6-terra"):(Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-5.6-terra");const endpoint=isGateway?"https://ai-gateway.vercel.sh/v1/responses":"https://api.openai.com/v1/responses";
      try{
        const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:[{role:"developer",content:`You are TROBBU's internal Knowledge assistant. Based exclusively on the candidate articles, write one short recommendation in ${language==="en"?"English":"Spanish"} explaining whether the user should read one before creating a ticket. Do not invent information.`},{role:"user",content:`Solicitud: ${query}\nArtículos candidatos: ${JSON.stringify(candidates.map(a=>({title:a.title,summary:a.summary,tags:a.tags})))}`} ]})});
        const payload=await res.json();if(res.ok){const txt=extractText(payload).trim();if(txt)message=txt;provider=isGateway?"vercel-ai-gateway":"openai-responses"}
      }catch{}
    }
    console.log(JSON.stringify({event:"knowledge_assistant_result",provider,language,candidates:candidates.length,has_openai_key:Boolean(openaiKey),has_gateway_key:Boolean(gatewayKey)}));
    return new Response(JSON.stringify({ok:true,message,provider,language,articles:candidates.slice(0,3).map(a=>({id:a.id,title:a.title,summary:cleanSnippet(a.summary||a.content,220),tags:a.tags,product_id:a.product_id,module_id:a.module_id,content_preview:cleanSnippet(a.summary||a.content,220),translation_cached:a.translation_cached}))}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(error){const message=error instanceof Error?error.message:"Unknown error";console.error("trobbu-knowledge-assistant:",message);return new Response(JSON.stringify({error:message}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
