import { Camera, TILE_SIZE, worldToScreen, getVisibleBounds } from './camera';
import { renderGrid, renderCursorHighlight } from './grid';
import {
  PlacedBuilding,
  getBuildingDef,
  drawBuilding,
  Direction,
} from './buildings';
import { GameWorld, canPlace } from './placement';
import { InputState } from './input';
import { RECIPE_BUILDING_IDS, REQUIRED_WORKER_TYPE, type RecipeKey } from './economyConstants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BG_COLOR = '#0a0a0f';
const MINIMAP_BG = 'rgba(10, 10, 15, 0.85)';
const MINIMAP_BORDER = 'rgba(0, 212, 255, 0.3)';
const MINIMAP_VIEWPORT_COLOR = 'rgba(255, 255, 255, 0.8)';
const GHOST_ALPHA = 0.5;
const INVALID_OVERLAY = 'rgba(255, 40, 40, 0.35)';
const VALID_GLOW = 'rgba(40, 255, 80, 0.45)';
const VALID_GLOW_LINE = 2;

const RECIPE_DOT_COLOR: Record<RecipeKey, string> = {
  iron: '#c2c7d2',
  copper: '#f0a24a',
  gold: '#ffd646',
  'bread-wheat': '#f5d06a',
  'bread-potato': '#d7b58c',
  'bread-rice': '#b9f4c8',
  'tool-iron': '#c2c7d2',
  'tool-copper': '#f0a24a',
};

const WORKER_SPRITE_COLOR: Record<'farmer' | 'miner' | 'engineer', string> = {
  farmer: '#f5d06a',
  miner: '#c2c7d2',
  engineer: '#ff9d5c',
};

/** Small colored dot on a smelter indicating which recipe it's set to refine. */
function drawRecipeIndicator(
  ctx: CanvasRenderingContext2D,
  recipeKey: RecipeKey,
  screenX: number,
  screenY: number,
  totalSize: number,
): void {
  const r = totalSize * 0.06;
  ctx.save();
  ctx.fillStyle = RECIPE_DOT_COLOR[recipeKey];
  ctx.beginPath();
  ctx.arc(screenX + totalSize * 0.15, screenY + totalSize * 0.15, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export function render(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  world: GameWorld,
  input: InputState,
  time: number,
): void {
  // 1. Clear ---------------------------------------------------------------
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Compute visible tile bounds once for culling
  const bounds = getVisibleBounds(camera, canvasWidth, canvasHeight);

  // 2. Grid ----------------------------------------------------------------
  renderGrid(ctx, camera, canvasWidth, canvasHeight);

  // 3. Placed buildings ----------------------------------------------------
  const tileScreenSize = TILE_SIZE * camera.zoom;

  for (let i = 0; i < world.buildings.length; i++) {
    const b: PlacedBuilding = world.buildings[i];
    const def = getBuildingDef(b.defId);
    if (!def) continue;

    const size = def.size ?? 1;

    // Visibility check: does any tile of the building fall within bounds?
    const bRight = b.col + size;
    const bBottom = b.row + size;
    if (
      bRight <= bounds.minCol ||
      b.col >= bounds.maxCol ||
      bBottom <= bounds.minRow ||
      b.row >= bounds.maxRow
    ) {
      continue; // entirely off‑screen
    }

    const screen = worldToScreen(
      camera,
      canvasWidth,
      canvasHeight,
      b.col * TILE_SIZE,
      b.row * TILE_SIZE,
    );

    drawBuilding(
      ctx,
      def,
      screen.x,
      screen.y,
      tileScreenSize,
      b.direction,
      1.0
    );

    if (RECIPE_BUILDING_IDS.has(def.id) && b.recipeKey) {
      drawRecipeIndicator(ctx, b.recipeKey, screen.x, screen.y, size * tileScreenSize);
    }

    // Draw Worker Status & Sprite
    if (b.assignedWorkerId) {
      const totalSize = size * tileScreenSize;
      const cx = screen.x + totalSize / 2;
      const cy = screen.y + totalSize / 2;

      // Draw Worker Sprite (A small person at the bottom-right corner)
      const wx = screen.x + totalSize * 0.85;
      const wy = screen.y + totalSize * 0.85;
      const ws = Math.max(6, tileScreenSize * 0.25); // worker size
      
      const workerType = REQUIRED_WORKER_TYPE[def.id] ?? (def.id.startsWith('farm') ? 'farmer' : 'miner');
      ctx.fillStyle = WORKER_SPRITE_COLOR[workerType];
      
      // head
      ctx.beginPath();
      ctx.arc(wx, wy - ws * 1.2, ws * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // body
      ctx.fillRect(wx - ws * 0.5, wy - ws * 0.7, ws, ws);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx - ws * 0.5, wy - ws * 0.7, ws, ws);

      if (b.readyToHarvest) {
        // Draw bouncing "Ready" icon (inside top of building so it is not clipped)
        const bounce = Math.sin(time / 150) * 5;
        const iconR = tileScreenSize * 0.22;
        const iconY = screen.y + totalSize * 0.14 + iconR + bounce;
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(cx, iconY, iconR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${tileScreenSize * 0.35}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', cx, iconY);
      } else {
        // Draw progress bar along top inside the building footprint
        const barW = totalSize * 0.8;
        const barH = Math.max(4, tileScreenSize * 0.15);
        const barX = screen.x + totalSize * 0.1;
        const barY = screen.y + totalSize * 0.06;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, barY, barW, barH);
        
        ctx.fillStyle = '#00d4ff';
        ctx.fillRect(barX, barY, barW * (b.productionProgress / 100), barH);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
    }
  }

  // 4. Ghost preview -------------------------------------------------------
  if (input.selectedBuildingId) {
    const ghostDef = getBuildingDef(input.selectedBuildingId);
    if (ghostDef) {
      const ghostCol = input.mouseGridCol;
      const ghostRow = input.mouseGridRow;
      const ghostSize = ghostDef.size ?? 1;

      const ghostScreen = worldToScreen(
        camera,
        canvasWidth,
        canvasHeight,
        ghostCol * TILE_SIZE,
        ghostRow * TILE_SIZE,
      );

      const valid = canPlace(world, input.selectedBuildingId, ghostCol, ghostRow) && input.canAffordPlacement;

      // Draw ghost building at half opacity
      ctx.globalAlpha = GHOST_ALPHA;
      drawBuilding(
        ctx,
        ghostDef,
        ghostScreen.x,
        ghostScreen.y,
        tileScreenSize,
        input.currentDirection,
        GHOST_ALPHA
      );
      ctx.globalAlpha = 1.0;

      const totalSize = ghostSize * tileScreenSize;

      if (RECIPE_BUILDING_IDS.has(ghostDef.id) && input.currentRecipeKey) {
        drawRecipeIndicator(ctx, input.currentRecipeKey, ghostScreen.x, ghostScreen.y, totalSize);
      }

      if (!valid) {
        // Invalid: red overlay
        ctx.fillStyle = INVALID_OVERLAY;
        ctx.fillRect(ghostScreen.x, ghostScreen.y, totalSize, totalSize);
      } else {
        // Valid: subtle green glow border
        ctx.strokeStyle = VALID_GLOW;
        ctx.lineWidth = VALID_GLOW_LINE;
        ctx.strokeRect(
          ghostScreen.x - 1,
          ghostScreen.y - 1,
          totalSize + 2,
          totalSize + 2,
        );
      }
    }
  }

  // 5. Cursor highlight ----------------------------------------------------
  if (!input.selectedBuildingId) {
    renderCursorHighlight(
      ctx,
      camera,
      canvasWidth,
      canvasHeight,
      input.mouseGridCol,
      input.mouseGridRow,
    );
  }
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------

/** How many world tiles the minimap covers in each axis. */
const MINIMAP_TILE_SPAN = 200;

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  world: GameWorld,
  minimapX: number,
  minimapY: number,
  minimapSize: number,
): void {
  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = MINIMAP_BG;
  ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);

  // ── Coordinate helpers ──────────────────────────────────────────────────
  // Centre of the minimap in world‑tile coords
  const centreCol = camera.x / TILE_SIZE;
  const centreRow = camera.y / TILE_SIZE;
  const halfSpan = MINIMAP_TILE_SPAN / 2;

  const tileMinCol = centreCol - halfSpan;
  const tileMinRow = centreRow - halfSpan;

  const scale = minimapSize / MINIMAP_TILE_SPAN; // px per tile on minimap

  // Map a world‑tile coord to minimap pixel
  const toMX = (col: number) => minimapX + (col - tileMinCol) * scale;
  const toMY = (row: number) => minimapY + (row - tileMinRow) * scale;

  // ── Buildings ───────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(minimapX, minimapY, minimapSize, minimapSize);
  ctx.clip();

  for (let i = 0; i < world.buildings.length; i++) {
    const b: PlacedBuilding = world.buildings[i];
    const def = getBuildingDef(b.defId);
    if (!def) continue;

    const size = def.size ?? 1;
    const dotSize = Math.max(1, size * scale);

    ctx.fillStyle = def.color ?? '#ffffff';
    ctx.fillRect(toMX(b.col), toMY(b.row), dotSize, dotSize);
  }

  ctx.restore();

  // ── Viewport rectangle ─────────────────────────────────────────────────
  const visibleBounds = getVisibleBounds(camera, canvasWidth, canvasHeight);
  const vpX = toMX(visibleBounds.minCol);
  const vpY = toMY(visibleBounds.minRow);
  const vpW = (visibleBounds.maxCol - visibleBounds.minCol) * scale;
  const vpH = (visibleBounds.maxRow - visibleBounds.minRow) * scale;

  ctx.strokeStyle = MINIMAP_VIEWPORT_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(vpX, vpY, vpW, vpH);

  // ── Border ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = MINIMAP_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
}
