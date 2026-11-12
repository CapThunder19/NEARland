// Server-only NEAR helpers: the game account that mints items, NEP-413 login verification,
// session tokens, and transaction verification for withdrawals.
import 'server-only';
import crypto from 'node:crypto';
import { Account, JsonRpcProvider, baseDecode, type KeyPairString } from 'near-api-js';
import { NEAR_CONTRACT_ID, NEAR_NETWORK, NEAR_RPC_URLS, loginMessage } from './near';

export const provider = new JsonRpcProvider({ url: NEAR_RPC_URLS[NEAR_NETWORK][0] });

export function getGameAccount(): Account | null {
  const accountId = process.env.NEAR_GAME_ACCOUNT_ID;
  const privateKey = process.env.NEAR_GAME_PRIVATE_KEY;
  if (!accountId || !privateKey) return null;
  return new Account(accountId, provider, privateKey as KeyPairString);
}

// ── NEP-413 signed-message verification ──────────────────────────────────────

const NEP413_TAG = 2 ** 31 + 413;
export const LOGIN_MAX_AGE_MS = 10 * 60 * 1000;

function borshString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
}

function nep413Hash(message: string, nonce: Buffer, recipient: string): Buffer {
  const tag = Buffer.alloc(4);
  tag.writeUInt32LE(NEP413_TAG);
  const payload = Buffer.concat([tag, borshString(message), nonce, borshString(recipient), Buffer.from([0])]);
  return crypto.createHash('sha256').update(payload).digest();
}

function ed25519Verify(publicKey: string, data: Buffer, signature: Buffer): boolean {
  if (!publicKey.startsWith('ed25519:')) return false;
  const raw = Buffer.from(baseDecode(publicKey.slice('ed25519:'.length)));
  if (raw.length !== 32) return false;
  const key = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') }, format: 'jwk' });
  return crypto.verify(null, data, key, signature);
}

function decodeSignature(signature: string): Buffer {
  // Wallets return base64; some return "ed25519:<base58>".
  if (signature.startsWith('ed25519:')) return Buffer.from(baseDecode(signature.slice('ed25519:'.length)));
  return Buffer.from(signature, 'base64');
}

async function isFullAccessKey(accountId: string, publicKey: string): Promise<boolean> {
  try {
    const result = (await provider.query({
      request_type: 'view_access_key',
      account_id: accountId,
      public_key: publicKey,
      finality: 'final',
    })) as unknown as { permission?: unknown };
    return result.permission === 'FullAccess';
  } catch {
    return false;
  }
}

export async function verifyLogin(params: {
  accountId: string;
  publicKey: string;
  signature: string;
  nonce: string; // base64, 32 bytes
  issuedAt: number;
}): Promise<string | null> {
  const { accountId, publicKey, signature, nonce, issuedAt } = params;
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > LOGIN_MAX_AGE_MS) return 'Login request expired.';
  const nonceBytes = Buffer.from(nonce, 'base64');
  if (nonceBytes.length !== 32) return 'Invalid nonce.';

  const hash = nep413Hash(loginMessage(accountId, issuedAt), nonceBytes, NEAR_CONTRACT_ID);
  if (!ed25519Verify(publicKey, hash, decodeSignature(signature))) return 'Signature does not match.';
  if (!(await isFullAccessKey(accountId, publicKey))) return 'Key is not a full-access key of this account.';
  return null;
}

// ── Session tokens (HMAC, 24h) ───────────────────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.NEARLAND_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('NEARLAND_SESSION_SECRET is not configured.');
  return secret;
}

export function issueSession(accountId: string): string {
  const body = Buffer.from(JSON.stringify({ a: accountId, e: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const mac = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** Returns the account ID the session belongs to, or null if invalid/expired. */
export function readSession(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { a: string; e: number };
    return typeof a === 'string' && Date.now() < e ? a : null;
  } catch {
    return null;
  }
}

// ── Withdrawal transaction verification ──────────────────────────────────────

type TxStatus = {
  status: unknown;
  transaction: { signer_id: string; receiver_id: string };
  receipts_outcome: { outcome: { logs: string[]; executor_id: string; status: unknown } }[];
};

/** Reads a finished `withdraw_to_game` transaction and returns the burned items. */
export async function readWithdrawTx(txHash: string, accountId: string): Promise<{ item: string; amount: number }[]> {
  const tx = (await provider.viewTransactionStatus({ txHash, accountId, waitUntil: 'FINAL' })) as unknown as TxStatus;
  if (tx.transaction.signer_id !== accountId) throw new Error('Transaction was not signed by this account.');
  if (tx.transaction.receiver_id !== NEAR_CONTRACT_ID) throw new Error('Transaction did not call the NEARland contract.');
  if (typeof tx.status === 'object' && tx.status !== null && 'Failure' in tx.status) throw new Error('Transaction failed.');

  const items: { item: string; amount: number }[] = [];
  for (const receipt of tx.receipts_outcome) {
    if (receipt.outcome.executor_id !== NEAR_CONTRACT_ID) continue;
    for (const log of receipt.outcome.logs) {
      if (!log.startsWith('EVENT_JSON:')) continue;
      const event = JSON.parse(log.slice('EVENT_JSON:'.length)) as {
        standard: string;
        event: string;
        data: { owner_id: string; item: string; amount: string }[];
      };
      if (event.standard !== 'nearland' || event.event !== 'withdraw_to_game') continue;
      for (const entry of event.data) {
        if (entry.owner_id !== accountId) continue;
        items.push({ item: entry.item, amount: Number(entry.amount) });
      }
    }
  }
  if (items.length === 0) throw new Error('No withdraw_to_game event found in this transaction.');
  return items;
}
