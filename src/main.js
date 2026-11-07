import { createApp } from 'vue';
import App from './App.vue';
import { createScoreboardStore } from './store/index.js';
import { createPreviewContests } from '../tests/fixtures/scoreboard.js';
import { backend } from './services/supabase.js';
import { createAuthService } from './services/auth.js';
import { createContestService } from './services/contests.js';
import { createRealtimeService } from './services/realtime.js';
import './assets/tailwind.css';

// Vite removes the fixture branch from production builds.
const store = createScoreboardStore(import.meta.env.DEV && !backend.configured ? createPreviewContests() : [], {
    editable: import.meta.env.DEV && !backend.configured,
    selectedYear: new URL(window.location.href).searchParams.get('year'),
    service: backend.client ? createContestService(backend.client) : null,
    realtime: backend.client ? createRealtimeService(backend.client) : null,
    auth: { configured: backend.configured, configError: backend.error, service: backend.client ? createAuthService(backend.client) : null, basePath: import.meta.env.BASE_URL },
});
createApp(App).use(store).mount('#app');
