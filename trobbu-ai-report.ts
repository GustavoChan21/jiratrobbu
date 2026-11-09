import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractResponseText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
      if (typeof content?.output_text === "string") parts.push(content.output_text);
    }
  }
  return parts.join("\n").trim();
}

function deterministicReport(metrics: any, question: string, mode: string) {
  const products = Array.isArray(metrics?.products) ? metrics.products : [];
  const totals = metrics?.totals || {};
  const sprints = Array.isArray(metrics?.active_sprints) ? metrics.active_sprints : [];
  const modules = Array.isArray(metrics?.modules) ? metrics.modules : [];
  const productLines = products.length
    ? products.map((p: any) => `• ${p.name}: ${Number(p.progress_percent || 0).toFixed(1)}% · ${p.total_tickets || 0} tickets · ${p.closed || 0} cerrados · ${p.due_this_week || 0} previstos esta semana${p.blocked ? ` · ${p.blocked} bloqueados` : ""}`).join("\n")
    : "• No hay tickets visibles por producto todavía.";
  const sprintLines = sprints.length
    ? sprints.map((s: any) => `• ${s.name}: ${Number(s.progress_percent || 0).toFixed(1)}% · ${s.completed || 0}/${s.total_tickets || 0} completados · ${s.remaining || 0} pendientes · ${s.completed_sp || 0}/${s.total_sp || 0} SP · ${s.planned_by_sprint_end || 0} previstos antes del cierre${s.blocked ? ` · ${s.blocked} bloqueados` : ""}`).join("\n")
    : "• No hay sprint activo para la fecha consultada.";
  const moduleLines = modules.length
    ? modules.slice(0, 6).map((m: any) => `• ${m.name}: ${Number(m.progress_percent || 0).toFixed(1)}% · ${m.total_tickets || 0} tickets · ${m.total_sp || 0} SP`).join("\n")
    : "• No hay módulos con tickets asociados todavía.";

  const intro = mode === "infographic"
    ? "Resumen ejecutivo listo para visualizar como infografía"
    : mode === "executive"
      ? "Reporte ejecutivo TROBBU"
      : "Estado actual del workspace";

  return `${intro}\n\nAvance general: ${Number(totals.progress_percent || 0).toFixed(1)}%\nTickets: ${totals.total_tickets || 0} · Cerrados: ${totals.closed || 0} · Backlog: ${totals.backlog || 0} · Vencidos: ${totals.overdue || 0} · Bloqueados: ${totals.blocked || 0}\nProyección al ${metrics?.week_end || "fin de semana"}: ${totals.due_this_week || 0} tickets con fecha objetivo.\n\nPor producto\n${productLines}\n\nSprint\n${sprintLines}\n\nMódulos\n${moduleLines}\n\nConsulta: ${question || "Estado general"}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const question = String(body.question || "Dime cómo vamos al día de hoy con los productos y qué se proyecta terminar esta semana.").slice(0, 4000);
    const mode = ["chat", "executive", "infographic"].includes(body.mode) ? body.mode : "chat";
    if (!workspaceId) throw new Error("workspace_id is required");

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session");

    const { data: metrics, error: metricsError } = await userClient.rpc("get_workspace_progress_report", {
      p_workspace: workspaceId,
      p_as_of: body.as_of || new Date().toISOString().slice(0, 10),
    });
    if (metricsError) throw metricsError;

    const fallback = deterministicReport(metrics, question, mode);
    const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let content = fallback;
    let provider = "deterministic";
    let model: string | null = null;
    let aiConfigured = false;
    let aiError: string | null = null;

    if (gatewayKey || openaiKey) {
      aiConfigured = true;
      const isGateway = Boolean(gatewayKey);
      model = isGateway
        ? (Deno.env.get("TROBBU_AI_MODEL") || "openai/gpt-6-luna")
        : (Deno.env.get("TROBBU_OPENAI_MODEL") || "gpt-6-luna");
      const endpoint = isGateway ? "https://ai-gateway.vercel.sh/v1/responses" : "https://api.openai.com/v1/responses";
      const apiKey = gatewayKey || openaiKey!;
      const instructions = `Eres TROBBU AI, analista ejecutivo interno de Jira. Responde exclusivamente con los datos JSON suministrados. No inventes tickets, fechas, riesgos ni porcentajes. Explica avance, bloqueos, riesgos y proyección semanal con lenguaje ejecutivo y concreto. Si el usuario pide un reporte ejecutivo, usa secciones: Resumen ejecutivo, Avance por producto, Sprint/proyección, Riesgos/bloqueos, Próximas acciones. Si pide infografía, devuelve texto breve y jerárquico pensado para tarjetas visuales. Usa porcentajes exactamente como vienen en los datos. Fecha de corte: ${metrics?.as_of}.`;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            input: [
              { role: "developer", content: instructions },
              { role: "user", content: `Pregunta: ${question}\n\nDatos calculados por el sistema:\n${JSON.stringify(metrics)}` },
            ],
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `AI HTTP ${response.status}`);
        content = extractResponseText(payload) || fallback;
        provider = isGateway ? "vercel-ai-gateway" : "openai-responses";
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err);
        content = fallback;
        provider = "deterministic-fallback";
      }
    }

    const { data: saved, error: saveError } = await userClient.from("executive_reports").insert({
      workspace_id: workspaceId,
      report_type: mode,
      question,
      metrics,
      content,
      provider,
      model,
      generated_by: userData.user.id,
    }).select("id,created_at").single();
    if (saveError) throw saveError;

    return new Response(JSON.stringify({
      ok: true,
      report_id: saved?.id,
      created_at: saved?.created_at,
      content,
      metrics,
      provider,
      model,
      ai_configured: aiConfigured,
      ai_error: aiError,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("trobbu-ai-report:", message);
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
