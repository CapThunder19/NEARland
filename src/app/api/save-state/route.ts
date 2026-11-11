import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type InventoryRow = {
  save_id: string;
  money: number;
  wheat: number;
  potato: number;
  rice: number;
  iron_ore: number;
  copper_ore: number;
  diamond: number;
  iron_bar: number;
  copper_bar: number;
  gold_ore: number;
  gold_bar: number;
  bread: number;
  tool: number;
  village_name?: string;
};

type LegacyInventoryRow = {
  save_id: string;
  money: number;
  food: number;
};

type WorkerRow = {
  id: string;
  save_id: string;
  type: 'farmer' | 'miner' | 'engineer';
  assigned_building_id: string | null;
};

type SaveStateBody = {
  saveId?: string;
  inventory?: InventoryRow;
  workers?: WorkerRow[];
};

function toLegacyFood(inventory: InventoryRow): number {
  return inventory.wheat + inventory.potato + inventory.rice;
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SaveStateBody | null;

  if (!body?.saveId || !body.inventory) {
    return NextResponse.json({ error: 'Invalid save payload.' }, { status: 400 });
  }

  const client = getAdminClient();
  if (!client) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const inventoryToSave = body.inventory;

  const { error: inventoryError } = await client
    .from('inventory')
    .upsert(inventoryToSave, { onConflict: 'save_id' });

  if (inventoryError) {
    const legacyInventory: LegacyInventoryRow = {
      save_id: inventoryToSave.save_id,
      money: inventoryToSave.money,
      food: toLegacyFood(inventoryToSave),
    };

    const { error: legacyError } = await client
      .from('inventory')
      .upsert(legacyInventory, { onConflict: 'save_id' });

    if (legacyError) {
      return NextResponse.json(
        {
          error: `Inventory save failed: ${inventoryError.message}`,
          legacyError: `Legacy inventory save failed: ${legacyError.message}`,
        },
        { status: 500 }
      );
    }
  }

  if (Array.isArray(body.workers) && body.workers.length > 0) {
    const { error: workerError } = await client
      .from('workers')
      .upsert(body.workers, { onConflict: 'save_id,id' });

    if (workerError) {
      return NextResponse.json(
        { error: `Worker save failed: ${workerError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}