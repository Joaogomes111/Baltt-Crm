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
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    leads: Array.isArray(value.leads) ? value.leads : [],
    investments: Array.isArray(value.investments) ? value.investments : [],
    permission: normalizePermission(value.permission),
  };
}

function isMissingRpc(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.message?.includes("load_crm_snapshot_for_user") ||
    error.message?.includes("save_crm_snapshot_for_user")
  );
}

async function loadCrmSnapshotFromTable(): Promise<CrmSnapshot | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("crm_snapshots")
    .select("leads, investments")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    leads: Array.isArray(data.leads) ? data.leads : [],
    investments: Array.isArray(data.investments) ? data.investments : [],
    permission: adminPermission,
  };
}

export async function loadCrmSnapshot(): Promise<CrmSnapshot | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("load_crm_snapshot_for_user");

  if (!error) return normalizeSnapshotPayload(data);
  if (isMissingRpc(error)) return loadCrmSnapshotFromTable();

  throw error;
}

async function saveCrmSnapshotToTable(snapshot: Pick<CrmSnapshot, "leads" | "investments">) {
  if (!supabase) return;

  const { error } = await supabase.from("crm_snapshots").upsert({
    id: "main",
    leads: snapshot.leads,
    investments: snapshot.investments,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function saveCrmSnapshot(snapshot: Pick<CrmSnapshot, "leads" | "investments">) {
  if (!supabase) return;

  const { error } = await supabase.rpc("save_crm_snapshot_for_user", {
    p_leads: snapshot.leads,
    p_investments: snapshot.investments,
  });

  if (!error) return;
  if (isMissingRpc(error)) {
    await saveCrmSnapshotToTable(snapshot);
    return;
  }

  throw error;
}
