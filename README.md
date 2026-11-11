# QuantumQie

QuantumQie is a browser-based, canvas-driven resource-management / base-building game built with Next.js and React. Place farms and mines, assign workers, harvest resources, and persist your world using Supabase. The game integrates Ethereum wallet sign-in via Wagmi and RainbowKit for player identity.

## Features

- Canvas-rendered, tile-based world with procedurally drawn building art
- Placeable buildings: farms (carrot/rice/cabbage), mines (copper/iron/diamond), warehouse
- Workers that can be hired and assigned to buildings to produce resources
- Production, harvesting, and autosave persistence via Supabase
- Wallet-based identity (Wagmi + RainbowKit) for per-player saves
- Lightweight, dependency-minimal engine with zoom, minimap, and intuitive input

## Quick Demo / Run

Prerequisites:

- Node.js (18+ recommended)
- npm / pnpm / yarn

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser. Connect a wallet on the landing page and navigate to the Game screen.

## Gameplay Overview

- Place buildings by selecting a building (hotkeys shown in the UI or press `1`–`6`) and left-click on the canvas to place.
- Right-click to remove (or press `x` to toggle remove mode).
- Click a ready building to harvest its output.
- Assign workers by clicking an unassigned building (workers appear in the Workers panel) — different building types require different worker types (farmers or miners).
- The world autosaves periodically to Supabase.

## Controls

- Place / Interact: Left Click
- Remove: Right Click (or toggle remove with `x`)
- Rotate selected building: `r`
- Deselect / Cancel: `q` or `Escape`
- Building hotkeys: `1`..`6`
- Canvas receives keyboard input when focused (click the canvas or tab into it)

## Buildings (summary)

- `1` — Carrot Farm (farm-wheat) — cost: 40
- `2` — Rice Farm (farm-potato) — cost: 50
- `3` — Cabbage Farm (farm-rice) — cost: 60
- `4` — Copper Mine (mine-copper) — cost: 90
- `5` — Iron Mine (mine-iron) — cost: 110
- `6` — Diamond Mine (mine-diamond) — cost: 180
- Warehouse (warehouse) — cost: 0 (stores resources)

These definitions and rendering are implemented in `src/game/buildings.ts`.

## Project Structure (high level)

- `app/` — Next.js app routes and pages (React + server/Client components)
- `src/game/` — game engine, renderer, input, placement, persistence
- `src/components/` — UI components (Toolbar, HUD, Wallet, etc.)
- `src/lib/` — small libraries (Supabase client)

Key files:

- [src/app/game/page.tsx](src/app/game/page.tsx) — main game page and React glue
- [src/game/engine.ts](src/game/engine.ts) — main loop, ticking, and render orchestration
- [src/game/buildings.ts](src/game/buildings.ts) — building defs & drawing
- [src/game/persistence.ts](src/game/persistence.ts) — Supabase save/load helpers
- [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts) — reads required env vars

## Environment variables

The game optionally persists to Supabase and supports a wallet connection. To enable Supabase persistence, set these env vars in a `.env.local` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
# Optional: WalletConnect project id for RainbowKit features
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<project-id>
```

If Supabase env vars are not provided, the game will still run locally but persistence will be disabled and a warning will be logged.

## Build & Deploy

- Development: `npm run dev`
- Production build: `npm run build` then `npm run start`

This project targets Next.js 16 and React 19. The `package.json` scripts are preconfigured for standard Next.js workflows.

## Notes for Developers

- Rendering is canvas based and uses procedural drawing (no heavy sprite atlases required). See `src/game/buildings.ts` and `src/game/renderer.ts` for drawing logic.
- Input handling and camera controls live in `src/game/input.ts` and `src/game/camera.ts`.
- Persistence expects a Supabase table named `buildings` with columns matching the fields used in `src/game/persistence.ts` (see file for mappings).

## Contributing

Contributions welcome. Open an issue or PR with a clear description of the change or bug. For feature work, add a short note describing the gameplay impact.

## License

This repository does not include a license file. Add `LICENSE` if you want to make the project open source.

---

If you want, I can also:

- Add a minimal `README` badge and usage GIF
- Create a small `SUPABASE_SETUP.md` with SQL schema and table examples
- Add a `Makefile`/npm script to seed demo saves


