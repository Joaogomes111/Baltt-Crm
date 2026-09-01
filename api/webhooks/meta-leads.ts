import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

type CompanyKey = "baltt" | "vale" | "baltec";
type StageKey = "novo" | "qualificado" | "atendimento" | "proposta" | "ganho" | "perdido";

type MetaWebhookChange = {
  field?: string;
  value?: {
    leadgen_id?: string;
    form_id?: string;
    page_id?: string;
    ad_id?: string;
    created_time?: number;
  };
};

type MetaLeadField = {
  name: string;
  values?: Array<string | number | boolean>;
};

type MetaLeadResponse = {
  id?: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
};

type CrmLead = {
  id: string;
  company: CompanyKey;
  stage: StageKey;
  arrivalDate: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  neighborhood: string;
  source: string;
  campaign: string;
  service: string;
  customerType: string;
  contactStatus: string;
  leadStatus: string;
  lossReason: string;
  budgetSent: number;
  proposalValue: number;
  closeDate: string;
  qualified: string;
  urgency: string;
  owner: string;
  nextFollowUp: string;
  notes: string;
  lastUpdate: string;
  metaLeadId?: string;
  metaFormId?: string;
  metaPageId?: string;
  metaAdId?: string;
  metaCampaignId?: string;
};

const graphApiVersion = process.env.META_GRAPH_API_VERSION || "v25.0";
const validCompanies: CompanyKey[] = ["baltt", "vale", "baltec"];

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function readRawBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function headerValue(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function verifyMetaSignature(req: IncomingMessage, rawBody: Buffer) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;

  const signature = headerValue(req, "x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function phoneDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatSaoPauloDate(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseCompanyMap() {
  const raw = process.env.META_FORM_COMPANY_MAP || "{}";
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function normalizeCompany(value: unknown): CompanyKey {
  const normalized = normalizeText(value);
  return validCompanies.includes(normalized as CompanyKey)
    ? (normalized as CompanyKey)
    : "baltt";
}

function resolveCompany(value: MetaWebhookChange["value"]): CompanyKey {
  const map = parseCompanyMap();
  return normalizeCompany(
    (value?.form_id && map[value.form_id]) ||
      (value?.page_id && map[value.page_id]) ||
      process.env.META_DEFAULT_COMPANY ||
      "baltt",
  );
}

function fieldMap(fieldData: MetaLeadField[] = []) {
  const entries = fieldData.map((field) => {
    const values = field.values ?? [];
    return [normalizeText(field.name), values.map(String).join(", ").trim()] as const;
  });

  return Object.fromEntries(entries);
}

function pickField(fields: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = fields[normalizeText(key)];
    if (value) return value;
  }
  return "";
}

function companyOwner(company: CompanyKey) {
  if (company === "vale") return "Comercial Vale";
  if (company === "baltec") return "Comercial Baltec";
  return "Comercial Baltt";
}

function buildNotes(lead: MetaLeadResponse, fields: Record<string, string>) {
  const answers = Object.entries(fields)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ");

  const metaParts = [
    lead.campaign_name ? `Campanha Meta: ${lead.campaign_name}` : "",
    lead.adset_name ? `Conjunto: ${lead.adset_name}` : "",
    lead.ad_name ? `Anuncio: ${lead.ad_name}` : "",
    lead.platform ? `Plataforma: ${lead.platform}` : "",
    answers ? `Respostas: ${answers}` : "",
  ].filter(Boolean);

  return metaParts.join(" | ");
}

function buildCrmLead(lead: MetaLeadResponse, changeValue: MetaWebhookChange["value"]): CrmLead {
  const fields = fieldMap(lead.field_data);
  const company = resolveCompany(changeValue);
  const firstName = pickField(fields, ["first_name", "primeiro_nome"]);
  const lastName = pickField(fields, ["last_name", "sobrenome"]);
  const createdDate = lead.created_time
    ? new Date(lead.created_time)
    : changeValue?.created_time
      ? new Date(changeValue.created_time * 1000)
      : new Date();

  const name =
    pickField(fields, ["full_name", "nome_completo", "nome completo", "name", "nome"]) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "Lead Meta";

  return {
    id: `meta-${company}-${lead.id || changeValue?.leadgen_id || Date.now()}`,
    company,
    stage: "novo",
    arrivalDate: formatSaoPauloDate(createdDate),
    name,
    phone: pickField(fields, ["phone_number", "telefone", "celular", "whatsapp", "mobile_phone", "phone"]),
    email: pickField(fields, ["email", "e-mail"]),
    city: pickField(fields, ["city", "cidade"]),
    neighborhood: pickField(fields, ["neighborhood", "bairro"]),
    source: "Meta Ads",
    campaign: lead.campaign_name || lead.ad_name || `Formulario Meta ${changeValue?.form_id || lead.form_id || ""}`.trim(),
    service: pickField(fields, ["produto", "servico", "serviço", "interesse", "tipo_de_servico"]) || process.env.META_DEFAULT_SERVICE || "",
    customerType: "Lead Meta",
    contactStatus: "Novo",
    leadStatus: "Pendente",
    lossReason: "",
    budgetSent: 0,
    proposalValue: 0,
    closeDate: "",
    qualified: "Pendente",
    urgency: "",
    owner: companyOwner(company),
    nextFollowUp: "",
    notes: buildNotes(lead, fields),
    lastUpdate: "Recebido automaticamente do Meta Leads",
    metaLeadId: lead.id || changeValue?.leadgen_id,
    metaFormId: lead.form_id || changeValue?.form_id,
    metaPageId: changeValue?.page_id,
    metaAdId: lead.ad_id || changeValue?.ad_id,
    metaCampaignId: lead.campaign_id,
  };
}

async function fetchMetaLead(leadgenId: string) {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) throw new Error("META_PAGE_ACCESS_TOKEN nao configurado.");

  const fields = [
    "id",
    "created_time",
    "field_data",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "form_id",
    "platform",
  ].join(",");

  const url = new URL(`https://graph.facebook.com/${graphApiVersion}/${leadgenId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url);
  const data = (await response.json()) as MetaLeadResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message || `Falha ao buscar lead ${leadgenId}.`);
  }

  return data;
}

async function getSnapshotClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados na Vercel.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isSameLead(existing: CrmLead, incoming: CrmLead) {
  if (existing.metaLeadId && incoming.metaLeadId && existing.metaLeadId === incoming.metaLeadId) return true;

  const existingPhone = phoneDigits(existing.phone);
  const incomingPhone = phoneDigits(incoming.phone);
  return Boolean(
    existingPhone &&
      incomingPhone &&
      existingPhone === incomingPhone &&
      existing.company === incoming.company &&
      existing.arrivalDate === incoming.arrivalDate,
  );
}

async function saveLeadToCrm(incomingLead: CrmLead) {
  const supabase = await getSnapshotClient();
  const { data, error } = await supabase
    .from("crm_snapshots")
    .select("leads, investments")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;

  const leads = Array.isArray(data?.leads) ? (data.leads as CrmLead[]) : [];
  const investments = Array.isArray(data?.investments) ? data.investments : [];
  const existingIndex = leads.findIndex((lead) => isSameLead(lead, incomingLead));
  const nextLeads =
    existingIndex >= 0
      ? leads.map((lead, index) =>
          index === existingIndex
            ? { ...incomingLead, ...lead, metaLeadId: lead.metaLeadId || incomingLead.metaLeadId }
            : lead,
        )
      : [...leads, incomingLead];

  const { error: saveError } = await supabase.from("crm_snapshots").upsert({
    id: "main",
    leads: nextLeads,
    investments,
    updated_at: new Date().toISOString(),
  });

  if (saveError) throw saveError;
  return { created: existingIndex === -1, duplicate: existingIndex >= 0 };
}

function getLeadgenChanges(payload: { entry?: Array<{ changes?: MetaWebhookChange[] }> }) {
  return (payload.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .filter((change) => change.field === "leadgen" && change.value?.leadgen_id);
}

function isMetaWebhookSampleLead(leadgenId: string) {
  return /^4+$/.test(leadgenId);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "GET") {
    const requestUrl = new URL(req.url || "/", "https://baltt-crm.vercel.app");
    const mode = requestUrl.searchParams.get("hub.mode");
    const token = requestUrl.searchParams.get("hub.verify_token");
    const challenge = requestUrl.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN && challenge) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(challenge);
      return;
    }

    sendJson(res, 200, {
      ok: true,
      name: "Baltt CRM Meta Lead Ads Webhook",
      configured: Boolean(process.env.META_VERIFY_TOKEN),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Metodo nao permitido." });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    if (!verifyMetaSignature(req, rawBody)) {
      sendJson(res, 403, { ok: false, error: "Assinatura Meta invalida." });
      return;
    }

    const payload = JSON.parse(rawBody.toString("utf8")) as { entry?: Array<{ changes?: MetaWebhookChange[] }> };
    const changes = getLeadgenChanges(payload);
    const results = [];

    console.info("[meta-leads] webhook received", {
      changes: changes.length,
      userAgent: headerValue(req, "user-agent"),
    });

    for (const change of changes) {
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      if (isMetaWebhookSampleLead(leadgenId)) {
        console.info("[meta-leads] meta webhook sample skipped", {
          leadgenId,
          formId: change.value?.form_id,
          pageId: change.value?.page_id,
        });
        results.push({ leadgenId, skipped: true, reason: "meta_webhook_sample" });
        continue;
      }

      try {
        const metaLead = await fetchMetaLead(leadgenId);
        const crmLead = buildCrmLead(metaLead, change.value);
        const result = await saveLeadToCrm(crmLead);
        results.push({ leadgenId, company: crmLead.company, name: crmLead.name, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        console.error("[meta-leads] failed to process lead", {
          leadgenId,
          formId: change.value?.form_id,
          pageId: change.value?.page_id,
          error: message,
        });
        results.push({ leadgenId, error: message });
      }
    }

    const failed = results.some((result) => "error" in result);
    if (failed) {
      sendJson(res, 500, {
        ok: false,
        received: changes.length,
        results,
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      received: changes.length,
      results,
    });
  } catch (error) {
    console.error("[meta-leads] webhook failed", {
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    });
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
}
