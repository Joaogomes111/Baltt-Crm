import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

type CompanyKey = "baltt" | "vale" | "baltec";
type StageKey = "novo" | "qualificado" | "atendimento" | "proposta" | "ganho" | "perdido";

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
  siteSubmissionId?: string;
};

const validCompanies: CompanyKey[] = ["baltt", "vale", "baltec"];
const defaultServices: Record<CompanyKey, string> = {
  baltt: "Terraplanagem",
  vale: "Britas / Agregados",
  baltec: "Pavers / Blocos",
};

function setCommonHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Site-Leads-Token");
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  setCommonHeaders(res);
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

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeKey(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
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

function normalizeCompany(value: unknown): CompanyKey {
  const normalized = normalizeText(value);
  return validCompanies.includes(normalized as CompanyKey)
    ? (normalized as CompanyKey)
    : "baltt";
}

function companyOwner(company: CompanyKey) {
  if (company === "vale") return "Comercial Vale";
  if (company === "baltec") return "Comercial Baltec";
  return "Comercial Baltt";
}

function parsePayload(rawBody: Buffer, contentType = "") {
  const body = rawBody.toString("utf8").trim();
  if (!body) return {};

  if (contentType.includes("application/json")) {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body)) as Record<string, unknown>;
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(body)) as Record<string, unknown>;
  }
}

function flattenPayload(value: unknown, target: Record<string, string>, prefix = "") {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    target[prefix] = value.map((item) => String(item ?? "")).join(", ");
    return;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const nestedKey = prefix ? `${prefix}.${key}` : key;
      flattenPayload(nestedValue, target, nestedKey);
    }
    return;
  }

  target[prefix] = String(value).trim();
}

function payloadFields(payload: Record<string, unknown>) {
  const flattened: Record<string, string> = {};
  flattenPayload(payload, flattened);

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(flattened)) {
    normalized[normalizeKey(key)] = value;
  }

  return { flattened, normalized };
}

function requestFieldsFromUrl(requestUrl: URL) {
  return Object.fromEntries(requestUrl.searchParams.entries()) as Record<string, string>;
}

function pickField(fields: ReturnType<typeof payloadFields>, aliases: string[]) {
  for (const alias of aliases) {
    const value = fields.normalized[normalizeKey(alias)];
    if (value) return value;
  }
  return "";
}

function tokenFromRequest(
  req: IncomingMessage,
  requestUrl: URL,
  payload: Record<string, unknown>,
) {
  const auth = headerValue(req, "authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return (
    headerValue(req, "x-site-leads-token") ||
    bearer ||
    requestUrl.searchParams.get("token") ||
    String(payload.token || payload.webhook_token || payload.site_leads_token || "")
  );
}

function tokensMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function buildNotes(fields: ReturnType<typeof payloadFields>) {
  const hiddenKeys = new Set([
    "token",
    "webhooktoken",
    "siteleadstoken",
    "xsiteleadstoken",
    "authorization",
  ]);

  const answers = Object.entries(fields.flattened)
    .filter(([key, value]) => value && !hiddenKeys.has(normalizeKey(key)))
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ");

  return ["Formulario do site", answers ? `Campos: ${answers}` : ""]
    .filter(Boolean)
    .join(" | ");
}

function buildCrmLead(payload: Record<string, unknown>, requestUrl: URL): CrmLead {
  const fields = payloadFields(payload);
  const company = normalizeCompany(
    requestUrl.searchParams.get("company") ||
      pickField(fields, ["company", "empresa", "company_key", "empresa_key"]),
  );
  const submissionId = pickField(fields, [
    "submission_id",
    "entry_id",
    "id",
    "response_id",
    "bitform_entry_id",
  ]);
  const now = new Date();

  const name =
    pickField(fields, ["name", "nome", "full_name", "nome_completo", "bl-2"]) ||
    "Lead Site";
  const phone = pickField(fields, [
    "phone",
    "telefone",
    "whatsapp",
    "celular",
    "mobile_phone",
    "bl-4",
  ]);
  const city = pickField(fields, ["city", "cidade", "localidade", "bl-5"]);
  const formName =
    pickField(fields, ["form_name", "formulario", "form", "form_title"]) ||
    `Formulario Site - ${company}`;

  return {
    id: `site-${company}-${submissionId || phoneDigits(phone) || Date.now()}`,
    company,
    stage: "novo",
    arrivalDate: formatSaoPauloDate(now),
    name,
    phone,
    email: pickField(fields, ["email", "e-mail", "mail"]),
    city,
    neighborhood: pickField(fields, ["neighborhood", "bairro"]),
    source: pickField(fields, ["source", "origem"]) || "Site",
    campaign: pickField(fields, ["campaign", "campanha", "utm_campaign"]) || formName,
    service:
      pickField(fields, ["service", "servico", "serviço", "interesse", "produto"]) ||
      defaultServices[company],
    customerType: "Lead Site",
    contactStatus: "Aguardando primeiro contato",
    leadStatus: "Novo",
    lossReason: "",
    budgetSent: 0,
    proposalValue: 0,
    closeDate: "",
    qualified: "Pendente",
    urgency: "Nao informado",
    owner: companyOwner(company),
    nextFollowUp: "",
    notes: buildNotes(fields),
    lastUpdate: "Recebido automaticamente do site",
    siteSubmissionId: submissionId,
  };
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
  if (
    existing.siteSubmissionId &&
    incoming.siteSubmissionId &&
    existing.siteSubmissionId === incoming.siteSubmissionId
  ) {
    return true;
  }

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
            ? { ...incomingLead, ...lead, siteSubmissionId: lead.siteSubmissionId || incomingLead.siteSubmissionId }
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    setCommonHeaders(res);
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      name: "Baltt CRM Site Leads Webhook",
      configured: Boolean(process.env.SITE_LEADS_WEBHOOK_TOKEN),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Metodo nao permitido." });
    return;
  }

  try {
    const requestUrl = new URL(req.url || "/", "https://baltt-crm.vercel.app");
    const rawBody = await readRawBody(req);
    const payload = parsePayload(rawBody, headerValue(req, "content-type") || "");
    const mergedPayload = { ...requestFieldsFromUrl(requestUrl), ...payload };
    const expectedToken = process.env.SITE_LEADS_WEBHOOK_TOKEN;

    if (!expectedToken) {
      sendJson(res, 500, { ok: false, error: "SITE_LEADS_WEBHOOK_TOKEN nao configurado." });
      return;
    }

    const requestToken = tokenFromRequest(req, requestUrl, payload);
    if (!requestToken || !tokensMatch(String(requestToken), expectedToken)) {
      sendJson(res, 401, { ok: false, error: "Token do webhook invalido." });
      return;
    }

    const crmLead = buildCrmLead(mergedPayload, requestUrl);
    const result = await saveLeadToCrm(crmLead);

    console.info("[site-leads] lead received", {
      company: crmLead.company,
      source: crmLead.source,
      hasPhone: Boolean(phoneDigits(crmLead.phone)),
      duplicate: result.duplicate,
    });

    sendJson(res, 200, {
      ok: true,
      company: crmLead.company,
      name: crmLead.name,
      ...result,
    });
  } catch (error) {
    console.error("[site-leads] webhook failed", {
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    });

    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
}
