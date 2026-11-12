import { NextResponse } from 'next/server';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { isValidSaveId } from '../../../lib/saveId';

const COLUMNS = 'id, def_id, col, row, direction, assigned_worker_id, production_progress, ready_to_harvest, recipe_key, save_id';
const MAX_BUILDINGS = 2000;

type BuildingRow = {
  id: string;
  save_id: string;
  def_id: string;
  col: number;
  row: number;
  direction: string;
  assigned_worker_id: string | null;
  production_progress: number;
  ready_to_harvest: boolean;
  recipe_key: string | null;
};

function isBuildingRow(value: unknown, saveId: string): value is BuildingRow {
  const row = value as BuildingRow;
  return (
    typeof row === 'object' &&
    row !== null &&
    row.save_id === saveId &&
    typeof row.id === 'string' &&
    typeof row.def_id === 'string' &&
    Number.isInteger(row.col) &&
    Number.isInteger(row.row) &&
    typeof row.direction === 'string'
  );
}

export async function GET(request: Request) {
  const saveId = new URL(request.url).searchParams.get('saveId');
  if (!isValidSaveId(saveId)) return NextResponse.json({ error: 'Invalid saveId.' }, { status: 400 });
  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });

  const { data, error } = await db.from('buildings').select(COLUMNS).eq('save_id', saveId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ buildings: data ?? [] });
}

/** Upsert one or more buildings: body { saveId, buildings: BuildingRow[] } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { saveId?: string; buildings?: unknown[] } | null;
  const saveId = body?.saveId;
  if (!isValidSaveId(saveId) || !Array.isArray(body?.buildings) || body.buildings.length > MAX_BUILDINGS) {
    return NextResponse.json({ error: 'Invalid buildings payload.' }, { status: 400 });
  }
  if (!body.buildings.every((row) => isBuildingRow(row, saveId))) {
    return NextResponse.json({ error: 'Invalid building row.' }, { status: 400 });
  }
  if (body.buildings.length === 0) return NextResponse.json({ ok: true });

  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });

  const { error } = await db.from('buildings').upsert(body.buildings as BuildingRow[], { onConflict: 'save_id,id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Delete one building: body { saveId, id } */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { saveId?: string; id?: string } | null;
  if (!isValidSaveId(body?.saveId) || typeof body?.id !== 'string') {
    return NextResponse.json({ error: 'Invalid delete payload.' }, { status: 400 });
  }
  const db = getAdminClient();
  if (!db) return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 500 });

  const { error } = await db.from('buildings').delete().eq('save_id', body.saveId).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
