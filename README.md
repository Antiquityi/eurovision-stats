# Eurovision — tabela ocen

Polish spreadsheet interface built with Vue 3 Options API, Vuex, Vite and
Tailwind CSS. TASK-001 and TASK-002 are accepted. TASK-003 adds the Supabase schema,
database permissions and GitHub account controls; real OAuth/SQL verification is
pending project setup. Score loading, persisted editing and realtime are TASK-004.
Imports, backups and GitHub Pages deployment remain later tasks.

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

Production builds exclude the fixtures. Configuring either Supabase environment
setting also disables the development demo, so the configured app shows account
controls and an empty workspace until TASK-004 adds scoreboard loading/saving.
Partial or invalid configuration shows a connection error and disables login.
The local demo's editable flag grants no database permission.

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

Verified on 2026-11-06 for TASK-003: 31 Vitest domain/component/service/auth-store
tests, 2 actual Edge spreadsheet browser tests and production build. The build
reports a JavaScript chunk above 500 kB with the Supabase SDK included. SQL tests
and actual GitHub login remain unrun: no Supabase project/provider is configured.
Mocked SDK tests verify application handling, not actual OAuth or database access.

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

## Configure Supabase and GitHub (TASK-003)

Use a disposable development Supabase project first. Localhost connects to that
project's real database. No migration has been applied by this implementation.

1. Copy `.env.example` to ignored `.env.local`. Set `VITE_SUPABASE_URL` to the
   project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its public publishable key
   (`sb_publishable_…`). A legacy JWT with role `anon` also works. All `VITE_`
   values are browser-visible. Keep database passwords, service-role/secret keys
   and the GitHub client secret outside frontend configuration.
2. In the development project's SQL Editor, execute the tracked migrations
   in filename order: [schema](supabase/migrations/20261106000100_schema.sql), then
   [access](supabase/migrations/20261106000200_access.sql), then
   [entry metadata removal](supabase/migrations/20261106000300_remove_entry_metadata.sql).
   Each is transactional.
   Apply each once to a fresh project; preserve applied history and make later
   schema corrections with new forward migrations. Never reset a database with
   real results. CLI users can instead link the disposable project and use their
   installed Supabase CLI's migration workflow.
3. Create a GitHub OAuth App. Set its homepage to `http://localhost:5000/` and its
   authorization callback to the **Supabase** callback shown in the provider
   settings, normally `https://<project-ref>.supabase.co/auth/v1/callback`.
   Enable GitHub in Supabase Authentication provider settings and enter the GitHub
   client ID and secret there. See the [official GitHub provider guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).
4. In Supabase Authentication URL Configuration, use `http://localhost:5000/` as
   the development Site URL. Add `http://localhost:5000/` and
   `http://localhost:5000/?year=*` to allowed redirect URLs. For publication, add
   the exact Pages base, for example `https://<owner>.github.io/<repository>/`,
   and its `?year=*` variant; use the actual URL once established. The app returns
   to its root/base path, preserving only the selected year, and handles PKCE
   session exchange through the SDK. No callback route is required. See
   [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
5. Restart `npm run dev`. Sign in through GitHub. A new account is **Podgląd**
   until approved. In Supabase Authentication Users, verify each friend's GitHub
   identity and copy their **auth user UUID**. As the database owner in SQL Editor,
   approve that UUID (replace the placeholder):

   ```sql
   insert into public.approved_editors (user_id)
   values ('<auth-user-uuid>') on conflict do nothing;
   ```

   Use the refresh arrow or return to the browser tab to recheck membership;
   approved accounts show **Edytor**. All approved accounts have equal rights to
   every voter column. Voters are independent scoreboard records, not accounts.
   Only the owner provisions approvals; there is no browser approval UI.
6. To revoke access, run as owner:

   ```sql
   delete from public.approved_editors where user_id = '<auth-user-uuid>';
   ```

   Database writes are denied immediately. Account controls recheck membership
   on auth changes, tab focus/visibility return or manual refresh. Sign-out,
   refresh failures and failed membership checks remove frontend edit permission.
   Sign-out affects this browser's session. Network errors display Polish messages.

The database exposes public reads of contests/voters/entries/ratings, with no auth
details in those rows. Authenticated users can read only their own approval.
Approved users can update **only `ratings.value`**; RLS and column grants protect
identities, revisions, timestamps, structures and approvals. The trigger owns
revision/timestamp generation. Scores accept null or exact half points from 0 to
10; totals/ranks are calculated in the frontend. See
[Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).
Import RPCs and rating-row creation for whole contests will arrive with TASK-005.

## Database verification and manual account checks

[Schema tests](supabase/tests/schema.test.sql) and
[access tests](supabase/tests/access.test.sql) are pgTAP SQL tests. Run them only
against a fresh isolated Supabase database: they insert disposable years and auth
UUIDs inside transactions and roll back. They verify malformed/cross-contest
rejection, public reads, anonymous/unapproved write denial, all-voter editor
updates, protected columns, owner-only approvals and immediate revocation.

For the optional local stack, install the Supabase CLI and a Docker-compatible
runtime, then run from this repository:

```sh
supabase start
supabase migration up --local
supabase test db
```

The tracked `supabase/config.toml` uses app port 5000 and disables local GitHub
by default. Local SQL tests do not need GitHub enabled. For local OAuth, enable
`auth.external.github` and set its referenced server environment secrets;
register the local Auth callback instead of the hosted callback in a separate
GitHub OAuth App. Hosted Supabase remains the default for manual app testing.
These optional CLI/SQL commands have not been run in this environment.

After configuring the hosted dev project, manually verify:

- Open `http://localhost:5000/?year=2024`, sign in, and confirm the return URL keeps
  `year=2024`. Verify anonymous, unapproved and approved account labels.
- Sign out, reload, and confirm **Podgląd**. Revoke approval as owner, then refocus
  or refresh permissions and confirm it disappears. Simulate a network failure
  during permission refresh; the app must remain a viewer.
- Run the SQL access tests in isolation before relying on client write access.
  UI labels and mocked tests cannot prove server authorization.

TASK-003 stops at schema/auth. A configured empty workspace is expected here;
real contest reads, score saves and multi-browser realtime testing are TASK-004.
