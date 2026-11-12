import { NextResponse } from 'next/server';
import { PRODUCE_KEYS, type ProduceKey } from '../../../../game/economyConstants';
import { saveIdForAccount } from '../../../../lib/near';
import { readSession, readWithdrawTx } from '../../../../lib/nearServer';
import { getAdminClient } from '../../../../lib/supabaseAdmin';

/**
 * Credit items the player burned with `withdraw_to_game` back to their in-game storehouse.
 * Each transaction hash can be redeemed exactly once (chain_claims primary key).
 */
export async function POST(request: Request) {
  const accountId = readSession(request);
  if (!accountId) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { txHash?: string } | null;
  const txHash = body?.txHash;
  if (!txHash || !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(txHash)) {
    return NextResponse.json({ error: 'Invalid transaction hash.' }, { status: 400 });
  }

  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });

  let items: { item: string; amount: number }[];
  try {
    items = await readWithdrawTx(txHash, accountId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read transaction.' }, { status: 400 });
  }

  const { error: claimError } = await db.from('chain_claims').insert({ tx_hash: txHash, account_id: accountId, kind: 'withdraw' });
  if (claimError) {
    const duplicate = claimError.code === '23505';
    return NextResponse.json(
      { error: duplicate ? 'This transaction was already redeemed.' : claimError.message },
      { status: duplicate ? 409 : 500 },
    );
  }

  const saveId = saveIdForAccount(accountId);
  const credited: { item: ProduceKey; amount: number }[] = [];
  for (const { item, amount } of items) {
    if (!PRODUCE_KEYS.includes(item as ProduceKey) || !Number.isInteger(amount) || amount <= 0) continue;
    const { error } = await db.rpc('credit_inventory_item', { p_save_id: saveId, p_item: item, p_amount: amount });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    credited.push({ item: item as ProduceKey, amount });
  }

  return NextResponse.json({ ok: true, credited });
}
