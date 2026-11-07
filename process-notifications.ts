import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const subjectFor = (eventType: string, key: string) => {
  if (eventType === "assigned_dev") return `[${key}] Ticket asignado a Desarrollo`;
  if (eventType === "assigned_qa") return `[${key}] Ticket asignado a QA`;
  if (eventType === "qa_rejected") return `[${key}] Regresado por QA - requiere corrección`;
  return `[${key}] Nuevo ticket creado`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM") ?? "Jira Interno Trobbu <noreply@trobbu.com>";
    if (!resendKey) return json({ error: "RESEND_API_KEY is not configured" }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session");

    const { workspace_id } = await req.json();
    if (!workspace_id) throw new Error("workspace_id is required");

    const { data: membership } = await admin.from("workspace_members").select("role,active")
      .eq("workspace_id", workspace_id).eq("user_id", userData.user.id).maybeSingle();
    if (!membership?.active) return json({ error: "Forbidden" }, 403);

    const { data: rows, error: rowsError } = await admin.from("notification_outbox")
      .select("id,event_type,recipient_user_id,recipient_email,payload,ticket_id")
      .eq("workspace_id", workspace_id).eq("status", "pending").order("created_at", { ascending: true }).limit(20);
    if (rowsError) throw rowsError;

    let sent = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      await admin.from("notification_outbox").update({ status: "processing", attempts: 1 }).eq("id", row.id);
      try {
        let recipient = row.recipient_email as string | null;
        if (!recipient && row.recipient_user_id) {
          const { data: recipientData } = await admin.auth.admin.getUserById(row.recipient_user_id);
          recipient = recipientData.user?.email ?? null;
        }
        if (!recipient) throw new Error("Recipient email not found");

        const key = String(row.payload?.ticket_key ?? "TICKET");
        const title = String(row.payload?.title ?? "Ticket");
        const html = row.event_type === "qa_rejected"
          ? `<h2>Ticket regresado por QA</h2><p><strong>${key}</strong> · ${title}</p><p>El ticket requiere correcciones antes de volver a revisión.</p>`
          : `<h2>${row.event_type === "ticket_created" ? "Nuevo ticket" : "Ticket asignado"}</h2><p><strong>${key}</strong> · ${title}</p><p>Ingresa a Jira Interno Trobbu para revisar el detalle y continuar el flujo.</p>`;

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: emailFrom, to: [recipient], subject: subjectFor(row.event_type, key), html }),
        });
        if (!response.ok) throw new Error(await response.text());

        await admin.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
        sent += 1;
      } catch (error) {
        await admin.from("notification_outbox").update({ status: "failed", last_error: error instanceof Error ? error.message : "Unknown error" }).eq("id", row.id);
        failed += 1;
      }
    }

    return json({ ok: true, sent, failed });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
