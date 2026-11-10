import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const words=(v:string)=>new Set(norm(v).split(/\s+/).filter(x=>x.length>2));
function scoreArticle(a:any,q:string){const qWords=words(q);if(!qWords.size)return 0;const title=words(a.title||"");const summary=words(a.summary||"");const tags=words((a.tags||[]).join(" "));const content=words(String(a.content||"").slice(0,12000));let s=0;qWords.forEach(w=>{if(title.has(w))s+=6;if(tags.has(w))s+=5;if(summary.has(w))s+=3;if(content.has(w))s+=1});return s}
function extractText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text;for(const item of payload?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")return c.text;return ""}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
    const body=await req.json();const workspaceId=String(body.workspace_id||"");const title=String(body.title||"").slice(0,500);const description=String(body.description||"").slice(0,4000);if(!workspaceId)throw new Error("workspace_id is required");
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser(token);if(userError||!userData.user)throw new Error("Invalid session");
    const {data,error}=await client.from("knowledge_articles").select("id,title,summary,content,tags,product_id,module_id,updated_at").eq("workspace_id",workspaceId).eq("status","published").limit(100);if(error)throw error;
    const query=`${title} ${description}`.trim();
    let candidates=(data||[]).map(a=>({...a,score:scoreArticle(a,query)})).filter(a=>a.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
    let message=candidates.length?"Encontré artículos que podrían resolver tu duda antes de crear el ticket.":"No encontré un artículo claramente relacionado; puedes continuar con el ticket.";
    let provider="deterministic";
    const gatewayKey=Deno.env.get("AI_GATEWAY_API_KEY"),openaiKey=Deno.env.get("OPENAI_API_KEY");
    if(candidates.length&&(gatewayKey||openaiKey)){
      const isGateway=Boolean(gatewayKey),apiKey=gatewayKey||openaiKey!;const model=isGateway?(Deno.env.get("TROBBU_AI_MODEL")||"openai/gpt-6-luna"):(Deno.env.get("TROBBU_OPENAI_MODEL")||"gpt-6-luna");const endpoint=isGateway?"https://ai-gateway.vercel.sh/v1/responses":"https://api.openai.com/v1/responses";
      try{
        const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:[{role:"developer",content:"Eres el asistente interno de Knowledge de TROBBU. Con base exclusivamente en los artículos candidatos, indica en una frase si conviene leer alguno antes de crear un ticket. No inventes información. Devuelve solo una recomendación breve en español."},{role:"user",content:`Solicitud: ${query}\nArtículos candidatos: ${JSON.stringify(candidates.map(a=>({title:a.title,summary:a.summary,tags:a.tags})))}`} ]})});
        const payload=await res.json();if(res.ok){const txt=extractText(payload).trim();if(txt)message=txt;provider=isGateway?"vercel-ai-gateway":"openai-responses"}
      }catch{}
    }
    return new Response(JSON.stringify({ok:true,message,provider,articles:candidates.slice(0,3).map(a=>({id:a.id,title:a.title,summary:a.summary,tags:a.tags,product_id:a.product_id,module_id:a.module_id,content_preview:String(a.content||"").slice(0,800)}))}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(error){const message=error instanceof Error?error.message:"Unknown error";console.error("trobbu-knowledge-assistant:",message);return new Response(JSON.stringify({error:message}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
