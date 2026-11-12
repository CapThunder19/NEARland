import { PlacedBuilding, Direction } from './buildings';
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

async function callBuildingsApi(method: 'POST' | 'DELETE', body: unknown): Promise<void> {
  try {
    const response = await fetch('/api/buildings', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.warn(`Building ${method === 'POST' ? 'save' : 'delete'} failed:`, response.status, await response.text());
    }
  } catch (error) {
    console.warn('Building save endpoint unavailable:', error);
  }
}

export async function loadBuildings(saveId?: string): Promise<PlacedBuilding[]> {
  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return [];

  try {
    const response = await fetch(`/api/buildings?saveId=${encodeURIComponent(activeSaveId)}`, { cache: 'no-store' });
    if (!response.ok) {
      console.warn('Buildings load failed:', response.status, await response.text());
      return [];
    }
    const { buildings } = (await response.json()) as { buildings: BuildingRow[] };
    return buildings.map(mapBuildingRow);
  } catch (error) {
    console.warn('Buildings load endpoint unavailable:', error);
    return [];
  }
}

export async function upsertBuilding(building: PlacedBuilding, saveId?: string): Promise<void> {
  return upsertBuildings([building], saveId);
}

export async function upsertBuildings(buildings: PlacedBuilding[], saveId?: string): Promise<void> {
  if (buildings.length === 0) return;
  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return;
  await callBuildingsApi('POST', { saveId: activeSaveId, buildings: buildings.map((b) => toBuildingRow(b, activeSaveId)) });
}

export async function deleteBuilding(buildingId: string, saveId?: string): Promise<void> {
  const activeSaveId = resolveSaveId(saveId);
  if (!activeSaveId) return;
  await callBuildingsApi('DELETE', { saveId: activeSaveId, id: buildingId });
}
