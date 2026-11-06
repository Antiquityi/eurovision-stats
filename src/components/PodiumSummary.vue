<script>
import { podium } from '../domain/ranking.js';
import { formatRating } from '../domain/ratings.js';

export default {
    name: 'PodiumSummary',
    computed: {
        groups() { return [{ id: 'total', name: 'Suma' }, ...this.$store.state.contests.active.voters]; },
        entries() { return this.$store.getters['contests/entries']; },
    },
    methods: { podium, formatRating },
};
</script>

<template>
    <section class="podiums" aria-label="Podium">
        <div v-for="group in groups" :key="group.id" class="podium-group">
            <h2>{{ group.name }}</h2>
            <p v-if="!podium(entries, group.id).length" class="muted">—</p>
            <ol v-else><li v-for="entry in podium(entries, group.id)" :key="entry.id"><span class="place" :class="'medal-' + entry.rank">{{ entry.rank }}</span><span>{{ entry.countryName }}</span><strong>{{ formatRating(entry.score) }}</strong></li></ol>
        </div>
    </section>
</template>
