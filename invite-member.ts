import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const PROD_APP_URL = "https://gustavochan21.github.io/jiratrobbu/";
const ROLES = ["superadmin","admin","pm","dev","qa","reporter","viewer"] as const;

function safeRedirect(value: unknown) {
  try {
    const candidate = new URL(String(value || PROD_APP_URL));
    if (
      candidate.protocol === "https:" &&
      candidate.hostname === "gustavochan21.github.io" &&
      (candidate.pathname === "/jiratrobbu" || candidate.pathname.startsWith("/jiratrobbu/"))
    ) return candidate.toString();
  } catch {}
  return PROD_APP_URL;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session");

    const { email, full_name, role, workspace_id, redirect_to } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedName = String(full_name ?? "").trim();
    if (!normalizedEmail || !workspace_id) throw new Error("email and workspace_id are required");
    if (!ROLES.includes(role)) throw new Error("Invalid role");

    const { data: caller } = await admin.from("workspace_members")
      .select("role,active")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!caller?.active || !["superadmin","admin"].includes(caller.role)) {
      return new Response(JSON.stringify({ error: "Only a workspace Superadmin or Admin can manage collaborators" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (role === "superadmin" && caller.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Only a Superadmin can grant the Superadmin role" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const redirectTo = safeRedirect(redirect_to);
    await admin.from("workspace_invites").upsert({
      workspace_id, email: normalizedEmail, role, invited_by: userData.user.id,
      status: "pending", accepted_at: null,
    }, { onConflict: "workspace_id,email" });

    let invitedUserId: string | null = null;
    let invitationSent = false;
    let resolvedConfirmed = false;
    const meta: Record<string, unknown> = { workspace_id, role };
    if (normalizedName) meta.full_name = normalizedName;

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail, { redirectTo, data: meta }
    );
    if (inviteData?.user?.id) {
      invitedUserId = inviteData.user.id;
      invitationSent = true;
      resolvedConfirmed = Boolean(inviteData.user.email_confirmed_at);
    }

    if (inviteError) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      const existing = users.users.find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!existing) throw inviteError;
      invitedUserId = existing.id;
      resolvedConfirmed = Boolean(existing.email_confirmed_at);
      if (normalizedName) {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("id", existing.id).maybeSingle();
        if (!profile?.full_name) await admin.from("profiles").update({ full_name: normalizedName }).eq("id", existing.id);
      }
    }

    if (!invitedUserId) throw new Error("Unable to resolve invited user");

    const { data: existingMembership } = await admin.from("workspace_members")
      .select("role,active")
      .eq("workspace_id",workspace_id).eq("user_id",invitedUserId).maybeSingle();

    if (existingMembership?.role === "superadmin" && caller.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Only a Superadmin can modify another Superadmin" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { error: memberError } = await admin.from("workspace_members").upsert({
      workspace_id,user_id:invitedUserId,role,active:true
    }, { onConflict: "workspace_id,user_id" });
    if (memberError) throw memberError;

    await admin.from("workspace_invites")
      .update({ status: resolvedConfirmed ? "accepted" : "pending", accepted_at: resolvedConfirmed ? new Date().toISOString() : null })
      .eq("workspace_id",workspace_id).eq("email",normalizedEmail);

    return new Response(JSON.stringify({
      ok:true,user_id:invitedUserId,invitation_sent:invitationSent,
      membership_active:true,status:resolvedConfirmed?"accepted":"pending",redirect_to:redirectTo
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status:400, headers:{ ...cors, "Content-Type":"application/json" }
    });
  }
});
