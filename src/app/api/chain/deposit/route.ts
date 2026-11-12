import { NextResponse } from 'next/server';
import { PRODUCE_KEYS, type ProduceKey } from '../../../../game/economyConstants';
import { NEAR_CONTRACT_ID, TGAS, saveIdForAccount } from '../../../../lib/near';
import { getGameAccount, readSession } from '../../../../lib/nearServer';
import { getAdminClient } from '../../../../lib/supabaseAdmin';

const MAX_DEPOSIT = 10_000;

/**
 * Move items from the player's saved in-game storehouse onto the NEAR contract.
 * The server debits Supabase atomically, then the game account mints the same amount on-chain.
 * If minting fails the debit is reversed.
 */
export async function POST(request: Request) {
  const accountId = readSession(request);
  if (!accountId) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { item?: string; amount?: number } | null;
  const item = body?.item as ProduceKey | undefined;
  const amount = body?.amount;
  if (!item || !PRODUCE_KEYS.includes(item) || !Number.isInteger(amount) || !amount || amount <= 0 || amount > MAX_DEPOSIT) {
    return NextResponse.json({ error: 'Choose a valid item and amount.' }, { status: 400 });
  }

  const db = getAdminClient();
  const game = getGameAccount();
  if (!db || !game || !NEAR_CONTRACT_ID) {
    return NextResponse.json({ error: 'Chain bridge is not configured on the server.' }, { status: 500 });
  }

  const saveId = saveIdForAccount(accountId);
  const { data: debited, error: debitError } = await db.rpc('debit_inventory_item', {
    p_save_id: saveId,
    p_item: item,
    p_amount: amount,
  });
  if (debitError) return NextResponse.json({ error: debitError.message }, { status: 500 });
  if (!debited) return NextResponse.json({ error: `Not enough ${item} in your saved storehouse.` }, { status: 409 });

  try {
    const outcome = await game.callFunctionRaw({
      contractId: NEAR_CONTRACT_ID,
      methodName: 'mint',
      args: { account_id: accountId, item, amount: String(amount) },
      gas: BigInt(30) * TGAS,
    });
    const txHash = (outcome as unknown as { transaction_outcome?: { id?: string } }).transaction_outcome?.id ?? null;
    return NextResponse.json({ ok: true, item, amount, txHash });
  } catch (error) {
    await db.rpc('credit_inventory_item', { p_save_id: saveId, p_item: item, p_amount: amount });
    const message = error instanceof Error ? error.message : 'Minting failed.';
    return NextResponse.json({ error: `Could not mint on NEAR: ${message}` }, { status: 502 });
  }
}
