import { PlacedBuilding, Direction } from './buildings';
import { getSupabaseClient } from '../lib/supabaseClient';
import { getActiveSaveId } from '../store/gameStore';
import type { RecipeKey } from './economyConstants';

type BuildingRow = {
  id: string;
  save_id: string;
  def_id: string;
  col: number;
  row: number;
  direction: Direction;
  assigned_worker_id: string | null;
  production_progress: number;
  ready_to_harvest: boolean;
  recipe_key: RecipeKey | null;
};

function mapBuildingRow(row: BuildingRow): PlacedBuilding {
  return {
    id: row.id,
    defId: row.def_id,
    col: row.col,
    row: row.row,
    direction: row.direction,
    assignedWorkerId: row.assigned_worker_id ?? null,
    productionProgress: typeof row.production_progress === 'number' ? row.production_progress : 0,
    readyToHarvest: Boolean(row.ready_to_harvest),
    recipeKey: row.recipe_key ?? null,
  };
}

function toBuildingRow(building: PlacedBuilding, saveId: string): BuildingRow {
  return {
    id: building.id,
    save_id: saveId,
    def_id: building.defId,
    col: building.col,
    row: building.row,
    direction: building.direction,
    assigned_worker_id: building.assignedWorkerId,
    production_progress: building.productionProgress,
    ready_to_harvest: building.readyToHarvest,
    recipe_key: building.recipeKey,
  };
}

export function computeNextBuildingId(buildings: PlacedBuilding[]): number {
  let maxId = 0;
  for (const building of buildings) {
    const match = /^b(\d+)$/.exec(building.id);
    if (!match) continue;
    const numericId = Number(match[1]);
    if (numericId > maxId) maxId = numericId;
  }
  return maxId + 1;
}

function resolveSaveId(saveId?: string | null): string | null {
  return saveId ?? getActiveSaveId();
}

export async function loadBuildings(saveId?: string): Promise<PlacedBuilding[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return [];

  const { data, error } = await client
    .from('buildings')
    .select('id, def_id, col, row, direction, assigned_worker_id, production_progress, ready_to_harvest, recipe_key, save_id')
    .eq('save_id', activeSaveId);

  if (error) {
    console.warn('Supabase buildings load failed:', error.message);
    return [];
  }

  return (data ?? []).map(mapBuildingRow);
}

export async function upsertBuilding(building: PlacedBuilding, saveId?: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return;

  const { error } = await client
    .from('buildings')
    .upsert(toBuildingRow(building, activeSaveId), { onConflict: 'save_id,id' });

  if (error) {
    console.warn('Supabase building save failed:', error.message);
  }
}

export async function upsertBuildings(buildings: PlacedBuilding[], saveId?: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  if (buildings.length === 0) return;

  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return;

  const rows = buildings.map((building) => toBuildingRow(building, activeSaveId));

  const { error } = await client
    .from('buildings')
    .upsert(rows, { onConflict: 'save_id,id' });

  if (error) {
    console.warn('Supabase buildings bulk save failed:', error.message);
  }
}

export async function deleteBuilding(buildingId: string, saveId?: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return;

  const { error } = await client
    .from('buildings')
    .delete()
    .eq('save_id', activeSaveId)
    .eq('id', buildingId);

  if (error) {
    console.warn('Supabase building delete failed:', error.message);
  }
}
