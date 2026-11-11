import { Camera, TILE_SIZE, worldToScreen, getVisibleBounds } from './camera';

const BG_COLOR = '#0d0d14';
const GRID_LINE_COLOR = 'rgba(255, 255, 255, 0.1)';
const CHUNK_LINE_COLOR = 'rgba(255, 255, 255, 0.2)';
const GRID_LINE_WIDTH = 1;
const CHUNK_LINE_WIDTH = 1.5;
const CHUNK_SIZE = 8; // every 8th line is a chunk boundary

const CURSOR_FILL = 'rgba(0, 212, 255, 0.3)';
const CURSOR_BORDER = 'rgba(0, 212, 255, 0.7)';
const CURSOR_BORDER_WIDTH = 2;

const TILESET_SRC = '/assets/GRASS+.png';
const TILESET_TILE_SIZE = 16;

const FORCED_TILE: [number, number] = [0, 0];

let tilesetImage: HTMLImageElement | null = null;
let tilesetReady = false;

function ensureTileset(): void {
  if (tilesetImage || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = TILESET_SRC;
  img.decoding = 'async';
  img.onload = () => {
    tilesetReady = true;
  };
  tilesetImage = img;
}

function chooseTile(col: number, row: number): [number, number] {
  return FORCED_TILE;
}

function renderTerrain(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ensureTileset();
  if (!tilesetReady || !tilesetImage) return;

  const bounds = getVisibleBounds(camera, canvasWidth, canvasHeight);
  const tileScreenSize = TILE_SIZE * camera.zoom;

  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      const screen = worldToScreen(camera, canvasWidth, canvasHeight, col * TILE_SIZE, row * TILE_SIZE);
      const [tx, ty] = chooseTile(col, row);
      ctx.drawImage(
        tilesetImage,
        tx * TILESET_TILE_SIZE,
        ty * TILESET_TILE_SIZE,
        TILESET_TILE_SIZE,
        TILESET_TILE_SIZE,
        screen.x,
        screen.y,
        tileScreenSize,
        tileScreenSize,
      );
    }
  }
}

/**
 * Render the infinite grid background.
 * Only draws grid lines for tiles currently visible in the viewport.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): void {
  // 1. Fill the entire canvas with the dark background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 1.5 Draw terrain tiles
  renderTerrain(ctx, camera, canvasWidth, canvasHeight);

  // 2. Determine which tiles are visible
  const bounds = getVisibleBounds(camera, canvasWidth, canvasHeight);

  // 3. Draw vertical grid lines
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    const worldX = col * TILE_SIZE;
    const screen = worldToScreen(camera, canvasWidth, canvasHeight, worldX, 0);
    const sx = Math.round(screen.x) + 0.5; // offset for crisp 1px lines

    const isChunk = col % CHUNK_SIZE === 0;
    ctx.strokeStyle = isChunk ? CHUNK_LINE_COLOR : GRID_LINE_COLOR;
    ctx.lineWidth = isChunk ? CHUNK_LINE_WIDTH : GRID_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, canvasHeight);
    ctx.stroke();
  }

  // 4. Draw horizontal grid lines
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    const worldY = row * TILE_SIZE;
    const screen = worldToScreen(camera, canvasWidth, canvasHeight, 0, worldY);
    const sy = Math.round(screen.y) + 0.5;

    const isChunk = row % CHUNK_SIZE === 0;
    ctx.strokeStyle = isChunk ? CHUNK_LINE_COLOR : GRID_LINE_COLOR;
    ctx.lineWidth = isChunk ? CHUNK_LINE_WIDTH : GRID_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvasWidth, sy);
    ctx.stroke();
  }
}

/**
 * Highlight the grid tile under the cursor with a subtle glowing fill and border.
 */
export function renderCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  gridCol: number,
  gridRow: number,
): void {
  // Convert tile top-left corner from world to screen coordinates
  const worldX = gridCol * TILE_SIZE;
  const worldY = gridRow * TILE_SIZE;
  const topLeft = worldToScreen(camera, canvasWidth, canvasHeight, worldX, worldY);

  // Tile size on screen (accounts for zoom)
  const tileScreenSize = TILE_SIZE * camera.zoom;

  // Fill
  ctx.fillStyle = CURSOR_FILL;
  ctx.fillRect(topLeft.x, topLeft.y, tileScreenSize, tileScreenSize);

  // Border (inset slightly so it doesn't overlap neighboring tiles)
  ctx.strokeStyle = CURSOR_BORDER;
  ctx.lineWidth = CURSOR_BORDER_WIDTH;
  ctx.strokeRect(topLeft.x, topLeft.y, tileScreenSize, tileScreenSize);
}
