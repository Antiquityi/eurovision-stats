import { describe, expect, it } from 'vitest';
import { validateArtifactText, validateConfig } from '../../scripts/check-pages.mjs';

const jwt = role => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
const config = key => ({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: key });

describe('Pages publication gates', () => {
    it('accepts both supported public key formats', () => {
        expect(() => validateConfig(config('sb_publishable_example'))).not.toThrow();
        expect(() => validateConfig(config(jwt('anon')))).not.toThrow();
    });
    it('blocks absent configuration and privileged keys before building', () => {
        for (const key of ['', 'sb_secret_example', jwt('service_role'), jwt('authenticated')]) {
            expect(() => validateConfig(config(key))).toThrow();
        }
        expect(() => validateConfig({})).toThrow();
        expect(() => validateConfig({ ...config('sb_publishable_example'), VITE_SUPABASE_URL: 'http://example.org' })).toThrow();
    });
    it('blocks privileged tokens and development data in generated assets', () => {
        for (const text of ['sb_secret_example', jwt('service_role'), '-----BEGIN PRIVATE KEY-----', 'fixture-2026']) {
            expect(() => validateArtifactText(text)).toThrow();
        }
        expect(() => validateArtifactText(jwt('anon'))).not.toThrow();
        expect(() => validateArtifactText('public scoreboard sb_publishable_example')).not.toThrow();
    });
});
