# EATWHAT

A warm, mobile-first group dining app. Create a table, invite your people, vote privately, and reveal a meal everyone agreed on.

## Development

Requires **Node.js 24+** (see `.nvmrc`). The application has no runtime package dependencies.

```sh
npm ci
npm run dev
```

The server listens on port `3000`; use `PORT` to change it. `npm start` runs without file watching. No compilation step is required. Use the existing checkout; a separate Git worktree is not necessary.

Open the app on separate devices or separate browser profiles to try a group session. Tabs in one browser profile intentionally share one participant identity through an HTTP-only cookie. Invite links prefill the room code; guests enter their own names. An invited device must be able to reach the host serving the app.

## How the flow works

- **Create/join:** the host sets any number of participants, a per-person budget in Sri Lankan rupees, maximum distance, cuisine, and optional vegetarian preference. Guests enter a six-character code or follow an invite link.
- **Lobby:** the exact group size must join and every participant must explicitly mark themselves ready. Only the host can start. Invite copying has a manual-copy fallback.
- **Voting:** each participant gets the same filtered deck. Yes/Pass controls are always available alongside horizontal swipes. Votes are immutable and private; responses include only your own voted meal IDs and other participants’ completion status.
- **Result:** results wait until everyone has voted on every meal. A match requires a yes from every participant. When several meals match, the first in the common catalogue wins. No-match and no-meals states are explicit. Only the host can restart; a restart clears votes and readiness.
- **Reconnect:** reloads preserve the current room and membership. Polling refreshes the shared room every 1.5 seconds, pauses in hidden tabs, and reports temporary connection loss.

Rooms persist in `.data/eatwhat.sqlite` using Node’s built-in SQLite driver. Set `DATA_DIR` to choose a different directory. Keep it writable and persist it when deploying. For an HTTPS deployment, set `COOKIE_SECURE=true`. This is a single-instance first version; real restaurant discovery, geolocation, account recovery, and production abuse controls are not included.

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
npm test             # Nine API/integration tests with isolated temporary data
npx playwright install chromium  # If a system Chromium is not available
npm run test:browser  # Real two-context group flow, responsive layout, axe WCAG A/AA checks
npx prettier --check .
```

Browser tests automatically use `/usr/bin/chromium` when available; `CHROMIUM_PATH` overrides that selection. Otherwise, they use Playwright’s downloaded Chromium. The browser script starts its own server on port `3107`, uses temporary storage, and writes review screenshots to the OS temporary directory. Tests do not modify development rooms. `npm run test:browser` checks create/join, lobby readiness, private voting, swipe input, waiting, unanimous/no-match results, reload/restart, reduced motion, invalid codes, and horizontal overflow at phone/tablet/desktop sizes.

For a sandbox that does not permit the default npm cache directory, pass `--cache /tmp/eatwhat-npm-cache` to npm/npx.

## Sample content

The catalogue in `meals.js` is illustrative, with illustrative Sri Lankan rupee prices and distances, and venue names. No geolocation or restaurant API is called. “Get directions” opens a Maps search for nearby restaurants in the winning cuisine, rather than presenting a fictional venue as verified. This limitation is also stated in the interface.

Sample photos come from [Foodish](https://github.com/surhud004/Foodish), at `public/assets/images/{category}/{category}1.jpg` (biryani, pasta, pizza, burger, dosa, rice). Foodish credits Rajaraman Ekambaram’s initial food dataset and RitaE on Pixabay; image rights remain with their original creators. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source and license notices. Replace the sample catalogue and photos with your approved venue data and assets when integrating a real food source.
