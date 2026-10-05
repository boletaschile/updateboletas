import { createBrowserClient } from '@supabase/ssr';

export const DEFAULT_SUPABASE_URL = 'https://ofnayjxehdavkaanejwk.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbmF5anhlaGRhdmthYW5landrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDUxMDMsImV4cCI6MjEwNDcyMTEwM30.hVdU4hZHVepkxKNnMBO2HTiW_GY8YGMfY9KPU7-9lbQ';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('placeholder-project') &&
    !key.includes('dummy')
  );
}

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    return createClient();
  }
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
