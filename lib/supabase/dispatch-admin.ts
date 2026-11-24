import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Internal-only dispatch client for querying eligible towing-provider
 * notification email addresses. Never import in client components.
 * The service role key must not use a NEXT_PUBLIC_ environment variable.
 */
export function createDispatchAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
