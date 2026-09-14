import { createClient } from "@supabase/supabase-js";

export type CrmSnapshot = {
  leads: unknown[];
  investments: unknown[];
  permission: CrmUserPermission;
};

export type CrmUserPermission = {
  role: "admin" | "empresa";
  companyKey: string | null;
  allowedCompanies: string[];
  email: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseLoginEmail =
  import.meta.env.VITE_SUPABASE_LOGIN_EMAIL?.trim() || "baltt@baltt.com.br";

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;

const adminPermission: CrmUserPermission = {
  role: "admin",
  companyKey: null,
  allowedCompanies: ["baltt", "vale", "baltec"],
  email: null,
};

function loginToEmail(login: string) {
  const normalizedLogin = login.trim();

  if (normalizedLogin.toLowerCase() === "baltt@") {
    return supabaseLoginEmail;
  }

  return normalizedLogin;
}

export async function signInCrm(login: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login),
    password,
  });

  if (error) throw error;

  return data.session;
}

export async function signOutCrm() {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function normalizePermission(raw: unknown): CrmUserPermission {
  if (!raw || typeof raw !== "object") return adminPermission;

  const value = raw as Record<string, unknown>;
  const role = value.role === "empresa" ? "empresa" : "admin";
  const companyKey =
    typeof value.companyKey === "string"
      ? value.companyKey
      : typeof value.company_key === "string"
        ? value.company_key
        : null;
  const allowedCompanies = Array.isArray(value.allowedCompanies)
    ? value.allowedCompanies.filter((item): item is string => typeof item === "string")
    : Array.isArray(value.allowed_companies)
      ? value.allowed_companies.filter((item): item is string => typeof item === "string")
      : role === "admin"
        ? adminPermission.allowedCompanies
        : companyKey
          ? [companyKey]
          : [];

  return {
    role,
    companyKey,
    allowedCompanies,
    email: typeof value.email === "string" ? value.email : null,
  };
}

function normalizeSnapshotPayload(raw: unknown): CrmSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      "A Supabase respondeu sem a base do CRM. Rode o SQL de supabase/schema.sql no SQL Editor.",
    );
  }

  const value = raw as Record<string, unknown>;

  if (value.permission === undefined && value.leads === undefined) {
    throw new Error(
      "Resposta inesperada da Supabase ao carregar a base. Rode o SQL de supabase/schema.sql.",
    );
  }

  return {
    leads: Array.isArray(value.leads) ? value.leads : [],
    investments: Array.isArray(value.investments) ? value.investments : [],
    permission: normalizePermission(value.permission),
  };
}

function describeRpcError(error: { code?: string; message?: string; details?: string }) {
  if (error.code === "PGRST202") {
    return new Error(
      "Funcao do CRM nao encontrada na Supabase. Rode o SQL atualizado de supabase/schema.sql no SQL Editor.",
    );
  }

  if (error.code === "42501" || /permission denied/i.test(error.message ?? "")) {
    return new Error(
      "Usuario sem permissao para gravar na base. Confira a tabela crm_user_permissions.",
    );
  }

  return new Error(error.message || "Falha desconhecida na Supabase.");
}

/**
 * Carrega a base compartilhada. Nunca cai em leitura direta da tabela: se a
 * funcao nao existir ou o usuario nao tiver permissao, o erro sobe para a UI,
 * em vez de fingir que a base local e a base remota.
 */
export async function loadCrmSnapshot(): Promise<CrmSnapshot> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("load_crm_snapshot_for_user");

  if (error) throw describeRpcError(error);

  return normalizeSnapshotPayload(data);
}

export type SaveCrmSnapshotInput = {
  leads: unknown[];
  investments: unknown[];
  /** Ids que o usuario apagou desde o ultimo carregamento/salvamento. */
  deletedLeadIds?: string[];
};

/**
 * Salva a base. A funcao no banco faz o merge por id: leads que chegaram por
 * webhook (Meta/site) enquanto o CRM estava aberto sao preservados, e apenas os
 * ids listados em deletedLeadIds sao removidos. Retorna a base ja mesclada.
 */
export async function saveCrmSnapshot(input: SaveCrmSnapshotInput): Promise<CrmSnapshot> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("save_crm_snapshot_for_user", {
    p_leads: input.leads,
    p_investments: input.investments,
    p_deleted_ids: input.deletedLeadIds ?? [],
  });

  if (error) throw describeRpcError(error);

  return normalizeSnapshotPayload(data);
}
