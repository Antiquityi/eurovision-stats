import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AuthControls from '../../../src/components/AuthControls.vue';
import { createScoreboardStore } from '../../../src/store/index.js';

const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
function render(auth = {}) {
    const store = createScoreboardStore([], { auth });
    const wrapper = mount(AuthControls, { global: { plugins: [store] } });
    wrappers.push(wrapper);
    return { store, wrapper };
}

describe('account controls', () => {
    it('keeps fixture mode uncluttered and reports invalid configuration', () => {
        expect(render().wrapper.find('[aria-label="Konto GitHub"]').exists()).toBe(false);
        const { wrapper } = render({ configured: true, configError: 'Nieprawidłowa konfiguracja połączenia.' });
        expect(wrapper.get('[role="alert"]').text()).toContain('konfiguracja');
        expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    });
    it('shows viewer/editor state and dispatches account actions', async () => {
        const { store, wrapper } = render({ configured: true, service: {} });
        const dispatch = vi.spyOn(store, 'dispatch').mockResolvedValue();
        expect(wrapper.get('[role="status"]').text()).toBe('Podgląd');
        await wrapper.get('button').trigger('click');
        expect(dispatch).toHaveBeenCalledWith('auth/signIn');
        store.commit('auth/session', { user: { id: 'friend', user_metadata: { user_name: 'Friend' } } });
        store.commit('auth/access', true);
        await flushPromises();
        expect(wrapper.get('[role="status"]').text()).toBe('Edytor · Friend');
        store.commit('auth/busy', true);
        await flushPromises();
        expect(wrapper.get('[role="status"]').text()).toBe('Edytor · Friend');
        expect(wrapper.get('[role="status"]').attributes('aria-busy')).toBe('true');
        store.commit('auth/access', true);
        await flushPromises();
        await wrapper.get('button').trigger('click');
        expect(dispatch).toHaveBeenCalledWith('auth/signOut');
        store.commit('auth/error', 'Nie udało się sprawdzić uprawnień.');
        await flushPromises();
        expect(wrapper.get('[role="status"]').text()).toBe('Podgląd · Friend');
        expect(wrapper.get('[role="alert"]').exists()).toBe(true);
    });
});
