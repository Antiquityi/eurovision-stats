<script>
import RatingCell from './RatingCell.vue';
import VoterHeader from './VoterHeader.vue';
import { summarize, sortedEntries, podium } from '../domain/ranking.js';
import { formatRating } from '../domain/ratings.js';

const flags = import.meta.glob('../../node_modules/flag-icons/flags/4x3/*.svg', { eager: true, query: '?url', import: 'default' });

export default {
    name: 'ScoreboardTable',
    components: { RatingCell, VoterHeader },
    data() { return { sortKey: 'order', direction: 'desc', personDialog: null, personName: '', personBusy: false, personError: '' }; },
    computed: {
        contest() { return this.$store.state.contests.active; },
        entries() { return this.$store.getters['contests/entries']; },
        rows() { return sortedEntries(this.entries, this.sortKey, this.direction, this.contest.tieBreaks?.[this.sortKey]); },
        editable() { return this.$store.getters.canEdit; },
        canManage() { return this.$store.getters.canCommit && !this.$store.state.contests.voterBusy; },
        medals() {
            return Object.fromEntries(['total', ...this.contest.voters.map(v => v.id)].map(key => [key,
                Object.fromEntries(podium(this.entries, key, this.contest.tieBreaks?.[key]).map(e => [e.id, e.rank]))]));
        },
    },
    watch: {
        'contest.voters': {
            deep: true,
            handler(voters) {
                if (!['order', 'total'].includes(this.sortKey) && !voters.some(voter => voter.id === this.sortKey)) this.sortKey = 'order';
            },
        },
    },
    methods: {
        summarize, formatRating,
        flag(code) { return flags[`../../node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]; },
        sort(key) { this.direction = key === this.sortKey && this.direction === 'desc' ? 'asc' : 'desc'; this.sortKey = key; },
        ariaSort(key) { return this.sortKey !== key ? 'none' : key === 'order' || this.direction === 'asc' ? 'ascending' : 'descending'; },
        async openPerson(action, voter = null) {
            this.personDialog = { action, voter, contestId: this.contest.id, voterId: voter?.id ?? crypto.randomUUID() };
            this.personName = '';
            this.personError = '';
            await this.$nextTick();
            this.$refs.personDialog.showModal();
        },
        closePerson() {
            if (this.personBusy) return;
            this.$refs.personDialog.close();
            this.personDialog = null;
        },
        async confirmPerson() {
            if (this.personBusy || !this.personDialog) return;
            if (!this.canManage || this.personDialog.contestId !== this.contest.id) { this.personError = 'Zmiana jest teraz niedostępna.'; return; }
            this.personBusy = true;
            this.personError = '';
            try {
                const saved = await this.$store.dispatch('contests/manageVoter', {
                    action: this.personDialog.action, voterId: this.personDialog.voterId, name: this.personName,
                });
                if (saved) { this.$refs.personDialog.close(); this.personDialog = null; }
                else this.personError = 'Zmiana jest teraz niedostępna.';
            } catch (error) { this.personError = error.message; }
            finally { this.personBusy = false; }
        },
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
                    <th v-for="voter in contest.voters" :key="voter.id" scope="col" :aria-sort="ariaSort(voter.id)"><VoterHeader :voter="voter" :indicator="sortKey === voter.id ? direction === 'desc' ? '↓' : '↑' : '↕'" @sort="sort(voter.id)" @delete="openPerson('delete', $event)" /></th>
                    <th scope="col" class="total" :aria-sort="ariaSort('total')"><button data-sort="total" @click="sort('total')">Suma <span class="sort-indicator" aria-hidden="true">{{ sortKey === 'total' ? direction === 'desc' ? '↓' : '↑' : '↕' }}</span></button></th>
                </tr></thead>
                <tbody><tr v-for="entry in rows" :key="entry.id">
                    <td class="order">{{ String(entry.order).padStart(2, '0') }}</td>
                    <th scope="row" class="country"><div class="country-line"><img :src="flag(entry.countryCode)" alt="" width="28" height="21" /><div>{{ entry.countryName }}</div></div></th>
                    <RatingCell v-for="voter in contest.voters" :key="voter.id" :entry="entry" :voter="voter" :value="entry.ratings[voter.id]" :medal="medals[voter.id][entry.id] || 0" />
                    <td class="total" :title="summarize(entry).count > 0 && summarize(entry).count < summarize(entry).possible ? 'Suma niepełna' : undefined"><strong>{{ formatRating(summarize(entry).total) }}</strong><span v-if="medals.total[entry.id]" class="medal-marker" :class="'medal-' + medals.total[entry.id]" :title="'Miejsce ' + medals.total[entry.id]"><span class="sr-only">Miejsce </span>{{ medals.total[entry.id] }}</span></td>
                </tr></tbody>
            </table>
        </div>
        <dialog ref="personDialog" class="person-dialog" aria-labelledby="person-dialog-title" aria-describedby="person-dialog-description" @cancel.prevent="closePerson">
            <form v-if="personDialog" @submit.prevent="confirmPerson">
                <div class="person-dialog-body">
                    <div class="person-dialog-heading">
                        <h2 id="person-dialog-title">{{ personDialog.action === 'add' ? 'Dodaj osobę' : 'Usunąć ' + personDialog.voter.name + '?' }}</h2>
                        <button type="button" class="dialog-close" :disabled="personBusy" @click="closePerson" aria-label="Zamknij">
                            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>
                        </button>
                    </div>
                    <template v-if="personDialog.action === 'add'">
                        <p id="person-dialog-description">Dodać nową osobę do tabeli {{ contest.year }}?</p>
                        <label for="new-person-name">Imię</label>
                        <input id="new-person-name" v-model="personName" placeholder="np. Anna" required maxlength="80" autocomplete="off" :disabled="personBusy" autofocus />
                        <span class="dialog-field-hint">Oceny nowej osoby będą puste.</span>
                    </template>
                    <template v-else>
                        <p id="person-dialog-description">Kolumna i wszystkie oceny tej osoby z roku {{ contest.year }} zostaną usunięte.</p>
                        <span class="dialog-delete-note">Tej operacji nie można cofnąć.</span>
                    </template>
                    <p v-if="personError" class="cell-error" role="alert">{{ personError }}</p>
                </div>
                <div class="dialog-actions">
                    <button type="button" :disabled="personBusy" @click="closePerson">Anuluj</button>
                    <button type="submit" :disabled="personBusy || !canManage" :class="{ 'delete-person': personDialog.action === 'delete' }">{{ personBusy ? 'Zapisywanie…' : personDialog.action === 'add' ? 'Dodaj osobę' : 'Usuń osobę' }}</button>
                </div>
            </form>
        </dialog>
    </section>
</template>
