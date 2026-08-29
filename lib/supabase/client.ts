import { createClient as _createClient } from '@supabase/supabase-js';

let _instance: ReturnType<typeof _createClient> | null = null;

export function createClient() {
  if (!_instance) {
    _instance = _createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'fitnessandi-auth',
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      }
    );
  }
  return _instance;
}
