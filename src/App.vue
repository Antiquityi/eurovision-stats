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
        editable() { return this.$store.getters.canEdit; },
        canManage() { return this.$store.getters.canCommit && !this.live.voterBusy; },
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
            <div class="workspace-actions">
                <span v-if="preview" class="preview-label" title="Przykładowe oceny i kolejność. Zmiany tylko w pamięci przeglądarki.">Dane testowe</span>
                <button v-if="active && editable" class="add-person" :disabled="!canManage" @click="$refs.scoreboard.openPerson('add')">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>Dodaj osobę
                </button>
                <AuthControls />
            </div>
        </header>
        <p v-if="configured && live.error" class="connection-state" role="alert">{{ live.error }} <button @click="$store.dispatch('contests/return')">Ponów</button></p>
        <p v-else-if="configured && !live.connected && !live.loading" class="connection-state" role="status">Brak połączenia. Wyniki mogą być nieaktualne. <button @click="$store.dispatch('contests/return')">Połącz ponownie</button></p>
        <template v-if="active">
            <ScoreboardTable ref="scoreboard" :key="active.id" />
            <PodiumSummary />
        </template>
        <p v-else-if="!live.loading && !live.error && (!configured || live.connected)" class="empty-state">Brak Eurowizji.</p>
    </main>
</template>
