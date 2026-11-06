<script>
import ContestTabs from './components/ContestTabs.vue';
import ScoreboardTable from './components/ScoreboardTable.vue';
import PodiumSummary from './components/PodiumSummary.vue';
import AuthControls from './components/AuthControls.vue';

export default {
    name: 'App',
    components: { ContestTabs, ScoreboardTable, PodiumSummary, AuthControls },
    mounted() { this.$store.dispatch('auth/start'); },
    computed: {
        active() { return this.$store.state.contests.active; },
        preview() { return this.$store.state.preview; },
    },
    beforeUnmount() { this.$store.dispatch('auth/stop'); },
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
        <template v-if="active">
            <ScoreboardTable :key="active.id" />
            <PodiumSummary />
        </template>
        <p v-else class="empty-state">Brak konkursów.</p>
    </main>
</template>
