import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-notification-cron-token",
};
const APP = "https://jiratrobbu.vercel.app/";
const DEFAULT_SENDER_NAME = "Notificaciones Jira x Helpdesk";

// v17.20 keeps the proven low-noise policy from v17.11/v17.19.
// Mentions and intermediate edits remain in-app. Email is reserved for the current
// high-value transactional flow so PROD cannot suddenly fan out hundreds of messages.
const EMAIL_EVENTS = new Set([
  "daily_jira_reminder",
  "helpdesk_assigned",
  "helpdesk_comment",
  "helpdesk_closed",
  "ticket_closed",
]);

const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, (c: string) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c] || c,
  );
const clean = (v: any, n = 480) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};
const emailLike = (v: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

function b64(v: string) {
  const bytes = new TextEncoder().encode(v);
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(out);
}
async function sha(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function urlFor(r: any) {
  const m = r.payload?.metadata || {};
  if (m.entity_type === "helpdesk" && (m.entity_id || r.payload?.helpdesk_ticket_id)) {
    return APP + "?view=helpdesk&helpdesk=" + encodeURIComponent(String(m.entity_id || r.payload.helpdesk_ticket_id));
  }
  if (m.entity_type === "ticket" && (m.entity_id || r.ticket_id)) {
    return APP + "?view=board&ticket=" + encodeURIComponent(String(m.entity_id || r.ticket_id));
  }
  return APP;
}

function priority(v: any) {
  return ({
    lowest: "Muy baja",
    very_low: "Muy baja",
    low: "Baja",
    medium: "Media",
    high: "Alta",
    highest: "Muy alta",
    very_high: "Muy alta",
    blocker: "Crítica",
    critical: "Crítica",
  } as any)[String(v ?? "").toLowerCase()] || String(v ?? "—");
}

function fact(label: string, value: any) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  return '<td style="width:50%;padding:0 6px 12px 0;vertical-align:top"><div style="border:1px solid #E0E6E9;border-radius:10px;padding:12px 14px;background:#FAFBFC"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6B778C;font-weight:800;margin-bottom:5px">' + esc(label) + '</div><div style="font-size:14px;line-height:1.35;color:#172B4D;font-weight:700">' + esc(value) + "</div></div></td>";
}

function htmlDoc(o: any) {
  const fs = (o.facts || []).filter(Boolean);
  const rows: string[] = [];
  for (let i = 0; i < fs.length; i += 2) rows.push("<tr>" + (fs[i] || "") + (fs[i + 1] || "<td></td>") + "</tr>");

  const qa = o.qa
    ? '<div style="margin:0 0 20px;border:1px solid #E5C16D;background:#FFF8E7;color:#6B4B00;border-radius:10px;padding:11px 13px;font-size:11px;line-height:1.45"><strong>ENTREGA QA CONTROLADA</strong><br>Destinatario físico: ' + esc(o.delivered) + (o.intended && String(o.intended).toLowerCase() !== String(o.delivered).toLowerCase() ? " · Destinatario lógico: " + esc(o.intended) : "") + "</div>"
    : "";

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#F3F5F6;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#172B4D"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F5F6;padding:30px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #DDE3E7;border-radius:18px;overflow:hidden"><tr><td style="background:#0C2B2A;padding:24px 30px;border-bottom:4px solid ' + o.accent + '"><div style="font-size:11px;font-weight:900;letter-spacing:.16em;color:#D1AA87">TROBBU · JIRA INTERNO</div><div style="margin-top:9px;font-size:11px;font-weight:800;letter-spacing:.09em;color:#B9C9C6">' + esc(o.eyebrow).toUpperCase() + '</div></td></tr><tr><td style="padding:30px">' + qa + (o.badge ? '<div style="display:inline-block;margin:0 0 13px;background:#F6F8FA;color:' + o.accent + ';border:1px solid ' + o.accent + '55;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900">' + esc(o.badge) + "</div>" : "") + '<h1 style="font-size:25px;line-height:1.22;margin:0 0 12px;color:#0C2B2A">' + esc(o.title) + '</h1><p style="font-size:15px;line-height:1.65;margin:0 0 22px;color:#42526E">' + esc(o.intro) + "</p>" + (o.quote ? '<div style="border-left:4px solid ' + o.accent + ';background:#F7F9FA;border-radius:0 10px 10px 0;padding:15px 17px;margin:0 0 22px;color:#24384B;font-size:14px;line-height:1.55">' + esc(o.quote) + "</div>" : "") + (rows.length ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px">' + rows.join("") + "</table>" : "") + '<a href="' + esc(o.url) + '" style="display:inline-block;margin-top:8px;background:#02488D;color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:12px 20px;border-radius:9px">' + esc(o.cta) + '</a></td></tr><tr><td style="padding:17px 30px;background:#F1E4CD;color:#4D5A51;font-size:11px;line-height:1.5;border-top:1px solid #E1D3BB">Notificación transaccional generada automáticamente por ' + esc(o.senderName || DEFAULT_SENDER_NAME) + ".</td></tr></table></td></tr></table></body></html>";
}

function canonicalSubject(r: any) {
  const p = r.payload || {};
  const m = p.metadata || {};
  if (r.event_type === "daily_jira_reminder") {
    return `[Jira Interno] Recordatorio diario · ${String(m.date || "hoy")}`;
  }
  if (m.entity_type === "helpdesk" || p.helpdesk_ticket_id) {
    const key = String(m.helpdesk_key || "Helpdesk").trim();
    return `[Jira Interno] ${key} · Seguimiento Helpdesk`;
  }
  if (m.entity_type === "ticket" || r.ticket_id) {
    const key = String(m.ticket_key || "Ticket").trim();
    return `[Jira Interno] ${key} · Seguimiento Jira`;
  }
  return `[Jira Interno] ${clean(p.title || r.event_type || "Notificación", 120)}`;
}

function threadKey(r: any) {
  const p = r.payload || {};
  const m = p.metadata || {};
  if (m.entity_type === "helpdesk" || p.helpdesk_ticket_id) return `helpdesk:${m.entity_id || p.helpdesk_ticket_id || m.helpdesk_key || r.id}`;
  if (m.entity_type === "ticket" || r.ticket_id) return `ticket:${m.entity_id || r.ticket_id || m.ticket_key || r.id}`;
  if (r.event_type === "daily_jira_reminder") return `daily:${m.date || "today"}`;
  return `${r.category || "system"}:${r.event_type}:${m.entity_id || r.ticket_id || r.id}`;
}

function template(r: any, intended: string | null, delivered: string, qa: boolean, senderName: string) {
  const p = r.payload || {};
  const m = p.metadata || {};
  const key = String(m.helpdesk_key || m.ticket_key || "");
  const url = urlFor(r);
  let title = String(m.subject || m.ticket_title || p.title || "Jira Interno");
  let intro = "";
  let accent = "#02488D";
  let badge = "";
  let quote = "";
  let facts: string[] = [];
  let cta = "Abrir Jira Interno";
  let actionLabel = "Actualización";

  if (r.event_type === "daily_jira_reminder") {
    title = "Mantén Jira Interno actualizado";
    intro = "Dedica unos minutos a actualizar avances, responsables y fechas objetivo para que el equipo mantenga una vista operativa confiable.";
    actionLabel = "Control diario";
    badge = "CONTROL DIARIO";
    facts = [fact("Tickets abiertos", m.open_tickets || 0), fact("Backlog", m.backlog_tickets || 0), fact("Helpdesk", m.open_helpdesk || 0), fact("Sprints activos / planeados", m.active_sprints || 0)];
  } else if (r.event_type === "helpdesk_assigned") {
    intro = "Se asignó esta solicitud de Helpdesk y ya está lista para revisión y seguimiento.";
    actionLabel = "Solicitud asignada";
    badge = `${key || "HELPDESK"} · ASIGNADA`;
    facts = [fact("Asignado a", m.assignee_name || "—"), fact("Solicitado por", m.requester_name || "—"), fact("Prioridad", priority(m.priority)), fact("Departamento", m.department_name || "—")];
    cta = "Revisar solicitud";
  } else if (r.event_type === "helpdesk_comment") {
    const requesterToTeam = m.comment_direction === "requester_to_team";
    intro = requesterToTeam ? "El solicitante agregó nueva información a la conversación de Helpdesk." : "El equipo de seguimiento agregó una nueva respuesta a la solicitud.";
    actionLabel = requesterToTeam ? "Nuevo comentario del solicitante" : "Nueva respuesta de seguimiento";
    accent = "#D1AA87";
    badge = `${key || "HELPDESK"} · NUEVO COMENTARIO`;
    quote = clean(m.comment_preview || p.body, 520);
    facts = [fact("Autor", m.comment_author_name || "Usuario"), fact("Dirección", requesterToTeam ? "Solicitante → seguimiento" : "Seguimiento → solicitante")];
    cta = "Ver conversación";
  } else if (r.event_type === "helpdesk_closed") {
    intro = "La solicitud fue cerrada. El resultado y todo su historial permanecen disponibles para trazabilidad.";
    actionLabel = "Solicitud cerrada";
    accent = "#168A5B";
    badge = `${key || "HELPDESK"} · CERRADA`;
    facts = [fact("Estado", "Cerrado"), fact("Asignado a", m.assignee_name || "—"), fact("Solicitado por", m.requester_name || "—")];
    cta = "Ver solicitud cerrada";
  } else if (r.event_type === "ticket_closed") {
    intro = "El ticket de Jira fue cerrado. El resultado y su historial permanecen disponibles para trazabilidad.";
    actionLabel = "Ticket cerrado";
    accent = "#168A5B";
    badge = `${key || "JIRA"} · CERRADO`;
    facts = [fact("Estado", "Cerrado"), fact("Dev", m.dev_name || "—"), fact("QA", m.qa_name || "—"), fact("Reportado por", m.reporter_name || "—")];
    cta = "Ver ticket cerrado";
  } else {
    intro = clean(p.body || "Tienes una actualización en Jira Interno.", 500);
    actionLabel = clean(m.action || r.event_type || "Actualización", 120);
  }

  const subject = canonicalSubject(r);
  const html = htmlDoc({
    eyebrow: actionLabel,
    title,
    intro,
    accent,
    badge,
    quote,
    facts,
    cta,
    url,
    intended,
    delivered,
    qa,
    senderName,
  });
  return {
    subject,
    threadKey: threadKey(r),
    html,
    text: `${actionLabel}\n${title}\n\n${intro}\n${quote ? quote + "\n" : ""}${url}`,
  };
}

async function enrich(admin: any, r: any) {
  const p = { ...(r.payload || {}) };
  const m = { ...(p.metadata || {}) };

  if (m.entity_type === "helpdesk" || p.helpdesk_ticket_id) {
    const id = m.entity_id || p.helpdesk_ticket_id;
    if (id) {
      const { data: h } = await admin.from("helpdesk_tickets").select("ticket_key,subject,priority,department_id,requester_user_id,assigned_to,closed_at").eq("id", id).maybeSingle();
      if (h) {
        m.entity_type = "helpdesk";
        m.entity_id = m.entity_id || id;
        m.helpdesk_key = m.helpdesk_key || h.ticket_key;
        m.subject = m.subject || h.subject;
        m.priority = m.priority || h.priority;
        m.closed_at = m.closed_at || h.closed_at;
        const ids = [h.requester_user_id, h.assigned_to].filter(Boolean);
        if (ids.length) {
          const { data: ps } = await admin.from("profiles").select("id,full_name").in("id", ids);
          const mp = new Map((ps || []).map((x: any) => [x.id, x.full_name]));
          m.requester_name = m.requester_name || mp.get(h.requester_user_id);
          m.assignee_name = m.assignee_name || mp.get(h.assigned_to);
        }
        if (h.department_id) {
          const { data: d } = await admin.from("helpdesk_departments").select("name").eq("id", h.department_id).maybeSingle();
          m.department_name = m.department_name || d?.name;
        }
      }
    }
  }

  if (m.entity_type === "ticket" || r.ticket_id) {
    const id = m.entity_id || r.ticket_id;
    if (id) {
      const { data: t } = await admin.from("tickets").select("ticket_key,title,priority,status,reporter_id,dev_owner_id,qa_owner_id").eq("id", id).maybeSingle();
      if (t) {
        m.entity_type = "ticket";
        m.entity_id = m.entity_id || id;
        m.ticket_key = m.ticket_key || t.ticket_key;
        m.ticket_title = m.ticket_title || t.title;
        m.priority = m.priority || t.priority;
        const ids = [t.reporter_id, t.dev_owner_id, t.qa_owner_id].filter(Boolean);
        if (ids.length) {
          const { data: ps } = await admin.from("profiles").select("id,full_name").in("id", ids);
          const mp = new Map((ps || []).map((x: any) => [x.id, x.full_name]));
          m.reporter_name = m.reporter_name || mp.get(t.reporter_id);
          m.dev_name = m.dev_name || mp.get(t.dev_owner_id);
          m.qa_name = m.qa_name || mp.get(t.qa_owner_id);
        }
      }
    }
  }

  return { ...r, payload: { ...p, metadata: m } };
}

async function recipient(admin: any, r: any) {
  let email = r.recipient_email || null;
  let name: string | null = null;
  if (r.recipient_user_id) {
    const [{ data: p }, { data: a }] = await Promise.all([
      admin.from("profiles").select("email,full_name").eq("id", r.recipient_user_id).maybeSingle(),
      admin.auth.admin.getUserById(r.recipient_user_id),
    ]);
    email = email || p?.email || a?.user?.email || null;
    name = p?.full_name || a?.user?.user_metadata?.full_name || null;
  }
  return { email: email ? String(email).trim().toLowerCase() : null, name };
}

async function spSender(key: string, preferredEmail: string, preferredName: string) {
  const x = await fetch("https://api.sendpulse.com/smtp/senders", { headers: { Authorization: "Bearer " + key, Accept: "application/json" } });
  if (!x.ok) throw new Error("SendPulse senders: " + x.status + " " + await x.text());
  const d = await x.json();
  const list = Array.isArray(d) ? d.map((v: any) => typeof v === "string" ? v : String(v?.email || "")).filter(Boolean) : [];
  const wanted = String(preferredEmail || Deno.env.get("SENDPULSE_FROM_EMAIL") || "").trim();
  const exact = wanted ? list.find((v: string) => v.toLowerCase() === wanted.toLowerCase()) : null;
  const nonTest = list.find((v: string) => !v.toLowerCase().endsWith("@sendpulseemail.com"));
  const sender = exact || nonTest || list[0];
  if (!sender) throw new Error("SendPulse has no active sender");
  return {
    email: sender,
    name: String(preferredName || Deno.env.get("SENDPULSE_FROM_NAME") || DEFAULT_SENDER_NAME),
    test: sender.toLowerCase().endsWith("@sendpulseemail.com"),
    preferred: wanted,
    preferredActive: Boolean(exact),
    available: list,
  };
}

async function sendSP(key: string, sender: any, to: { email: string; name?: string | null }, doc: any, replyTo?: string | null) {
  const email: any = {
    html: b64(doc.html),
    text: doc.text,
    subject: doc.subject,
    from: { name: sender.name, email: sender.email },
    to: [{ name: to.name || "Usuario Jira Interno", email: to.email }],
  };
  // Reply-To is supported by SendPulse's transactional API. It is intentionally
  // separate from threading: the API does not expose RFC In-Reply-To/References.
  if (replyTo && emailLike(replyTo)) email.reply_to = { name: sender.name, email: replyTo };

  const x = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
  });
  const raw = await x.text();
  let d: any = raw;
  try { d = JSON.parse(raw); } catch { /* keep raw body */ }
  if (!x.ok || d?.result === false) throw new Error("SendPulse: " + x.status + " " + (typeof d === "string" ? d : JSON.stringify(d)));
  return { id: d?.id ? String(d.id) : null, provider: "sendpulse" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const out = (d: any, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

  try {
    const body = await req.json().catch(() => ({}));
    const wid = String(body.workspace_id || "");
    if (!wid) throw new Error("workspace_id is required");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: settings, error: se } = await admin.from("workspace_settings")
      .select("support_email,email_notifications,email_qa_mode,email_qa_recipient,email_qa_hourly_limit,email_hourly_limit,email_monthly_limit,email_sender_address,email_sender_name,email_rollout_at,email_cron_token_hash")
      .eq("workspace_id", wid).maybeSingle();
    if (se) throw se;
    const s = settings || {};

    const cron = req.headers.get("x-notification-cron-token") || "";
    if (cron) {
      if (!s.email_cron_token_hash || (await sha(cron)) !== s.email_cron_token_hash) return out({ error: "Forbidden" }, 403);
    } else {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (!token) return out({ error: "Unauthorized" }, 401);
      const { data: u, error: ue } = await admin.auth.getUser(token);
      if (ue || !u.user) return out({ error: "Invalid session" }, 401);
      const { data: wm } = await admin.from("workspace_members").select("active").eq("workspace_id", wid).eq("user_id", u.user.id).maybeSingle();
      if (!wm?.active) return out({ error: "Forbidden" }, 403);
    }

    const key = Deno.env.get("SENDPULSE_API_KEY");
    const qa = s.email_qa_mode !== false;
    const qaTo = String(s.email_qa_recipient || "gustavo.chan@trobbucollection.com").trim().toLowerCase();
    const configuredHourlyLimit = Math.min(50, Math.max(1, Number(s.email_hourly_limit || 45)));
    const monthlyLimit = Math.min(12000, Math.max(1, Number(s.email_monthly_limit || 11000)));
    const preferredSender = String(s.email_sender_address || "helpdesk@trobbucollection.com").trim().toLowerCase();
    const preferredName = String(s.email_sender_name || DEFAULT_SENDER_NAME).trim() || DEFAULT_SENDER_NAME;
    const replyTo = emailLike(s.support_email) ? String(s.support_email).trim().toLowerCase() : null;

    let sender: any = null;
    if (key) {
      try { sender = await spSender(key, preferredSender, preferredName); }
      catch (e) { sender = { error: e instanceof Error ? e.message : String(e) }; }
    }
    const brandingReady = Boolean(key && sender?.email && !sender?.test && sender?.preferredActive && sender.email.toLowerCase() === preferredSender);
    // Operational PROD is allowed with SendPulse SMTP Test when explicitly enabled.
    // SendPulse will still override the visible identity while that account remains in Test mode.
    const productionReady = Boolean(key && sender?.email);
    const providerHourlyLimit = sender?.test ? 10 : 50;
    const hourlyLimit = Math.min(providerHourlyLimit, configuredHourlyLimit);

    const now = new Date();
    const hourStart = new Date(now.getTime() - 3600000).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const [{ count: hourCount }, { count: monthCount }, { count: providerTotalCount }] = await Promise.all([
      admin.from("notification_outbox").select("id", { count: "exact", head: true }).eq("workspace_id", wid).eq("status", "sent").gte("sent_at", hourStart),
      admin.from("notification_outbox").select("id", { count: "exact", head: true }).eq("workspace_id", wid).eq("status", "sent").gte("sent_at", monthStart),
      admin.from("notification_outbox").select("id", { count: "exact", head: true }).eq("workspace_id", wid).eq("status", "sent").eq("provider", "sendpulse"),
    ]);
    let hourRemaining = Math.max(0, hourlyLimit - Number(hourCount || 0));
    let monthRemaining = Math.max(0, monthlyLimit - Number(monthCount || 0));
    let providerTestRemaining = sender?.test ? Math.max(0, 50 - Number(providerTotalCount || 0)) : Number.POSITIVE_INFINITY;
    const qaHourlyLimit = Math.min(hourlyLimit, Math.max(1, Number(s.email_qa_hourly_limit || 8)));
    let qaRemaining = qa ? Math.max(0, qaHourlyLimit - Number(hourCount || 0)) : hourRemaining;

    if (body.status_only) return out({
      ok: true,
      configured: Boolean(key && sender?.email),
      provider: key ? "sendpulse" : null,
      sender: sender?.email || null,
      sender_name: preferredName,
      preferred_sender: preferredSender,
      preferred_sender_active: Boolean(sender?.preferredActive),
      production_ready: productionReady,
      branding_ready: brandingReady,
      provider_forces_test_identity: Boolean(sender?.test),
      smtp_test_mode: Boolean(sender?.test),
      email_notifications: s.email_notifications !== false,
      qa_mode: qa,
      qa_recipient: qaTo,
      qa_hourly_limit: qaHourlyLimit,
      configured_hourly_limit: configuredHourlyLimit,
      hourly_limit: hourlyLimit,
      provider_hourly_limit: providerHourlyLimit,
      provider_test_remaining: Number.isFinite(providerTestRemaining) ? providerTestRemaining : null,
      hourly_used: Number(hourCount || 0),
      hourly_remaining: hourRemaining,
      monthly_limit: monthlyLimit,
      monthly_used: Number(monthCount || 0),
      monthly_remaining: monthRemaining,
      threading_mode: "canonical_subject",
      threading_rfc_guaranteed: false,
      allowed_events: [...EMAIL_EVENTS],
    });

    if (s.email_notifications === false) return out({ ok: true, skipped: true, reason: "email_notifications_disabled" });
    if (!key || !sender?.email) return out({ ok: false, configured: false, provider: key ? "sendpulse" : null, sender_error: sender?.error || null });
    if (!qa && !productionReady) return out({ ok: false, configured: true, provider: "sendpulse", sent: 0, skipped: true, reason: "production_sender_not_ready", sender: sender?.email || null, preferred_sender: preferredSender, smtp_test_mode: Boolean(sender?.test) });

    const { data: rawRows, error: re } = await admin.from("notification_outbox")
      .select("id,event_type,category,recipient_user_id,recipient_email,payload,ticket_id,attempts,created_at")
      .eq("workspace_id", wid)
      .in("status", ["pending", "failed"])
      .gte("created_at", s.email_rollout_at || "1970-01-01T00:00:00Z")
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(50);
    if (re) throw re;

    const rows = [...(rawRows || [])].sort((a: any, b: any) => {
      const pa = a.event_type === "daily_jira_reminder" ? 1 : 0;
      const pb = b.event_type === "daily_jira_reminder" ? 1 : 0;
      return pa - pb || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let sent = 0, failed = 0, suppressed = 0, deferred = 0;
    const results: any[] = [];
    const seenQaEvents = new Set<string>();

    for (const r of rows) {
      if (!EMAIL_EVENTS.has(r.event_type)) {
        await admin.from("notification_outbox").update({ status: "suppressed", suppressed_at: new Date().toISOString(), suppressed_reason: qa ? "qa_event_not_enabled" : "email_event_not_enabled", provider: "sendpulse" }).eq("id", r.id);
        suppressed++;
        continue;
      }

      if (qa) {
        const meta = r.payload?.metadata || {};
        const entity = r.event_type === "helpdesk_comment" ? (meta.comment_id || r.id) : (meta.entity_id || r.ticket_id || meta.date || r.id);
        const qaEventKey = `${r.event_type}:${entity}:${meta.to_status || meta.action || ""}`;
        if (seenQaEvents.has(qaEventKey)) {
          await admin.from("notification_outbox").update({ status: "suppressed", suppressed_at: new Date().toISOString(), suppressed_reason: "qa_duplicate_logical_event", provider: "sendpulse" }).eq("id", r.id);
          suppressed++;
          continue;
        }
        seenQaEvents.add(qaEventKey);
      }

      const effectiveRemaining = qa ? Math.min(qaRemaining, hourRemaining, monthRemaining, providerTestRemaining) : Math.min(hourRemaining, monthRemaining, providerTestRemaining);
      if (effectiveRemaining <= 0) { deferred++; continue; }

      if (r.event_type === "daily_jira_reminder" && monthRemaining <= 100) {
        await admin.from("notification_outbox").update({ status: "suppressed", suppressed_at: new Date().toISOString(), suppressed_reason: "monthly_reserve_for_transactional_email", provider: "sendpulse" }).eq("id", r.id);
        suppressed++;
        continue;
      }

      await admin.from("notification_outbox").update({ status: "processing", attempts: Number(r.attempts || 0) + 1, provider: "sendpulse" }).eq("id", r.id);
      try {
        const er = await enrich(admin, r);
        const intended = await recipient(admin, er);
        const delivered = qa ? qaTo : String(intended.email || "").trim().toLowerCase();
        if (!delivered) throw new Error("Recipient email not found");
        if (qa && delivered !== qaTo) throw new Error("QA recipient gate rejected destination");

        const doc = template(er, intended.email, delivered, qa, preferredName);
        const deliveryName = qa ? `QA · ${intended.name || "Jira Interno"}` : (intended.name || "Usuario Jira Interno");
        const pr = await sendSP(key, sender, { email: delivered, name: deliveryName }, doc, replyTo);

        await admin.from("notification_outbox").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
          provider: "sendpulse",
          provider_message_id: pr.id,
          intended_recipient_email: intended.email,
          delivered_to: delivered,
          suppressed_at: null,
          suppressed_reason: null,
        }).eq("id", r.id);

        sent++;
        hourRemaining--;
        monthRemaining--;
        if (Number.isFinite(providerTestRemaining)) providerTestRemaining--;
        if (qa) qaRemaining--;
        results.push({ id: r.id, event_type: r.event_type, thread_key: doc.threadKey, subject: doc.subject, message_id: pr.id, delivered_to: delivered });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("notification_outbox").update({ status: "failed", last_error: msg, provider: "sendpulse" }).eq("id", r.id);
        failed++;
        results.push({ id: r.id, event_type: r.event_type, error: msg });
      }
    }

    return out({
      ok: true,
      provider: "sendpulse",
      sender: sender.email,
      sender_name: preferredName,
      preferred_sender: preferredSender,
      production_ready: productionReady,
      branding_ready: brandingReady,
      provider_forces_test_identity: Boolean(sender.test),
      smtp_test_mode: Boolean(sender.test),
      qa_mode: qa,
      qa_recipient: qa ? qaTo : null,
      threading_mode: "canonical_subject",
      threading_rfc_guaranteed: false,
      sent,
      failed,
      suppressed,
      deferred,
      hourly_remaining: hourRemaining,
      monthly_remaining: monthRemaining,
      provider_test_remaining: Number.isFinite(providerTestRemaining) ? providerTestRemaining : null,
      qa_remaining_this_hour: qa ? qaRemaining : null,
      results,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e || "Unknown error") }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
