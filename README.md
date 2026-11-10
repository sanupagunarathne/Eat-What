# EATWHAT

A warm, mobile-first group dining app. Create a table, invite your people, vote privately, and reveal a meal everyone agreed on.

## Development and database setup

Use Node.js **24.x** (Vercel-supported; see `.nvmrc`) and PostgreSQL. Create a **Neon Free** project manually, or use local PostgreSQL. Copy `.env.example` to `.env` and replace `DATABASE_URL` with your Neon pooled connection string, keeping `sslmode=require`. Never commit credentials.

```sh
npm ci
npm run db:init
npm run dev
```

Open http://localhost:3000 in separate browser profiles to represent separate participants. Tabs share the HTTP-only session cookie. `npm start` runs without watching; `PORT` optionally changes the local port. `.env` loads automatically for development, startup, and initialization.

Required environment variable: `DATABASE_URL`. Optional: `COOKIE_SECURE=true` for local HTTPS (leave false for HTTP). Vercel and `NODE_ENV=production` always use Secure cookies. Tests use a separate initialized database specified by `TEST_DATABASE_URL`; never point this at production.

`npm run db:init` runs `migrations/001_rooms.sql`, creating the table if absent. It is idempotent and non-destructive. Run once per database before deployment; it does not run during requests or on every deployment.

## Architecture and Vercel Hobby deployment

Rooms retain their JSON structure in PostgreSQL JSONB rows keyed by six-character room codes. The `pg` driver uses parameterized SQL and a reused pool capped at three connections per function instance. Use Neon's pooled hostname to manage connections across instances. Each mutation reads the room with `SELECT FOR UPDATE` inside a transaction, applies existing validation and authorization, and commits before responding. Concurrent votes, joins, and readiness updates cannot overwrite one another. Atomic inserts retry room-code collisions.

`api/index.js` exports the native HTTP request handler without opening a listening server. `vercel.json` rewrites only `/api/*` to that function and serves `public` assets directly, preserving the frontend. Local `server.js` still serves both API and static files. No database state is written to disk.

Deployment checklist:

1. Initialize your Neon Free database and run the checks below.
2. Review the changes, then commit and push to the GitHub branch connected to Vercel when ready. No push or deployment has been performed here.
3. In Vercel use this repository root, Framework Preset **Other**, Node.js **24.x**, Install Command `npm ci`, Build Command `npm run build`, Output Directory `public`. Remove stale overrides referring to `server.mjs` or SQLite. Configuration is also in `vercel.json`.
4. Add sensitive `DATABASE_URL` for Production and any Preview environments. Prefer a separate Neon database/branch for previews; initialize each database once.
5. Redeploy the GitHub commit after setting environment variables.
6. In two browser profiles verify create, join, both ready, host start, all votes, result, reload, and host restart; check function logs. A live Vercel deployment remains to be verified.

Existing SQLite rooms are not imported. Preserve `.data/eatwhat.sqlite` as a backup if needed; users create new rooms after migration. Clearing participant cookies loses the associated identity. The application still uses illustrative meals and polling; restaurant discovery, account recovery, and abuse rate limiting are outside this migration.

Troubleshooting: missing `DATABASE_URL` means the environment needs configuration; a missing `rooms` relation means run `db:init` for that database. For connection failures check Neon project status, credentials, pooled hostname, and TLS parameters. For API 404s check Root Directory and stale Vercel overrides. Redeploy after changing environment variables. API errors hide internal details; server logs report error codes without connection strings. Secure cookies require HTTPS.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [PostgreSQL driver pooling](https://node-postgres.com/apis/pool).

## How the flow works

- **Create/join:** the host sets 2–10 participants, a per-person budget, maximum distance, cuisine, and optional vegetarian preference. Guests enter a six-character code or follow an invite link.
- **Lobby:** the exact group size must join and every participant must explicitly mark themselves ready. Only the host can start. Invite copying has a manual-copy fallback.
- **Voting:** each participant gets the same filtered deck. Yes/Pass controls are always available alongside horizontal swipes. Votes are immutable and private; responses include only your own voted meal IDs and other participants’ completion status.
- **Result:** results wait until everyone has voted on every meal. A match requires a yes from every participant. When several meals match, the first in the common catalogue wins. No-match and no-meals states are explicit. Only the host can restart; a restart clears votes and readiness.
- **Reconnect:** reloads preserve the current room and membership. Polling refreshes the shared room every 1.5 seconds, pauses in hidden tabs, and reports temporary connection loss.

## Design system

Reusable CSS tokens in `public/styles.css`:

| Token        | Colour    | Purpose                                            |
| ------------ | --------- | -------------------------------------------------- |
| `--cream`    | `#F5F0ED` | Backgrounds and light text on dark panels          |
| `--espresso` | `#593527` | Text, icons, dark panels, focus outlines           |
| `--gold`     | `#F5C267` | Primary actions, counts, highlights                |
| `--mint`     | `#8ABFB0` | Ready badges, yes controls, unanimous match        |
| `--coral`    | `#F25D50` | Pass icons and actionable validation borders/icons |

Espresso text accompanies gold, mint, and cream surfaces. Colour statuses always include text or icons. Controls have visible keyboard focus and large touch targets. The match has one short reveal, disabled by `prefers-reduced-motion`. All photography is served locally. No external fonts or image services are required at runtime.

## Validation

```sh
npm run build          # Syntax validation; no frontend compilation needed
npm test               # 11 API workflow/security tests with a test-only memory store
npm run test:postgres  # Same tests against TEST_DATABASE_URL; skips if missing
npx playwright install chromium
npm run test:browser   # Requires TEST_DATABASE_URL and browser installation
npx prettier --check server.js db.js api scripts test README.md package.json vercel.json .github/workflows/checks.yml
```

For PostgreSQL tests, initialize an isolated test database first (`DATABASE_URL` set to that database when running `db:init`). Test rooms remain in the test database. GitHub Actions provides PostgreSQL 17, initializes it, and runs API and browser tests. The browser suite exercises two participants, readiness, voting, results, reload, restart, accessibility, and responsive layouts. `CHROMIUM_PATH` can override the browser executable. Browser screenshots go to the OS temporary directory.

Local verification used Node 26 because that is installed in this workspace; Node 24 verification is configured in CI. Live PostgreSQL, browser workflow, CI, and Vercel deployment checks require the appropriate environment and must be verified before release.

## Sample content

The catalogue in `meals.js` is illustrative, including USD prices, distances, and venue names. No geolocation or restaurant API is called. “Get directions” opens a Maps search for nearby restaurants in the winning cuisine, rather than presenting a fictional venue as verified. This limitation is also stated in the interface.

Sample photos come from [Foodish](https://github.com/surhud004/Foodish), at `public/assets/images/{category}/{category}1.jpg` (biryani, pasta, pizza, burger, dosa, rice). Foodish credits Rajaraman Ekambaram’s initial food dataset and RitaE on Pixabay; image rights remain with their original creators. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source and license notices. Replace the sample catalogue and photos with your approved venue data and assets when integrating a real food source.
