<script>
import ContestTabs from './components/ContestTabs.vue';
import ScoreboardTable from './components/ScoreboardTable.vue';
import PodiumSummary from './components/PodiumSummary.vue';
import AuthControls from './components/AuthControls.vue';

export default {
    name: 'App',
    components: { ContestTabs, ScoreboardTable, PodiumSummary, AuthControls },
    mounted() {
        this.$store.dispatch('auth/start');
        this.$store.dispatch('contests/start');
    },
    computed: {
        active() { return this.$store.state.contests.active; },
        preview() { return this.$store.state.preview; },
        live() { return this.$store.state.contests; },
        configured() { return this.$store.state.auth.available; },
    },
    beforeUnmount() {
        this.$store.dispatch('contests/stop');
        this.$store.dispatch('auth/stop');
    },
};
</script>

<template>
    <main class="app-shell">
        <header class="workspace-bar">
            <h1>Eurowizja</h1>
            <ContestTabs />
            <span v-if="preview" class="preview-label" title="Przykładowe oceny i kolejność. Zmiany tylko w pamięci przeglądarki.">Dane testowe</span>
            <AuthControls />
        </header>
        <p v-if="configured && live.error" class="connection-state" role="alert">{{ live.error }} <button @click="$store.dispatch('contests/return')">Ponów</button></p>
        <p v-else-if="configured && !live.connected && !live.loading" class="connection-state" role="status">Brak połączenia. Wyniki mogą być nieaktualne. <button @click="$store.dispatch('contests/return')">Połącz ponownie</button></p>
        <p v-else-if="configured && (live.loading || live.stale)" class="connection-state" role="status">Odświeżanie wyników…</p>
        <template v-if="active">
            <ScoreboardTable :key="active.id" />
            <PodiumSummary />
        </template>
        <p v-else-if="!live.loading && !live.error && (!configured || live.connected)" class="empty-state">Brak konkursów.</p>
    </main>
</template>
