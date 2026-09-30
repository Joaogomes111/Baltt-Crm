import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { META_CRM_EVENT_NAMES, sendMetaCrmEvent } from "../lib/meta-crm.mjs";
import type { MetaCrmEventKey } from "../lib/meta-crm.mjs";

type CrmLead = {
  id?: string;
  email?: string;
  phone?: string;
  metaLeadId?: string;
};

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function headerValue(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;

    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > 64 * 1024) {
        reject(new Error("Corpo da solicitacao muito grande."));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    req.on("error", reject);
  });
}

function snapshotLeads(value: unknown): CrmLead[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const leads = (value as { leads?: unknown }).leads;
  return Array.isArray(leads) ? (leads as CrmLead[]) : [];
}

async function authenticatedSnapshot(accessToken: string) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase nao configurada no servidor.");
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return null;

  const { data, error } = await supabase.rpc("load_crm_snapshot_for_user");
  if (error) throw new Error(error.message || "Falha ao conferir permissao do CRM.");
  return data;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Metodo nao permitido." });
    return;
  }

  const authorization = headerValue(req, "authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    sendJson(res, 401, { ok: false, error: "Login do CRM necessario." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    const eventKey = typeof body.eventKey === "string" ? body.eventKey : "";

    if (!leadId || !Object.hasOwn(META_CRM_EVENT_NAMES, eventKey)) {
      sendJson(res, 400, { ok: false, error: "Lead ou evento invalido." });
      return;
    }

    const snapshot = await authenticatedSnapshot(accessToken);
    if (!snapshot) {
      sendJson(res, 401, { ok: false, error: "Sessao do CRM invalida ou expirada." });
      return;
    }

    const lead = snapshotLeads(snapshot).find((item) => item.id === leadId);
    if (!lead) {
      sendJson(res, 404, { ok: false, error: "Lead nao encontrado ou sem permissao." });
      return;
    }
    if (!lead.metaLeadId) {
      sendJson(res, 422, { ok: false, error: "Este lead nao veio de um formulario da Meta." });
      return;
    }

    const result = await sendMetaCrmEvent({
      eventKey: eventKey as MetaCrmEventKey,
      leadId: lead.metaLeadId,
      email: lead.email,
      phone: lead.phone,
    });

    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    console.error("[meta-crm] failed to send CRM event", { error: message });
    sendJson(res, 502, { ok: false, error: message });
  }
}
