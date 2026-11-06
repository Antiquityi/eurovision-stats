<script>
export default {
    name: 'AuthControls',
    computed: {
        auth() { return this.$store.state.auth; },
    },
    methods: {
        signIn() { this.$store.dispatch('auth/signIn'); },
        signOut() { this.$store.dispatch('auth/signOut'); },
        refresh() { this.$store.dispatch('auth/refresh'); },
    },
};
</script>

<template>
    <div v-if="auth.configured" class="auth-controls" aria-label="Konto GitHub">
        <span role="status">{{ auth.busy ? 'Sprawdzanie…' : auth.isEditor ? 'Edytor' : 'Podgląd' }}<template v-if="auth.user"> · {{ auth.user.name }}</template></span>
        <button v-if="auth.user" :disabled="auth.busy" @click="signOut">Wyloguj</button>
        <button v-else :disabled="auth.busy || !auth.available" @click="signIn">Zaloguj przez GitHub</button>
        <button v-if="auth.user && !auth.busy" @click="refresh" aria-label="Odśwież uprawnienia">↻</button>
        <span v-if="auth.error" role="alert" class="auth-error">{{ auth.error }}</span>
    </div>
</template>
