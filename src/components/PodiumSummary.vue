<script>
import { podium, podiumTies } from '../domain/ranking.js';
import { formatRating } from '../domain/ratings.js';

export default {
    name: 'PodiumSummary',
    data() {
        return { editing: null, selectedTie: 0, order: [], busy: false, error: '' };
    },
    computed: {
        contest() { return this.$store.state.contests.active; },
        groups() {
            return [{ id: 'total', name: 'Suma' }, ...(this.contest?.voters ?? [])].map(group => ({
                ...group,
                podium: podium(this.entries, group.id, this.contest?.tieBreaks?.[group.id]),
                ties: podiumTies(this.entries, group.id, this.contest?.tieBreaks?.[group.id]),
            }));
        },
        entries() { return this.$store.getters['contests/entries']; },
        editable() { return this.$store.getters.canEdit; },
        canSave() { return this.$store.getters.canCommit; },
        tie() { return this.editing?.ties[this.selectedTie]; },
        changed() {
            if (!this.editing) return false;
            return this.contest?.id !== this.editing.contestId
                || !this.groups.find(group => group.id === this.editing.scope)?.ties.some(tie => tie.key === this.tie?.key);
        },
    },
    watch: {
        'contest.id'() {
            if (this.editing) this.$refs.tieDialog.close();
            this.editing = null;
        },
    },
    methods: {
        formatRating,
        async open(group) {
            this.editing = {
                contestId: this.contest.id, scope: group.id, name: group.name,
                ties: group.ties.map(tie => ({ ...tie, entries: [...tie.entries] })),
            };
            this.selectedTie = 0;
            this.selectTie();
            await this.$nextTick();
            this.$refs.tieDialog.showModal();
        },
        selectTie() {
            this.order = [...this.tie.entries];
            this.error = '';
        },
        move(index, direction) {
            const next = index + direction;
            if (this.busy || next < 0 || next >= this.order.length) return;
            [this.order[index], this.order[next]] = [this.order[next], this.order[index]];
        },
        close() {
            if (this.busy) return;
            this.$refs.tieDialog.close();
            this.editing = null;
        },
        async save(reset = false) {
            if (this.busy || !this.canSave || this.changed || !this.editing) return;
            this.busy = true;
            this.error = '';
            try {
                await this.$store.dispatch('contests/resolveTie', {
                    scope: this.editing.scope, score: this.tie.score,
                    entryIds: this.order.map(entry => entry.id), reset,
                });
                this.busy = false;
                this.close();
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
    },
};
</script>

<template>
    <section class="podiums" aria-label="Podium">
        <div v-for="group in groups" :key="group.id" class="podium-group">
            <div class="podium-heading">
                <h2>{{ group.name }}</h2>
                <button
                    v-if="editable && group.ties.length"
                    class="tie-trigger"
                    :aria-label="'Rozstrzygnij remis: ' + group.name"
                    :disabled="!canSave"
                    @click="open(group)"
                >
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 11V3m-2 2 2-2 2 2m8 0v8m-2-2 2 2 2-2M7 5h2M7 8h2M7 11h2"/></svg>
                    Remis
                </button>
            </div>
            <p v-if="!group.podium.length" class="muted">—</p>
            <ol v-else>
                <li v-for="entry in group.podium" :key="entry.id">
                    <span class="place" :class="'medal-' + entry.rank">{{ entry.rank }}</span>
                    <span>{{ entry.countryName }}</span>
                    <strong>{{ formatRating(entry.score) }}</strong>
                </li>
            </ol>
        </div>
    </section>
    <dialog ref="tieDialog" class="person-dialog tie-dialog" aria-labelledby="tie-title" @cancel.prevent="close">
        <template v-if="editing">
            <div class="person-dialog-body">
                <div class="person-dialog-heading">
                    <h2 id="tie-title">Kolejność podium · {{ editing.name }}</h2>
                    <button class="dialog-close" :disabled="busy" aria-label="Zamknij wybór podium" @click="close">×</button>
                </div>
                <p>Ustaw kolejność krajów z taką samą oceną.</p>
                <label v-if="editing.ties.length > 1" class="tie-select">
                    Remis do rozstrzygnięcia
                    <select v-model="selectedTie" :disabled="busy" @change="selectTie">
                        <option v-for="(option, i) in editing.ties" :key="option.key" :value="i">{{ formatRating(option.score) }} pkt</option>
                    </select>
                </label>
                <div class="tie-score">{{ formatRating(tie.score) }} pkt</div>
                <TransitionGroup name="tie-reorder" tag="ol" class="tie-order">
                    <li v-for="(entry, i) in order" :key="entry.id">
                        <span class="place" :class="'medal-' + (tie.rank + i)">{{ tie.rank + i }}</span>
                        <span class="tie-country">{{ entry.countryName }}</span>
                        <div class="tie-move">
                            <button :disabled="busy || i === 0" :aria-label="'Wyżej: ' + entry.countryName" @click="move(i, -1)">↑</button>
                            <button :disabled="busy || i === order.length - 1" :aria-label="'Niżej: ' + entry.countryName" @click="move(i, 1)">↓</button>
                        </div>
                    </li>
                </TransitionGroup>
                <button class="tie-reset" :disabled="busy || !canSave || changed" @click="save(true)">Przywróć wspólne miejsca</button>
                <p v-if="error" class="cell-error" role="alert">{{ error }}</p>
                <p v-else-if="changed" class="cell-error" role="alert">Wyniki się zmieniły. Otwórz wybór ponownie.</p>
                <p v-else-if="!canSave" class="cell-error" role="status">Brak połączenia lub uprawnień do zapisu.</p>
            </div>
            <div class="dialog-actions">
                <button :disabled="busy" @click="close">Anuluj</button>
                <button type="submit" :disabled="busy || !canSave || changed" @click="save(false)">{{ busy ? 'Zapisywanie…' : 'Zapisz kolejność' }}</button>
            </div>
        </template>
    </dialog>
</template>
