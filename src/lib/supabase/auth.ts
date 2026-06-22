export const ADMIN_ACCESS_COOKIE = "dc_admin_access_token";
export const ADMIN_REFRESH_COOKIE = "dc_admin_refresh_token";

export type SupabasePasswordAuthResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  user?: {
    email?: string;
    id: string;
  };
};

export function getSupabaseAuthConfigError() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return "NEXT_PUBLIC_SUPABASE_URL is not configured";
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured";
  }

  return null;
}

export function getSupabaseAuthUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/${path.replace(/^\//, "")}`;
}
