# NEARland

A pixel farming-and-mining economy game. The goods you produce can leave the game, be listed for NEAR, and be bought by other players. Payment and delivery are settled in one transaction by a smart contract on NEAR.

| | |
| --- | --- |
| **Hackathon** | NEAR HACKATHON 2026, track **Games With Real Economies** (`games`) |
| **Live demo** | https://nearland-dun.vercel.app (NEAR testnet) |
| **Contract** | [`nearland-687e.testnet`](https://testnet.nearblocks.io/address/nearland-687e.testnet) |
| **Source of the contract** | [`contract/src/lib.rs`](contract/src/lib.rs) (Rust, near-sdk 5.30, 10 unit tests) |
| **License** | MIT |

## The problem

In most browser games the economy is a database the developer owns. Items cannot leave the game, player-to-player trades need trust or a middleman, and nothing a player earns can be checked outside the game.

## What NEARland does

1. **Play.** Place farms and mines, hire workers, harvest crops and ore, smelt bars, bake bread, forge tools, sell surplus to the town market, climb the leaderboard.
2. **Bridge.** Send any of the 12 resources from your in-game storehouse to your NEAR account. The game server removes them from your save and mints the same amount on the contract.
3. **Trade.** List items for NEAR. The contract holds them in escrow. A buyer calls `buy_listing` with NEAR attached, and in **one transaction** the seller is paid, the buyer receives the items, and any overpayment is refunded.
4. **Return.** Burn items with `withdraw_to_game`. The server verifies the transaction on-chain and puts the items back in your storehouse. Each transaction can be redeemed only once.

The chain stays out of the way while you play: farming, hiring and harvesting need no wallet approvals. The wallet is only asked to approve when real value moves (listing, buying, returning items).

## Try it in two minutes (no setup)

You need a NEAR **testnet** account with a little testnet NEAR ([faucet](https://near-faucet.io)). Any of these wallets work: Meteor, HOT, Intear, MyNearWallet. To see a trade you need two accounts (a seller and a buyer).

Open **https://nearland-dun.vercel.app** and follow the table.

| # | Do | See |
| --- | --- | --- |
| 1 | Click **Connect NEAR**, pick a wallet, approve | Your account ID in the top bar and an **Enter Factory Hub** button |
| 2 | Factory Hub: press `1`, click the grass | A Carrot Farm is placed and your coins drop by 40 |
| 3 | Worker Hub: hire a Farmer. Back in Factory Hub, click the farm | The worker is assigned and the farm's progress bar fills (about 5 s) |
| 4 | Click the farm when it is ready | 10 Carrot Bundles are added to your storehouse |
| 5 | Open another page and come back | The farm, the worker and the stock are still there |
| 6 | NEAR Exchange → **Bridge** → Carrot Bundles, amount 5 → **Send to NEAR** → sign the message | A green banner with a nearblocks link; "On your NEAR account: Carrot Bundles x5"; storehouse is 5 lower |
| 7 | **List for NEAR** → quantity 5, price `0.001` → **Publish listing** → approve | The listing appears under Live Listings and the 5 items leave your on-chain balance (escrow) |
| 8 | Log out, connect a **second** account, NEAR Exchange → **Buy with NEAR** → approve | A banner with a nearblocks link. On nearblocks: one `buy_listing` call with 0.005 NEAR attached, paid to the seller |
| 9 | As the buyer, click **Return to game** → approve | The items disappear from "On your NEAR account" and appear in the buyer's storehouse |

## Verify the claims without a wallet

### On-chain evidence (a full cycle recorded on testnet)

| Step | Signed by | Transaction |
| --- | --- | --- |
| Game server mints bridged items | `game.nearland-687e.testnet` | [`2W4s6Cqe…`](https://testnet.nearblocks.io/txns/2W4s6CqeZqdaRVgH7h5ktmWzwtpcLAKFqRz6jVobwnYe) |
| Seller lists 10 Carrot Bundles (escrow) | `greatapp6802.testnet` | [`HASHQ4sq…`](https://testnet.nearblocks.io/txns/HASHQ4sqSt1mewd84ATBmuYVyEd5hUWKDwTRVNNA6jfE) |
| Buyer pays 0.01 NEAR, receives the goods | `badpalace506.testnet` | [`4fMYd4nS…`](https://testnet.nearblocks.io/txns/4fMYd4nSuWB3PxGNZkPegDVubaGiwdKMxG41htQC2A8T) |
| Buyer burns the items to return them to the game | `badpalace506.testnet` | [`B2hBSX2j…`](https://testnet.nearblocks.io/txns/B2hBSX2jXfwCNophCyWD2jy3EdJpuGoM1J1zFV9LQ9L5) |
| Contract deployment | `nearland-687e.testnet` | [`66k2zKrn…`](https://testnet.nearblocks.io/txns/66k2zKrns7RfnLVX8YRV7xtbz4XUMqCBLZUDAyYJZuWz) |

### Read the contract ([near-cli-rs](https://github.com/near/near-cli-rs))

```bash
# who is allowed to mint  ->  "game.nearland-687e.testnet"
near contract call-function as-read-only nearland-687e.testnet get_owner json-args '{}' network-config testnet now

# open listings  ->  JSON array of {id, seller_id, item, quantity, unit_price}
near contract call-function as-read-only nearland-687e.testnet get_listings json-args '{}' network-config testnet now

# an account's on-chain items  ->  JSON array of {item, balance}
near contract call-function as-read-only nearland-687e.testnet balances_of json-args '{"account_id":"badpalace506.testnet"}' network-config testnet now
```

### Check the server's guards on the live site

```bash
# bridge without a session  ->  {"error":"Sign in again to continue."}
curl -s -X POST https://nearland-dun.vercel.app/api/chain/deposit -H 'content-type: application/json' -d '{"item":"wheat","amount":1}'

# malformed save id  ->  {"error":"Invalid saveId."}
curl -s "https://nearland-dun.vercel.app/api/buildings?saveId=bad"

# public leaderboard  ->  {"ok":true,"rows":[...]}
curl -s https://nearland-dun.vercel.app/api/leaderboard
```

### Run the contract tests

```bash
cd contract
cargo test        # 10 passed
```

The tests cover: only the game server can mint, unknown items are rejected, listing escrows the items, buying settles and removes the listing, underpayment is rejected, sellers cannot buy their own listing, only the seller can cancel, cancelling returns the escrow, listing more than you own is rejected, transfer and withdraw.

## Where each feature lives in the code

| Claim | Code |
| --- | --- |
| On-chain balances of 12 items (`balance_of`, `balances_of`, `mt_balance_of` in the style of NEP-245) | [`contract/src/lib.rs`](contract/src/lib.rs): `ITEMS`, `credit`, `debit`, views |
| Only the game server can mint | [`contract/src/lib.rs`](contract/src/lib.rs): `mint` |
| Escrowed listings | [`contract/src/lib.rs`](contract/src/lib.rs): `create_listing`, `cancel_listing` |
| Atomic purchase: pay seller, deliver items, refund excess | [`contract/src/lib.rs`](contract/src/lib.rs): `buy_listing` |
| Burn to return items to the game | [`contract/src/lib.rs`](contract/src/lib.rs): `withdraw_to_game` |
| NEP-297 `EVENT_JSON` logs for every state change | [`contract/src/lib.rs`](contract/src/lib.rs): `emit` |
| Wallet login (NEAR Connector: HOT, Meteor, Intear, MyNearWallet) | [`src/app/providers.tsx`](src/app/providers.tsx), [`src/components/WalletButton.tsx`](src/components/WalletButton.tsx) |
| NEP-413 signed login, verified server-side (ed25519 signature and full-access-key check), 24 h session | [`src/lib/nearServer.ts`](src/lib/nearServer.ts): `verifyLogin`, `issueSession`; [`src/app/api/session/route.ts`](src/app/api/session/route.ts) |
| Bridge in: debit the save, then mint; refund the save if minting fails | [`src/app/api/chain/deposit/route.ts`](src/app/api/chain/deposit/route.ts) |
| Bridge out: read the transaction from RPC, check signer, receiver and events, redeem once | [`src/app/api/chain/withdraw/route.ts`](src/app/api/chain/withdraw/route.ts); [`src/lib/nearServer.ts`](src/lib/nearServer.ts): `readWithdrawTx`; `chain_claims` in [`supabase/schema.sql`](supabase/schema.sql) |
| Exchange UI calling the contract | [`src/app/exchange/page.tsx`](src/app/exchange/page.tsx), [`src/game/nearMarket.ts`](src/game/nearMarket.ts) |
| Game loop: buildings, workers, production, recipes, levels, town-market pricing | [`src/game/`](src/game), [`src/store/gameStore.ts`](src/store/gameStore.ts), [`src/game/economyConstants.ts`](src/game/economyConstants.ts) |
| Saves go through the server; the browser has no database access | [`src/app/api/world`](src/app/api/world/route.ts), [`src/app/api/buildings`](src/app/api/buildings/route.ts), [`src/app/api/save-state`](src/app/api/save-state/route.ts) |

## Architecture

```
Browser (Next.js 16, React 19, canvas engine)
  ├─ NEAR wallet ── signs create_listing / buy_listing / cancel_listing / withdraw_to_game ──▶ nearland contract
  └─ fetch /api/*
        ├─ /api/world, /api/buildings, /api/save-state ─▶ Supabase (service role; row-level security on)
        ├─ /api/session        NEP-413 signature  →  24 h session token
        ├─ /api/chain/deposit  debit save  →  game account mints  ───────────────────────────▶ nearland contract
        └─ /api/chain/withdraw verify tx and events via RPC  →  credit save, once per tx  ◀── NEAR RPC
```

Accounts on testnet: `nearland-687e.testnet` (contract), `game.nearland-687e.testnet` (minter, a sub-account), `npc.nearland-687e.testnet` (reserved for an NPC trader).

## Run it locally

Prerequisites: Node.js 20+, a free Supabase project, a NEAR testnet wallet.

```bash
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm run dev                     # http://localhost:3000
```

Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL editor (safe to re-run).

| Variable in `.env.local` | Value |
| --- | --- |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_NEAR_CONTRACT_ID` | `nearland-687e.testnet`, or your own deployment |
| `NEAR_GAME_ACCOUNT_ID`, `NEAR_GAME_PRIVATE_KEY` | the account set as the contract's `owner_id` (the minter) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `NEARLAND_SESSION_SECRET` | any random string of 32 or more characters |

With the public contract ID you can play, list, buy and cancel locally. **Send to NEAR** needs the minter's private key, so for the full bridge deploy your own copy:

```bash
cd contract
cargo near build non-reproducible-wasm
near contract deploy <your-account>.testnet use-file target/near/nearland_market.wasm \
  with-init-call new json-args '{"owner_id":"<minter-account>.testnet"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

## Known limits

- **Testnet only.** The contract is not deployed on mainnet.
- **Production is simulated in the browser.** The server stores what the game client reports for farming and harvesting. The contract guarantees the trade (escrow, payment, delivery, no double redemption); it does not prove an item was farmed fairly. Server-side validation of production is the next step.
- **Listings are bought whole.** There are no partial fills.
- **The contract pays for its own storage** from its balance; there is no per-user storage deposit.
- **The NPC trader is not built yet.** Its account exists, but no agent runs on it.

## Repository layout

- `contract/`: the NEAR market contract and its unit tests
- `src/app/`: pages and server routes (`exchange/` is the market UI, `api/` the server)
- `src/game/`: canvas engine, buildings, economy constants, persistence, contract client
- `src/lib/`: NEAR helpers (`near.ts` shared, `nearServer.ts` server-only), Supabase clients
- `supabase/schema.sql`: database schema

Built with Next.js, React, Zustand, GSAP, Supabase, `near-connect-hooks`, `near-api-js`, `near-sdk` (Rust) and `cargo-near`.

## License

[MIT](LICENSE)
