# Eurovision Stats

A shared Eurovision scoreboard for friends, with a Polish spreadsheet interface.
Anyone can view the results; approved GitHub accounts can edit scores together.

## Features

- Ratings from 0 to 10 in half-point steps, with automatic saving and live updates.
- Sortable country and voter columns, combined totals and individual/group podiums.
- Shared tie resolution for equal-scoring podium places.
- Historical year tabs and named contests, with shareable selection links.
- Person column management for approved editors.
- One combined artist/song field per country, editable inline by approved editors.
- Responsive layout with horizontal scrolling on smaller screens.

## Stack

Vue 3 Options API, Vuex 4, Tailwind CSS 3 and Vite. Supabase provides PostgreSQL,
GitHub authentication and realtime updates. GitHub Pages hosts the static frontend.

## Getting started

Requires **Node.js 22.14+** and **npm**.

```sh
npm ci
npm run dev
```

Open **http://localhost:5000/**. The development server requires port 5000.
On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

Without Supabase configuration, development runs with labeled sample data. Changes
stay in memory and reset on reload. Sample data is excluded from production builds.

To connect to Supabase, copy `.env.example` to `.env.local`, fill in the public
settings below and restart the development server:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-public-key>
VITE_BASE_PATH=/
```

A legacy Supabase `anon` JWT is also supported. All `VITE_` values are visible in
the browser. Keep service-role keys, database passwords and OAuth secrets out of
frontend configuration. Local development connects to the configured project's
real database.

## Supabase setup

### Database

Run the SQL files in [supabase/migrations](supabase/migrations/) in filename order
through the Supabase SQL Editor. Apply each migration once; for an existing
project, apply only migrations that have not already been run.

For the artist/song column, apply `20261108000200_entry_details.sql` before running
the updated frontend. Existing entries start blank. Enter or leaving the field
saves changes; Escape cancels the current edit. Clear the field to remove its text.

Contests, countries and their complete rating matrices are provisioned through
owner-run SQL. Each country/person pair needs a rating row, including blank scores
stored as `NULL`. Data-specific scripts are kept outside version control.

Public reads and approved-editor writes are enforced by database policies.
GitHub accounts and scoreboard person columns are independent: every approved
editor can edit every person's scores.

### GitHub sign-in

1. Create a GitHub OAuth App with homepage `http://localhost:5000/`.
2. Set its authorization callback to the URL shown in Supabase's GitHub provider
   settings, normally `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Enable the GitHub provider in Supabase Authentication and enter the OAuth
   client ID and secret there.
4. In Supabase **Authentication → URL Configuration**, set the development Site
   URL to `http://localhost:5000/` and add these redirect URLs:

   ```text
   http://localhost:5000/
   http://localhost:5000/?year=*
   ```

The app returns to its base URL after login, preserving the selected year and
contest. See the [Supabase GitHub guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-github)
for provider setup.

### Editor access

After a person's first GitHub sign-in, find their account in Supabase
**Authentication → Users**, verify their identity and copy their auth user UUID.
Run this as the database owner:

```sql
insert into public.approved_editors (user_id)
values ('<auth-user-uuid>') on conflict do nothing;
```

Return to the browser tab or reload to refresh access. Approved accounts show
**Edytor**; other accounts show **Podgląd**.

To revoke access:

```sql
delete from public.approved_editors where user_id = '<auth-user-uuid>';
```

## Usage

Enter ratings with a comma or decimal point. **Enter** or leaving the cell saves;
**Escape** cancels unsent input. A blank cell means no score; zero is a valid score.
Use **Tab / Shift+Tab** to move between cells and **Up / Down** within a column.

Click a person or **Suma** header to change sorting; **Nr** restores performance
order. Year tabs preserve selection in the URL and support browser back/forward.

Editors can use **Dodaj osobę** to add a blank column and the column's **…** menu
to rename or delete it. **Remis** beside a tied podium lets editors choose its
order or restore shared places without changing scores.

Confirmed changes sync between browsers. After a connection failure, reconnect
and use **Ponów** for failed cells. Unsaved drafts are lost on a full page reload.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server at `http://localhost:5000/` |
| `npm test` | Unit, component and service tests |
| `npm run test:e2e` | Playwright browser tests |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Production preview at `http://localhost:4173/` |

Install Chromium before running browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Alternatively, use installed Edge on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:e2e
```

Browser tests use controlled services and do not modify the configured database.
Database tests in [supabase/tests](supabase/tests/) use pgTAP. With the Supabase CLI
and a Docker-compatible runtime, run them against an isolated local database:

```sh
supabase start
supabase migration up --local
supabase test db
```

## Deploy to GitHub Pages

The repository's Pages address is **https://antiquityi.github.io/eurovision-stats/**.
The [deployment workflow](.github/workflows/deploy.yml) publishes pushes to `main`.

1. In GitHub **Settings → Pages → Build and deployment**, select **GitHub Actions**
   as the source.
2. Under **Settings → Secrets and variables → Actions → Variables**, add these
   repository variables using your Supabase project's public settings:

   | Variable | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Supabase project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Public publishable key or legacy `anon` JWT |

3. In Supabase **Authentication → URL Configuration**, set the Site URL to
   `https://antiquityi.github.io/eurovision-stats/`. Add these redirect URLs,
   retaining the localhost entries for development:

   ```text
   https://antiquityi.github.io/eurovision-stats/
   https://antiquityi.github.io/eurovision-stats/?year=*
   http://localhost:4173/eurovision-stats/
   http://localhost:4173/eurovision-stats/?year=*
   ```

   The query pattern covers both year and contest selection. Update the GitHub
   OAuth App's homepage to the Pages URL; keep its callback pointing to Supabase.
4. Apply any outstanding database migrations, then merge your changes into `main`.
5. Watch **Actions → Publish GitHub Pages** and open the URL in the deployment
   output. If the `github-pages` environment restricts branches, allow `main`.

The workflow runs unit and browser tests, validates public configuration, builds
with the Pages base path and checks generated files for known privileged key
formats and development fixtures. Only `dist/` is uploaded. Database migrations
and data provisioning are separate from deployment.

After changing repository variables, rerun **Publish GitHub Pages → Run workflow →
main** to rebuild. To roll back the frontend, revert the relevant change on `main`
and push, keeping compatibility with the current database schema.

### Preview the deployed base path locally

With `.env.local` configured, run:

```powershell
$env:VITE_BASE_PATH = '/eurovision-stats/'
npm.cmd run build
node scripts/check-pages.mjs artifact
npm.cmd run preview
```

Open **http://localhost:4173/eurovision-stats/**. Keep the base override for both
build and preview; remove it afterward with `Remove-Item Env:VITE_BASE_PATH`.

After publishing, check public viewing, year selection, GitHub login and a saved
score updating in a second browser profile.

### Troubleshooting

- **Assets return 404:** check the GitHub Pages source and build base path.
- **Login returns to the wrong URL:** check Supabase's Site URL and redirect list,
  including the year query pattern.
- **Connection errors:** check Supabase availability, public build variables and
  applied migrations. Rebuild after changing GitHub variables.

See [Vite's Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
and [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
for hosting and authentication details.
