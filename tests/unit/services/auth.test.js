import { describe, expect, it, vi } from 'vitest';
import { createAuthService, authRedirectUrl } from '../../../src/services/auth.js';
import { configureSupabase } from '../../../src/services/supabase.js';

describe('auth SDK boundary', () => {
    it('uses only the same-origin app base and selected year for OAuth', async () => {
        const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
        const service = createAuthService({ auth: { signInWithOAuth } });
        const redirect = authRedirectUrl('https://example.org/eurovision-stats/?year=2024&code=private#access_token=private', '/eurovision-stats/');
        await service.signIn(redirect);
        expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'github', options: { redirectTo: 'https://example.org/eurovision-stats/?year=2024' } });
        expect(authRedirectUrl('http://localhost:5000/?year=2024', '/', 2025)).toBe('http://localhost:5000/?year=2025');
        const id = '00000000-0000-0000-0000-000000000001';
        expect(authRedirectUrl(`http://localhost:5000/?year=2026&contest=${id}&code=secret`, '/'))
            .toBe(`http://localhost:5000/?year=2026&contest=${id}`);
        expect(authRedirectUrl(`http://localhost:5000/?year=2026&contest=${id}`, '/', 2025))
            .toBe('http://localhost:5000/?year=2025');
        expect(() => authRedirectUrl('https://example.org', 'https://other.org/')).toThrow();
    });
    it('reads only own membership and propagates lookup failures', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'own-id' }, error: null });
        const eq = vi.fn(() => ({ maybeSingle }));
        const select = vi.fn(() => ({ eq }));
        const from = vi.fn(() => ({ select }));
        const service = createAuthService({ from });
        expect(await service.isEditor('own-id')).toBe(true);
        expect(from).toHaveBeenCalledWith('approved_editors');
        expect(select).toHaveBeenCalledWith('user_id');
        expect(eq).toHaveBeenCalledWith('user_id', 'own-id');
        maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        expect(await service.isEditor('own-id')).toBe(false);
        maybeSingle.mockResolvedValueOnce({ error: new Error('network') });
        await expect(service.isEditor('own-id')).rejects.toThrow('network');
    });
    it('returns sessions, forwards events synchronously and unsubscribes', async () => {
        const unsubscribe = vi.fn();
        let callback;
        const auth = {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'id' } } }, error: null }),
            onAuthStateChange: vi.fn(fn => { callback = fn; return { data: { subscription: { unsubscribe } } }; }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
        };
        const service = createAuthService({ auth });
        const listener = vi.fn();
        const stop = service.subscribe(listener);
        expect(callback('SIGNED_OUT', null)).toBeUndefined();
        expect(listener).toHaveBeenCalledWith(null);
        expect((await service.getSession()).user.id).toBe('id');
        await service.signOut();
        expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
        stop();
        expect(unsubscribe).toHaveBeenCalledOnce();
        auth.getSession.mockResolvedValueOnce({ error: new Error('expired') });
        await expect(service.getSession()).rejects.toThrow('expired');
    });
    it('creates no SDK client for absent/partial config or privileged keys', () => {
        const factory = vi.fn(() => ({}));
        expect(configureSupabase({}, factory).configured).toBe(false);
        for (const key of ['', 'sb_secret_private', `a.${btoa(JSON.stringify({ role: 'service_role' }))}.b`]) {
            const config = configureSupabase({ VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: key }, factory);
            expect(config.client).toBeNull();
            expect(config.error).toBeTruthy();
        }
        expect(factory).not.toHaveBeenCalled();
        const config = configureSupabase({ VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }, factory);
        expect(config.client).not.toBeNull();
        expect(factory).toHaveBeenCalledOnce();
        expect(factory.mock.calls[0][2].auth).toMatchObject({ flowType: 'pkce', detectSessionInUrl: true });
    });
});
