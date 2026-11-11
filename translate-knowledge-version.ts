import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const jsonHeaders={...cors,"Content-Type":"application/json"};

async function sha256(value:string){
  const data=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function extractText(payload:any){
  if(typeof payload?.output_text==="string") return payload.output_text;
  for(const item of payload?.output||[]) for(const c of item?.content||[]) if(typeof c?.text==="string") return c.text;
  return "";
}
function compactBlocks(blocks:any[]){
  return (blocks||[]).map(b=>({
    id:String(b.id||""),type:String(b.type||"paragraph"),
    text:typeof b.text==="string"?b.text:"",html:typeof b.html==="string"?b.html:"",
    alt:typeof b.alt==="string"?b.alt:"",caption:typeof b.caption==="string"?b.caption:"",
    eyebrow:typeof b.eyebrow==="string"?b.eyebrow:"",title:typeof b.title==="string"?b.title:"",
    subtitle:typeof b.subtitle==="string"?b.subtitle:"",meta:typeof b.meta==="string"?b.meta:""
  }));
}
function mergeBlocks(source:any[],translated:any[]){
  const byId=new Map((translated||[]).map((x:any)=>[String(x.id||""),x]));
  return (source||[]).map((b:any)=>{const t=byId.get(String(b.id||""))||{};return {...b,
    ...(typeof b.text==="string"?{text:typeof (t as any).text==="string"?(t as any).text:b.text}:{}),
    ...(typeof b.html==="string"?{html:typeof (t as any).html==="string"?(t as any).html:b.html}:{}),
    ...(typeof b.alt==="string"?{alt:typeof (t as any).alt==="string"?(t as any).alt:b.alt}:{}),
    ...(typeof b.caption==="string"?{caption:typeof (t as any).caption==="string"?(t as any).caption:b.caption}:{}),
    ...(typeof b.eyebrow==="string"?{eyebrow:typeof (t as any).eyebrow==="string"?(t as any).eyebrow:b.eyebrow}:{}),
    ...(typeof b.title==="string"?{title:typeof (t as any).title==="string"?(t as any).title:b.title}:{}),
    ...(typeof b.subtitle==="string"?{subtitle:typeof (t as any).subtitle==="string"?(t as any).subtitle:b.subtitle}:{}),
    ...(typeof b.meta==="string"?{meta:typeof (t as any).meta==="string"?(t as any).meta:b.meta}:{})
  }});
}
function stripHtml(value:string){return String(value||"").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/p\s*>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+\n/g,"\n").replace(/[ \t]+/g," ").trim()}
function plainText(blocks:any[]){
  return (blocks||[]).map((b:any)=>b.type==="richtext"?stripHtml(String(b.html||"")):b.type==="cover"?[b.eyebrow,b.title,b.subtitle,b.meta].filter(Boolean).join(" "):["paragraph","heading1","heading2","heading3","heading4","heading5","list","quote","callout","code"].includes(b.type)?String(b.text||""):String(b.caption||"")).filter(Boolean).join("\n\n");
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:jsonHeaders});
    const body=await req.json();
    const versionId=String(body.version_id||"");
    const target=String(body.language||"").toLowerCase();
    if(!versionId||!["es","en"].includes(target)) throw new Error("version_id and language es|en are required");

    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser(token);
    if(userError||!userData.user) throw new Error("Invalid session");

    const {data:version,error:vErr}=await client.from("knowledge_article_versions")
      .select("*,knowledge_articles!inner(id,default_language)").eq("id",versionId).maybeSingle();
    if(vErr) throw vErr;
    if(!version) throw new Error("Knowledge version not found or not visible");

    const sourceLang=version.knowledge_articles?.default_language||"es";
    const sourceObject={title:version.title||"",summary:version.summary||"",tags:version.tags||[],blocks:compactBlocks(version.content_blocks||[])};
    const sourceHash=await sha256(JSON.stringify(sourceObject));

    if(target===sourceLang){
      return new Response(JSON.stringify({ok:true,cached:true,provider:"source",language:target,source_hash:sourceHash,
        translation:{title:version.title,summary:version.summary,content:version.content,content_blocks:version.content_blocks,tags:version.tags||[]}}),{headers:jsonHeaders});
    }

    const {data:cached}=await client.from("knowledge_version_translations").select("*")
      .eq("version_id",versionId).eq("language",target).eq("source_hash",sourceHash).maybeSingle();
    if(cached) return new Response(JSON.stringify({ok:true,cached:true,provider:cached.provider,language:target,source_hash:sourceHash,translation:cached}),{headers:jsonHeaders});

    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const model=Deno.env.get("TROBBU_TRANSLATION_MODEL")||"gpt-5.6-terra";
    const languageName=target==="en"?"English":"Spanish";
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        input:[
          {role:"developer",content:`Translate the provided Knowledge article from ${sourceLang} to ${languageName}. Return JSON only. Preserve IDs and block order. Translate only human-readable text: title, summary, tags, and each block's text/html/alt/caption/eyebrow/title/subtitle/meta. For html, preserve the exact HTML tag hierarchy, attributes, links and formatting; translate only visible human-readable text nodes. Do not translate code syntax, URLs, media IDs, identifiers, or product/module names. Keep technical terminology natural and concise.`},
          {role:"user",content:`Return JSON with this exact shape: {"title":"...","summary":"...","tags":["..."],"blocks":[{"id":"...","text":"...","html":"...","alt":"...","caption":"...","eyebrow":"...","title":"...","subtitle":"...","meta":"..."}]}. Source JSON: ${JSON.stringify(sourceObject)}`}
        ],
        text:{format:{type:"json_object"}}
      })
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload?.error?.message||"Translation request failed");
    const translated=JSON.parse(extractText(payload).trim());
    const merged=mergeBlocks(version.content_blocks||[],translated.blocks||[]);
    const row={workspace_id:version.workspace_id,article_id:version.article_id,version_id:version.id,language:target,source_hash:sourceHash,
      title:String(translated.title||version.title||""),summary:translated.summary==null?version.summary:String(translated.summary),content:plainText(merged),content_blocks:merged,
      tags:Array.isArray(translated.tags)?translated.tags.map(String):version.tags||[],provider:`openai:${model}`,updated_at:new Date().toISOString()};
    const {data:saved,error:saveErr}=await admin.from("knowledge_version_translations").upsert(row,{onConflict:"version_id,language"}).select("*").single();
    if(saveErr) throw saveErr;
    console.log(JSON.stringify({event:"knowledge_translation",version_id:versionId,language:target,cached:false,provider:row.provider}));
    return new Response(JSON.stringify({ok:true,cached:false,provider:row.provider,language:target,source_hash:sourceHash,translation:saved}),{headers:jsonHeaders});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    console.error("translate-knowledge-version:",message);
    return new Response(JSON.stringify({error:message}),{status:400,headers:jsonHeaders});
  }
});
