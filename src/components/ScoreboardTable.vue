<script>
import RatingCell from './RatingCell.vue';
import { summarize, sortedEntries, podium } from '../domain/ranking.js';
import { formatRating } from '../domain/ratings.js';

const flags = import.meta.glob('../../node_modules/flag-icons/flags/4x3/*.svg', { eager: true, query: '?url', import: 'default' });

export default {
    name: 'ScoreboardTable',
    components: { RatingCell },
    data() { return { sortKey: 'order', direction: 'desc' }; },
    computed: {
        contest() { return this.$store.state.contests.active; },
        entries() { return this.$store.getters['contests/entries']; },
        rows() { return sortedEntries(this.entries, this.sortKey, this.direction); },
        medals() {
            return Object.fromEntries(['total', ...this.contest.voters.map(v => v.id)].map(key => [key,
                Object.fromEntries(podium(this.entries, key).map(e => [e.id, e.rank]))]));
        },
    },
    methods: {
        summarize, formatRating,
        flag(code) { return flags[`../../node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]; },
        sort(key) { this.direction = key === this.sortKey && this.direction === 'desc' ? 'asc' : 'desc'; this.sortKey = key; },
        ariaSort(key) { return this.sortKey !== key ? 'none' : key === 'order' || this.direction === 'asc' ? 'ascending' : 'descending'; },
    },
};
</script>

<template>
    <section class="scoreboard" aria-label="Tabela ocen">
        <div class="table-scroll" tabindex="0" aria-label="Przewijana tabela wyników">
            <table>
                <caption class="sr-only">{{ contest.title }}. Puste oceny nie wliczają się do sumy.</caption>
                <thead><tr>
                    <th scope="col" class="order" :aria-sort="ariaSort('order')"><button data-sort="order" @click="sort('order')" aria-label="Przywróć kolejność występów">Nr <span class="sort-indicator" aria-hidden="true">{{ sortKey === 'order' ? '↑' : '↕' }}</span></button></th>
                    <th scope="col" class="country">Kraj</th>
                    <th v-for="voter in contest.voters" :key="voter.id" scope="col" :aria-sort="ariaSort(voter.id)"><button :data-sort="voter.id" @click="sort(voter.id)">{{ voter.name }} <span class="sort-indicator" aria-hidden="true">{{ sortKey === voter.id ? direction === 'desc' ? '↓' : '↑' : '↕' }}</span></button></th>
                    <th scope="col" class="total" :aria-sort="ariaSort('total')"><button data-sort="total" @click="sort('total')">Suma <span class="sort-indicator" aria-hidden="true">{{ sortKey === 'total' ? direction === 'desc' ? '↓' : '↑' : '↕' }}</span></button></th>
                </tr></thead>
                <tbody><tr v-for="entry in rows" :key="entry.id">
                    <td class="order">{{ String(entry.order).padStart(2, '0') }}</td>
                    <th scope="row" class="country"><div class="country-line"><img :src="flag(entry.countryCode)" alt="" width="28" height="21" /><div>{{ entry.countryName }}<small v-if="entry.artist || entry.song">{{ [entry.artist, entry.song].filter(Boolean).join(' · ') }}</small></div></div></th>
                    <RatingCell v-for="voter in contest.voters" :key="voter.id" :entry="entry" :voter="voter" :value="entry.ratings[voter.id]" :medal="medals[voter.id][entry.id] || 0" />
                    <td class="total" :title="summarize(entry).count > 0 && summarize(entry).count < summarize(entry).possible ? 'Suma niepełna' : undefined"><strong>{{ formatRating(summarize(entry).total) }}</strong><span v-if="medals.total[entry.id]" class="medal-marker" :class="'medal-' + medals.total[entry.id]" :title="'Miejsce ' + medals.total[entry.id]"><span class="sr-only">Miejsce </span>{{ medals.total[entry.id] }}</span></td>
                </tr></tbody>
            </table>
        </div>
    </section>
</template>
