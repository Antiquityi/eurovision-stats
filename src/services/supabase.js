import { createClient } from '@supabase/supabase-js';

export function configureSupabase(env, factory = createClient) {
    const url = env.VITE_SUPABASE_URL?.trim();
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url && !key) return { client: null, configured: false, error: '' };
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        let publicKey = key?.startsWith('sb_publishable_');
        if (key?.split('.').length === 3) {
            const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            publicKey = JSON.parse(atob(payload)).role === 'anon';
        }
        if (!publicKey) throw new Error();
        return {
            client: factory(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }),
            configured: true,
            error: '',
        };
    } catch {
        return { client: null, configured: true, error: 'Nieprawidłowa konfiguracja połączenia.' };
    }
}

// One SDK instance, shared by auth and future scoreboard services.
export const backend = configureSupabase(import.meta.env);
