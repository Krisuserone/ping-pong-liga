# Ping Pong Liga

A private web app (in Slovenian) for a small group (about 10 people) to record table tennis games, browse match history and follow a live leaderboard.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 (Vite) · Supabase (Postgres, Auth with Google sign-in, Realtime) · Vercel hosting.

## Features

| Tab | Everyone | Administrators |
| --- | --- | --- |
| Dashboard | Totals, top three, recent matches, standings, "Record a match" button | — |
| Players | List, search, see games and W/L | Add, rename, deactivate or reactivate |
| Record Match | Two dropdowns, two scores, date (defaults to today), Save | — |
| Match History | Grouped by date, newest first; filter by date range, player or name; match details | Edit or delete (with confirmation) |
| Leaderboard | **Overall** table (rank, P, W, L, points scored, points conceded, difference; sort and filter) and **Match day** view: one day’s standings with the day’s winner, ‹ › to step between match days | — |
| Administration | — | Invite players by Gmail address, grant or revoke admin, disable accounts, league name |

**Rules enforced in the database (not only in the browser):** scores are whole numbers from 0 to 21, there are no ties, the two players must be different, the date can't be in the future, and new games need active players. The recorder is always the signed-in user. Statistics are never stored. The `player_stats` view calculates them from the matches, so editing or deleting a match changes the leaderboard straight away. Open screens refresh through Supabase Realtime.

**Ranking:** wins, then point difference, then points scored, all highest first. Players level on all three share a rank, shown as "T2". Inactive players keep their history but are not ranked.

## Signing in

Players click **Continue with Google** and pick their Gmail account. There are no passwords to create or forget.

The league is **invite-only**. An administrator adds each player's Gmail address under **Administration → Invite players**. Supabase Auth calls the `hook_before_user_created` database function before creating any account, and it refuses every email that isn't on the invite list. So a stranger with a Google account can't even create an account; they see "This email has not been invited to the league."

**Password sign-in** ("Raje se prijavi z e-pošto in geslom") is only for local test accounts. It appears during local development (`npm run dev`) and is hidden on the live site. To show it on the live site anyway, set `VITE_ENABLE_PASSWORD_LOGIN=true` in Vercel and redeploy.

## Security model

- Google or Supabase Auth handles all credentials. The app never sees or stores a password.
- Accounts are invite-only, enforced inside Supabase Auth by the sign-up hook (see above).
- Row Level Security on every table:
  - Signed-in, active users can read league data and record matches.
  - Only admins can change players, edit or delete matches, manage invites, or manage users.
  - Disabled accounts and anonymous visitors see nothing.
- Role and status changes go through `SECURITY DEFINER` functions that check the caller is an admin. The last active admin cannot be demoted or disabled.
- **Initial admin:** nothing is hard-coded in the code. During deployment, `npm run invite-admin -- <gmail>` invites the owner's Gmail as administrator, directly in the live database. Their first Google sign-in creates an admin account. Every sign-in, including the very first one to an empty league, must be invited, so there is no window in which a stranger could claim the league.
- The browser only gets the public anon/publishable key. The Google client secret is stored only in Supabase.

## Deploying (one-time, about 20 minutes)

You need free accounts at [supabase.com](https://supabase.com), [vercel.com](https://vercel.com) and [Google Cloud](https://console.cloud.google.com) (your Gmail works).

### 1. Create the Supabase project

1. In the Supabase dashboard, click **New project**. Pick a region near your players and save the database password somewhere safe.
2. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**. Note your project ref, the `xxxx` in `https://xxxx.supabase.co`.

### 2. Push the database schema

From this folder:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```

```bash
npx supabase db push
```

Then invite yourself as the first administrator (use the Gmail you will sign in with):

```bash
npm run invite-admin -- your.name@gmail.com
```

You can run it again later to make another existing or future account an administrator.

> On Windows, if `npx supabase` fails with `spawn ... ENOENT`, run the binary directly: `node_modules/@supabase/cli-windows-x64/bin/supabase.exe <command>`.

### 3. Turn on the invite-only hook

In Supabase, go to **Authentication → Hooks → Add hook → Before User Created**. Choose **Postgres**, schema `public`, function `hook_before_user_created`, then save.

**Don't skip this step.** Without the hook, any Google account could create an account. It would see no data until an admin enabled it, but it still shouldn't exist.

Then go to **Authentication → Sign In / Providers → Email** and turn the Email provider **off**. Everyone signs in with Google, so this closes the password sign-in path completely, even for someone calling Supabase directly. (Leave it on only if you set `VITE_ENABLE_PASSWORD_LOGIN=true`.)

### 4. Deploy the frontend to Vercel

1. Push this folder to a GitHub repository. Then, in Vercel, click **Add New → Project** and import that repository. Vercel detects Vite automatically.
2. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from step 1.2), then click **Deploy**.
3. Copy the production URL (for example `https://your-league.vercel.app`). In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to that address.

Or use the CLI: run `npx vercel` once to link the project, `npx vercel env add` for each variable, then `npx vercel --prod`.

### 5. Create the Google sign-in client

1. In [Google Cloud Console](https://console.cloud.google.com), create a project (for example "Table Tennis League").
2. Open **Google Auth Platform**:
   - **Branding:** set the app name, your support email and your developer contact email.
   - **Audience:** choose **External**. Then click **Publish app**, which needs no Google review because the app only asks for name and email. If you leave it in "Testing" instead, add every player's Gmail under **Test users**.
3. Go to **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** your Vercel URL, plus `http://localhost:5173` for local use.
   - **Authorized redirect URIs:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`, plus `http://127.0.0.1:54321/auth/v1/callback` for local use.
4. Copy the **Client ID** and **Client secret**.
5. In Supabase, go to **Authentication → Sign In / Providers → Google**. Enable it, paste the ID and secret, and save.

### 6. Become the administrator, then invite players

1. Open the production URL and click **Nadaljuj z Googlom** with the Gmail you invited in step 2. Confirm your display name, and you're in as administrator.
2. Go to **Administracija → Povabi igralce**. Add each player's Gmail address (choose **Skrbnik** for anyone who should help manage; a second admin is a good backup), then send them the URL.
3. Add the players under **Players**. Players are the people in matches, which is separate from login accounts.

- **Grant admin access later:** Administration → **Make admin** next to the account.
- **Someone leaves:** use **Disable**. Their recorded matches stay.

## Updating the live app

The live site is https://ping-pong-liga.vercel.app. The Vercel project is connected to this GitHub repository:

- **Frontend changes:** push to `main` and Vercel builds and deploys automatically (about a minute). Pushes to other branches get their own preview URL.
- **Database changes:** add a new file under `supabase/migrations/`, then run `npx supabase db push`. Vercel does not touch the database.
- **Sign-in settings:** edit `supabase/config.toml` (production values live in the `[remotes.production]` section), check with `npx supabase config diff`, then apply with `npx supabase config push`.
- **Another administrator:** `npm run invite-admin -- someone@gmail.com`, or use **Administracija** in the app.

Secrets never go in the repo. The database password is in `.env.deploy.local`, the Google client in `supabase/.env`, and the Supabase URL and key in Vercel's environment variables.

## Local development

You need Docker Desktop.

```bash
npm install
```

```bash
npx supabase start
```

That command prints the local API URL and publishable key. Put them in `.env.local`, using `.env.example` as a template, then run:

```bash
npm run dev
```

The app is at http://localhost:5173.

**Google sign-in locally:** put your Google client ID and secret in `supabase/.env` (git ignores it):

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

Then restart with `npx supabase stop` followed by `npx supabase start`. The local invite hook is already turned on in `supabase/config.toml`.

## Tests

```bash
npm test
```

Runs 23 unit tests for score validation, the ranking rules, tie labels, display sorting and date grouping.

```bash
npm run test:db
```

Applies the real migrations to an in-memory Postgres (PGlite, no Docker needed) and runs 47 database tests from `supabase/tests/league_test.sql`. They cover:

- RLS for users, admins, disabled accounts and anonymous visitors
- Score, tie, self-play and date validation
- Statistics and ranking, including recalculation after an edit or delete
- The one-time admin claim and the last-admin safeguard
- Invites and the invite-only sign-up hook

With Docker, the same file also runs on the real local Supabase stack via `npx supabase test db`. It runs inside a transaction that is rolled back, so it never changes your data.

## Project layout

```
src/
  auth/AuthContext.tsx        session, profile, role, setup state
  data/LiveData.tsx           realtime-driven refresh + query hook
  data/queries.ts             Supabase queries
  lib/                        validation, stats/ranking, dates, error messages (pure, unit tested)
  components/                 layout/nav, match form fields, match list, standings table, dialogs
  pages/                      Dashboard, Players, RecordMatch, MatchHistory, Leaderboard, Admin, auth screens
supabase/
  migrations/                 schema, RLS policies, functions, stats view, invites + sign-up hook
  tests/league_test.sql       database tests
  config.toml                 local stack config (Google provider + hook enabled)
scripts/db-test.mjs           runs the database tests on PGlite
vercel.json                   SPA rewrites + security headers
```
