<script>
export default {
    name: 'VoterHeader',
    props: {
        voter: { type: Object, required: true },
        indicator: { type: String, default: '↕' },
    },
    emits: ['sort', 'delete'],
    data() { return { editing: false, text: '', saving: false, error: '', menuOpen: false }; },
    mounted() { document.addEventListener('pointerdown', this.outside); },
    beforeUnmount() { document.removeEventListener('pointerdown', this.outside); },
    computed: {
        editable() { return this.$store.getters.canEdit; },
        available() { return this.$store.getters.canCommit && !this.$store.state.contests.voterBusy; },
    },
    watch: { editable(value) { if (!value) this.menuOpen = false; } },
    methods: {
        outside(event) { if (!this.$refs.heading?.contains(event.target)) this.menuOpen = false; },
        async toggleMenu() {
            if (this.menuOpen) this.closeMenu();
            else await this.openMenu();
        },
        async openMenu() {
            this.menuOpen = true;
            await this.$nextTick();
            this.$refs.menu?.querySelector('button')?.focus({ preventScroll: true });
        },
        closeMenu(focus = false) { this.menuOpen = false; if (focus) this.$refs.trigger?.focus({ preventScroll: true }); },
        menuKeys(event) {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.closeMenu(true); }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const items = [...this.$refs.menu.querySelectorAll('button')];
            const current = items.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus({ preventScroll: true });
        },
        leave(event) { if (event.relatedTarget && !this.$refs.heading.contains(event.relatedTarget)) this.menuOpen = false; },
        remove() { this.closeMenu(true); this.$emit('delete', this.voter); },
        async edit() {
            this.closeMenu();
            this.text = this.voter.name;
            this.error = '';
            this.editing = true;
            await this.$nextTick();
            this.$refs.name?.focus({ preventScroll: true });
            this.$refs.name?.select();
        },
        cancel() { if (!this.saving) { this.editing = false; this.error = ''; } },
        async save() {
            if (!this.editing || this.saving) return;
            const name = this.text.trim();
            if (name === this.voter.name) { this.cancel(); return; }
            if (!name) { this.error = 'Wpisz imię.'; return; }
            if (!this.available) { this.error = 'Zmiana jest teraz niedostępna.'; return; }
            this.saving = true;
            this.error = '';
            try {
                const saved = await this.$store.dispatch('contests/manageVoter', { action: 'rename', voterId: this.voter.id, name });
                if (saved) this.editing = false;
                else this.error = 'Zmiana jest teraz niedostępna.';
            } catch (error) { this.error = error.message; }
            finally { this.saving = false; }
        },
    },
};
</script>

<template>
    <div ref="heading" class="voter-heading" :class="{ 'is-menu-open': menuOpen }" @focusout="leave">
        <input v-if="editing && editable" ref="name" v-model="text" class="voter-name-input" maxlength="80"
            :disabled="saving" :aria-label="`Imię osoby: ${voter.name}`" :aria-invalid="Boolean(error)"
            @keydown.enter.prevent="save" @keydown.esc.prevent.stop="cancel" @blur="save" />
        <button v-else class="voter-sort" :data-sort="voter.id" :title="voter.name" @click="$emit('sort')">{{ voter.name }} <span class="sort-indicator" aria-hidden="true">{{ indicator }}</span></button>
        <button v-if="editable && !editing" ref="trigger" class="voter-menu-trigger" :disabled="!available"
            :aria-label="`Opcje osoby: ${voter.name}`" aria-haspopup="menu" :aria-expanded="menuOpen" :aria-controls="`person-menu-${voter.id}`"
            @click="toggleMenu" @keydown.down.prevent="openMenu" title="Opcje osoby">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="16" cy="10" r="1.3"/></svg>
        </button>
        <div v-if="menuOpen && editable" ref="menu" :id="`person-menu-${voter.id}`" class="voter-menu" role="menu" :aria-label="`Opcje osoby: ${voter.name}`" @keydown="menuKeys">
            <button role="menuitem" :disabled="!available" @click="edit" :aria-label="`Zmień imię: ${voter.name}`">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m12.5 3.5 4 4M3 17l1-5L13 3a2.8 2.8 0 0 1 4 4l-9 9-5 1Z"/></svg>Zmień imię
            </button>
            <button role="menuitem" class="voter-menu-delete" :disabled="!available" @click="remove" :aria-label="`Usuń osobę: ${voter.name}`">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6m4-6v6"/></svg>Usuń osobę
            </button>
        </div>
        <span v-if="saving" class="voter-feedback" role="status">Zapisywanie…</span>
        <span v-if="error" class="voter-feedback cell-error" role="alert">{{ error }}</span>
    </div>
</template>
