import { createBrowserClient } from '@supabase/ssr';

/**
 * Anon-key client for use in the browser. Only needed for the admin login
 * page's signInWithPassword call — the public booking flow talks to our own
 * Route Handlers, never directly to Supabase.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anonKey);
}
