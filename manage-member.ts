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

function cleanPermissions(value:any){
  const out:any={};
  if(!value||typeof value!=="object")return out;
  for(const key of PERMISSIONS)if(typeof value[key]==="boolean")out[key]=value[key];
  return out;
}
function optionalLimit(value:any){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>500)throw new Error("Los límites de Helpdesk deben ser enteros entre 0 y 500.");
  return n;
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
    const {data:target,error:targetError}=await admin.from("workspace_members").select("role,role_id,active,all_products,permissions,helpdesk_routing_description,helpdesk_auto_assign_enabled,helpdesk_daily_limit,helpdesk_active_limit,helpdesk_overflow_mode,helpdesk_overflow_user_id").eq("workspace_id",workspaceId).eq("user_id",targetUserId).maybeSingle();
    if(targetError)throw targetError;
    if(!target)throw new Error("El usuario no pertenece al workspace.");
    if(target.role==="superadmin"&&caller.role!=="superadmin")return new Response(JSON.stringify({error:"Solo un Superadmin puede modificar a otro Superadmin."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});

    if(action==="update_member"){
      const roleId=String(body.role_id||"");
      if(!roleId)throw new Error("Selecciona un rol válido.");
      const {data:roleDef,error:roleError}=await admin.from("workspace_roles").select("id,workspace_id,code,base_role,active,protected").eq("id",roleId).eq("workspace_id",workspaceId).maybeSingle();
      if(roleError)throw roleError;
      if(!roleDef||roleDef.active===false)throw new Error("El rol seleccionado no está disponible en este workspace.");
      const callerIsSuper=caller.role==="superadmin"||callerRole?.code==="superadmin"||callerRole?.base_role==="superadmin";
      const targetIsSelf=targetUserId===userData.user.id;
      if(roleDef.code==="superadmin"&&!callerIsSuper)return new Response(JSON.stringify({error:"Solo un Superadmin puede asignar el rol Superadmin."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
      if(targetIsSelf&&target.role==="superadmin"&&(roleDef.code!=="superadmin"||body.active===false))throw new Error("No puedes retirar ni degradar tu propio acceso Superadmin.");

      const email=String(body.email||"").trim().toLowerCase();
      const fullName=String(body.full_name||"").trim();
      const jobTitle=String(body.job_title||"").trim();
      if(!email||!email.includes("@"))throw new Error("Ingresa un correo válido.");
      if(fullName.length>160||jobTitle.length>160)throw new Error("Nombre o puesto demasiado largo.");
      const routingDescription=String(body.helpdesk_routing_description||"").trim();
      if(routingDescription.length>1600)throw new Error("La descripción de enrutamiento es demasiado larga.");
      const portal=roleDef.code==="helpdesk_requester";
      const autoAssign=portal?false:Boolean(body.helpdesk_auto_assign_enabled);
      if(autoAssign&&routingDescription.length<12)throw new Error("Describe con al menos 12 caracteres qué temas atiende este usuario para habilitar la autoasignación.");
      const dailyLimit=portal?null:optionalLimit(body.helpdesk_daily_limit);
      const activeLimit=portal?null:optionalLimit(body.helpdesk_active_limit);
      const overflowMode=portal?"inherit":String(body.helpdesk_overflow_mode||"inherit");
      if(!["inherit","fallback","next_available","queue"].includes(overflowMode))throw new Error("Modo de desborde Helpdesk inválido.");
      let overflowUserId=portal?null:(body.helpdesk_overflow_user_id?String(body.helpdesk_overflow_user_id):null);
      if(overflowUserId){
        const {data:overflow}=await admin.from("workspace_members").select("user_id,active").eq("workspace_id",workspaceId).eq("user_id",overflowUserId).maybeSingle();
        if(!overflow?.active)throw new Error("El responsable de respaldo no está activo en este workspace.");
      }
      const permissions=roleDef.code==="superadmin"||portal?{}:cleanPermissions(body.permissions);
      const allProducts=roleDef.code==="superadmin"?true:portal?false:Boolean(body.all_products);
      let productIds=portal||allProducts?[]:(Array.isArray(body.product_ids)?[...new Set(body.product_ids.map((x:any)=>String(x)).filter(Boolean))]:[]);
      if(productIds.length){
        const {data:validProducts,error:productError}=await admin.from("products").select("id").eq("workspace_id",workspaceId).in("id",productIds);
        if(productError)throw productError;
        if((validProducts||[]).length!==productIds.length)throw new Error("Uno o más productos no pertenecen a este workspace.");
      }
      const {data:duplicateProfile,error:dupError}=await admin.from("profiles").select("id").eq("email",email).neq("id",targetUserId).limit(1);
      if(dupError)throw dupError;
      if((duplicateProfile||[]).length)throw new Error("Ese correo ya pertenece a otro usuario.");

      const [{data:oldProfile,error:profileReadError},{data:oldProducts,error:productsReadError},{data:currentAuth,error:authReadError}]=await Promise.all([
        admin.from("profiles").select("full_name,email,job_title").eq("id",targetUserId).maybeSingle(),
        admin.from("workspace_member_products").select("product_id").eq("workspace_id",workspaceId).eq("user_id",targetUserId),
        admin.auth.admin.getUserById(targetUserId)
      ]);
      if(profileReadError)throw profileReadError;if(productsReadError)throw productsReadError;if(authReadError||!currentAuth?.user)throw authReadError||new Error("No se encontró el usuario de autenticación.");
      const oldMember={...target};
      const oldMeta=currentAuth.user.user_metadata||{};
      const rollback=async()=>{
        await admin.from("profiles").update({email:oldProfile?.email||currentAuth.user.email||null,full_name:oldProfile?.full_name||null,job_title:oldProfile?.job_title||null,updated_at:new Date().toISOString()}).eq("id",targetUserId);
        await admin.from("workspace_members").update(oldMember).eq("workspace_id",workspaceId).eq("user_id",targetUserId);
        await admin.from("workspace_member_products").delete().eq("workspace_id",workspaceId).eq("user_id",targetUserId);
        if((oldProducts||[]).length)await admin.from("workspace_member_products").insert((oldProducts||[]).map((x:any)=>({workspace_id:workspaceId,user_id:targetUserId,product_id:x.product_id})));
        await admin.auth.admin.updateUserById(targetUserId,{email:currentAuth.user.email||undefined,email_confirm:true,user_metadata:oldMeta});
      };
      try{
        const {error:memberError}=await admin.from("workspace_members").update({
          role_id:roleDef.id,role:roleDef.base_role,active:body.active!==false,all_products:allProducts,permissions,
          helpdesk_routing_description:portal?null:(routingDescription||null),helpdesk_auto_assign_enabled:autoAssign,
          helpdesk_daily_limit:dailyLimit,helpdesk_active_limit:activeLimit,helpdesk_overflow_mode:overflowMode,
          helpdesk_overflow_user_id:overflowUserId
        }).eq("workspace_id",workspaceId).eq("user_id",targetUserId);
        if(memberError)throw memberError;
        const {error:profileError}=await admin.from("profiles").update({email,full_name:fullName||null,job_title:jobTitle||null,updated_at:new Date().toISOString()}).eq("id",targetUserId);
        if(profileError)throw profileError;
        const {error:deleteProductsError}=await admin.from("workspace_member_products").delete().eq("workspace_id",workspaceId).eq("user_id",targetUserId);
        if(deleteProductsError)throw deleteProductsError;
        if(!allProducts&&productIds.length){const {error:insertProductsError}=await admin.from("workspace_member_products").insert(productIds.map((product_id:string)=>({workspace_id:workspaceId,user_id:targetUserId,product_id})));if(insertProductsError)throw insertProductsError;}
        const {data:authUser,error:authError}=await admin.auth.admin.updateUserById(targetUserId,{email,email_confirm:true,user_metadata:{...oldMeta,full_name:fullName||null}});
        if(authError)throw authError;
        return new Response(JSON.stringify({ok:true,user_id:targetUserId,email:authUser.user?.email||email,role_id:roleDef.id,role:roleDef.base_role,active:body.active!==false,all_products:allProducts,product_ids:productIds}),{headers:{...cors,"Content-Type":"application/json"}});
      }catch(error){
        try{await rollback()}catch(rollbackError){console.error("manage-member rollback failed",rollbackError)}
        throw error;
      }
    }
    if(action==="remove_member"){
      if(targetUserId===userData.user.id)throw new Error("No puedes retirarte a ti mismo desde esta pantalla.");
      const callerIsSuper=caller.role==="superadmin"||callerRole?.code==="superadmin"||callerRole?.base_role==="superadmin";
      if(target.role==="superadmin"&&!callerIsSuper)return new Response(JSON.stringify({error:"Solo un Superadmin puede retirar a otro Superadmin."}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
      // workspace_member_products has ON DELETE CASCADE from workspace_members, so delete only the membership.
      // This keeps removal atomic at the database level and avoids a partial delete if the membership operation fails.
      const {error:memberError}=await admin.from("workspace_members").delete().eq("workspace_id",workspaceId).eq("user_id",targetUserId);if(memberError)throw memberError;
      return new Response(JSON.stringify({ok:true,user_id:targetUserId,removed:true}),{headers:{...cors,"Content-Type":"application/json"}});
    }

    if(action==="update_profile"){
      const email=String(body.email||"").trim().toLowerCase();
      const fullName=String(body.full_name||"").trim();
      const jobTitle=String(body.job_title||"").trim();
      if(!email||!email.includes("@"))throw new Error("Ingresa un correo válido.");
      if(fullName.length>160||jobTitle.length>160)throw new Error("Nombre o puesto demasiado largo.");
      const {data:currentAuth}=await admin.auth.admin.getUserById(targetUserId);
      const currentMeta=currentAuth?.user?.user_metadata||{};
      const {data:authUser,error:authError}=await admin.auth.admin.updateUserById(targetUserId,{email,email_confirm:true,user_metadata:{...currentMeta,full_name:fullName||null}});
      if(authError)throw authError;
      const {error:profileError}=await admin.from("profiles").update({email,full_name:fullName||null,job_title:jobTitle||null,updated_at:new Date().toISOString()}).eq("id",targetUserId);
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
    const message=error instanceof Error?error.message:String((error as any)?.message||(error as any)?.error||error||"Unknown error");
    console.error("manage-member:",message);
    return new Response(JSON.stringify({error:message}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});
