<script>
export default {
    name: 'EntryDetailsCell',
    props: {
        entry: { type: Object, required: true },
        contestId: { type: String, required: true },
    },
    data() { return { draft: null, saving: false, error: '' }; },
    computed: {
        editable() { return this.$store.getters.canEdit; },
        available() { return this.$store.getters.canCommit; },
        text() { return this.draft ?? this.entry.artistSong ?? ''; },
    },
    methods: {
        cancel() { if (!this.saving) { this.draft = null; this.error = ''; } },
        async save() {
            if (this.draft === null || this.saving) return;
            const text = this.draft.trim();
            if (text === (this.entry.artistSong ?? '')) { this.cancel(); return; }
            if (!this.available) { this.error = 'Zmiana jest teraz niedostępna.'; return; }
            this.saving = true;
            this.error = '';
            try {
                await this.$store.dispatch('contests/saveEntryDetails', {
                    contestId: this.contestId, entryId: this.entry.id, text,
                });
                this.draft = null;
            } catch (error) { this.error = error.message; }
            finally { this.saving = false; }
        },
    },
};
</script>

<template>
    <td class="entry-details">
        <input v-if="editable" :value="text" :disabled="saving" maxlength="200" type="text" autocomplete="off"
            :aria-label="`Wykonawca i utwór: ${entry.countryName}`" :aria-invalid="Boolean(error)"
            :title="text || undefined" placeholder="Wykonawca - tytuł utworu"
            @input="draft = $event.target.value" @blur="save" @keydown.enter.prevent="save" @keydown.esc.prevent.stop="cancel" />
        <span v-else class="entry-details-text" :title="entry.artistSong || undefined">{{ entry.artistSong || '—' }}</span>
        <span v-if="saving" class="entry-details-feedback" role="status">Zapisywanie…</span>
        <span v-if="error" class="entry-details-feedback cell-error" role="alert">{{ error }}</span>
    </td>
</template>
