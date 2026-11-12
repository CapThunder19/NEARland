// Client for the NEARland market contract (contract/src/lib.rs) and the game's chain-bridge API.
import type { NearContextValue } from 'near-connect-hooks';
import { NEAR_CONTRACT_ID, TGAS, loginMessage } from '../lib/near';
import type { ProduceKey } from './economyConstants';

export type { ProduceKey };

type Wallet = Pick<NearContextValue, 'viewFunction' | 'callFunction' | 'callFunctionRaw' | 'signNEP413Message'>;

export interface ContractListing {
  id: number;
  seller_id: string;
  item: ProduceKey;
  quantity: number;
  /** yoctoNEAR per unit */
  unit_price: string;
}

export interface ItemBalance {
  item: ProduceKey;
  balance: string;
}

export function listingTotal(listing: ContractListing): bigint {
  return BigInt(listing.unit_price) * BigInt(listing.quantity);
}

function txHashOf(outcome: unknown): string {
  const hash = (outcome as { transaction_outcome?: { id?: string } }).transaction_outcome?.id;
  if (!hash) throw new Error('Wallet did not return a transaction hash.');
  return hash;
}

function assertSuccess(outcome: unknown) {
  const status = (outcome as { status?: unknown }).status;
  if (typeof status === 'object' && status !== null && 'Failure' in status) {
    throw new Error('The transaction failed on-chain.');
  }
}

// ── Contract views ───────────────────────────────────────────────────────────

export async function loadListings(wallet: Wallet): Promise<ContractListing[]> {
  return (await wallet.viewFunction({
    contractId: NEAR_CONTRACT_ID,
    method: 'get_listings',
    args: { from_index: 0, limit: 100 },
  })) as ContractListing[];
}

export async function loadOnChainBalances(wallet: Wallet, accountId: string): Promise<ItemBalance[]> {
  return (await wallet.viewFunction({
    contractId: NEAR_CONTRACT_ID,
    method: 'balances_of',
    args: { account_id: accountId },
  })) as ItemBalance[];
}

// ── Contract calls (signed by the player's wallet) ───────────────────────────

export async function createListing(wallet: Wallet, item: ProduceKey, quantity: number, unitPriceYocto: bigint) {
  const outcome = await wallet.callFunctionRaw({
    contractId: NEAR_CONTRACT_ID,
    method: 'create_listing',
    args: { item, quantity, unit_price: unitPriceYocto.toString() },
    gas: (BigInt(30) * TGAS).toString(),
  });
  assertSuccess(outcome);
  return txHashOf(outcome);
}

export async function cancelListing(wallet: Wallet, listingId: number) {
  const outcome = await wallet.callFunctionRaw({
    contractId: NEAR_CONTRACT_ID,
    method: 'cancel_listing',
    args: { listing_id: listingId },
    gas: (BigInt(30) * TGAS).toString(),
  });
  assertSuccess(outcome);
  return txHashOf(outcome);
}

export async function buyListing(wallet: Wallet, listing: ContractListing) {
  const outcome = await wallet.callFunctionRaw({
    contractId: NEAR_CONTRACT_ID,
    method: 'buy_listing',
    args: { listing_id: listing.id },
    deposit: listingTotal(listing).toString(),
    gas: (BigInt(50) * TGAS).toString(),
  });
  assertSuccess(outcome);
  return txHashOf(outcome);
}

export async function withdrawToGameOnChain(wallet: Wallet, item: ProduceKey, amount: number) {
  const outcome = await wallet.callFunctionRaw({
    contractId: NEAR_CONTRACT_ID,
    method: 'withdraw_to_game',
    args: { item, amount: String(amount) },
    gas: (BigInt(30) * TGAS).toString(),
  });
  assertSuccess(outcome);
  return txHashOf(outcome);
}

// ── Server session (one NEP-413 signature per 24h) ───────────────────────────

const SESSION_KEY = 'nearland:session';

function readCachedSession(accountId: string): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accountId: string; token: string };
    return parsed.accountId === accountId ? parsed.token : null;
  } catch {
    return null;
  }
}

function clearCachedSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}

async function getSessionToken(wallet: Wallet, accountId: string): Promise<string> {
  const cached = readCachedSession(accountId);
  if (cached) return cached;

  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const issuedAt = Date.now();
  const signed = await wallet.signNEP413Message({
    message: loginMessage(accountId, issuedAt),
    recipient: NEAR_CONTRACT_ID,
    nonce,
  });

  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: signed.accountId || accountId,
      publicKey: signed.publicKey,
      signature: signed.signature,
      nonce: btoa(String.fromCharCode(...nonce)),
      issuedAt,
    }),
  });
  const json = (await response.json()) as { token?: string; error?: string };
  if (!response.ok || !json.token) throw new Error(json.error ?? 'Sign-in failed.');

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accountId, token: json.token }));
  } catch {
    // storage unavailable; the token is still used for this call
  }
  return json.token;
}

async function callBridge<T>(wallet: Wallet, accountId: string, path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getSessionToken(wallet, accountId);
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (response.status === 401 && attempt === 0) {
      clearCachedSession();
      continue;
    }
    if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status}).`);
    return json;
  }
  throw new Error('Sign-in failed.');
}

/** Game -> chain: server debits the saved storehouse and mints the items to the player's account. */
export function depositToChain(wallet: Wallet, accountId: string, item: ProduceKey, amount: number) {
  return callBridge<{ ok: true; txHash: string | null }>(wallet, accountId, '/api/chain/deposit', { item, amount });
}

/** Chain -> game: after `withdraw_to_game`, the server verifies the tx and credits the storehouse. */
export function redeemWithdrawal(wallet: Wallet, accountId: string, txHash: string) {
  return callBridge<{ ok: true; credited: { item: ProduceKey; amount: number }[] }>(
    wallet,
    accountId,
    '/api/chain/withdraw',
    { txHash },
  );
}
