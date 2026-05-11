# AlienBackrooms

A browser-based retro-terminal game with a 3D Backrooms-meets-desert scene,
built around the **real** PURSUE archive — the U.S. Department of War's
declassified UAP file release from May 8, 2026.

Boot the "Department of War — Secure Terminal," browse the live PURSUE archive
(every released file, with thumbnails and downloads), chat with the A.I.S.
subsystem about specific cases, then enter the maze and try to escape with
randomized case files before the Men in Black catch up to you.

Built with React + Vite + TypeScript and react-three-fiber. Two Vercel Edge
Functions handle the LLM proxy and the war.gov asset proxy — no separate
backend.

## Stack

- **Vite + React 19 + TypeScript** for the UI
- **react-three-fiber / drei / rapier / postprocessing** for the 3D scene and physics
- **Vercel Edge Functions** in `/api`:
  - `/api/ais` — LLM chat through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
  - `/api/pursue` — fetches and parses the PURSUE CSV from war.gov
  - `/api/asset` — proxies images and PDFs from war.gov (Akamai blocks cross-site browser fetches; this proxy makes the request look same-origin)

## How the data flow works

The Department of War's release page at <https://www.war.gov/UFO/> loads a
CSV of all 161 records from
`https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-csv.csv`. That CSV
and every referenced PDF/image is behind Akamai's WAF, which rejects requests
unless they look like a same-origin browser fetch from `/UFO/`.

The browser can't lie about `Sec-Fetch-Site` from client JS, so we can't
hotlink war.gov assets directly. Instead:

1. On page load, the client calls `/api/pursue`, which fetches the CSV
   server-side with the magic headers, parses it, and returns JSON. Cached
   on the edge for an hour.
2. When the UI renders a thumbnail or download link, it goes through
   `/api/asset?u=…` — a tiny streaming proxy that does the same trick for
   images and PDFs. Aggressively edge-cached.

If the Department of War releases a new tranche, just reload the page —
fresh data on the next cache expiry.

## Run locally

You need Node 20+ and a [Vercel AI Gateway API key](https://vercel.com/dashboard).

```bash
npm install
cp .env.example .env.local      # paste your key into AI_GATEWAY_API_KEY
```

Two options for local dev:

1. **UI only** — Vite dev server alone. The 3D scene works, but the AIS
   terminal and PURSUE archive will error because there are no
   `/api/*` routes.

   ```bash
   npm run dev
   ```

2. **Full stack** — Vite plus Vercel CLI for the serverless functions:

   ```bash
   npm i -g vercel
   vercel dev
   ```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel (it auto-detects Vite — no config needed).
3. Add `AI_GATEWAY_API_KEY` under **Settings → Environment Variables**.
4. (Optional) Add `AIS_MODEL` to override the default LLM (`openai/gpt-4o-mini`).
5. Deploy.

If `/api/pursue` ever returns 502 in production, war.gov's WAF probably
started rejecting Vercel's egress IPs. The fix is to add stronger headers
in `api/pursue.ts` or fall back to a build-time CSV → JSON sync (run the
fetch locally and commit a static `src/lib/pursue-records.json`).

## Project layout

```
api/
  ais.ts               Edge: LLM chat proxy (Vercel AI Gateway)
  pursue.ts            Edge: CSV → JSON proxy for PURSUE archive
  asset.ts             Edge: image/PDF proxy for war.gov assets
src/
  App.tsx              Terminal UI, boot, live archive browser
  components/          3D scene (player, MIB, maze, pickups, etc.)
  lib/
    ais.ts             Thin client wrapper around /api/ais
    pursue.ts          Types, fetch helper, asset URL, pickup randomizer
    gameState.ts       Escalation tiers, pickup type definitions
public/                Static assets
```

## License

MIT © 2026 0xbl33p. See [LICENSE](./LICENSE).
