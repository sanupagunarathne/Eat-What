# EATWHAT

A warm, mobile-first group dining app. Create a table, invite your people, vote privately, and reveal a meal everyone agreed on.

## Development and database setup

Requires **Node.js 24.x** (Vercel-supported; see `.nvmrc`) and PostgreSQL. Room storage uses `pg`. Create a Neon project or use local PostgreSQL, copy `.env.example` to `.env`, and replace `DATABASE_URL` with your connection string, keeping Neon's TLS parameters. Never commit credentials.

```sh
npm ci
# Save DATABASE_URL from Neon in .env, including its TLS parameters.
npm run db:check
npm run db:migrate
npm run dev
```

The server listens on port `3000`; use `PORT` to change it. `npm start` runs without file watching. No compilation step is required. Use the existing checkout; a separate Git worktree is not necessary.

Open the app on separate devices or separate browser profiles to try a group session. Tabs in one browser profile intentionally share one participant identity through an HTTP-only cookie. Invite links prefill the room code; guests enter their own names. An invited device must be able to reach the host serving the app.

Click the EATWHAT logo or **Back to create room** from any room screen to return to create/join. Home stays on the setup screen after a reload. **Back to room** explicitly resumes your saved room, including your votes; returning home keeps your seat in that room. Refreshing a room URL still restores that room.

## How the flow works

- **Create/join:** the host sets any number of participants, a per-person budget in Sri Lankan rupees, maximum distance, cuisine, and optional vegetarian preference. Guests enter a six-character code or follow an invite link.
- **Lobby:** the exact group size must join and every participant must explicitly mark themselves ready. Only the host can start. Invite copying has a manual-copy fallback.
- **Voting:** each participant gets the same filtered deck. Yes/Pass controls are always available alongside horizontal swipes. Votes are immutable and private; responses include only your own voted meal IDs and other participants’ completion status.
- **Result:** results wait until everyone has voted on every meal. A match requires a yes from every participant. When several meals match, the first in the common catalogue wins. No-match and no-meals states are explicit. Only the host can restart; a restart clears votes and readiness.
- **Reconnect:** reloads preserve the current room and membership. Polling refreshes the shared room every 1.5 seconds, pauses in hidden tabs, and reports temporary connection loss.

Rooms persist in Neon PostgreSQL. `DATABASE_URL` is required. Start, dev, migration, connection-check, and test scripts load `.env` when present using Node’s built-in loader; CI and hosting can supply environment variables directly without that file. Keep Neon's TLS parameters in the URL. `.env` is ignored by Git. `npm run db:migrate` (also available as `npm run db:init`) applies the idempotent `migrations/001_rooms.sql` migration and is safe to rerun. `npm run db:check` verifies connectivity without printing connection details. The server checks the rooms table before listening. Transactions and row locks preserve concurrent joins, readiness changes, and votes across server instances.

The migration creates the PostgreSQL table; it does not copy rooms from an existing `.data/eatwhat.sqlite` file. Keep that file if you need its history. For HTTPS deployments, set `COOKIE_SECURE=true`. Real restaurant discovery, geolocation, account recovery, and production abuse controls are not included.

New databases use JSONB room data and timestamp updates. Existing PostgreSQL tables with text room data and millisecond updates remain supported without rewriting saved rooms. Tests can use `TEST_DATABASE_URL` to select a separate database; each run uses its own temporary schema.

For Vercel, import the repository, choose Node.js 24.x, and configure `DATABASE_URL` and `COOKIE_SECURE=true` in the project environment. Run `npm run db:init` against that database before serving requests. `vercel.json` serves `public` and routes API requests through `api/index.js`; importing the handler does not start a separate HTTP listener.

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
npm run check        # JavaScript syntax
npm run test:navigation # Browser navigation regression checks without a database
npm test             # API/integration tests in an isolated PostgreSQL schema
npx playwright install chromium  # If a system Chromium is not available
npm run test:browser  # Real two-context group flow, responsive layout, axe WCAG A/AA checks
npx prettier --check .
```

Browser tests automatically use `/usr/bin/chromium` when available; `CHROMIUM_PATH` overrides that selection. Otherwise, they use Playwright’s downloaded Chromium. The browser script starts its own server on port `3107`, uses a temporary PostgreSQL schema, and writes review screenshots to the OS temporary directory. Tests require DATABASE_URL and permission to create/drop schemas. They remove only their own randomly named schemas and do not modify development rooms. `npm run test:browser` checks create/join, lobby readiness, private voting, swipe input, waiting, unanimous/no-match results, reload/restart, reduced motion, invalid codes, and horizontal overflow at phone/tablet/desktop sizes.

For a sandbox that does not permit the default npm cache directory, pass `--cache /tmp/eatwhat-npm-cache` to npm/npx.

## Sample content

The catalogue in `meals.js` is illustrative, with illustrative Sri Lankan rupee prices and distances, and venue names. No geolocation or restaurant API is called. “Get directions” opens a Maps search for nearby restaurants in the winning cuisine, rather than presenting a fictional venue as verified. This limitation is also stated in the interface.

Sample photos come from [Foodish](https://github.com/surhud004/Foodish), at `public/assets/images/{category}/{category}1.jpg` (biryani, pasta, pizza, burger, dosa, rice). Foodish credits Rajaraman Ekambaram’s initial food dataset and RitaE on Pixabay; image rights remain with their original creators. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source and license notices. Replace the sample catalogue and photos with your approved venue data and assets when integrating a real food source.
