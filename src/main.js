import { createApp } from 'vue';
import App from './App.vue';
import { createScoreboardStore } from './store/index.js';
import { createPreviewContests } from '../tests/fixtures/scoreboard.js';
import './assets/tailwind.css';

// Vite removes the fixture branch from production builds.
const store = createScoreboardStore(import.meta.env.DEV ? createPreviewContests() : [], { editable: import.meta.env.DEV });
createApp(App).use(store).mount('#app');
