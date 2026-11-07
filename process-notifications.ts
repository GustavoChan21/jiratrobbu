import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type QueueRow = {
  id: number;
  event_type: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  payload: Record<string, unknown> | null;
  ticket_id: string | null;
  attempts: number;
};

function subjectFor(eventType: string, key: string) {
  if (eventType === "assigned_dev") return `[${key}] Ticket asignado a Desarrollo`;
  if (eventType === "assigned_qa") return `[${key}] Ticket asignado a QA`;
  if (eventType === "qa_rejected") return `[${key}] Regresado por QA - requiere corrección`;
  return `[${key}] Nuevo ticket creado`;
}

function htmlFor(row: QueueRow) {
  const key = String(row.payload?.ticket_key ?? "TICKET");
  const title = String(row.payload?.title ?? "Ticket");
  const isRejected = row.event_type === "qa_rejected";
  const heading = isRejected
    ? "Ticket regresado por QA"
    : row.event_type === "ticket_created"
      ? "Nuevo ticket creado"
      : "Ticket asignado";
  const message = isRejected
    ? "El ticket requiere correcciones antes de volver a revisión."
    : "Ingresa a Jira Interno TROBBU para revisar el detalle y continuar el flujo.";

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#21343E;background:#F6F7F8;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #D4DCE0;border-radius:14px;padding:28px"><div style="font-size:12px;font-weight:700;color:#4D5A51;letter-spacing:.08em">TROBBU · JIRA INTERNO</div><h2 style="margin:10px 0 18px">${heading}</h2><p style="font-size:16px"><strong>${key}</strong> · ${title}</p><p style="color:#4D5A51">${message}</p></div></body></html>`;
}

async function sendWithResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Resend: ${await response.text()}`);
}

async function sendWithMailgun(apiKey: string, domain: string, baseUrl: string, from: string, to: string, subject: string, html: string) {
  const form = new FormData();
  form.set("from", from);
  form.set("to", to);
  form.set("subject", subject);
  form.set("html", html);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v3/${domain}/messages`, {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Mailgun: ${await response.text()}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session");

    const { workspace_id, status_only = false } = await req.json();
    if (!workspace_id) throw new Error("workspace_id is required");

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role,active")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership?.active) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: settings } = await admin
      .from("workspace_settings")
      .select("email_notifications")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const mailgunKey = Deno.env.get("MAILGUN_API_KEY");
    const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN");
    const mailgunBaseUrl = Deno.env.get("MAILGUN_BASE_URL") ?? "https://api.mailgun.net";
    const emailFrom = Deno.env.get("EMAIL_FROM") ?? (mailgunDomain ? `Jira Interno TROBBU <jira@${mailgunDomain}>` : "");
    const provider = resendKey ? "resend" : (mailgunKey && mailgunDomain ? "mailgun" : null);

    if (status_only) {
      return new Response(JSON.stringify({
        ok: true,
        configured: Boolean(provider && emailFrom),
        provider,
        email_notifications: settings?.email_notifications !== false,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (settings && settings.email_notifications === false) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "email_notifications_disabled", configured: Boolean(provider && emailFrom), provider }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: rows, error: rowsError } = await admin
      .from("notification_outbox")
      .select("id,event_type,recipient_user_id,recipient_email,payload,ticket_id,attempts,status")
      .eq("workspace_id", workspace_id)
      .in("status", ["pending", "failed"])
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(30);
    if (rowsError) throw rowsError;

    if (!provider || !emailFrom) {
      return new Response(JSON.stringify({
        ok: false,
        configured: false,
        provider: null,
        pending: rows?.length ?? 0,
        required: ["RESEND_API_KEY + EMAIL_FROM", "or MAILGUN_API_KEY + MAILGUN_DOMAIN (+ optional EMAIL_FROM)"],
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    let sent = 0;
    let failed = 0;

    for (const raw of rows ?? []) {
      const row = raw as QueueRow;
      const attempt = Number(row.attempts ?? 0) + 1;
      await admin.from("notification_outbox").update({ status: "processing", attempts: attempt }).eq("id", row.id);

      try {
        let recipient = row.recipient_email;
        if (!recipient && row.recipient_user_id) {
          const { data: recipientData } = await admin.auth.admin.getUserById(row.recipient_user_id);
          recipient = recipientData.user?.email ?? null;
        }
        if (!recipient) throw new Error("Recipient email not found");

        const key = String(row.payload?.ticket_key ?? "TICKET");
        const subject = subjectFor(row.event_type, key);
        const html = htmlFor(row);

        if (provider === "resend") await sendWithResend(resendKey!, emailFrom, recipient, subject, html);
        else await sendWithMailgun(mailgunKey!, mailgunDomain!, mailgunBaseUrl, emailFrom, recipient, subject, html);

        await admin.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
        sent += 1;
      } catch (error) {
        await admin.from("notification_outbox").update({ status: "failed", last_error: error instanceof Error ? error.message : "Unknown error" }).eq("id", row.id);
        failed += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, configured: true, provider, sent, failed }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
