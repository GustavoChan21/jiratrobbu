import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session");

    const { email, role, workspace_id, redirect_to } = await req.json();
    if (!email || !workspace_id) throw new Error("email and workspace_id are required");
    if (!["admin", "pm", "dev", "qa", "viewer"].includes(role)) throw new Error("Invalid role");

    const { data: membership } = await admin.from("workspace_members").select("role,active")
      .eq("workspace_id", workspace_id).eq("user_id", userData.user.id).maybeSingle();
    if (!membership?.active || !["admin", "pm"].includes(membership.role)) return json({ error: "Forbidden" }, 403);

    const normalized = String(email).trim().toLowerCase();
    await admin.from("workspace_invites").upsert({ workspace_id, email: normalized, role, invited_by: userData.user.id, status: "pending" }, { onConflict: "workspace_id,email" });

    let invitedUserId: string | null = null;
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalized,
      redirect_to ? { redirectTo: redirect_to, data: { workspace_id, role } } : { data: { workspace_id, role } }
    );
    if (inviteData?.user?.id) invitedUserId = inviteData.user.id;

    if (inviteError) {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = users.users.find((u) => u.email?.toLowerCase() === normalized);
      if (!existing) throw inviteError;
      invitedUserId = existing.id;
    }

    if (!invitedUserId) throw new Error("Unable to resolve invited user");
    const { error: memberError } = await admin.from("workspace_members").upsert({ workspace_id, user_id: invitedUserId, role, active: true }, { onConflict: "workspace_id,user_id" });
    if (memberError) throw memberError;

    await admin.from("workspace_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("workspace_id", workspace_id).eq("email", normalized);
    return json({ ok: true, user_id: invitedUserId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
