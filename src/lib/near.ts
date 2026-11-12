// NEAR network configuration and unit helpers shared across the client.

export type NearNetwork = 'mainnet' | 'testnet';

export const NEAR_NETWORK: NearNetwork =
  process.env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

/** Account the NEARland market contract is deployed to. */
export const NEAR_CONTRACT_ID = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID ?? '';

export const TGAS = BigInt(10) ** BigInt(12);

export const NEAR_RPC_URLS: Record<NearNetwork, string[]> = {
  mainnet: ['https://free.rpc.fastnear.com', 'https://rpc.mainnet.near.org'],
  testnet: ['https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org'],
};

export const NEAR_EXPLORER_URL: Record<NearNetwork, string> = {
  mainnet: 'https://nearblocks.io',
  testnet: 'https://testnet.nearblocks.io',
};

export function explorerTxUrl(txHash: string): string {
  return `${NEAR_EXPLORER_URL[NEAR_NETWORK]}/txns/${txHash}`;
}

export function explorerAccountUrl(accountId: string): string {
  return `${NEAR_EXPLORER_URL[NEAR_NETWORK]}/address/${accountId}`;
}

const YOCTO_DECIMALS = 24;
const YOCTO_PER_NEAR = BigInt(10) ** BigInt(YOCTO_DECIMALS);

/** Parse a human NEAR amount such as "0.25" into yoctoNEAR. Throws on invalid input. */
export function parseNear(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid NEAR amount: ${amount}`);
  }
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > YOCTO_DECIMALS) {
    throw new Error('Too many decimal places for NEAR (max 24).');
  }
  return BigInt(whole) * YOCTO_PER_NEAR + BigInt(fraction.padEnd(YOCTO_DECIMALS, '0'));
}

/** Format yoctoNEAR as a human NEAR string, trimmed to `maxDecimals` places. */
export function formatNear(yocto: bigint | string, maxDecimals = 5): string {
  const value = typeof yocto === 'string' ? BigInt(yocto) : yocto;
  const whole = value / YOCTO_PER_NEAR;
  const fraction = (value % YOCTO_PER_NEAR).toString().padStart(YOCTO_DECIMALS, '0').slice(0, maxDecimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Shorten long (e.g. 64-char implicit) account IDs for display; named accounts stay readable. */
export function shortAccountId(accountId: string): string {
  if (accountId.length <= 24) return accountId;
  return `${accountId.slice(0, 8)}...${accountId.slice(-8)}`;
}

/** Text the player signs (NEP-413, no gas) to start a server session. Shared by client and server. */
export function loginMessage(accountId: string, issuedAt: number): string {
  return `Sign in to NEARland as ${accountId} at ${new Date(issuedAt).toISOString()}`;
}

/** Supabase save key for a NEAR account. */
export function saveIdForAccount(accountId: string): string {
  return `near:${accountId.toLowerCase()}`;
}
