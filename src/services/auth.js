export function authRedirectUrl(href, basePath, year) {
    const current = new URL(href);
    const target = new URL(basePath, current.origin);
    if (target.origin !== current.origin) throw new Error('Invalid app base');
    const selected = year ?? current.searchParams.get('year');
    if (/^\d{4}$/.test(String(selected))) target.searchParams.set('year', selected);
    return target.href;
}

export function createAuthService(client) {
    return {
        async getSession() {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            return data.session;
        },
        subscribe(callback) {
            const { data } = client.auth.onAuthStateChange((_event, session) => { callback(session); });
            return () => data.subscription.unsubscribe();
        },
        async isEditor(userId) {
            const { data, error } = await client.from('approved_editors').select('user_id').eq('user_id', userId).maybeSingle();
            if (error) throw error;
            return data?.user_id === userId;
        },
        async signIn(redirectTo) {
            const { error } = await client.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } });
            if (error) throw error;
        },
        async signOut() {
            const { error } = await client.auth.signOut({ scope: 'local' });
            if (error) throw error;
        },
    };
}
