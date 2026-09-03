"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, WheelEvent } from "react";
import {
  loadCrmSnapshot,
  saveCrmSnapshot,
  signInCrm,
  signOutCrm,
  supabase,
  supabaseEnabled,
} from "../src/supabaseClient";
import type { CrmUserPermission } from "../src/supabaseClient";

type CompanyKey = "baltt" | "vale" | "baltec";
type ViewKey = "funis" | "leads" | "investimento" | "relatorios";
type NavIconKey = "pipeline" | "leads" | "investment" | "reports";
type DateFilterKey = "7" | "30" | "90" | "all" | "custom";
type LeadStageFilterKey = StageKey | "all";
type ReportScopeKey = CompanyKey | "all";
type StageKey =
  | "novo"
  | "qualificado"
  | "atendimento"
  | "proposta"
  | "ganho"
  | "perdido";

type Lead = {
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
};

type LeadForm = Omit<Lead, "id" | "lastUpdate">;
type Investment = {
  id: string;
  month: string;
  meta: number;
  google: number;
  note: string;
};
type InvestmentForm = Omit<Investment, "id">;
type AuthState = "checking" | "authenticated" | "anonymous";
type SyncState = "local" | "loading" | "shared" | "saving" | "error";

const STORAGE_KEY = "baltt-crm-leads-v1";
const INVESTMENT_STORAGE_KEY = "baltt-crm-investments-v1";
const AUTH_STORAGE_KEY = "baltt-crm-auth-v1";
const LOGIN_USER = "Baltt@";
const LOGIN_PASSWORD = "Baltt26@";
const fixedToday = new Date("2026-08-19T12:00:00");

const companies: Array<{
  key: CompanyKey;
  name: string;
  shortName: string;
  phone: string;
  focus: string;
  accent: string;
}> = [
  {
    key: "baltt",
    name: "Baltt Empreiteira",
    shortName: "Baltt",
    phone: "(47) 99169-5770",
    focus: "Terraplanagem, infraestrutura e pavimentacao",
    accent: "#f6b21a",
  },
  {
    key: "vale",
    name: "Vale Britagem",
    shortName: "Vale",
    phone: "(47) 99123-3416",
    focus: "Britas, agregados minerais e base graduada",
    accent: "#2f8f6f",
  },
  {
    key: "baltec",
    name: "Baltec Paver e Blocos",
    shortName: "Baltec",
    phone: "47 9950-5553",
    focus: "Pavers, blocos e massas asfalticas",
    accent: "#2d72b8",
  },
];

const companyKeys = companies.map((company) => company.key);
const adminPermission: CrmUserPermission = {
  role: "admin",
  companyKey: null,
  allowedCompanies: companyKeys,
  email: null,
};

const stages: Array<{ key: StageKey; label: string; tone: string }> = [
  { key: "novo", label: "Novo WhatsApp", tone: "blue" },
  { key: "atendimento", label: "Em atendimento", tone: "amber" },
  { key: "qualificado", label: "Qualificado", tone: "green" },
  { key: "proposta", label: "Proposta enviada", tone: "orange" },
  { key: "ganho", label: "Fechado", tone: "success" },
  { key: "perdido", label: "Perdido", tone: "danger" },
];

const navItems: Array<{ key: ViewKey; label: string; icon: NavIconKey }> = [
  { key: "funis", label: "Funis", icon: "pipeline" },
  { key: "leads", label: "Leads", icon: "leads" },
  { key: "investimento", label: "Investimento", icon: "investment" },
  { key: "relatorios", label: "Relatorios", icon: "reports" },
];

const services = [
  "Terraplanagem",
  "Pavimentacao asfaltica",
  "Britas / Agregados",
  "Pavers / Blocos",
  "Obra completa",
  "Reforma",
  "Aluguel / venda de pallets",
  "Outro",
];

const sources = [
  "Meta Ads",
  "Google Ads",
  "Site",
  "Organico",
  "Indicacao",
  "Orcamento direto",
  "Outro",
];

const chartColors = ["#2f8f6f", "#2d72b8", "#f6b21a", "#8b5cf6", "#ef6f4e", "#14b8a6"];

const lossReasons = [
  "",
  "Preco",
  "Sem retorno",
  "Fechou com concorrente",
  "Fora da regiao",
  "Nao era o publico",
  "Queria emprego",
  "Outro",
];

const initialLeads: Lead[] = [
  {
    id: "lead-001",
    company: "baltt",
    stage: "novo",
    arrivalDate: "2026-08-18",
    name: "Lead Terraplanagem 001",
    phone: "(47) 90000-1001",
    email: "",
    city: "Balneario Picarras",
    neighborhood: "Centro",
    source: "Meta Ads",
    campaign: "Conversas WhatsApp - Terraplanagem",
    service: "Terraplanagem",
    customerType: "Pessoa Juridica",
    contactStatus: "Aguardando primeiro contato",
    leadStatus: "Novo",
    lossReason: "",
    budgetSent: 0,
    proposalValue: 0,
    closeDate: "",
    qualified: "Pendente",
    urgency: "Ate 30 dias",
    owner: "Comercial Baltt",
    nextFollowUp: "2026-08-20",
    notes: "Solicitou avaliacao de acesso para obra pequena.",
    lastUpdate: "Hoje",
  },
  {
    id: "lead-002",
    company: "baltt",
    stage: "proposta",
    arrivalDate: "2026-08-12",
    name: "Construtora Modelo",
    phone: "(47) 90000-1002",
    email: "orcamento@exemplo.com",
    city: "Itajai",
    neighborhood: "Cordeiros",
    source: "Google Ads",
    campaign: "Pesquisa - Pavimentacao",
    service: "Pavimentacao asfaltica",
    customerType: "Pessoa Juridica",
    contactStatus: "Contato realizado",
    leadStatus: "Proposta enviada",
    lossReason: "",
    budgetSent: 18500,
    proposalValue: 18500,
    closeDate: "",
    qualified: "Sim",
    urgency: "Imediato",
    owner: "Comercial Baltt",
    nextFollowUp: "2026-08-21",
    notes: "Comparando prazo de mobilizacao.",
    lastUpdate: "2 dias",
  },
  {
    id: "lead-003",
    company: "baltt",
    stage: "perdido",
    arrivalDate: "2026-07-28",
    name: "Cliente fora de perfil",
    phone: "(47) 90000-1003",
    email: "",
    city: "Joinville",
    neighborhood: "",
    source: "Google Ads",
    campaign: "Pesquisa ampla",
    service: "Outro",
    customerType: "Pessoa Fisica",
    contactStatus: "Contato realizado",
    leadStatus: "Perdido",
    lossReason: "Nao era o publico",
    budgetSent: 0,
    proposalValue: 0,
    closeDate: "",
    qualified: "Nao",
    urgency: "Nao informado",
    owner: "Comercial Baltt",
    nextFollowUp: "",
    notes: "Pedido nao relacionado aos servicos da empresa.",
    lastUpdate: "12 dias",
  },
  {
    id: "lead-004",
    company: "vale",
    stage: "qualificado",
    arrivalDate: "2026-08-17",
    name: "Lead Britagem 001",
    phone: "(47) 90000-2001",
    email: "",
    city: "Navegantes",
    neighborhood: "Sao Paulo",
    source: "Meta Ads",
    campaign: "Conversas WhatsApp - Britas",
    service: "Britas / Agregados",
    customerType: "Pessoa Fisica",
    contactStatus: "Contato realizado",
    leadStatus: "Qualificado",
    lossReason: "",
    budgetSent: 0,
    proposalValue: 0,
    closeDate: "",
    qualified: "Sim",
    urgency: "Ate 30 dias",
    owner: "Comercial Vale",
    nextFollowUp: "2026-08-20",
    notes: "Precisa confirmar metragem minima para entrega.",
    lastUpdate: "Hoje",
  },
  {
    id: "lead-005",
    company: "vale",
    stage: "atendimento",
    arrivalDate: "2026-08-09",
    name: "Engenharia Vale Norte",
    phone: "(47) 90000-2002",
    email: "compras@exemplo.com",
    city: "Penha",
    neighborhood: "Armacao",
    source: "Orcamento direto",
    campaign: "WhatsApp direto",
    service: "Britas / Agregados",
    customerType: "Pessoa Juridica",
    contactStatus: "Em conversa",
    leadStatus: "Em atendimento",
    lossReason: "",
    budgetSent: 3400,
    proposalValue: 0,
    closeDate: "",
    qualified: "Parcial",
    urgency: "Apenas orcamento",
    owner: "Comercial Vale",
    nextFollowUp: "2026-08-22",
    notes: "Aguardando endereco completo da obra.",
    lastUpdate: "3 dias",
  },
  {
    id: "lead-006",
    company: "vale",
    stage: "ganho",
    arrivalDate: "2026-07-24",
    name: "Cliente recorrente agregados",
    phone: "(47) 90000-2003",
    email: "",
    city: "Ilhota",
    neighborhood: "Minas",
    source: "Indicacao",
    campaign: "Indicacao cliente",
    service: "Britas / Agregados",
    customerType: "Pessoa Juridica",
    contactStatus: "Contato realizado",
    leadStatus: "Fechado",
    lossReason: "",
    budgetSent: 12574.32,
    proposalValue: 12574.32,
    closeDate: "2026-08-02",
    qualified: "Sim",
    urgency: "Imediato",
    owner: "Comercial Vale",
    nextFollowUp: "",
    notes: "Venda fechada com entrega programada.",
    lastUpdate: "5 dias",
  },
  {
    id: "lead-007",
    company: "baltec",
    stage: "novo",
    arrivalDate: "2026-08-19",
    name: "Lead Paver 001",
    phone: "(47) 90000-3001",
    email: "",
    city: "Itajai",
    neighborhood: "Fazenda",
    source: "Meta Ads",
    campaign: "Conversas WhatsApp - Pavers",
    service: "Pavers / Blocos",
    customerType: "Pessoa Fisica",
    contactStatus: "Nao respondeu",
    leadStatus: "Novo",
    lossReason: "",
    budgetSent: 0,
    proposalValue: 0,
    closeDate: "",
    qualified: "Pendente",
    urgency: "Ate 3 meses",
    owner: "Comercial Baltec",
    nextFollowUp: "2026-08-20",
    notes: "Perguntou por piso intertravado para area externa.",
    lastUpdate: "Hoje",
  },
  {
    id: "lead-008",
    company: "baltec",
    stage: "proposta",
    arrivalDate: "2026-08-11",
    name: "Condominio Exemplo",
    phone: "(47) 90000-3002",
    email: "condominio@exemplo.com",
    city: "Balneario Picarras",
    neighborhood: "Itacolomi",
    source: "Google Ads",
    campaign: "Pesquisa - Blocos",
    service: "Pavers / Blocos",
    customerType: "Pessoa Juridica",
    contactStatus: "Contato realizado",
    leadStatus: "Proposta enviada",
    lossReason: "",
    budgetSent: 8200,
    proposalValue: 8200,
    closeDate: "",
    qualified: "Sim",
    urgency: "Ate 30 dias",
    owner: "Comercial Baltec",
    nextFollowUp: "2026-08-23",
    notes: "Validar prazo e frete antes de fechar.",
    lastUpdate: "Ontem",
  },
  {
    id: "lead-009",
    company: "baltec",
    stage: "ganho",
    arrivalDate: "2026-07-30",
    name: "Obra residencial exemplo",
    phone: "(47) 90000-3003",
    email: "",
    city: "Penha",
    neighborhood: "Centro",
    source: "Orcamento direto",
    campaign: "WhatsApp direto",
    service: "Pavers / Blocos",
    customerType: "Pessoa Fisica",
    contactStatus: "Contato realizado",
    leadStatus: "Fechado",
    lossReason: "",
    budgetSent: 4768.97,
    proposalValue: 4768.97,
    closeDate: "2026-08-05",
    qualified: "Sim",
    urgency: "Imediato",
    owner: "Comercial Baltec",
    nextFollowUp: "",
    notes: "Fechado pelo WhatsApp apos ajuste no frete.",
    lastUpdate: "7 dias",
  },
];

const initialInvestments: Investment[] = [
  {
    id: "investment-2026-01",
    month: "janeiro 26",
    meta: 333.3,
    google: 124,
    note: "2.381 interacoes Meta / 97 cliques Google",
  },
  {
    id: "investment-2026-02",
    month: "fevereiro 26",
    meta: 1378.7,
    google: 164,
    note: "324 leads Meta / 164 cliques",
  },
  {
    id: "investment-2026-03",
    month: "marco 26",
    meta: 1567.85,
    google: 156.97,
    note: "188 leads Meta / 107 cliques",
  },
  {
    id: "investment-2026-04",
    month: "abril 26",
    meta: 1514.61,
    google: 326.49,
    note: "134 leads Meta / 1.533 cliques",
  },
  {
    id: "investment-2026-05",
    month: "maio 26",
    meta: 1564.26,
    google: 178.69,
    note: "102 leads Meta / 463 cliques",
  },
  {
    id: "investment-2026-06",
    month: "junho 26",
    meta: 1338.79,
    google: 467.24,
    note: "95 leads Meta / 1.093 cliques",
  },
  {
    id: "investment-2026-07",
    month: "julho 26",
    meta: 1318.14,
    google: 508.58,
    note: "86 leads Meta / 1.609 cliques",
  },
];

const emptyLead = (company: CompanyKey): LeadForm => ({
  company,
  stage: "novo",
  arrivalDate: "2026-08-19",
  name: "",
  phone: "",
  email: "",
  city: "",
  neighborhood: "",
  source: "Meta Ads",
  campaign: "",
  service: "Pavers / Blocos",
  customerType: "Pessoa Fisica",
  contactStatus: "Aguardando primeiro contato",
  leadStatus: "Novo",
  lossReason: "",
  budgetSent: 0,
  proposalValue: 0,
  closeDate: "",
  qualified: "Pendente",
  urgency: "Nao informado",
  owner: "",
  nextFollowUp: "",
  notes: "",
});

const emptyInvestment = (): InvestmentForm => ({
  month: "",
  meta: 0,
  google: 0,
  note: "",
});

function leadToForm(lead: Lead): LeadForm {
  return {
    company: lead.company,
    stage: lead.stage,
    arrivalDate: lead.arrivalDate,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    neighborhood: lead.neighborhood,
    source: lead.source,
    campaign: lead.campaign,
    service: lead.service,
    customerType: lead.customerType,
    contactStatus: lead.contactStatus,
    leadStatus: lead.leadStatus,
    lossReason: lead.lossReason,
    budgetSent: lead.budgetSent,
    proposalValue: lead.proposalValue,
    closeDate: lead.closeDate,
    qualified: lead.qualified,
    urgency: lead.urgency,
    owner: lead.owner,
    nextFollowUp: lead.nextFollowUp,
    notes: lead.notes,
  };
}

function toMoneyNumber(value: unknown) {
  const parsed =
    typeof value === "string" ? parseMoney(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInvestments(value: unknown): Investment[] {
  if (!Array.isArray(value)) return initialInvestments;

  const normalized = value
    .map((item, index) => {
      const row = item as Partial<Investment>;
      return {
        id: row.id || `investment-saved-${index}`,
        month: String(row.month ?? "").trim(),
        meta: toMoneyNumber(row.meta),
        google: toMoneyNumber(row.google),
        note: String(row.note ?? ""),
      };
    })
    .filter((item) => item.month);

  return normalized.length > 0 ? normalized : initialInvestments;
}

function investmentLineTotal(item: Pick<Investment, "meta" | "google">) {
  return toMoneyNumber(item.meta) + toMoneyNumber(item.google);
}

function makeClientId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function getCompany(key: CompanyKey) {
  return companies.find((company) => company.key === key) ?? companies[0];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return "erro desconhecido";
}

function isCompanyKey(value: string | null | undefined): value is CompanyKey {
  return companyKeys.includes(value as CompanyKey);
}

function normalizePermission(permission?: CrmUserPermission | null): CrmUserPermission {
  if (!permission || permission.role === "admin") return adminPermission;

  const allowedCompanies = permission.allowedCompanies.filter(isCompanyKey);
  const companyKey = isCompanyKey(permission.companyKey)
    ? permission.companyKey
    : allowedCompanies[0] ?? null;

  return {
    role: "empresa",
    companyKey,
    allowedCompanies: companyKey ? [companyKey] : allowedCompanies,
    email: permission.email,
  };
}

function companyIsAllowed(permission: CrmUserPermission, companyKey: CompanyKey) {
  return (
    permission.role === "admin" ||
    permission.allowedCompanies.includes(companyKey)
  );
}

function firstAllowedCompany(permission: CrmUserPermission) {
  return companies.find((company) => companyIsAllowed(permission, company.key))?.key ?? "baltt";
}

function daysSince(date: string) {
  const value = new Date(`${normalizeDate(date)}T12:00:00`);
  return Math.max(
    0,
    Math.round((fixedToday.getTime() - value.getTime()) / 86_400_000),
  );
}

function formatDate(date: string) {
  if (!date) return "Sem data";
  const normalizedDate = normalizeDate(date);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${normalizedDate}T12:00:00`));
}

function formatMonthKey(key: string) {
  if (key === "sem-data") return "Sem data";

  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

function dateTimeValue(date: string) {
  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) return null;

  const timestamp = new Date(`${normalizedDate}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function dateMatchesFilter(
  date: string,
  filter: DateFilterKey,
  customStart: string,
  customEnd: string,
) {
  if (filter === "all") return true;

  if (filter === "custom") {
    const leadTime = dateTimeValue(date);
    if (leadTime === null) return false;

    const startTime = customStart ? dateTimeValue(customStart) : null;
    const endTime = customEnd ? dateTimeValue(customEnd) : null;

    if (startTime !== null && leadTime < startTime) return false;
    if (endTime !== null && leadTime > endTime) return false;

    return true;
  }

  return daysSince(date) <= Number(filter);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function stageFromStatus(value: string): StageKey {
  const normalized = value.toLowerCase();

  if (normalized.includes("fechado") || normalized.includes("ganho")) {
    return "ganho";
  }

  if (normalized.includes("perdido")) {
    return "perdido";
  }

  if (normalized.includes("proposta")) {
    return "proposta";
  }

  if (normalized.includes("qualificado")) {
    return "qualificado";
  }

  if (normalized.includes("atendimento") || normalized.includes("contato")) {
    return "atendimento";
  }

  return "novo";
}

function statusFromStage(stage: StageKey) {
  return stages.find((item) => item.key === stage)?.label ?? "Novo WhatsApp";
}

function parseMoney(value: string | undefined) {
  if (!value) return 0;
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "2026-08-19";

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function splitCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (const character of line) {
    if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === separator && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ""));
}

function headerKey(header: string) {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "")
    .trim()
    .toLowerCase();
}

function mapCsvRows(text: string, activeCompany: CompanyKey): Lead[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], separator).map(headerKey);

  return lines
    .slice(1)
    .map((line, index) => {
      const values = splitCsvLine(line, separator);
      const row = headers.reduce<Record<string, string>>((acc, key, cellIndex) => {
        acc[key] = values[cellIndex] ?? "";
        return acc;
      }, {});

      const rawCompany = headerKey(row.empresa ?? "");
      const company =
        companies.find((item) => rawCompany.includes(item.shortName.toLowerCase()))
          ?.key ?? activeCompany;
      const rawStatus =
        row["status do lead"] ??
        row.fechado ??
        row.status ??
        row["conseguiu contato"] ??
        "Novo";
      const stage = stageFromStatus(rawStatus);

      return {
        id: `lead-import-${Date.now()}-${index}`,
        company,
        stage,
        arrivalDate: normalizeDate(
          row.tha || row.data || row["data de entrada"] || "2026-08-19",
        ),
        name: row["nome completo"] || row.nome || `Lead importado ${index + 1}`,
        phone: row["telefone (whatsapp)"] || row.telefone || row.whatsapp || "",
        email: row["e-mail"] || row.email || "",
        city: row.cidade || "",
        neighborhood: row.bairro || "",
        source: row.origem || row["origem"] || row["google ads"] || row["meta ads"] || "",
        campaign: row.campanha || "",
        service:
          row["pavers / blocos"] ||
          row["britas / agregados"] ||
          row.servico ||
          row.produto ||
          "",
        customerType: row["pessoa fisica"] || row.cliente || "Pessoa Fisica",
        contactStatus: row["conseguiu contato"] || "",
        leadStatus: rawStatus,
        lossReason: row["fechou com concorrente"] || row["sem retorno"] || row.perda || "",
        budgetSent: parseMoney(row["valor do orcamento enviado"]),
        proposalValue: parseMoney(row["valor proposta"]),
        closeDate: row["data do fechamento"]
          ? normalizeDate(row["data do fechamento"])
          : "",
        qualified: row["lead qualificado"] || "Pendente",
        urgency: row.urgencia || "Nao informado",
        owner: row.responsavel || "",
        nextFollowUp: row["proximo follow-up"] || row.followup || "",
        notes: row.observacoes || "",
        lastUpdate: "Importado",
      };
    })
    .filter((lead) => lead.name || lead.phone);
}

function NavPictogram({ icon }: { icon: NavIconKey }) {
  return (
    <svg
      aria-hidden="true"
      className="nav-pictogram"
      fill="none"
      viewBox="0 0 24 24"
    >
      {icon === "pipeline" ? (
        <>
          <rect x="3" y="5" width="5" height="14" rx="1.5" />
          <rect x="9.5" y="5" width="5" height="14" rx="1.5" />
          <rect x="16" y="5" width="5" height="14" rx="1.5" />
        </>
      ) : null}
      {icon === "leads" ? (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.8 19c.7-3 2.5-4.5 5.2-4.5s4.5 1.5 5.2 4.5" />
          <path d="M16.5 10.2a2.8 2.8 0 1 0 0-5.6" />
          <path d="M15.2 14.8c2.5.2 4.1 1.6 4.8 4.2" />
        </>
      ) : null}
      {icon === "investment" ? (
        <>
          <path d="M4 18.5h16" />
          <path d="M7 15.5V11" />
          <path d="M12 15.5V6" />
          <path d="M17 15.5V9" />
          <path d="M5.5 8.5 9 5l3 3 5-5" />
        </>
      ) : null}
      {icon === "reports" ? (
        <>
          <path d="M6 3.5h8l4 4v13H6z" />
          <path d="M14 3.5v4h4" />
          <path d="M9 16v-3" />
          <path d="M12 16v-6" />
          <path d="M15 16v-4" />
        </>
      ) : null}
    </svg>
  );
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (supabaseEnabled) return "checking";
    if (typeof window === "undefined") return "checking";

    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "authenticated"
      ? "authenticated"
      : "anonymous";
  });
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [leads, setLeads] = useState<Lead[]>(() => {
    if (typeof window === "undefined") return initialLeads;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialLeads;

    try {
      return JSON.parse(stored) as Lead[];
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return initialLeads;
    }
  });
  const [investments, setInvestments] = useState<Investment[]>(() => {
    if (typeof window === "undefined") return initialInvestments;

    const stored = window.localStorage.getItem(INVESTMENT_STORAGE_KEY);
    if (!stored) return initialInvestments;

    try {
      return normalizeInvestments(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem(INVESTMENT_STORAGE_KEY);
      return initialInvestments;
    }
  });
  const [activeCompany, setActiveCompany] = useState<CompanyKey>("baltt");
  const [activeView, setActiveView] = useState<ViewKey>("funis");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("Todas");
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("90");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [leadStageFilter, setLeadStageFilter] =
    useState<LeadStageFilterKey>("all");
  const [reportScope, setReportScope] = useState<ReportScopeKey>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    initialLeads[0]?.id ?? null,
  );
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyLead("baltt"));
  const [investmentForm, setInvestmentForm] = useState<InvestmentForm>(
    emptyInvestment(),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(
    supabaseEnabled ? "loading" : "local",
  );
  const [syncMessage, setSyncMessage] = useState(
    supabaseEnabled
      ? "Aguardando login Supabase"
      : "Dados locais neste navegador",
  );
  const [permission, setPermission] =
    useState<CrmUserPermission>(adminPermission);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const detailsPanelRef = useRef<HTMLElement | null>(null);
  const remoteReadyRef = useRef(!supabaseEnabled);
  const loadingRemoteRef = useRef(false);
  const latestLeadsRef = useRef(leads);
  const latestInvestmentsRef = useRef(investments);

  useEffect(() => {
    latestLeadsRef.current = leads;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    latestInvestmentsRef.current = investments;
    window.localStorage.setItem(
      INVESTMENT_STORAGE_KEY,
      JSON.stringify(investments),
    );
  }, [investments]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setAuthState(data.session ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!mounted) return;
        setAuthState("anonymous");
        setLoginError("Nao foi possivel verificar o login.");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthState(session ? "authenticated" : "anonymous");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseEnabled || authState !== "authenticated") return;

    let cancelled = false;

    async function loadRemoteData() {
      loadingRemoteRef.current = true;
      setSyncState("loading");
      setSyncMessage("Carregando base Supabase...");

      try {
        const snapshot = await loadCrmSnapshot();
        if (cancelled) return;

        if (snapshot) {
          const nextPermission = normalizePermission(snapshot.permission);
          const remoteLeads = snapshot.leads as Lead[];
          const remoteInvestments = normalizeInvestments(snapshot.investments);

          setPermission(nextPermission);
          setActiveCompany((current) =>
            companyIsAllowed(nextPermission, current)
              ? current
              : firstAllowedCompany(nextPermission),
          );

          setLeads(remoteLeads);
          setSelectedLeadId(remoteLeads[0]?.id ?? null);
          setInvestments(remoteInvestments);
        } else {
          setPermission(adminPermission);
        }

        if (!cancelled) {
          remoteReadyRef.current = true;
          setSyncState("shared");
          setSyncMessage("Base Supabase ativa");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Baltt CRM] Falha ao carregar a Supabase", error);
          remoteReadyRef.current = false;
          setSyncState("error");
          setSyncMessage(`Falha Supabase: ${getErrorMessage(error)}`);
        }
      } finally {
        loadingRemoteRef.current = false;
      }
    }

    loadRemoteData();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  useEffect(() => {
    if (
      !supabaseEnabled ||
      authState !== "authenticated" ||
      !remoteReadyRef.current ||
      loadingRemoteRef.current
    ) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      setSyncState("saving");
      setSyncMessage("Salvando na Supabase...");

      saveCrmSnapshot({ leads, investments })
        .then(() => {
          setSyncState("shared");
          setSyncMessage("Base Supabase ativa");
        })
        .catch((error) => {
          console.error("[Baltt CRM] Falha ao salvar na Supabase", error);
          setSyncState("error");
          setSyncMessage(`Falha ao salvar: ${getErrorMessage(error)}`);
        });
    }, 550);

    return () => window.clearTimeout(saveTimer);
  }, [leads, investments, authState]);

  useEffect(() => {
    if (!selectedLeadId || activeView !== "funis") return;

    function closeDetailsOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (detailsPanelRef.current?.contains(target)) return;

      setSelectedLeadId(null);
    }

    document.addEventListener("pointerdown", closeDetailsOnOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", closeDetailsOnOutsideClick);
    };
  }, [activeView, selectedLeadId]);

  const activeCompanyData = getCompany(activeCompany);
  const hasAdminAccess = permission.role === "admin";
  const activeViewKey: ViewKey =
    activeView === "investimento" && !hasAdminAccess ? "funis" : activeView;
  const activeViewData =
    navItems.find((item) => item.key === activeViewKey) ?? navItems[0];
  const activeCompanyAllowed = companyIsAllowed(permission, activeCompany);

  const companyLeads = useMemo(
    () =>
      activeCompanyAllowed
        ? leads.filter((lead) => lead.company === activeCompany)
        : [],
    [leads, activeCompany, activeCompanyAllowed],
  );

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return companyLeads
      .filter((lead) => {
        if (!normalizedQuery) return true;
        const searchable = [
          lead.name,
          lead.phone,
          lead.city,
          lead.neighborhood,
          lead.service,
          lead.campaign,
          lead.notes,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .filter((lead) => sourceFilter === "Todas" || lead.source === sourceFilter)
      .filter((lead) => {
        return dateMatchesFilter(
          lead.arrivalDate,
          dateFilter,
          customDateStart,
          customDateEnd,
        );
      })
      .sort((a, b) => {
        const first = new Date(a.arrivalDate).getTime();
        const second = new Date(b.arrivalDate).getTime();
        return sortOrder === "desc" ? second - first : first - second;
      });
  }, [
    companyLeads,
    query,
    sourceFilter,
    dateFilter,
    customDateStart,
    customDateEnd,
    sortOrder,
  ]);

  const tableLeads = useMemo(() => {
    return filteredLeads.filter(
      (lead) => leadStageFilter === "all" || lead.stage === leadStageFilter,
    );
  }, [filteredLeads, leadStageFilter]);
  const validSelectedLeadIds = selectedLeadIds.filter((leadId) => {
    const lead = leads.find((item) => item.id === leadId);
    return lead ? companyIsAllowed(permission, lead.company) : false;
  });
  const visibleLeadIds = tableLeads.map((lead) => lead.id);
  const selectedVisibleCount = validSelectedLeadIds.filter((leadId) =>
    visibleLeadIds.includes(leadId),
  ).length;
  const allVisibleSelected =
    tableLeads.length > 0 && selectedVisibleCount === tableLeads.length;

  const selectedLead = useMemo(
    () => {
      if (!selectedLeadId) return null;

      return leads.find(
        (lead) => lead.id === selectedLeadId && lead.company === activeCompany,
      ) ?? null;
    },
    [leads, selectedLeadId, activeCompany],
  );

  const stageTotals = useMemo(() => {
    return stages.map((stage) => ({
      ...stage,
      count: companyLeads.filter((lead) => lead.stage === stage.key).length,
      value: companyLeads
        .filter((lead) => lead.stage === stage.key)
        .reduce((sum, lead) => sum + lead.proposalValue, 0),
    }));
  }, [companyLeads]);

  const metrics = useMemo(() => {
    const won = companyLeads.filter((lead) => lead.stage === "ganho");
    const lost = companyLeads.filter((lead) => lead.stage === "perdido");
    const pipeline = companyLeads.filter(
      (lead) => lead.stage !== "ganho" && lead.stage !== "perdido",
    );
    const proposalValue = pipeline.reduce(
      (sum, lead) => sum + lead.proposalValue,
      0,
    );
    const wonValue = won.reduce((sum, lead) => sum + lead.proposalValue, 0);
    const qualified = companyLeads.filter((lead) =>
      ["Sim", "Parcial"].includes(lead.qualified),
    );

    return {
      total: companyLeads.length,
      pipeline: pipeline.length,
      proposalValue,
      wonValue,
      conversion:
        companyLeads.length > 0
          ? Math.round((won.length / companyLeads.length) * 100)
          : 0,
      lost: lost.length,
      qualified:
        companyLeads.length > 0
          ? Math.round((qualified.length / companyLeads.length) * 100)
          : 0,
    };
  }, [companyLeads]);

  const investmentTotal = investments.reduce(
    (sum, item) => sum + investmentLineTotal(item),
    0,
  );
  const investmentMetaTotal = investments.reduce((sum, item) => sum + item.meta, 0);
  const investmentGoogleTotal = investments.reduce(
    (sum, item) => sum + item.google,
    0,
  );
  const investmentAverage =
    investments.length > 0 ? investmentTotal / investments.length : 0;
  const leadCost =
    metrics.total > 0 ? investmentTotal / Math.max(metrics.total, 1) : 0;

  const companyTotals = useMemo(() => {
    return companies.map((company) => {
      const items = leads.filter((lead) => lead.company === company.key);
      return {
        ...company,
        count: items.length,
        open: items.filter(
          (lead) => lead.stage !== "ganho" && lead.stage !== "perdido",
        ).length,
        won: items.filter((lead) => lead.stage === "ganho").length,
        value: items.reduce((sum, lead) => sum + lead.proposalValue, 0),
      };
    });
  }, [leads]);

  const reportScopeIsAll = reportScope === "all" && hasAdminAccess;
  const reportCompanyKey = reportScope === "all" ? activeCompany : reportScope;
  const reportCompanyData = getCompany(reportCompanyKey);
  const reportScopeLabel = reportScopeIsAll
    ? "Todas as empresas"
    : reportCompanyData.shortName;
  const reportScopeFocus = reportScopeIsAll
    ? "Consolidado Baltt, Vale e Baltec"
    : reportCompanyData.focus;

  const reportLeads = useMemo(() => {
    if (reportScope === "all" && hasAdminAccess) {
      return leads.filter((lead) => companyIsAllowed(permission, lead.company));
    }

    const targetCompany = reportScope === "all" ? activeCompany : reportScope;
    if (!companyIsAllowed(permission, targetCompany)) return [];

    return leads.filter((lead) => lead.company === targetCompany);
  }, [activeCompany, hasAdminAccess, leads, permission, reportScope]);

  const reportStageTotals = useMemo(() => {
    return stages.map((stage) => ({
      ...stage,
      count: reportLeads.filter((lead) => lead.stage === stage.key).length,
      value: reportLeads
        .filter((lead) => lead.stage === stage.key)
        .reduce((sum, lead) => sum + lead.proposalValue, 0),
    }));
  }, [reportLeads]);

  const reportMetrics = useMemo(() => {
    const won = reportLeads.filter((lead) => lead.stage === "ganho");
    const lost = reportLeads.filter((lead) => lead.stage === "perdido");
    const pipeline = reportLeads.filter(
      (lead) => lead.stage !== "ganho" && lead.stage !== "perdido",
    );
    const proposalValue = pipeline.reduce(
      (sum, lead) => sum + lead.proposalValue,
      0,
    );
    const wonValue = won.reduce((sum, lead) => sum + lead.proposalValue, 0);
    const qualified = reportLeads.filter((lead) =>
      ["Sim", "Parcial"].includes(lead.qualified),
    );

    return {
      total: reportLeads.length,
      pipeline: pipeline.length,
      proposalValue,
      wonValue,
      conversion:
        reportLeads.length > 0
          ? Math.round((won.length / reportLeads.length) * 100)
          : 0,
      lost: lost.length,
      qualified:
        reportLeads.length > 0
          ? Math.round((qualified.length / reportLeads.length) * 100)
          : 0,
    };
  }, [reportLeads]);

  const reportSourceTotals = useMemo(() => {
    const grouped = sources
      .map((source) => {
        const sourceLeads = reportLeads.filter((lead) => lead.source === source);
        return {
          source,
          count: sourceLeads.length,
          value: sourceLeads.reduce((sum, lead) => sum + lead.proposalValue, 0),
        };
      })
      .filter((item) => item.count > 0);
    const missingSource = reportLeads.filter(
      (lead) => !lead.source || !sources.includes(lead.source),
    );

    if (missingSource.length > 0) {
      grouped.push({
        source: "Sem origem",
        count: missingSource.length,
        value: missingSource.reduce((sum, lead) => sum + lead.proposalValue, 0),
      });
    }

    return grouped.sort((first, second) => second.count - first.count);
  }, [reportLeads]);

  const reportLossTotals = useMemo(() => {
    return lossReasons
      .filter(Boolean)
      .map((reason) => ({
        reason,
        count: reportLeads.filter((lead) => lead.lossReason === reason).length,
      }))
      .filter((item) => item.count > 0)
      .sort((first, second) => second.count - first.count);
  }, [reportLeads]);

  const reportMonthlyReport = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        label: string;
        leads: number;
        proposals: number;
        won: number;
        value: number;
      }
    >();

    reportLeads.forEach((lead) => {
      const normalizedDate = normalizeDate(lead.arrivalDate);
      const key = normalizedDate ? normalizedDate.slice(0, 7) : "sem-data";
      const current =
        grouped.get(key) ??
        {
          key,
          label: formatMonthKey(key),
          leads: 0,
          proposals: 0,
          won: 0,
          value: 0,
        };

      current.leads += 1;
      current.proposals += lead.stage === "proposta" ? 1 : 0;
      current.won += lead.stage === "ganho" ? 1 : 0;
      current.value += lead.proposalValue;
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .sort((first, second) => first.key.localeCompare(second.key))
      .slice(-7);
  }, [reportLeads]);

  const reportWonCount =
    reportStageTotals.find((stage) => stage.key === "ganho")?.count ?? 0;
  const reportAverageTicket =
    reportWonCount > 0 ? reportMetrics.wonValue / reportWonCount : 0;
  const reportLeadCost =
    reportMetrics.total > 0
      ? investmentTotal / Math.max(reportMetrics.total, 1)
      : 0;
  const reportStageMaxCount = Math.max(
    ...reportStageTotals.map((stage) => stage.count),
    1,
  );
  const reportMonthlyMaxLeads = Math.max(
    ...reportMonthlyReport.map((item) => item.leads),
    1,
  );
  const reportSourceTotalCount = Math.max(
    reportSourceTotals.reduce((sum, item) => sum + item.count, 0),
    1,
  );
  const reportSourceSlices = reportSourceTotals.slice(0, 6).map((item, index) => ({
    ...item,
    color: chartColors[index % chartColors.length],
    percent: Math.round((item.count / reportSourceTotalCount) * 100),
  }));
  const reportSourceGradient =
    reportSourceSlices.length > 0
      ? `conic-gradient(${reportSourceSlices
          .reduce<Array<{ color: string; start: number; end: number }>>(
            (segments, item) => {
              const start = segments.at(-1)?.end ?? 0;
              const end = start + (item.count / reportSourceTotalCount) * 100;
              return [...segments, { color: item.color, start, end }];
            },
            [],
          )
          .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
          .join(", ")})`
      : "conic-gradient(#26384f 0% 100%)";
  const reportRevenueChart = useMemo(() => {
    const chartWidth = 640;
    const chartHeight = 250;
    const paddingX = 34;
    const paddingY = 30;
    const rows =
      reportMonthlyReport.length > 0
        ? reportMonthlyReport
        : [
            {
              key: "sem-data",
              label: "Sem dados",
              leads: 0,
              proposals: 0,
              won: 0,
              value: 0,
            },
          ];
    const maxValue = Math.max(...rows.map((item) => item.value), 1);
    const step =
      rows.length > 1
        ? (chartWidth - paddingX * 2) / (rows.length - 1)
        : 0;
    const points = rows.map((item, index) => {
      const x = rows.length > 1 ? paddingX + index * step : chartWidth / 2;
      const y =
        chartHeight -
        paddingY -
        (item.value / maxValue) * (chartHeight - paddingY * 2);

      return { ...item, x, y };
    });
    const line = points.map((point) => `${point.x},${point.y}`).join(" ");
    const area =
      points.length > 0
        ? `M ${points[0].x} ${chartHeight - paddingY} L ${line.replaceAll(
            " ",
            " L ",
          )} L ${points[points.length - 1].x} ${chartHeight - paddingY} Z`
        : "";

    return { width: chartWidth, height: chartHeight, points, line, area };
  }, [reportMonthlyReport]);

  const headerMetrics = activeViewKey === "relatorios" ? reportMetrics : metrics;
  const headerLeadCost =
    activeViewKey === "relatorios" ? reportLeadCost : leadCost;

  const activeViewTitle =
    activeViewKey === "funis"
      ? activeCompanyData.name
      : activeViewKey === "relatorios"
        ? `${activeViewData.label} - ${reportScopeLabel}`
        : `${activeViewData.label} - ${activeCompanyData.shortName}`;
  const activeViewSubtitle =
    activeViewKey === "funis"
      ? activeCompanyData.focus
      : activeViewKey === "leads"
        ? `${tableLeads.length} leads filtrados de ${companyLeads.length} no total`
        : activeViewKey === "investimento"
          ? `${currency.format(investmentTotal)} em Meta Ads e Google Ads`
          : `${reportMetrics.conversion}% conversao e ${reportMetrics.qualified}% qualificados`;

  function changeCompany(companyKey: CompanyKey) {
    if (!companyIsAllowed(permission, companyKey)) return;

    setActiveCompany(companyKey);
    setSelectedLeadId(
      leads.find((lead) => lead.company === companyKey)?.id ?? null,
    );
  }

  function handleLeadStackWheel(event: WheelEvent<HTMLDivElement>) {
    const stack = event.currentTarget;
    const canScroll = stack.scrollHeight > stack.clientHeight + 1;

    if (!canScroll) return;

    const atTop = stack.scrollTop <= 0;
    const atBottom =
      stack.scrollTop + stack.clientHeight >= stack.scrollHeight - 1;
    const scrollingUp = event.deltaY < 0;
    const scrollingDown = event.deltaY > 0;

    if ((scrollingUp && atTop) || (scrollingDown && atBottom)) return;

    event.stopPropagation();
  }

  function addInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAdminAccess) return;
    if (!investmentForm.month.trim()) return;

    const investment = {
      id: makeClientId("investment"),
      month: investmentForm.month.trim(),
      meta: toMoneyNumber(investmentForm.meta),
      google: toMoneyNumber(investmentForm.google),
      note: investmentForm.note.trim(),
    };
    setInvestments((current) => [...current, investment]);
    setInvestmentForm(emptyInvestment());
  }

  function updateInvestment(
    investmentId: string,
    patch: Partial<InvestmentForm>,
  ) {
    if (!hasAdminAccess) return;

    const nextInvestments = investments.map((item) => {
      if (item.id !== investmentId) return item;

      return {
        ...item,
        ...patch,
        meta:
          patch.meta === undefined ? item.meta : toMoneyNumber(patch.meta),
        google:
          patch.google === undefined
            ? item.google
            : toMoneyNumber(patch.google),
      };
    });

    setInvestments(nextInvestments);
  }

  function removeInvestment(investmentId: string) {
    if (!hasAdminAccess) return;

    setInvestments((current) =>
      current.filter((item) => item.id !== investmentId),
    );
  }

  function moveLead(leadId: string, stage: StageKey) {
    const targetLead = leads.find((lead) => lead.id === leadId);
    if (!targetLead || !companyIsAllowed(permission, targetLead.company)) return;

    const nextLeads = leads.map((lead) => {
      if (lead.id !== leadId) return lead;

      return {
        ...lead,
        stage,
        leadStatus: statusFromStage(stage),
        lastUpdate: "Agora",
        closeDate:
          stage === "ganho" && !lead.closeDate ? "2026-08-19" : lead.closeDate,
      };
    });

    setLeads(nextLeads);
  }

  function openNewLead() {
    const companyKey = activeCompanyAllowed
      ? activeCompany
      : firstAllowedCompany(permission);
    if (!companyIsAllowed(permission, companyKey)) return;

    setEditingLead(null);
    setForm(emptyLead(companyKey));
    setModalOpen(true);
  }

  function openEditLead(lead: Lead) {
    if (!companyIsAllowed(permission, lead.company)) return;

    setEditingLead(lead);
    setForm(leadToForm(lead));
    setModalOpen(true);
  }

  function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) return;
    if (!companyIsAllowed(permission, form.company)) return;

    if (editingLead) {
      const updatedLead = {
        ...editingLead,
        ...form,
        leadStatus: form.leadStatus || statusFromStage(form.stage),
        lastUpdate: "Agora",
      };
      setLeads((current) =>
        current.map((lead) =>
          lead.id === editingLead.id ? updatedLead : lead,
        ),
      );
      setSelectedLeadId(editingLead.id);
      setActiveCompany(form.company);
    } else {
      const id = makeClientId("lead");
      const newLead = {
        id,
        ...form,
        leadStatus: form.leadStatus || statusFromStage(form.stage),
        lastUpdate: "Agora",
      };
      setLeads((current) => [newLead, ...current]);
      setSelectedLeadId(id);
      setActiveCompany(form.company);
    }

    setModalOpen(false);
  }

  function removeLead(leadId: string) {
    setLeads((current) =>
      current.filter(
        (lead) => lead.id !== leadId || !companyIsAllowed(permission, lead.company),
      ),
    );
    setSelectedLeadIds((current) => current.filter((id) => id !== leadId));
    if (selectedLeadId === leadId) setSelectedLeadId(null);
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    );
  }

  function toggleVisibleLeadSelection(checked: boolean) {
    const visibleIds = tableLeads.map((lead) => lead.id);

    setSelectedLeadIds((current) => {
      if (!checked) return current.filter((id) => !visibleIds.includes(id));

      const next = new Set([...current, ...visibleIds]);
      return Array.from(next);
    });
  }

  function removeSelectedLeads() {
    const removableIds = validSelectedLeadIds;

    if (removableIds.length === 0) return;

    const confirmed = window.confirm(
      `Excluir ${removableIds.length} lead(s) selecionado(s)?`,
    );
    if (!confirmed) return;

    const idsToRemove = new Set(removableIds);
    setLeads((current) => current.filter((lead) => !idsToRemove.has(lead.id)));
    setSelectedLeadIds([]);
    if (selectedLeadId && idsToRemove.has(selectedLeadId)) setSelectedLeadId(null);
  }

  function handleCsvUpload(file: File) {
    if (!activeCompanyAllowed) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imported = mapCsvRows(String(reader.result ?? ""), activeCompany);
      if (imported.length > 0) {
        setLeads((current) => [...imported, ...current]);
        setSelectedLeadId(imported[0].id);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    if (supabaseEnabled) {
      setAuthState("checking");

      try {
        const session = await signInCrm(loginUser, loginPassword);
        if (!session) throw new Error("Login sem sessao");
        setAuthState("authenticated");
        setLoginPassword("");
      } catch {
        setAuthState("anonymous");
        setLoginError("Usuario ou senha invalidos na Supabase.");
      }

      return;
    }

    if (loginUser.trim() === LOGIN_USER && loginPassword === LOGIN_PASSWORD) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "authenticated");
      setAuthState("authenticated");
      setLoginError("");
      setLoginPassword("");
      return;
    }

    setLoginError("Usuario ou senha invalidos.");
  }

  function logout() {
    if (supabaseEnabled) {
      signOutCrm().catch(() => undefined);
      remoteReadyRef.current = false;
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    setAuthState("anonymous");
    setPermission(adminPermission);
    setSelectedLeadId(null);
    setLoginUser("");
    setLoginPassword("");
  }

  function exportCsv() {
    const headers = [
      "Empresa",
      "Data de entrada",
      "Nome completo",
      "Telefone WhatsApp",
      "E-mail",
      "Cidade",
      "Bairro",
      "Origem",
      "Campanha",
      "Servico",
      "Tipo de cliente",
      "Conseguiu contato",
      "Status do lead",
      "Motivo de perda",
      "Valor do orcamento enviado",
      "Valor proposta",
      "Data do fechamento",
      "Lead qualificado",
      "Urgencia",
      "Responsavel",
      "Proximo follow-up",
      "Observacoes",
    ];
    const rows = leads.map((lead) => [
      getCompany(lead.company).name,
      lead.arrivalDate,
      lead.name,
      lead.phone,
      lead.email,
      lead.city,
      lead.neighborhood,
      lead.source,
      lead.campaign,
      lead.service,
      lead.customerType,
      lead.contactStatus,
      lead.leadStatus,
      lead.lossReason,
      lead.budgetSent,
      lead.proposalValue,
      lead.closeDate,
      lead.qualified,
      lead.urgency,
      lead.owner,
      lead.nextFollowUp,
      lead.notes,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "baltt-crm-leads.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (authState !== "authenticated") {
    const checkingAccess = authState === "checking";

    return (
      <main className="login-shell">
        <section className="login-card" aria-label="Entrada do CRM Baltt">
          <div className="login-brand" role="img" aria-label="Grupo Baltt" />
          <div>
            <p className="eyebrow">CRM Comercial</p>
            <h1>Entrar no CRM Baltt</h1>
            <span>
              {supabaseEnabled
                ? "Acesso conectado a Supabase."
                : "Acesso temporario para a equipe comercial."}
            </span>
          </div>

          <form onSubmit={handleLogin}>
            <label>
              Usuario
              <input
                autoComplete="username"
                disabled={checkingAccess}
                placeholder="Baltt@"
                value={loginUser}
                onChange={(event) => setLoginUser(event.target.value)}
              />
            </label>
            <label>
              Senha
              <input
                autoComplete="current-password"
                disabled={checkingAccess}
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            {loginError ? <p className="login-error">{loginError}</p> : null}
            <button className="primary-button" disabled={checkingAccess} type="submit">
              {checkingAccess ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (supabaseEnabled && syncState === "loading") {
    return (
      <main className="login-shell">
        <section className="login-card" aria-label="Carregando CRM Baltt">
          <div className="login-brand" role="img" aria-label="Grupo Baltt" />
          <div>
            <p className="eyebrow">CRM Comercial</p>
            <h1>Carregando CRM Baltt</h1>
            <span>Verificando usuario, permissao e base de leads.</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="crm-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" role="img" aria-label="Grupo Baltt" />
          <div>
            <p>CRM Comercial</p>
            <strong>Grupo Baltt</strong>
          </div>
        </div>

        <div className={`sync-panel ${syncState}`}>
          <span>
            {syncState === "shared"
              ? "Base Supabase"
              : syncState === "saving"
                ? "Salvando"
                : syncState === "loading"
                  ? "Conectando"
                  : syncState === "error"
                    ? "Atenção"
                    : "Modo local"}
          </span>
          <small>{syncMessage}</small>
        </div>

        <nav className="nav-list" aria-label="Areas do CRM">
          {navItems.map((item) => {
            const lockedNavItem = item.key === "investimento" && !hasAdminAccess;

            return (
              <button
                className={`nav-item ${activeViewKey === item.key ? "active" : ""} ${
                  lockedNavItem ? "locked" : ""
                }`}
                disabled={lockedNavItem}
                key={item.key}
                onClick={() => {
                  if (lockedNavItem) return;
                  setActiveView(item.key);
                }}
                type="button"
                title={
                  lockedNavItem
                    ? "Investimento liberado apenas para admin"
                    : item.label
                }
              >
                <span className="nav-icon">
                  <NavPictogram icon={item.icon} />
                </span>
                {item.label}
                {lockedNavItem ? (
                  <span className="lock-icon nav-lock" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="company-panel">
          <div className="panel-heading">
            <span>Empresas</span>
            <small>{companies.length} funis</small>
          </div>
          <div className="company-list">
            {companies.map((company) => {
              const count = leads.filter((lead) => lead.company === company.key).length;
              const allowed = companyIsAllowed(permission, company.key);

              return (
                <button
                  className={`company-button ${
                    activeCompany === company.key ? "selected" : ""
                  } ${allowed ? "" : "locked"}`}
                  disabled={!allowed}
                  key={company.key}
                  onClick={() => changeCompany(company.key)}
                  style={{ "--company-accent": company.accent } as CSSProperties}
                  type="button"
                  title={allowed ? company.name : "Funil bloqueado para este usuario"}
                >
                  <span>{company.shortName}</span>
                  {allowed ? <strong>{count}</strong> : <span className="lock-icon" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {activeViewKey === "funis" ? "Funil por empresa" : activeViewData.label}
            </p>
            <h1>{activeViewTitle}</h1>
            <span>{activeViewSubtitle}</span>
          </div>
          <div className="topbar-actions">
            <input
              aria-label="Buscar leads"
              className="search"
              placeholder="Buscar por nome, cidade, servico..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="icon-button" type="button" onClick={exportCsv} title="Exportar CSV">
              CSV
            </button>
            <input
              ref={fileInputRef}
              className="hidden-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleCsvUpload(file);
                event.currentTarget.value = "";
              }}
            />
            <button
              className="secondary-button"
              disabled={!activeCompanyAllowed}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Importar planilha
            </button>
            <button
              className="primary-button"
              disabled={!activeCompanyAllowed}
              type="button"
              onClick={openNewLead}
            >
              Novo lead
            </button>
            <button className="secondary-button logout-button" type="button" onClick={logout}>
              Sair
            </button>
          </div>
        </header>

        <section className="metrics-grid" aria-label="Indicadores">
          <article className="metric">
            <span>Leads no funil</span>
            <strong>{headerMetrics.total}</strong>
            <small>{headerMetrics.pipeline} em andamento</small>
          </article>
          <article className="metric">
            <span>Propostas abertas</span>
            <strong>{currency.format(headerMetrics.proposalValue)}</strong>
            <small>{headerMetrics.qualified}% qualificados</small>
          </article>
          <article className="metric">
            <span>Vendas fechadas</span>
            <strong>{currency.format(headerMetrics.wonValue)}</strong>
            <small>{headerMetrics.conversion}% conversao</small>
          </article>
          <article className="metric">
            <span>Custo base por lead</span>
            <strong>{currency.format(headerLeadCost)}</strong>
            <small>Meta + Google no periodo</small>
          </article>
        </section>

        <section className="control-strip">
          <div className="segmented" aria-label="Empresas">
            {activeViewKey === "relatorios" ? (
              <button
                type="button"
                className={reportScope === "all" ? "active" : ""}
                disabled={!hasAdminAccess}
                onClick={() => setReportScope("all")}
                title={
                  hasAdminAccess
                    ? "Relatorio completo"
                    : "Relatorio completo bloqueado para este usuario"
                }
              >
                {!hasAdminAccess ? (
                  <span className="lock-icon" aria-hidden="true" />
                ) : null}
                <span>Todas</span>
              </button>
            ) : null}
            {companies.map((company) => {
              const allowed = companyIsAllowed(permission, company.key);
              const selected =
                activeViewKey === "relatorios"
                  ? reportScope !== "all" && reportScope === company.key
                  : activeCompany === company.key;

              return (
                <button
                  type="button"
                  key={company.key}
                  className={`${selected ? "active" : ""} ${allowed ? "" : "locked"}`}
                  disabled={!allowed}
                  onClick={() => {
                    if (activeViewKey === "relatorios") {
                      setReportScope(company.key);
                      return;
                    }

                    changeCompany(company.key);
                  }}
                  title={
                    allowed
                      ? company.name
                      : activeViewKey === "relatorios"
                        ? "Relatorio bloqueado para este usuario"
                        : "Funil bloqueado para este usuario"
                  }
                >
                  {!allowed ? <span className="lock-icon" aria-hidden="true" /> : null}
                  <span>{company.shortName}</span>
                </button>
              );
            })}
          </div>
          <div className="filters">
            <label>
              Origem
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option>Todas</option>
                {sources.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </label>
            {activeViewKey === "leads" ? (
              <label>
                Etapa
                <select
                  value={leadStageFilter}
                  onChange={(event) =>
                    setLeadStageFilter(event.target.value as LeadStageFilterKey)
                  }
                >
                  <option value="all">Todas</option>
                  {stages.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Entrada
              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value as DateFilterKey)
                }
              >
                <option value="7">Ultimos 7 dias</option>
                <option value="30">Ultimos 30 dias</option>
                <option value="90">Ultimos 90 dias</option>
                <option value="custom">Personalizado</option>
                <option value="all">Todos</option>
              </select>
            </label>
            {dateFilter === "custom" ? (
              <>
                <label className="date-field">
                  De
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(event) => setCustomDateStart(event.target.value)}
                  />
                </label>
                <label className="date-field">
                  Ate
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(event) => setCustomDateEnd(event.target.value)}
                  />
                </label>
              </>
            ) : null}
            <label>
              Ordenar
              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value as "desc" | "asc")
                }
              >
                <option value="desc">Mais recentes</option>
                <option value="asc">Mais antigos</option>
              </select>
            </label>
          </div>
        </section>

        {activeViewKey === "funis" ? (
          <>
            <section className={`main-grid ${selectedLead ? "details-open" : "details-closed"}`}>
          <div className="board" aria-label={`Funil ${activeCompanyData.name}`}>
            {stages.map((stage) => {
              const stageLeads = filteredLeads.filter(
                (lead) => lead.stage === stage.key,
              );

              return (
                <section
                  className="lane"
                  key={stage.key}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedId) moveLead(draggedId, stage.key);
                    setDraggedId(null);
                  }}
                >
                  <header className="lane-header">
                    <div>
                      <span className={`status-dot ${stage.tone}`} />
                      <strong>{stage.label}</strong>
                    </div>
                    <small>{stageLeads.length}</small>
                  </header>

                  <div className="lead-stack" onWheel={handleLeadStackWheel}>
                    {stageLeads.map((lead) => {
                      const company = getCompany(lead.company);
                      const stale = daysSince(lead.arrivalDate) > 10 && !["ganho", "perdido"].includes(lead.stage);

                      return (
                        <div
                          className={`lead-card ${selectedLead?.id === lead.id ? "active" : ""}`}
                          draggable
                          key={lead.id}
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                          }}
                          onDragStart={() => setDraggedId(lead.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedLeadId(lead.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="card-top">
                            <span
                              className="company-chip"
                              style={{ "--chip-color": company.accent } as CSSProperties}
                            >
                              {company.shortName}
                            </span>
                            <time>{formatDate(lead.arrivalDate)}</time>
                          </div>
                          <h3>{lead.name}</h3>
                          <p>{lead.service}</p>
                          <div className="card-meta">
                            <span>{lead.city || "Cidade pendente"}</span>
                            <span>{lead.source || "Sem origem"}</span>
                          </div>
                          <div className="card-footer">
                            <strong>{currency.format(lead.proposalValue)}</strong>
                            <span className={stale ? "warm-alert" : "next-date"}>
                              {stale ? "Esfriando" : lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "Sem follow-up"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {stageLeads.length === 0 ? (
                      <div className="empty-lane">Solte leads aqui</div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>

          {selectedLead ? (
          <aside className="details-panel" ref={detailsPanelRef}>
              <>
                <button
                  type="button"
                  className="details-close"
                  aria-label="Fechar detalhes do lead"
                  onClick={() => {
                    setSelectedLeadId(null);
                  }}
                >
                  X
                </button>
                <div className="details-hero">
                  <span>{getCompany(selectedLead.company).shortName}</span>
                  <h2>{selectedLead.name}</h2>
                  <p>{selectedLead.service}</p>
                </div>

                <div className="details-actions">
                  <a
                    className="whatsapp-button"
                    href={`https://wa.me/55${normalizePhone(selectedLead.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir WhatsApp
                  </a>
                  <button type="button" onClick={() => openEditLead(selectedLead)}>
                    Editar
                  </button>
                </div>

                <dl className="lead-fields">
                  <div>
                    <dt>Entrada</dt>
                    <dd>{formatDate(selectedLead.arrivalDate)}</dd>
                  </div>
                  <div>
                    <dt>Telefone</dt>
                    <dd>{selectedLead.phone || "Pendente"}</dd>
                  </div>
                  <div>
                    <dt>Origem</dt>
                    <dd>{selectedLead.source}</dd>
                  </div>
                  <div>
                    <dt>Campanha</dt>
                    <dd>{selectedLead.campaign || "Sem campanha"}</dd>
                  </div>
                  <div>
                    <dt>Cliente</dt>
                    <dd>{selectedLead.customerType}</dd>
                  </div>
                  <div>
                    <dt>Qualificacao</dt>
                    <dd>{selectedLead.qualified}</dd>
                  </div>
                  <div>
                    <dt>Proposta</dt>
                    <dd>{currency.format(selectedLead.proposalValue)}</dd>
                  </div>
                  <div>
                    <dt>Follow-up</dt>
                    <dd>
                      {selectedLead.nextFollowUp
                        ? formatDate(selectedLead.nextFollowUp)
                        : "Sem data"}
                    </dd>
                  </div>
                </dl>

                <div className="notes-box">
                  <span>Observacoes</span>
                  <p>{selectedLead.notes || "Sem observacoes registradas."}</p>
                </div>

                <div className="playbook">
                  <div className="panel-heading">
                    <span>Checklist comercial</span>
                    <small>{selectedLead.lastUpdate}</small>
                  </div>
                  <label>
                    <input type="checkbox" defaultChecked={selectedLead.contactStatus !== "Aguardando primeiro contato"} />
                    Primeiro contato realizado
                  </label>
                  <label>
                    <input type="checkbox" defaultChecked={["Sim", "Parcial"].includes(selectedLead.qualified)} />
                    Interesse validado
                  </label>
                  <label>
                    <input type="checkbox" defaultChecked={selectedLead.proposalValue > 0} />
                    Orcamento enviado
                  </label>
                </div>
              </>
          </aside>
          ) : null}
            </section>

            <section className="lower-grid">
          <article className="investment-panel">
            <div className="panel-heading">
              <span>Investimento e origem</span>
              <small>{currency.format(investmentTotal)}</small>
            </div>
            <div className="investment-table">
              {investments.slice(-5).map((item) => (
                <div className="investment-row" key={item.id}>
                  <strong>{item.month}</strong>
                  <span>{currency.format(item.meta)}</span>
                  <span>{currency.format(item.google)}</span>
                  <span>{currency.format(investmentLineTotal(item))}</span>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="summary-panel">
            <div className="panel-heading">
              <span>Resumo do funil</span>
              <small>{activeCompanyData.shortName}</small>
            </div>
            <div className="stage-bars">
              {stageTotals.map((stage) => (
                <div className="stage-bar" key={stage.key}>
                  <span>{stage.label}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(8, (stage.count / Math.max(metrics.total, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{stage.count}</strong>
                </div>
              ))}
            </div>
          </article>
            </section>
          </>
        ) : null}

        {activeViewKey === "leads" ? (
          <section className="content-card leads-view" aria-label="Lista de leads">
            <div className="panel-heading">
              <span>Leads cadastrados</span>
              <small>{tableLeads.length} visiveis</small>
            </div>

            <div className="bulk-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={tableLeads.length === 0}
                  onChange={(event) =>
                    toggleVisibleLeadSelection(event.target.checked)
                  }
                />
                Selecionar visiveis
              </label>
              <span>
                {validSelectedLeadIds.length > 0
                  ? `${validSelectedLeadIds.length} selecionado(s)`
                  : "Nenhum selecionado"}
              </span>
              <button
                className="danger-button"
                disabled={validSelectedLeadIds.length === 0}
                type="button"
                onClick={removeSelectedLeads}
              >
                Excluir selecionados
              </button>
            </div>

            <div className="lead-table">
              <div className="lead-table-row lead-table-head">
                <span>Sel.</span>
                <span>Entrada</span>
                <span>Lead</span>
                <span>WhatsApp</span>
                <span>Origem</span>
                <span>Produto</span>
                <span>Etapa</span>
                <span>Proposta</span>
                <span>Acoes</span>
              </div>
              {tableLeads.map((lead) => (
                <div className="lead-table-row" key={lead.id}>
                  <label className="row-check">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => toggleLeadSelection(lead.id)}
                      aria-label={`Selecionar ${lead.name}`}
                    />
                  </label>
                  <time>{formatDate(lead.arrivalDate)}</time>
                  <div className="lead-name-cell">
                    <strong>{lead.name}</strong>
                    <small>{lead.city || "Cidade pendente"}</small>
                  </div>
                  <span>{lead.phone || "Pendente"}</span>
                  <span>{lead.source || "Sem origem"}</span>
                  <span>{lead.service || "Sem produto"}</span>
                  <span className={`status-pill ${lead.stage}`}>
                    {statusFromStage(lead.stage)}
                  </span>
                  <strong>{currency.format(lead.proposalValue)}</strong>
                  <div className="table-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        openEditLead(lead);
                      }}
                    >
                      Editar
                    </button>
                    <a
                      href={`https://wa.me/55${normalizePhone(lead.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              ))}
              {tableLeads.length === 0 ? (
                <div className="empty-table">Nenhum lead encontrado</div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeViewKey === "investimento" ? (
          <section className="investment-view" aria-label="Investimento">
            <div className="investment-kpis">
              <article className="content-card compact-metric">
                <span>Total investido</span>
                <strong>{currency.format(investmentTotal)}</strong>
                <small>{investments.length} lancamentos</small>
              </article>
              <article className="content-card compact-metric">
                <span>Meta Ads</span>
                <strong>{currency.format(investmentMetaTotal)}</strong>
                <small>Campanhas para WhatsApp</small>
              </article>
              <article className="content-card compact-metric">
                <span>Google Ads</span>
                <strong>{currency.format(investmentGoogleTotal)}</strong>
                <small>Cliques e leads de busca</small>
              </article>
              <article className="content-card compact-metric">
                <span>Media mensal</span>
                <strong>{currency.format(investmentAverage)}</strong>
                <small>Calculada pelos meses</small>
              </article>
              <article className="content-card compact-metric">
                <span>Custo por lead</span>
                <strong>{currency.format(leadCost)}</strong>
                <small>{metrics.total} leads no funil atual</small>
              </article>
            </div>

            <form className="content-card investment-form" onSubmit={addInvestment}>
              <label>
                Mes
                <input
                  disabled={!hasAdminAccess}
                  placeholder="agosto 26"
                  value={investmentForm.month}
                  onChange={(event) =>
                    setInvestmentForm({
                      ...investmentForm,
                      month: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Meta Ads
                <input
                  disabled={!hasAdminAccess}
                  min="0"
                  step="0.01"
                  type="number"
                  value={investmentForm.meta}
                  onChange={(event) =>
                    setInvestmentForm({
                      ...investmentForm,
                      meta: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Google Ads
                <input
                  disabled={!hasAdminAccess}
                  min="0"
                  step="0.01"
                  type="number"
                  value={investmentForm.google}
                  onChange={(event) =>
                    setInvestmentForm({
                      ...investmentForm,
                      google: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Observacoes
                <input
                  disabled={!hasAdminAccess}
                  placeholder="Leads, cliques ou observacao do mes"
                  value={investmentForm.note}
                  onChange={(event) =>
                    setInvestmentForm({
                      ...investmentForm,
                      note: event.target.value,
                    })
                  }
                />
              </label>
              <button className="primary-button" disabled={!hasAdminAccess} type="submit">
                Adicionar
              </button>
            </form>

            <article className="investment-panel investment-wide">
              <div className="panel-heading">
                <span>Investimento por mes</span>
                <small>Meta + Google</small>
              </div>
              <div className="investment-table">
                <div className="investment-row investment-head">
                  <strong>Mes</strong>
                  <span>Meta</span>
                  <span>Google</span>
                  <span>Total</span>
                  <small>Observacoes</small>
                  <span>Acoes</span>
                </div>
                {investments.map((item) => (
                  <div className="investment-row editable-investment-row" key={item.id}>
                    <input
                      aria-label={`Mes ${item.month}`}
                      disabled={!hasAdminAccess}
                      value={item.month}
                      onChange={(event) =>
                        updateInvestment(item.id, { month: event.target.value })
                      }
                    />
                    <input
                      aria-label={`Meta Ads ${item.month}`}
                      disabled={!hasAdminAccess}
                      min="0"
                      step="0.01"
                      type="number"
                      value={item.meta}
                      onChange={(event) =>
                        updateInvestment(item.id, {
                          meta: Number(event.target.value),
                        })
                      }
                    />
                    <input
                      aria-label={`Google Ads ${item.month}`}
                      disabled={!hasAdminAccess}
                      min="0"
                      step="0.01"
                      type="number"
                      value={item.google}
                      onChange={(event) =>
                        updateInvestment(item.id, {
                          google: Number(event.target.value),
                        })
                      }
                    />
                    <strong>{currency.format(investmentLineTotal(item))}</strong>
                    <input
                      aria-label={`Observacoes ${item.month}`}
                      disabled={!hasAdminAccess}
                      value={item.note}
                      onChange={(event) =>
                        updateInvestment(item.id, { note: event.target.value })
                      }
                    />
                    <button
                      className="danger-button compact-danger"
                      disabled={!hasAdminAccess}
                      type="button"
                      onClick={() => removeInvestment(item.id)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                {investments.length === 0 ? (
                  <div className="empty-table">Nenhum investimento registrado</div>
                ) : null}
              </div>
            </article>
          </section>
        ) : null}

        {activeViewKey === "relatorios" ? (
          <section className="analytics-dashboard" aria-label="Relatorios">
            <header className="analytics-hero">
              <div>
                <p className="eyebrow">Dashboard comercial</p>
                <h2>{reportScopeLabel} Performance</h2>
                <span>{reportScopeFocus}</span>
              </div>
              <div className="analytics-hero-stats">
                <strong>{currency.format(investmentTotal)}</strong>
                <span>Investimento total</span>
                <small>{currency.format(reportLeadCost)} por lead</small>
              </div>
            </header>

            <div className="analytics-kpi-grid">
              <article className="analytics-kpi">
                <span>Leads no funil</span>
                <strong>{reportMetrics.total}</strong>
                <small>{reportMetrics.pipeline} em andamento</small>
              </article>
              <article className="analytics-kpi">
                <span>Propostas abertas</span>
                <strong>{currency.format(reportMetrics.proposalValue)}</strong>
                <small>{reportMetrics.qualified}% qualificados</small>
              </article>
              <article className="analytics-kpi">
                <span>Vendas fechadas</span>
                <strong>{currency.format(reportMetrics.wonValue)}</strong>
                <small>{reportWonCount} negocios ganhos</small>
              </article>
              <article className="analytics-kpi">
                <span>Conversao</span>
                <strong>{reportMetrics.conversion}%</strong>
                <small>{currency.format(reportAverageTicket)} ticket medio</small>
              </article>
            </div>

            <div className="analytics-main-grid">
              <article className="analytics-card analytics-card-wide">
                <div className="analytics-card-heading">
                  <div>
                    <span>Evolucao de receita</span>
                    <small>Valor em proposta e vendas por mes</small>
                  </div>
                  <strong>{currency.format(reportMetrics.proposalValue + reportMetrics.wonValue)}</strong>
                </div>

                <div className="line-chart-shell">
                  <svg
                    className="line-chart"
                    role="img"
                    aria-label="Grafico de evolucao de receita"
                    viewBox={`0 0 ${reportRevenueChart.width} ${reportRevenueChart.height}`}
                  >
                    <defs>
                      <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f6b21a" stopOpacity="0.38" />
                        <stop offset="100%" stopColor="#f6b21a" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path className="line-chart-area" d={reportRevenueChart.area} />
                    <polyline className="line-chart-line" points={reportRevenueChart.line} />
                    {reportRevenueChart.points.map((point) => (
                      <circle
                        className="line-chart-point"
                        cx={point.x}
                        cy={point.y}
                        key={`${point.key}-${point.label}`}
                        r="5"
                      >
                        <title>
                          {point.label}: {currency.format(point.value)}
                        </title>
                      </circle>
                    ))}
                  </svg>

                  <div className="chart-labels">
                    {reportRevenueChart.points.map((point) => (
                      <span key={point.key}>{point.label}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="analytics-card source-card">
                <div className="analytics-card-heading">
                  <div>
                    <span>Origem dos leads</span>
                    <small>{reportLeads.length} leads rastreados</small>
                  </div>
                </div>

                <div
                  className="donut-chart"
                  style={{ "--donut": reportSourceGradient } as CSSProperties}
                >
                  <div>
                    <strong>{reportSourceSlices[0]?.percent ?? 0}%</strong>
                    <span>{reportSourceSlices[0]?.source ?? "Sem dados"}</span>
                  </div>
                </div>

                <div className="source-legend">
                  {reportSourceSlices.map((item) => (
                    <div className="source-legend-row" key={item.source}>
                      <i style={{ background: item.color }} />
                      <span>{item.source}</span>
                      <strong>{item.percent}%</strong>
                    </div>
                  ))}
                  {reportSourceSlices.length === 0 ? (
                    <div className="empty-dark">Sem origem registrada</div>
                  ) : null}
                </div>
              </article>
            </div>

            <div className="analytics-bottom-grid">
              <article className="analytics-card">
                <div className="analytics-card-heading">
                  <div>
                    <span>Volume mensal</span>
                    <small>Leads recebidos nos ultimos meses</small>
                  </div>
                </div>

                <div className="monthly-bars">
                  {(reportMonthlyReport.length > 0
                    ? reportMonthlyReport
                    : [
                        {
                          key: "sem-data",
                          label: "Sem dados",
                          leads: 0,
                          proposals: 0,
                          won: 0,
                          value: 0,
                        },
                      ]
                  ).map((item) => (
                    <div className="monthly-bar-item" key={item.key}>
                      <div>
                        <i
                          style={{
                            height: `${Math.max(10, (item.leads / reportMonthlyMaxLeads) * 100)}%`,
                          }}
                        />
                      </div>
                      <strong>{item.leads}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-heading">
                  <div>
                    <span>Etapas do funil</span>
                    <small>Distribuicao dos cards atuais</small>
                  </div>
                </div>

                <div className="funnel-bars">
                  {reportStageTotals.map((stage) => (
                    <div className="funnel-bar" data-tone={stage.tone} key={stage.key}>
                      <div>
                        <span>{stage.label}</span>
                        <strong>{stage.count}</strong>
                      </div>
                      <small>
                        <i
                          style={{
                            width: `${Math.max(5, (stage.count / reportStageMaxCount) * 100)}%`,
                          }}
                        />
                      </small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-heading">
                  <div>
                    <span>Motivos de perda</span>
                    <small>{reportMetrics.lost} leads perdidos</small>
                  </div>
                </div>

                <div className="dark-list">
                  {reportLossTotals.slice(0, 5).map((item) => (
                    <div className="dark-list-row" key={item.reason}>
                      <span>{item.reason}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                  {reportLossTotals.length === 0 ? (
                    <div className="empty-dark">Sem perdas registradas</div>
                  ) : null}
                </div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-heading">
                  <div>
                    <span>Visao por empresa</span>
                    <small>{leads.length} leads totais</small>
                  </div>
                </div>

                <div className="company-dashboard-list">
                  {companyTotals.map((company) => {
                    const allowed = companyIsAllowed(permission, company.key);

                    return (
                      <button
                        className={`company-dashboard-row ${
                          reportScope !== "all" && reportScope === company.key ? "selected" : ""
                        } ${allowed ? "" : "locked"}`}
                        disabled={!allowed}
                        key={company.key}
                        onClick={() => setReportScope(company.key)}
                        style={{ "--company-accent": company.accent } as CSSProperties}
                        title={
                          allowed
                            ? company.name
                            : "Relatorio bloqueado para este usuario"
                        }
                        type="button"
                      >
                        <i />
                        <span>{company.shortName}</span>
                        {allowed ? (
                          <>
                            <strong>{company.count}</strong>
                            <small>{company.won} ganhos</small>
                          </>
                        ) : (
                          <small>Bloqueado</small>
                        )}
                      </button>
                    );
                  })}
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="lead-modal" onSubmit={saveLead}>
            <header>
              <div>
                <p className="eyebrow">
                  {editingLead ? "Editar oportunidade" : "Nova oportunidade"}
                </p>
                <h2>{form.name || activeCompanyData.name}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} title="Fechar">
                X
              </button>
            </header>

            <div className="form-grid">
              <label>
                Empresa
                <select
                  value={form.company}
                  disabled={!hasAdminAccess}
                  onChange={(event) =>
                    setForm({ ...form, company: event.target.value as CompanyKey })
                  }
                >
                  {companies
                    .filter((company) => companyIsAllowed(permission, company.key))
                    .map((company) => (
                      <option key={company.key} value={company.key}>
                        {company.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Etapa
                <select
                  value={form.stage}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      stage: event.target.value as StageKey,
                      leadStatus: statusFromStage(event.target.value as StageKey),
                    })
                  }
                >
                  {stages.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data de entrada
                <input
                  type="date"
                  value={form.arrivalDate}
                  onChange={(event) =>
                    setForm({ ...form, arrivalDate: event.target.value })
                  }
                />
              </label>
              <label>
                Nome completo
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                WhatsApp
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label>
                Cidade
                <input
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                />
              </label>
              <label>
                Bairro
                <input
                  value={form.neighborhood}
                  onChange={(event) =>
                    setForm({ ...form, neighborhood: event.target.value })
                  }
                />
              </label>
              <label>
                Origem
                <select
                  value={form.source}
                  onChange={(event) => setForm({ ...form, source: event.target.value })}
                >
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                Campanha
                <input
                  value={form.campaign}
                  onChange={(event) =>
                    setForm({ ...form, campaign: event.target.value })
                  }
                />
              </label>
              <label>
                Produto/interesse
                <select
                  value={form.service}
                  onChange={(event) => setForm({ ...form, service: event.target.value })}
                >
                  {services.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de cliente
                <select
                  value={form.customerType}
                  onChange={(event) =>
                    setForm({ ...form, customerType: event.target.value })
                  }
                >
                  <option>Pessoa Fisica</option>
                  <option>Pessoa Juridica</option>
                </select>
              </label>
              <label>
                Conseguiu contato
                <select
                  value={form.contactStatus}
                  onChange={(event) =>
                    setForm({ ...form, contactStatus: event.target.value })
                  }
                >
                  <option>Aguardando primeiro contato</option>
                  <option>Contato realizado</option>
                  <option>Em conversa</option>
                  <option>Nao respondeu</option>
                  <option>Numero invalido</option>
                </select>
              </label>
              <label>
                Lead qualificado
                <select
                  value={form.qualified}
                  onChange={(event) =>
                    setForm({ ...form, qualified: event.target.value })
                  }
                >
                  <option>Pendente</option>
                  <option>Sim</option>
                  <option>Parcial</option>
                  <option>Nao</option>
                </select>
              </label>
              <label>
                Motivo de perda
                <select
                  value={form.lossReason}
                  onChange={(event) =>
                    setForm({ ...form, lossReason: event.target.value })
                  }
                >
                  {lossReasons.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </select>
              </label>
              <label>
                Valor orcado
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budgetSent}
                  onChange={(event) =>
                    setForm({ ...form, budgetSent: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Valor proposta
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.proposalValue}
                  onChange={(event) =>
                    setForm({ ...form, proposalValue: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Data fechamento
                <input
                  type="date"
                  value={form.closeDate}
                  onChange={(event) =>
                    setForm({ ...form, closeDate: event.target.value })
                  }
                />
              </label>
              <label>
                Urgencia
                <select
                  value={form.urgency}
                  onChange={(event) => setForm({ ...form, urgency: event.target.value })}
                >
                  <option>Imediato</option>
                  <option>Ate 30 dias</option>
                  <option>Ate 3 meses</option>
                  <option>Apenas orcamento</option>
                  <option>Nao informado</option>
                </select>
              </label>
              <label>
                Responsavel
                <input
                  value={form.owner}
                  onChange={(event) => setForm({ ...form, owner: event.target.value })}
                />
              </label>
              <label>
                Proximo follow-up
                <input
                  type="date"
                  value={form.nextFollowUp}
                  onChange={(event) =>
                    setForm({ ...form, nextFollowUp: event.target.value })
                  }
                />
              </label>
              <label className="wide-field">
                Observacoes
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </div>

            <footer>
              {editingLead ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    removeLead(editingLead.id);
                    setModalOpen(false);
                  }}
                >
                  Remover
                </button>
              ) : (
                <span />
              )}
              <div>
                <button type="button" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button className="primary-button" type="submit">
                  Salvar lead
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
