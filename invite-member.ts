import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const PROD_APP_URL="https://gustavochan21.github.io/jiratrobbu/";
const PERMISSIONS=["view_dashboard","view_tickets","create_tickets","edit_tickets","delete_tickets","manage_sprints","qa_review","manage_helpdesk","manage_staff","manage_products","manage_settings"] as const;

function safeRedirect(value:unknown){
  try{
    const u=new URL(String(value||PROD_APP_URL));
    if(u.protocol==="https:"&&u.hostname==="gustavochan21.github.io"&&(u.pathname==="/jiratrobbu"||u.pathname.startsWith("/jiratrobbu/")))return u.toString();
  }catch{}
  return PROD_APP_URL;
}
function randomPassword(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const a=new Uint32Array(18);crypto.getRandomValues(a);
  return Array.from(a,n=>chars[n%chars.length]).join("");
}
function legacyRole(value:string){
  if(value==="reporter")return {code:"consulta",extra:{create_tickets:true}};
  if(value==="viewer")return {code:"consulta",extra:{}};
  return {code:value,extra:{}};
}
function cleanOverrides(raw:Record<string,unknown>|null|undefined,extra:Record<string,boolean>={}){
  const out:Record<string,boolean>={...extra};
  for(const k of PERMISSIONS)if(typeof raw?.[k]==="boolean")out[k]=raw[k] as boolean;
  return out;
}
async function findUserByEmail(admin:any,email:string){
  for(let page=1;page<=20;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
    if(error)throw error;
    const found=data.users.find((u:any)=>u.email?.toLowerCase()===email);
    if(found)return found;
    if(data.users.length<100)break;
  }
  return null;
}
function memberPermission(member:any, role:any, permission:string){
  if(member?.role==="superadmin")return true;
  if(typeof member?.permissions?.[permission]==="boolean")return member.permissions[permission];
  if(typeof role?.permissions?.[permission]==="boolean")return role.permissions[permission];
  const base=role?.base_role||member?.role||"consulta";
  const defaults:any={
    superadmin:Object.fromEntries(PERMISSIONS.map(k=>[k,true])),
    admin:Object.fromEntries(PERMISSIONS.map(k=>[k,true])),
    pm:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:true,manage_sprints:true,qa_review:true,manage_helpdesk:true},
    dev:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true},
    qa:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,qa_review:true},
    consulta:{view_dashboard:true,view_tickets:true},
  };
  return Boolean(defaults[base]?.[permission]);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")??"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await admin.auth.getUser(token);
    if(userError||!userData.user)throw new Error("Invalid session");

    const body=await req.json();
    const email=String(body.email??"").trim().toLowerCase();
    const fullName=String(body.full_name??"").trim();
    const workspaceId=String(body.workspace_id??"");
    if(!email||!workspaceId)throw new Error("email and workspace_id are required");

    const {data:caller,error:callerError}=await admin.from("workspace_members")
      .select("role,role_id,active,permissions").eq("workspace_id",workspaceId).eq("user_id",userData.user.id).maybeSingle();
    if(callerError)throw callerError;
    const {data:callerRole}=caller?.role_id?await admin.from("workspace_roles").select("*").eq("id",caller.role_id).maybeSingle():{data:null};
    if(!caller?.active||!memberPermission(caller,callerRole,"manage_staff")){
      return new Response(JSON.stringify({error:"No tienes permiso para administrar Staff en este workspace."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
    }

    const normalized=legacyRole(String(body.role??"consulta"));
    let role:any=null;
    if(body.role_id){
      const {data,error}=await admin.from("workspace_roles").select("*").eq("id",String(body.role_id)).eq("workspace_id",workspaceId).eq("active",true).maybeSingle();
      if(error)throw error;role=data;
    }else{
      const {data,error}=await admin.from("workspace_roles").select("*").eq("workspace_id",workspaceId).eq("code",normalized.code).eq("active",true).maybeSingle();
      if(error)throw error;role=data;
    }
    if(!role)throw new Error("El rol seleccionado no existe en este workspace.");
    if((role.code==="superadmin"||role.base_role==="superadmin")&&caller.role!=="superadmin"){
      return new Response(JSON.stringify({error:"Solo un Superadmin puede otorgar Superadmin."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
    }

    const forcedAll=role.code==="superadmin";
    const allProducts=forcedAll||Boolean(body.all_products);
    const productIds=Array.isArray(body.product_ids)?[...new Set(body.product_ids.map(String))]:[];
    if(!allProducts){
      if(!productIds.length)throw new Error("Selecciona al menos un producto.");
      const {data,error}=await admin.from("products").select("id").eq("workspace_id",workspaceId).in("id",productIds);
      if(error)throw error;
      if((data?.length??0)!==productIds.length)throw new Error("Uno o más productos no pertenecen a este workspace.");
    }

    const overrides=role.code==="superadmin"?{}:cleanOverrides((body.permissions??{}) as Record<string,unknown>,normalized.extra);
    const redirectTo=safeRedirect(body.redirect_to);
    let user=await findUserByEmail(admin,email);
    let invitationSent=false;
    let temporaryPassword:string|null=null;
    let inviteErrorMessage:string|null=null;

    if(!user){
      const meta:any={workspace_id:workspaceId,role:role.base_role,role_id:role.id};
      if(fullName)meta.full_name=fullName;
      const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:meta});
      if(data?.user?.id){user=data.user;invitationSent=true;}
      if(error){
        inviteErrorMessage=error.message;
        user=await findUserByEmail(admin,email);
        if(!user){
          temporaryPassword=randomPassword();
          const created=await admin.auth.admin.createUser({
            email,password:temporaryPassword,email_confirm:true,
            user_metadata:meta,
          });
          if(created.error)throw new Error("No se pudo crear el usuario: "+created.error.message);
          user=created.data.user;
        }
      }
    }

    if(!user?.id)throw new Error("No se pudo resolver el usuario.");
    if(fullName){
      const {data:profile}=await admin.from("profiles").select("full_name").eq("id",user.id).maybeSingle();
      if(!profile?.full_name)await admin.from("profiles").update({full_name:fullName}).eq("id",user.id);
    }

    const {data:existing}=await admin.from("workspace_members").select("role,role_id").eq("workspace_id",workspaceId).eq("user_id",user.id).maybeSingle();
    if(existing?.role==="superadmin"&&caller.role!=="superadmin"){
      return new Response(JSON.stringify({error:"Solo un Superadmin puede modificar a otro Superadmin."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
    }

    const {error:memberError}=await admin.from("workspace_members").upsert({
      workspace_id:workspaceId,user_id:user.id,role:role.base_role,role_id:role.id,active:true,
      all_products:allProducts,permissions:overrides,
    },{onConflict:"workspace_id,user_id"});
    if(memberError)throw memberError;

    const {error:clearError}=await admin.from("workspace_member_products").delete().eq("workspace_id",workspaceId).eq("user_id",user.id);
    if(clearError)throw clearError;
    if(!allProducts&&productIds.length){
      const {error}=await admin.from("workspace_member_products").insert(productIds.map(product_id=>({workspace_id:workspaceId,user_id:user.id,product_id})));
      if(error)throw error;
    }

    await admin.from("workspace_invites").upsert({
      workspace_id:workspaceId,email,role:role.base_role,invited_by:userData.user.id,
      status:user.email_confirmed_at||temporaryPassword?"accepted":"pending",
      accepted_at:user.email_confirmed_at||temporaryPassword?new Date().toISOString():null,
    },{onConflict:"workspace_id,email"});

    return new Response(JSON.stringify({
      ok:true,user_id:user.id,role_id:role.id,role_code:role.code,
      invitation_sent:invitationSent,temporary_password:temporaryPassword,
      invite_warning:inviteErrorMessage,membership_active:true,
      status:user.email_confirmed_at||temporaryPassword?"accepted":"pending",
      redirect_to:redirectTo,
    }),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    console.error("invite-member:",message);
    return new Response(JSON.stringify({error:message}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});
