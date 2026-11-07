import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROD_APP_URL = "https://gustavochan21.github.io/jiratrobbu/";

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

    const { email, role, workspace_id, redirect_to } = await req.json();
    if (!email || !workspace_id) throw new Error("email and workspace_id are required");
    if (!["admin","pm","dev","qa","viewer"].includes(role)) throw new Error("Invalid role");

    const { data: membership } = await admin.from("workspace_members")
      .select("role,active")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership?.active || !["admin","pm"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const redirectTo = safeRedirect(redirect_to);

    await admin.from("workspace_invites").upsert({
      workspace_id, email: normalizedEmail, role, invited_by: userData.user.id, status: "pending"
    }, { onConflict: "workspace_id,email" });

    let invitedUserId: string | null = null;
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo, data: { workspace_id, role } }
    );
    if (inviteData?.user?.id) invitedUserId = inviteData.user.id;

    if (inviteError) {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = users.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (!existing) throw inviteError;
      invitedUserId = existing.id;
    }

    if (!invitedUserId) throw new Error("Unable to resolve invited user");

    const { error: memberError } = await admin.from("workspace_members").upsert({
      workspace_id, user_id: invitedUserId, role, active: true
    }, { onConflict: "workspace_id,user_id" });
    if (memberError) throw memberError;

    await admin.from("workspace_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
      .eq("email", normalizedEmail);

    return new Response(JSON.stringify({ ok: true, user_id: invitedUserId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
