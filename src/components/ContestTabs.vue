<script>
export default {
    name: 'ContestTabs',
    computed: {
        contests() { return this.$store.state.contests.list; },
        active() { return this.$store.state.contests.active?.id; },
    },
    methods: { select(id) { this.$store.dispatch('contests/select', id); } },
};
</script>

<template>
    <nav v-if="contests.length" class="year-tabs" aria-label="Wybierz rok"><button v-for="contest in contests" :key="contest.id" :class="contest.id === active ? 'chip-selected' : 'chip-unselected'" :aria-current="contest.id === active ? 'page' : undefined" @click="select(contest.id)">{{ contest.year }}</button></nav>
</template>
