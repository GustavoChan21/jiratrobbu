import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const PROD_APP_URL = "https://gustavochan21.github.io/jiratrobbu/";
const ROLES = ["superadmin","admin","pm","dev","qa","consulta"] as const;
const PERMISSIONS = [
  "view_dashboard","view_tickets","create_tickets","edit_tickets","delete_tickets",
  "manage_sprints","qa_review","manage_helpdesk","manage_staff","manage_products","manage_settings",
] as const;

function defaults(role: string) {
  const all = Object.fromEntries(PERMISSIONS.map(k => [k, true]));
  if (role === "superadmin" || role === "admin") return all;
  if (role === "pm") return {...all, manage_staff:false, manage_products:false, manage_settings:false};
  if (role === "dev") return {view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_settings:false};
  if (role === "qa") return {view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:true,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_settings:false};
  return {view_dashboard:true,view_tickets:true,create_tickets:false,edit_tickets:false,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_settings:false};
}
function effective(role: string, overrides: Record<string, unknown> | null | undefined) {
  const base = defaults(role);
  for (const key of PERMISSIONS) if (typeof overrides?.[key] === "boolean") base[key] = overrides[key] as boolean;
  if (role === "superadmin") return defaults("superadmin");
  return base;
}
function cleanOverrides(role: string, raw: Record<string, unknown> | null | undefined) {
  if (role === "superadmin") return {};
  const base = defaults(role);
  const out: Record<string, boolean> = {};
  for (const key of PERMISSIONS) {
    if (typeof raw?.[key] === "boolean" && raw[key] !== base[key]) out[key] = raw[key] as boolean;
  }
  return out;
}
function safeRedirect(value: unknown) {
  try {
    const candidate = new URL(String(value || PROD_APP_URL));
    if (candidate.protocol === "https:" && candidate.hostname === "gustavochan21.github.io" &&
        (candidate.pathname === "/jiratrobbu" || candidate.pathname.startsWith("/jiratrobbu/"))) return candidate.toString();
  } catch {}
  return PROD_APP_URL;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken:false, persistSession:false },
    });
    const { data:userData, error:userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session");

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    const role = String(body.role ?? "");
    const workspaceId = String(body.workspace_id ?? "");
    const requestedAllProducts = Boolean(body.all_products);
    const productIds = Array.isArray(body.product_ids) ? [...new Set(body.product_ids.map(String))] : [];
    const permissionOverrides = cleanOverrides(role, (body.permissions ?? {}) as Record<string, unknown>);
    if (!email || !workspaceId) throw new Error("email and workspace_id are required");
    if (!ROLES.includes(role as any)) throw new Error("Invalid role");

    const { data:caller } = await admin.from("workspace_members")
      .select("role,active,permissions")
      .eq("workspace_id",workspaceId).eq("user_id",userData.user.id).maybeSingle();
    if (!caller?.active || !effective(caller.role, caller.permissions).manage_staff) {
      return new Response(JSON.stringify({error:"You do not have permission to manage Staff"}), {status:403,headers:{...cors,"Content-Type":"application/json"}});
    }
    if (role === "superadmin" && caller.role !== "superadmin") {
      return new Response(JSON.stringify({error:"Only a Superadmin can grant the Superadmin role"}), {status:403,headers:{...cors,"Content-Type":"application/json"}});
    }

    const forcedAll = role === "superadmin" || role === "admin";
    const allProducts = forcedAll || requestedAllProducts;
    if (!allProducts) {
      if (!productIds.length) throw new Error("Select at least one product");
      const { data:validProducts, error:productsError } = await admin.from("products")
        .select("id").eq("workspace_id",workspaceId).in("id",productIds);
      if (productsError) throw productsError;
      if ((validProducts?.length ?? 0) !== productIds.length) throw new Error("One or more selected products do not belong to this workspace");
    }

    const redirectTo = safeRedirect(body.redirect_to);
    await admin.from("workspace_invites").upsert({
      workspace_id:workspaceId,email,role,invited_by:userData.user.id,status:"pending",accepted_at:null,
    }, {onConflict:"workspace_id,email"});

    let userId: string | null = null;
    let invitationSent = false;
    let confirmed = false;
    const meta: Record<string, unknown> = {workspace_id:workspaceId,role};
    if (fullName) meta.full_name = fullName;

    const {data:inviteData,error:inviteError} = await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:meta});
    if (inviteData?.user?.id) {
      userId=inviteData.user.id; invitationSent=true; confirmed=Boolean(inviteData.user.email_confirmed_at);
    }
    if (inviteError) {
      const {data:users,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
      if (listError) throw listError;
      const existing=users.users.find(u=>u.email?.toLowerCase()===email);
      if (!existing) throw inviteError;
      userId=existing.id; confirmed=Boolean(existing.email_confirmed_at);
      if (fullName) {
        const {data:profile}=await admin.from("profiles").select("full_name").eq("id",existing.id).maybeSingle();
        if (!profile?.full_name) await admin.from("profiles").update({full_name:fullName}).eq("id",existing.id);
      }
    }
    if (!userId) throw new Error("Unable to resolve invited user");

    const {data:existingMembership}=await admin.from("workspace_members").select("role").eq("workspace_id",workspaceId).eq("user_id",userId).maybeSingle();
    if (existingMembership?.role === "superadmin" && caller.role !== "superadmin") {
      return new Response(JSON.stringify({error:"Only a Superadmin can modify another Superadmin"}), {status:403,headers:{...cors,"Content-Type":"application/json"}});
    }

    const {error:memberError}=await admin.from("workspace_members").upsert({
      workspace_id:workspaceId,user_id:userId,role,active:true,all_products:allProducts,permissions:permissionOverrides,
    },{onConflict:"workspace_id,user_id"});
    if (memberError) throw memberError;

    const {error:clearError}=await admin.from("workspace_member_products").delete().eq("workspace_id",workspaceId).eq("user_id",userId);
    if (clearError) throw clearError;
    if (!allProducts && productIds.length) {
      const {error:accessError}=await admin.from("workspace_member_products").insert(productIds.map(product_id=>({
        workspace_id:workspaceId,user_id:userId,product_id,
      })));
      if (accessError) throw accessError;
    }

    await admin.from("workspace_invites").update({
      status:confirmed?"accepted":"pending",accepted_at:confirmed?new Date().toISOString():null,
    }).eq("workspace_id",workspaceId).eq("email",email);

    return new Response(JSON.stringify({
      ok:true,user_id:userId,invitation_sent:invitationSent,membership_active:true,
      status:confirmed?"accepted":"pending",role,all_products:allProducts,products:allProducts?"all":productIds.length,
      redirect_to:redirectTo,
    }), {headers:{...cors,"Content-Type":"application/json"}});
  } catch (error) {
    return new Response(JSON.stringify({error:error instanceof Error?error.message:"Unknown error"}), {
      status:400,headers:{...cors,"Content-Type":"application/json"},
    });
  }
});
