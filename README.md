# NEARland

A pixel farming-and-mining economy game where the goods you produce can leave the game and be traded with other players for NEAR, with payment and delivery settled atomically by a smart contract.

Built for **NEAR HACKATHON 2026**, track **Games With Real Economies** (`games`).

## The problem

In most browser games the economy is a spreadsheet the developer owns. Items cannot leave the game, player-to-player trades need trust (or a middleman), and nothing a player earns is verifiable outside the game's database.

## What NEARland does

1. **Play:** place farms and mines, hire workers, harvest crops and ore, smelt bars, bake bread and forge tools.
2. **Bridge:** send any of the 12 resources from your in-game storehouse to your NEAR account. The game server debits your save and mints the same amount on the NEARland contract.
3. **Trade:** list items for NEAR. The items are escrowed by the contract. A buyer attaches NEAR to `buy_listing`, and in **one transaction** the seller is paid, the buyer receives the items, and any overpayment is refunded.
4. **Return:** burn items with `withdraw_to_game`. The server verifies the transaction on-chain and credits your storehouse. Each transaction can be redeemed once.

You sign in with any NEAR wallet (HOT, Meteor, Intear, MyNearWallet). One free NEP-413 signature per session proves to the server that you own the account, so the bridge cannot be used by anyone else.

## How NEAR is used

| Piece | Where | What it does |
| --- | --- | --- |
| Market contract (Rust, near-sdk 5.30) | [`contract/src/lib.rs`](contract/src/lib.rs) | On-chain balances of the 12 items (`mt_balance_of` in the style of NEP-245), escrowed listings, atomic `buy_listing`, `cancel_listing`, `transfer`, `withdraw_to_game`, NEP-297 `EVENT_JSON` logs |
| Game-server minter | `game.<contract>` sub-account, [`src/app/api/chain/deposit`](src/app/api/chain/deposit/route.ts) | The only account allowed to `mint`; signs with near-api-js on the server |
| Withdrawal verifier | [`src/app/api/chain/withdraw`](src/app/api/chain/withdraw/route.ts), [`src/lib/nearServer.ts`](src/lib/nearServer.ts) | Reads the transaction from RPC, checks signer, receiver and `withdraw_to_game` events, records the hash so it cannot be replayed |
| Wallet login | [`src/app/providers.tsx`](src/app/providers.tsx), [`src/app/api/session`](src/app/api/session/route.ts) | NEAR Connector (`near-connect-hooks`); NEP-413 signed message verified server-side (ed25519 + full-access-key check) |

**Deployed on testnet:** [`nearland-687e.testnet`](https://testnet.nearblocks.io/address/nearland-687e.testnet) (owner/minter `game.nearland-687e.testnet`).

## Try it (judges)

### Option A: run locally

Prerequisites: Node.js 20+, a Supabase project (free tier), a NEAR **testnet** wallet with a little testnet NEAR ([faucet](https://near-faucet.io)).

```bash
npm install
cp .env.example .env.local      # fill in the values, see below
npm run dev                     # http://localhost:3000
```

In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) once.

`.env.local`:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_NEAR_CONTRACT_ID` | `nearland-687e.testnet`, or your own deployment (see below) |
| `NEAR_GAME_ACCOUNT_ID` / `NEAR_GAME_PRIVATE_KEY` | the minter account set as `owner_id` of the contract |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Project Settings → API |
| `NEARLAND_SESSION_SECRET` | any random string of 32+ characters |

Minting needs the minter's key, so to run the full bridge locally, deploy your own copy of the contract (below) and use your own minter account.

### Walkthrough: do X, see Y

| Do | See |
| --- | --- |
| Click **Connect NEAR**, choose a wallet, approve | Your account ID in the top bar; **Enter Factory Hub** appears |
| Factory Hub: press `1`, click the grass | A Carrot Farm is placed; coins go down by 40 |
| Workers: hire a Farmer; back in Factory Hub click the farm | The worker is assigned and the progress bar fills (5 s) |
| Click the farm when it glows | 10 Carrot Bundles in your storehouse |
| Leave the page and come back | The farm, worker and stock are still there (server-side save) |
| NEAR Exchange → Bridge → Carrot Bundles, 5 → **Send to NEAR**, sign the message | Banner with a nearblocks link; "On your NEAR account: Carrot Bundles x5"; storehouse is 5 lower |
| List for NEAR → 5 at `0.001` → **Publish listing**, approve | The listing appears under Live Listings; the items left your on-chain balance (escrow) |
| Sign in with a **second** account → **Buy with NEAR**, approve | Seller receives 0.005 NEAR and buyer receives 5 Carrot Bundles in the same transaction (check the nearblocks link) |
| As the buyer: **Return to game** | Items burn on-chain and appear in the buyer's storehouse |
| Click **Return to game** with the same transaction again (via the API) | `409 This transaction was already redeemed.` |

### Deploy your own contract

```bash
cd contract
cargo test                                  # 10 unit tests
cargo near build non-reproducible-wasm
near contract deploy <your-account>.testnet use-file target/near/nearland_market.wasm \
  with-init-call new json-args '{"owner_id":"<minter-account>.testnet"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

## Architecture

```
Browser (Next.js 16, React 19, canvas engine)
  ├─ NEAR Connector wallet ── signs create_listing / buy_listing / cancel / withdraw_to_game ──▶ nearland contract
  └─ fetch /api/*
        ├─ /api/world, /api/buildings, /api/save-state ─▶ Supabase (service role; RLS on, no browser access)
        ├─ /api/session  (NEP-413 verify → 24 h HMAC session)
        ├─ /api/chain/deposit  (debit save → game account mints)  ─────────────────────▶ nearland contract
        └─ /api/chain/withdraw (verify tx + events → credit save, once per tx)  ◀──── RPC
```

## Repository layout

- `contract/`: NEAR market contract (Rust) with unit tests
- `src/app/`: Next.js routes and pages (`exchange/` is the NEAR market UI, `api/` the server routes)
- `src/game/`: canvas engine, buildings, economy constants, persistence, contract client (`nearMarket.ts`)
- `src/lib/`: NEAR helpers (`near.ts` shared, `nearServer.ts` server-only), Supabase clients
- `supabase/schema.sql`: database schema (safe to re-run)

Built with Next.js, React, Zustand, GSAP, Supabase, `near-connect-hooks`, `near-api-js`, `near-sdk` (Rust) and `cargo-near`.

## License

[MIT](LICENSE)
