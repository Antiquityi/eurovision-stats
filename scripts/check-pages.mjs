import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function jwtRole(token) {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role;
    } catch {
        return null;
    }
}

export function validateConfig(env) {
    const url = new URL(env.VITE_SUPABASE_URL || 'invalid');
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use the public HTTPS Supabase project URL.');
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && jwtRole(key) !== 'anon') {
        throw new Error('Set a public Supabase publishable key or legacy anon JWT; privileged keys are forbidden.');
    }
}

export function validateArtifactText(text) {
    if (/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
        throw new Error('Privileged credential detected in the Pages artifact.');
    }
    for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
        if (jwtRole(match[0]) === 'service_role') throw new Error('Service-role JWT detected in the Pages artifact.');
    }
    if (text.includes('fixture-')) throw new Error('Development fixtures detected in the Pages artifact.');
}

function checkArtifact(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, item.name);
        if (item.isSymbolicLink()) throw new Error('Symlinks are forbidden in the Pages artifact.');
        if (item.name.startsWith('.env')) throw new Error('Environment file detected in the Pages artifact.');
        if (item.isDirectory()) checkArtifact(path);
        else validateArtifactText(readFileSync(path, 'utf8'));
    }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    try {
        if (process.argv[2] === 'config') validateConfig(process.env);
        else if (process.argv[2] === 'artifact') {
            readFileSync('dist/index.html');
            checkArtifact(resolve('dist'));
        } else throw new Error('Usage: node scripts/check-pages.mjs config|artifact');
        console.log('Pages check passed.');
    } catch {
        // Never echo config values, tokens, or artifact contents into CI logs.
        console.error('Pages check failed. Check public configuration or scan dist for privileged credentials/development fixtures.');
        process.exitCode = 1;
    }
}
