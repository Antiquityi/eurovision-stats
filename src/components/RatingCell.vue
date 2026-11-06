<script>
import { formatRating, parseRating, ratingTone } from '../domain/ratings.js';
import { cellKey } from '../store/index.js';

export default {
    name: 'RatingCell',
    props: {
        entry: { type: Object, required: true },
        voter: { type: Object, required: true },
        value: { type: Number, default: null },
        medal: { type: Number, default: 0 },
    },
    data() { return { error: '' }; },
    computed: {
        key() { return cellKey(this.entry.id, this.voter.id); },
        draft() { return this.$store.state.contests.drafts[this.key]; },
        editable() { return this.$store.state.editable; },
        text() { return this.draft ?? (this.value === null ? '' : formatRating(this.value)); },
    },
    methods: {
        formatRating, ratingTone,
        input(event) {
            this.error = '';
            this.$store.dispatch('contests/draft', { entryId: this.entry.id, voterId: this.voter.id, text: event.target.value });
        },
        async commit() {
            if (this.draft === undefined) return true;
            try {
                parseRating(this.draft);
                await this.$store.dispatch('contests/save', { entryId: this.entry.id, voterId: this.voter.id });
                this.error = ''; return true;
            } catch (error) { this.error = error.message; return false; }
        },
        cancel(event) {
            this.error = '';
            this.$store.dispatch('contests/cancel', this.key);
            event.target.value = this.value === null ? '' : formatRating(this.value);
            // Keep focus in the sheet; do not generate a blur commit after cancel.
        },
        async navigate(event) {
            const input = event.target;
            const table = input.closest('table');
            const column = input.closest('td').cellIndex;
            const row = input.closest('tr');
            const next = event.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling;
            event.preventDefault();
            if (!(await this.commit())) return;
            next?.cells[column]?.querySelector('input')?.focus();
            if (!table.contains(document.activeElement)) input.focus();
        },
    },
};
</script>

<template>
    <td class="rating-cell" :class="[{ 'has-error': error, 'has-draft': draft !== undefined }, ratingTone(value)]">
        <input v-if="editable" :value="text" type="text" inputmode="decimal" autocomplete="off" maxlength="8"
            :aria-label="`${entry.countryName}, ${voter.name}`" :aria-invalid="Boolean(error)"
            :aria-describedby="[error ? 'error-' + key : null, medal ? 'rank-' + key : null].filter(Boolean).join(' ') || undefined" placeholder="—"
            @input="input" @blur="commit" @keydown.enter.prevent="commit" @keydown.esc.prevent="cancel"
            @keydown.up="navigate" @keydown.down="navigate" />
        <span v-else>{{ formatRating(value) }}</span>
        <span v-if="medal" :id="'rank-' + key" class="medal-marker" :class="'medal-' + medal" :title="'Miejsce ' + medal"><span class="sr-only">Miejsce </span>{{ medal }}</span>
        <span v-if="error" :id="'error-' + key" class="cell-error" role="alert">{{ error }}</span>
    </td>
</template>
