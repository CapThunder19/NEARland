import { NextResponse } from 'next/server';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { isValidSaveId } from '../../../lib/saveId';

const INVENTORY_COLUMNS =
  'save_id, money, wheat, potato, rice, iron_ore, copper_ore, diamond, iron_bar, copper_bar, gold_ore, gold_bar, bread, tool, village_name, food, level';

/** Load a player's inventory row and workers. The browser never reads Supabase directly. */
export async function GET(request: Request) {
  const saveId = new URL(request.url).searchParams.get('saveId');
  if (!isValidSaveId(saveId)) return NextResponse.json({ error: 'Invalid saveId.' }, { status: 400 });

  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });

  const [inventory, workers] = await Promise.all([
    db.from('inventory').select(INVENTORY_COLUMNS).eq('save_id', saveId).maybeSingle(),
    db.from('workers').select('id, type, assigned_building_id, save_id').eq('save_id', saveId),
  ]);
  if (inventory.error) return NextResponse.json({ error: inventory.error.message }, { status: 500 });
  if (workers.error) return NextResponse.json({ error: workers.error.message }, { status: 500 });

  return NextResponse.json({ inventory: inventory.data, workers: workers.data ?? [] });
}
