import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const PLATFORM_URL="https://jiratrobbu.vercel.app/";
const PERMISSIONS=["view_dashboard","view_tickets","create_tickets","edit_tickets","delete_tickets","manage_sprints","qa_review","manage_helpdesk","view_knowledge","create_knowledge","edit_knowledge","delete_knowledge","view_vacations","request_vacations","view_vacation_projection","manage_vacations","manage_staff","manage_products","manage_ticket_fields","manage_settings"] as const;
function randomPassword(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";const a=new Uint32Array(18);crypto.getRandomValues(a);return Array.from(a,n=>chars[n%chars.length]).join("")}
function memberPermission(member:any,role:any,permission:string){
  if(member?.role==="superadmin")return true;
  if(typeof member?.permissions?.[permission]==="boolean")return member.permissions[permission];
  if(typeof role?.permissions?.[permission]==="boolean")return role.permissions[permission];
  const base=role?.base_role||member?.role||"consulta";
  const defaults:any={superadmin:Object.fromEntries(PERMISSIONS.map(k=>[k,true])),admin:Object.fromEntries(PERMISSIONS.map(k=>[k,true])),pm:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:true,manage_sprints:true,qa_review:true,manage_helpdesk:true,view_knowledge:true,create_knowledge:true,edit_knowledge:true,view_vacations:true,request_vacations:true,view_vacation_projection:true,manage_vacations:true,manage_ticket_fields:true},dev:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,view_knowledge:true,view_vacations:true,request_vacations:true},qa:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,qa_review:true,view_knowledge:true,view_vacations:true,request_vacations:true},consulta:{view_dashboard:true,view_tickets:true,view_knowledge:true,view_vacations:true}};
  return Boolean(defaults[base]?.[permission]);
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await admin.auth.getUser(token);
    if(userError||!userData.user)throw new Error("Invalid session");
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const targetUserId=String(body.user_id||"");
    const action=String(body.action||"");
    if(!workspaceId||!targetUserId)throw new Error("workspace_id and user_id are required");
    const {data:caller,error:callerError}=await admin.from("workspace_members").select("role,role_id,active,permissions").eq("workspace_id",workspaceId).eq("user_id",userData.user.id).maybeSingle();
    if(callerError)throw callerError;
    const {data:callerRole}=caller?.role_id?await admin.from("workspace_roles").select("*").eq("id",caller.role_id).maybeSingle():{data:null};
    if(!caller?.active||!memberPermission(caller,callerRole,"manage_staff"))return new Response(JSON.stringify({error:"No tienes permiso para administrar Staff en este workspace."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
    const {data:target,error:targetError}=await admin.from("workspace_members").select("role,role_id,active").eq("workspace_id",workspaceId).eq("user_id",targetUserId).maybeSingle();
    if(targetError)throw targetError;
    if(!target)throw new Error("El usuario no pertenece al workspace.");
    if(target.role==="superadmin"&&caller.role!=="superadmin")return new Response(JSON.stringify({error:"Solo un Superadmin puede modificar a otro Superadmin."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});

    if(action==="update_profile"){
      const email=String(body.email||"").trim().toLowerCase();
      const fullName=String(body.full_name||"").trim();
      const jobTitle=String(body.job_title||"").trim();
      if(!email||!email.includes("@"))throw new Error("Ingresa un correo válido.");
      if(fullName.length>160||jobTitle.length>160)throw new Error("Nombre o puesto demasiado largo.");
      const {data:authUser,error:authError}=await admin.auth.admin.updateUserById(targetUserId,{email,email_confirm:true,user_metadata:{full_name:fullName||null}});
      if(authError)throw authError;
      const {error:profileError}=await admin.from("profiles").update({full_name:fullName||null,job_title:jobTitle||null,updated_at:new Date().toISOString()}).eq("id",targetUserId);
      if(profileError)throw profileError;
      return new Response(JSON.stringify({ok:true,user_id:targetUserId,email:authUser.user?.email||email,full_name:fullName,job_title:jobTitle}),{headers:{...cors,"Content-Type":"application/json"}});
    }
    if(action==="set_password"){
      const newPassword=String(body.new_password||"");
      if(newPassword.length<10)throw new Error("La nueva contraseña debe tener al menos 10 caracteres.");
      if(newPassword.length>128)throw new Error("La nueva contraseña es demasiado larga.");
      const {data:authUser,error:authError}=await admin.auth.admin.updateUserById(targetUserId,{password:newPassword});
      if(authError)throw authError;
      return new Response(JSON.stringify({ok:true,user_id:targetUserId,email:authUser.user?.email||body.email||"",password_updated:true,platform_url:PLATFORM_URL}),{headers:{...cors,"Content-Type":"application/json"}});
    }
    if(action==="reset_credentials"){
      const temporaryPassword=randomPassword();
      const {data:authUser,error:authError}=await admin.auth.admin.updateUserById(targetUserId,{password:temporaryPassword});
      if(authError)throw authError;
      return new Response(JSON.stringify({ok:true,user_id:targetUserId,email:authUser.user?.email||body.email||"",temporary_password:temporaryPassword,credential_mode:"temporary",platform_url:PLATFORM_URL}),{headers:{...cors,"Content-Type":"application/json"}});
    }
    throw new Error("Unsupported action");
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    console.error("manage-member:",message);
    return new Response(JSON.stringify({error:message}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});
