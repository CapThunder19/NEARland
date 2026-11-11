// ── Placement Logic & Collision Detection ────────────────────────────────────

import { PlacedBuilding, BuildingDef, getBuildingDef, Direction } from './buildings';
import type { RecipeKey } from './economyConstants';

// ── Game World State ─────────────────────────────────────────────────────────

export interface GameWorld {
  buildings: PlacedBuilding[];
  nextBuildingId: number;
}

/** Create a fresh, empty game world. */
export function createGameWorld(): GameWorld {
  return {
    buildings: [],
    nextBuildingId: 1,
  };
}

// ── Tile Occupancy ───────────────────────────────────────────────────────────

/**
 * Check whether a placed building's footprint covers the given tile.
 * A building at (col, row) with size N occupies tiles
 * from (col, row) to (col + N - 1, row + N - 1).
 */
export function occupiesTile(
  building: PlacedBuilding,
  col: number,
  row: number,
): boolean {
  const def = getBuildingDef(building.defId);
  if (!def) return false;

  return (
    col >= building.col &&
    col < building.col + def.size &&
    row >= building.row &&
    row < building.row + def.size
  );
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * Find the placed building whose footprint covers the given tile, or null.
 */
export function getBuildingAt(
  world: GameWorld,
  col: number,
  row: number,
): PlacedBuilding | null {
  for (let i = 0; i < world.buildings.length; i++) {
    if (occupiesTile(world.buildings[i], col, row)) {
      return world.buildings[i];
    }
  }
  return null;
}

// ── Collision Detection ──────────────────────────────────────────────────────

/**
 * Check if a building with the given defId can be placed at (col, row)
 * without overlapping any existing building.
 */
export function canPlace(
  world: GameWorld,
  defId: string,
  col: number,
  row: number,
): boolean {
  const def = getBuildingDef(defId);
  if (!def) return false;

  const newSize = def.size;

  // For every existing building, check AABB overlap with the proposed footprint
  for (let i = 0; i < world.buildings.length; i++) {
    const existing = world.buildings[i];
    const existingDef = getBuildingDef(existing.defId);
    if (!existingDef) continue;

    // AABB overlap test:
    // Building A occupies [col, col + newSize)  x  [row, row + newSize)
    // Building B occupies [existing.col, existing.col + existingDef.size)  x  …
    const noOverlap =
      col + newSize <= existing.col ||
      existing.col + existingDef.size <= col ||
      row + newSize <= existing.row ||
      existing.row + existingDef.size <= row;

    if (!noOverlap) return false;
  }

  return true;
}

// ── Placement ────────────────────────────────────────────────────────────────

/**
 * Place a building into the world if valid. Returns the new PlacedBuilding,
 * or null if placement is blocked.
 */
export function placeBuilding(
  world: GameWorld,
  defId: string,
  col: number,
  row: number,
  direction: Direction,
  recipeKey: RecipeKey | null = null,
): PlacedBuilding | null {
  if (!canPlace(world, defId, col, row)) return null;

  const building: PlacedBuilding = {
    id: `b${world.nextBuildingId}`,
    defId,
    col,
    row,
    direction,
    assignedWorkerId: null,
    productionProgress: 0,
    readyToHarvest: false,
    recipeKey,
  };

  world.nextBuildingId++;
  world.buildings.push(building);
  return building;
}

// ── Removal ──────────────────────────────────────────────────────────────────

/**
 * Remove any building whose footprint covers (col, row).
 * Returns the removed building, or null if nothing was there.
 */
export function removeBuilding(
  world: GameWorld,
  col: number,
  row: number,
): PlacedBuilding | null {
  for (let i = 0; i < world.buildings.length; i++) {
    if (occupiesTile(world.buildings[i], col, row)) {
      const removed = world.buildings[i];
      world.buildings.splice(i, 1);
      return removed;
    }
  }
  return null;
}
