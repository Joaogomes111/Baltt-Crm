import { createClient } from "@supabase/supabase-js";

export type CrmSnapshot = {
  leads: unknown[];
  investments: unknown[];
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

export async function loadCrmSnapshot(): Promise<CrmSnapshot | null> {
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
  };
}

export async function saveCrmSnapshot(snapshot: CrmSnapshot) {
  if (!supabase) return;

  const { error } = await supabase.from("crm_snapshots").upsert({
    id: "main",
    leads: snapshot.leads,
    investments: snapshot.investments,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
