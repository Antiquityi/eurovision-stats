# Eurovision — tabela ocen

Polish spreadsheet interface built with Vue 3 Options API, Vuex, Vite and
Tailwind CSS. TASK-001 and TASK-002 are implemented. Supabase authentication,
persistence and realtime, imports, backups, and GitHub Pages deployment belong to
later tasks and are not implemented yet.

## Run locally

Use Node.js 22.14+ and npm:

```sh
npm ci
npm run dev
```

Open **http://localhost:5000/**. Port 5000 is fixed; the server stops if it is
occupied. If PowerShell blocks npm.ps1, use `npm.cmd` for these commands.

Development shows two clearly labeled **test-data** year tabs (2025 and 2024),
each with 26 countries.
Their countries, running order and scores are synthetic UI fixtures, not historical
Eurovision results. Edits live in browser memory and reset on reload. No database,
account or environment configuration is needed to test the frontend.

Production builds exclude the fixtures and show an empty workspace until real
data integration is implemented. `.env.example` reserves the planned public
Supabase settings; these settings are not consumed by TASK-002.

## Test the spreadsheet

- Click a voter or Suma header to sort descending, then ascending. Missing scores
  stay last. Click Nr to restore performance order.
- Enter scores from 0 to 10 in steps of 0.5, with comma or point. Values above 10
  become 10; letters and other fractions are blocked without error messages. Enter or leaving
  the cell confirms; Escape cancels. An empty cell means no submitted score.
- Use Tab/Shift+Tab to move between cells; Up/Down to move within a voter column.
- Green shading marks scores 7–10; red shading marks scores 0–2. Other scores
  stay neutral. Gold/silver/bronze rank badges independently follow competition
  ranks (1, 1, 3) when scores tie. The test data starts with distinct first, second
  and third places. Individual/group podium lists are always displayed below the
  table. Incomplete sums have a
  tooltip; vote counts are hidden.
- Switch years to check isolated scores and drafts. On narrow screens, scroll the
  table horizontally; country names and headers remain visible.

## Verification commands

```sh
npm test
npm run build
npm run preview
npm run test:e2e
```

Preview uses http://localhost:4173/ and intentionally contains no synthetic rows.
The frontend browser tests use the development server. Playwright defaults to its
Chromium browser (`npx playwright install chromium` if needed). To use an installed
Edge browser on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

The spreadsheet uses a soft charcoal theme and compact system-font numbers with
tabular figures. Filled gold/silver/bronze circles mark places inside the spreadsheet;
the podium lists use smaller, muted square rank labels.
No external font request is required.

Verified on 2026-11-06: 18 Vitest domain/component tests, 2 actual Edge browser
tests, production build and fixture-free production preview. Backend behavior has
not been implemented or tested.

For a future repository-base build:

```powershell
$env:VITE_BASE_PATH = '/eurovision-stats/'
npm run build
npm run preview
```

Open http://localhost:4173/eurovision-stats/. Replace the base with the actual
repository path and remove the temporary override afterward with
`Remove-Item Env:VITE_BASE_PATH`. Local environment files, build output and test
reports are ignored. No privileged credentials belong in frontend environment variables.

The [screenshot-to-JSON prompt](prompts/create-contest-json.md) is retained for the
future import task.
