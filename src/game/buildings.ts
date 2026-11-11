// ── Building Definitions & Procedural Rendering ──────────────────────────────

import type { RecipeKey } from './economyConstants';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface BuildingDef {
  id: string;
  name: string;
  size: number; // NxN tiles
  color: string; // primary fill color
  accentColor: string; // detail/icon color
  hotkey: string; // '1' through '8'
  description: string;
  cost: number;
  minLevel: number;
}

export interface PlacedBuilding {
  id: string; // unique instance id
  defId: string; // references BuildingDef.id
  col: number; // grid column (top-left corner)
  row: number; // grid row (top-left corner)
  direction: Direction;
  assignedWorkerId: string | null;
  productionProgress: number; // 0 to 100
  readyToHarvest: boolean;
  recipeKey: RecipeKey | null; // recipe-building instances only (smelter/bakery/toolsmith)
}

type SpriteCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// ── 8 Building Definitions ───────────────────────────────────────────────────

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'farm-wheat',
    name: 'Carrot Farm',
    size: 3,
    color: '#7b6a2e',
    accentColor: '#f5d06a',
    hotkey: '1',
    description: 'Grows carrots for food and trade',
    cost: 40,
    minLevel: 1,
  },
  {
    id: 'farm-potato',
    name: 'Rice Farm',
    size: 3,
    color: '#5a3f24',
    accentColor: '#d7b58c',
    hotkey: '2',
    description: 'Grows rice for staples',
    cost: 50,
    minLevel: 1,
  },
  {
    id: 'farm-rice',
    name: 'Cabbage Farm',
    size: 3,
    color: '#214a3e',
    accentColor: '#b9f4c8',
    hotkey: '3',
    description: 'Grows cabbage in wet fields',
    cost: 60,
    minLevel: 1,
  },
  {
    id: 'mine-copper',
    name: 'Copper Mine',
    size: 7,
    color: '#7a3f1f',
    accentColor: '#f0a24a',
    hotkey: '4',
    description: 'Extracts copper ore',
    cost: 90,
    minLevel: 2,
  },
  {
    id: 'mine-iron',
    name: 'Iron Mine',
    size: 7,
    color: '#4a4f5a',
    accentColor: '#c2c7d2',
    hotkey: '5',
    description: 'Extracts iron ore',
    cost: 110,
    minLevel: 2,
  },
  {
    id: 'mine-diamond',
    name: 'Diamond Mine',
    size: 7,
    color: '#17384f',
    accentColor: '#7ed1ff',
    hotkey: '6',
    description: 'Extracts rare diamonds',
    cost: 180,
    minLevel: 3,
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    size: 4,
    color: '#3d3d45',
    accentColor: '#b4b4c8',
    hotkey: '', // never placeable — filtered from the Toolbar, not wired into any hotkey map
    description: 'Stores and displays your global resources',
    cost: 0,
    minLevel: 1,
  },
  {
    id: 'smelter',
    name: 'Smelter',
    size: 5,
    color: '#5c3a2e',
    accentColor: '#ff7b3d',
    hotkey: '8',
    description: 'Refines raw ore into valuable bars. Choose a recipe with C before placing.',
    cost: 250,
    minLevel: 2,
  },
  {
    id: 'mine-gold',
    name: 'Gold Mine',
    size: 7,
    color: '#5c4a12',
    accentColor: '#ffd646',
    hotkey: '7',
    description: 'Extracts precious gold ore',
    cost: 220,
    minLevel: 4,
  },
  {
    id: 'bakery',
    name: 'Bakery',
    size: 4,
    color: '#6b4226',
    accentColor: '#f4c98b',
    hotkey: '9',
    description: 'Bakes crops into valuable bread. Choose a recipe with C before placing.',
    cost: 180,
    minLevel: 5,
  },
  {
    id: 'toolsmith',
    name: 'Toolsmith',
    size: 4,
    color: '#3a3a42',
    accentColor: '#cfd6e0',
    hotkey: '0',
    description: 'Forges bars into tools. Choose a recipe with C before placing.',
    cost: 350,
    minLevel: 6,
  },
];

// ── Lookup Helper ────────────────────────────────────────────────────────────

export function getBuildingDef(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

const FARM_SPRITE_SRC = '/assets/image.png';
/** Inset inside the building footprint so crops are not clipped at tile edges. */
const FARM_SPRITE_INSET = 0.08;
const FARM_SPRITE_GRID = 1;
/** Crops aligned to centered 2×2 soil patches in image.png (reference layout). */
const FARM_SPRITE_CROPS: Record<'farm-wheat' | 'farm-potato' | 'farm-rice', SpriteCrop> = {
  'farm-wheat': { x: 300, y: 296, w: 116, h: 116 },
  'farm-potato': { x: 532, y: 240, w: 112, h: 112 },
  'farm-rice': { x: 422, y: 476, w: 118, h: 118 },
};

let farmSpriteImage: HTMLImageElement | null = null;
let farmSpriteReady = false;

function ensureFarmSprites(): void {
  if (farmSpriteImage || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = FARM_SPRITE_SRC;
  img.decoding = 'async';
  img.onload = () => {
    farmSpriteReady = true;
  };
  farmSpriteImage = img;
}

function drawFarmSprite(
  ctx: CanvasRenderingContext2D,
  crop: SpriteCrop,
  sx: number,
  sy: number,
  s: number,
): boolean {
  ensureFarmSprites();
  if (!farmSpriteReady || !farmSpriteImage) return false;

  const inset = s * FARM_SPRITE_INSET;
  const box = s - inset * 2;
  const aspect = crop.w / crop.h;
  let dw = box;
  let dh = box;
  if (aspect > 1) {
    dh = box / aspect;
  } else if (aspect < 1) {
    dw = box * aspect;
  }
  const dx = sx + inset + (box - dw) / 2;
  const dy = sy + inset + (box - dh) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (FARM_SPRITE_GRID <= 1) {
    ctx.drawImage(farmSpriteImage, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);
  } else {
    const gap = box * 0.06;
    const cell = (box - gap) / FARM_SPRITE_GRID;
    for (let row = 0; row < FARM_SPRITE_GRID; row++) {
      for (let col = 0; col < FARM_SPRITE_GRID; col++) {
        const tileX = sx + inset + col * (cell + gap);
        const tileY = sy + inset + row * (cell + gap);
        ctx.drawImage(
          farmSpriteImage,
          crop.x,
          crop.y,
          crop.w,
          crop.h,
          tileX,
          tileY,
          cell,
          cell,
        );
      }
    }
  }
  ctx.restore();
  return true;
}

function isFarmBuilding(defId: string): defId is keyof typeof FARM_SPRITE_CROPS {
  return defId === 'farm-wheat' || defId === 'farm-potato' || defId === 'farm-rice';
}

function tryDrawFarmSprite(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): boolean {
  if (!isFarmBuilding(def.id)) return false;
  return drawFarmSprite(ctx, FARM_SPRITE_CROPS[def.id], sx, sy, s);
}

// Mines sprite sheet (contains copper / iron / diamond icons)
const MINE_SPRITE_SRC = '/assets/mines.png';
const MINE_SPRITE_INSET = 0.08;

let mineSpriteImage: HTMLImageElement | null = null;
let mineSpriteReady = false;
let mineSpriteCellW = 0;
let mineSpriteCellH = 0;

function ensureMineSprites(): void {
  if (mineSpriteImage || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = MINE_SPRITE_SRC;
  img.decoding = 'async';
  img.onload = () => {
    // layout: three icons horizontally (copper, iron, diamond)
    mineSpriteCellW = Math.floor(img.width / 3);
    mineSpriteCellH = img.height;
    mineSpriteReady = true;
  };
  mineSpriteImage = img;
}

function drawMineSprite(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): boolean {
  ensureMineSprites();
  if (!mineSpriteReady || !mineSpriteImage || mineSpriteCellW === 0) return false;

  const idx = def.id === 'mine-copper' ? 0 : def.id === 'mine-iron' ? 1 : def.id === 'mine-diamond' ? 2 : -1;
  if (idx < 0) return false;

  const cropX = idx * mineSpriteCellW;
  const cropY = 0;
  const cropW = mineSpriteCellW;
  const cropH = mineSpriteCellH;

  const inset = s * MINE_SPRITE_INSET;
  const box = s - inset * 2;
  const aspect = cropW / cropH;
  let dw = box;
  let dh = box;
  if (aspect > 1) {
    dh = box / aspect;
  } else if (aspect < 1) {
    dw = box * aspect;
  }
  const dx = sx + inset + (box - dw) / 2;
  const dy = sy + inset + (box - dh) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mineSpriteImage, cropX, cropY, cropW, cropH, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

// Individual iron mine sprite (optional override)
const IRON_SPRITE_SRC = '/assets/ironmine.png';
const IRON_SPRITE_INSET = 0.08;

let ironSpriteImage: HTMLImageElement | null = null;
let ironSpriteReady = false;

function ensureIronSprite(): void {
  if (ironSpriteImage || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = IRON_SPRITE_SRC;
  img.decoding = 'async';
  img.onload = () => {
    ironSpriteReady = true;
  };
  ironSpriteImage = img;
}

function drawIronSprite(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): boolean {
  ensureIronSprite();
  if (!ironSpriteReady || !ironSpriteImage) return false;

  const inset = s * IRON_SPRITE_INSET;
  const box = s - inset * 2;
  const aspect = ironSpriteImage.width / ironSpriteImage.height;
  let dw = box;
  let dh = box;
  if (aspect > 1) {
    dh = box / aspect;
  } else if (aspect < 1) {
    dw = box * aspect;
  }
  const dx = sx + inset + (box - dw) / 2;
  const dy = sy + inset + (box - dh) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ironSpriteImage, 0, 0, ironSpriteImage.width, ironSpriteImage.height, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

// Individual copper mine sprite (optional override)
const COPPER_SPRITE_SRC = '/assets/coppermine.png';
const COPPER_SPRITE_INSET = 0.08;

let copperSpriteImage: HTMLImageElement | null = null;
let copperSpriteReady = false;

function ensureCopperSprite(): void {
  if (copperSpriteImage || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = COPPER_SPRITE_SRC;
  img.decoding = 'async';
  img.onload = () => {
    copperSpriteReady = true;
  };
  copperSpriteImage = img;
}

function drawCopperSprite(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): boolean {
  ensureCopperSprite();
  if (!copperSpriteReady || !copperSpriteImage) return false;

  const inset = s * COPPER_SPRITE_INSET;
  const box = s - inset * 2;
  const aspect = copperSpriteImage.width / copperSpriteImage.height;
  let dw = box;
  let dh = box;
  if (aspect > 1) {
    dh = box / aspect;
  } else if (aspect < 1) {
    dw = box * aspect;
  }
  const dx = sx + inset + (box - dw) / 2;
  const dy = sy + inset + (box - dh) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(copperSpriteImage, 0, 0, copperSpriteImage.width, copperSpriteImage.height, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

// Individual diamond mine sprite (optional override)
const DIAMOND_SPRITE_SRC = '/assets/diamondmine.png';
const DIAMOND_SPRITE_INSET = 0.08;

let diamondSpriteImage: HTMLImageElement | null = null;
let diamondSpriteReady = false;

function ensureDiamondSprite(): void {
  if (diamondSpriteImage || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = DIAMOND_SPRITE_SRC;
  img.decoding = 'async';
  img.onload = () => {
    diamondSpriteReady = true;
  };
  diamondSpriteImage = img;
}

function drawDiamondSprite(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): boolean {
  ensureDiamondSprite();
  if (!diamondSpriteReady || !diamondSpriteImage) return false;

  const inset = s * DIAMOND_SPRITE_INSET;
  const box = s - inset * 2;
  const aspect = diamondSpriteImage.width / diamondSpriteImage.height;
  let dw = box;
  let dh = box;
  if (aspect > 1) {
    dh = box / aspect;
  } else if (aspect < 1) {
    dw = box * aspect;
  }
  const dx = sx + inset + (box - dw) / 2;
  const dy = sy + inset + (box - dh) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(diamondSpriteImage, 0, 0, diamondSpriteImage.width, diamondSpriteImage.height, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

// ── Internal Drawing Utilities ───────────────────────────────────────────────

/** Draw a rounded rectangle path (does NOT stroke/fill). */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Darken a hex colour by a ratio (0‑1). */
function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

// ── Base Shape (shared by all buildings) ─────────────────────────────────────

function drawBaseRect(
  ctx: CanvasRenderingContext2D,
  color: string,
  sx: number,
  sy: number,
  totalSize: number,
  radius: number,
): void {
  const pad = totalSize * 0.04; // small inset so buildings don't touch
  const x = sx + pad;
  const y = sy + pad;
  const w = totalSize - pad * 2;
  const h = totalSize - pad * 2;

  // Main fill
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();

  // Subtle bottom‑darkened gradient overlay
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = grad;
  ctx.fill();

  // Dark border
  roundedRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = darken(color, 0.45);
  ctx.lineWidth = Math.max(1, totalSize * 0.03);
  ctx.stroke();
}

// ── Per‑building Detail Renderers ────────────────────────────────────────────

function drawMinerIron(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(2, s * 0.04);
  ctx.lineCap = 'round';

  // Pickaxe icon – two diagonal lines forming an X with a handle
  const extent = s * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - extent, cy - extent);
  ctx.lineTo(cx + extent, cy + extent);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + extent, cy - extent);
  ctx.lineTo(cx - extent, cy + extent);
  ctx.stroke();

  // Handle line (vertical down from centre)
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + extent * 1.1);
  ctx.stroke();

  // Gear circles in corners
  const gr = s * 0.07;
  const offset = s * 0.18;
  ctx.fillStyle = def.accentColor;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * (s / 2 - offset), cy + dy * (s / 2 - offset), gr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMinerCopper(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(2, s * 0.04);
  ctx.lineCap = 'round';

  // Diamond shapes (two rotated squares)
  const d = s * 0.18;
  for (const offset of [-s * 0.13, s * 0.13]) {
    ctx.beginPath();
    ctx.moveTo(cx + offset, cy - d);
    ctx.lineTo(cx + offset + d, cy);
    ctx.lineTo(cx + offset, cy + d);
    ctx.lineTo(cx + offset - d, cy);
    ctx.closePath();
    ctx.stroke();
  }

  // Gear circles in corners
  const gr = s * 0.07;
  const gOffset = s * 0.18;
  ctx.fillStyle = def.accentColor;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * (s / 2 - gOffset), cy + dy * (s / 2 - gOffset), gr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFarmWheat(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const furrowColor = darken(def.color, 0.2);
  const pad = s * 0.12;
  const rowCount = 4;

  ctx.strokeStyle = furrowColor;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 1; i <= rowCount; i++) {
    const y = sy + pad + ((s - pad * 2) / (rowCount + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(sx + pad, y);
    ctx.lineTo(sx + s - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  for (const offset of [-s * 0.2, 0, s * 0.2]) {
    const x = cx + offset;
    const top = sy + s * 0.3;
    const bottom = sy + s * 0.72;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, top);
    ctx.stroke();

    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05, top + s * 0.05);
    ctx.lineTo(x + s * 0.05, top + s * 0.05);
    ctx.stroke();
  }
}

function drawFarmPotato(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const furrowColor = darken(def.color, 0.25);
  const pad = s * 0.12;
  const rowCount = 3;

  ctx.strokeStyle = furrowColor;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 1; i <= rowCount; i++) {
    const y = sy + pad + ((s - pad * 2) / (rowCount + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(sx + pad, y);
    ctx.lineTo(sx + s - pad, y);
    ctx.stroke();
  }

  ctx.fillStyle = def.accentColor;
  const cx = sx + s / 2;
  const cy = sy + s / 2;
  const r = s * 0.09;
  for (const [dx, dy] of [
    [-s * 0.18, -s * 0.05],
    [s * 0.05, s * 0.1],
    [s * 0.2, -s * 0.14],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + dy, r * 1.1, r * 0.85, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFarmRice(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const waterColor = darken(def.color, 0.15);
  const pad = s * 0.12;
  const rowCount = 3;

  ctx.strokeStyle = waterColor;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 1; i <= rowCount; i++) {
    const y = sy + pad + ((s - pad * 2) / (rowCount + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(sx + pad, y);
    ctx.lineTo(sx + s - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(1, s * 0.035);
  const cx = sx + s / 2;
  for (const offset of [-s * 0.18, 0, s * 0.18]) {
    const x = cx + offset;
    ctx.beginPath();
    ctx.moveTo(x, sy + s * 0.7);
    ctx.quadraticCurveTo(x + s * 0.05, sy + s * 0.5, x, sy + s * 0.3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - s * 0.04, sy + s * 0.32);
    ctx.lineTo(x + s * 0.04, sy + s * 0.32);
    ctx.stroke();
  }
}

function drawMineDiamond(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;
  const w = s * 0.26;
  const h = s * 0.18;

  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - w, cy);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + w, cy);
  ctx.stroke();

  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.6, cy - h * 0.9);
  ctx.lineTo(cx + w * 0.6, cy - h * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.4, cy - h * 0.65);
  ctx.lineTo(cx + w * 0.8, cy - h * 0.65);
  ctx.stroke();
}

function drawWarehouse(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  // A large crate / building with an 'X' pattern on the front
  const w = s * 0.7;
  const h = s * 0.5;
  const bx = cx - w / 2;
  const by = cy - h * 0.3;

  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(2, s * 0.02);
  
  // Outer box
  ctx.strokeRect(bx, by, w, h);
  
  // X crossing
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + w, by + h);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(bx + w, by);
  ctx.lineTo(bx, by + h);
  ctx.stroke();
  
  // Roof
  ctx.beginPath();
  ctx.moveTo(bx - s * 0.05, by);
  ctx.lineTo(cx, by - s * 0.2);
  ctx.lineTo(bx + w + s * 0.05, by);
  ctx.stroke();
}

function drawSmelter(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  // Brick-like horizontal lines
  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(1, s * 0.015);
  const pad = s * 0.1;
  const lineCount = 5;
  for (let i = 1; i <= lineCount; i++) {
    const ly = sy + pad + ((s - pad * 2) / (lineCount + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(sx + pad, ly);
    ctx.lineTo(sx + s - pad, ly);
    ctx.stroke();
  }

  // Flame icon — 3 teardrop shapes
  ctx.fillStyle = def.accentColor;
  const flameH = s * 0.18;
  const flameW = s * 0.07;
  for (const offsetX of [-s * 0.1, 0, s * 0.1]) {
    const fx = cx + offsetX;
    const fy = cy - s * 0.05;
    ctx.beginPath();
    ctx.moveTo(fx, fy - flameH);
    ctx.quadraticCurveTo(fx + flameW * 1.5, fy - flameH * 0.3, fx, fy + flameH * 0.5);
    ctx.quadraticCurveTo(fx - flameW * 1.5, fy - flameH * 0.3, fx, fy - flameH);
    ctx.closePath();
    ctx.fill();
  }
}

function drawMinerGold(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  // Three overlapping gold coins
  ctx.strokeStyle = def.accentColor;
  ctx.fillStyle = def.accentColor;
  ctx.lineWidth = Math.max(1.5, s * 0.03);

  const coinR = s * 0.13;
  for (const [dx, dy] of [
    [-s * 0.14, s * 0.06],
    [s * 0.06, -s * 0.08],
    [s * 0.16, s * 0.1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, coinR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darken(def.accentColor, 0.35);
    ctx.stroke();
  }

  // Gear circles in corners, matching the other mines' framing
  const gr = s * 0.07;
  const offset = s * 0.18;
  ctx.fillStyle = def.accentColor;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * (s / 2 - offset), cy + dy * (s / 2 - offset), gr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBakery(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  // Oven arch
  ctx.strokeStyle = def.accentColor;
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.02, s * 0.22, Math.PI, 0);
  ctx.stroke();

  // Loaf of bread — rounded shape with score lines
  const loafW = s * 0.32;
  const loafH = s * 0.18;
  const loafY = cy + s * 0.16;
  ctx.fillStyle = def.accentColor;
  ctx.beginPath();
  ctx.ellipse(cx, loafY, loafW / 2, loafH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = darken(def.accentColor, 0.35);
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (const offsetX of [-loafW * 0.2, 0, loafW * 0.2]) {
    ctx.beginPath();
    ctx.moveTo(cx + offsetX, loafY - loafH * 0.35);
    ctx.lineTo(cx + offsetX, loafY + loafH * 0.1);
    ctx.stroke();
  }
}

function drawToolsmith(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  sx: number,
  sy: number,
  s: number,
): void {
  const cx = sx + s / 2;
  const cy = sy + s / 2;

  // Anvil silhouette
  ctx.fillStyle = def.accentColor;
  const baseW = s * 0.36;
  const baseH = s * 0.1;
  const topW = s * 0.24;
  const topH = s * 0.08;
  ctx.fillRect(cx - baseW / 2, cy + s * 0.05, baseW, baseH);
  ctx.fillRect(cx - topW / 2, cy - s * 0.05, topW, topH);
  ctx.fillRect(cx - s * 0.04, cy - s * 0.05 + topH, s * 0.08, s * 0.1);

  // Hammer head + handle, angled over the anvil
  ctx.save();
  ctx.translate(cx + s * 0.16, cy - s * 0.2);
  ctx.rotate(Math.PI / 5);
  ctx.fillStyle = def.accentColor;
  ctx.fillRect(-s * 0.09, -s * 0.045, s * 0.18, s * 0.09);
  ctx.strokeStyle = darken(def.accentColor, 0.3);
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, s * 0.22);
  ctx.stroke();
  ctx.restore();
}

// ── Public Drawing API ───────────────────────────────────────────────────────

/**
 * Draw a building at screen position.
 * @param tileScreenSize  pixel size of a single tile at current zoom
 * @param alpha  opacity (1.0 placed, 0.6 ghost preview)
 */
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  screenX: number,
  screenY: number,
  tileScreenSize: number,
  direction: Direction,
  alpha: number,
): void {
  const totalSize = tileScreenSize * def.size;
  const radius = Math.max(2, totalSize * 0.06);

  ctx.save();
  ctx.globalAlpha = alpha;

  const drewFarmSprite = tryDrawFarmSprite(ctx, def, screenX, screenY, totalSize);
  const drewIronSprite = def.id === 'mine-iron' ? drawIronSprite(ctx, def, screenX, screenY, totalSize) : false;
  const drewCopperSprite = def.id === 'mine-copper' ? drawCopperSprite(ctx, def, screenX, screenY, totalSize) : false;
  const drewDiamondSprite = def.id === 'mine-diamond' ? drawDiamondSprite(ctx, def, screenX, screenY, totalSize) : false;
  const isMine = def.id.startsWith('mine');
  const drewMineSprite = isMine && !drewIronSprite && !drewCopperSprite && !drewDiamondSprite ? drawMineSprite(ctx, def, screenX, screenY, totalSize) : false;

  if (!drewFarmSprite && !drewMineSprite && !drewIronSprite && !drewCopperSprite && !drewDiamondSprite) {
    drawBaseRect(ctx, def.color, screenX, screenY, totalSize, radius);
    switch (def.id) {
      case 'farm-wheat':
        drawFarmWheat(ctx, def, screenX, screenY, totalSize);
        break;
      case 'farm-potato':
        drawFarmPotato(ctx, def, screenX, screenY, totalSize);
        break;
      case 'farm-rice':
        drawFarmRice(ctx, def, screenX, screenY, totalSize);
        break;
    }
  }

  switch (def.id) {
    case 'farm-wheat':
    case 'farm-potato':
    case 'farm-rice':
      break;
    case 'mine-copper':
      if (!drewCopperSprite && !drewMineSprite) drawMinerCopper(ctx, def, screenX, screenY, totalSize);
      break;
    case 'mine-iron':
      if (!drewIronSprite && !drewMineSprite) drawMinerIron(ctx, def, screenX, screenY, totalSize);
      break;
    case 'mine-diamond':
      if (!drewDiamondSprite && !drewMineSprite) drawMineDiamond(ctx, def, screenX, screenY, totalSize);
      break;
    case 'warehouse':
      drawWarehouse(ctx, def, screenX, screenY, totalSize);
      break;
    case 'smelter':
      drawSmelter(ctx, def, screenX, screenY, totalSize);
      break;
    case 'mine-gold':
      if (!drewMineSprite) drawMinerGold(ctx, def, screenX, screenY, totalSize);
      break;
    case 'bakery':
      drawBakery(ctx, def, screenX, screenY, totalSize);
      break;
    case 'toolsmith':
      drawToolsmith(ctx, def, screenX, screenY, totalSize);
      break;
  }

  ctx.restore();
}

/**
 * Draw a simplified icon for the toolbar.
 * Just the main shape + primary icon detail, no direction.
 */
export function drawBuildingIcon(
  ctx: CanvasRenderingContext2D,
  def: BuildingDef,
  x: number,
  y: number,
  size: number,
): void {
  ctx.save();

  const radius = Math.max(2, size * 0.1);
  const drewFarmSprite = tryDrawFarmSprite(ctx, def, x, y, size);
  const drewIronIcon = def.id === 'mine-iron' ? drawIronSprite(ctx, def, x, y, size) : false;
  const drewCopperIcon = def.id === 'mine-copper' ? drawCopperSprite(ctx, def, x, y, size) : false;
  const drewDiamondIcon = def.id === 'mine-diamond' ? drawDiamondSprite(ctx, def, x, y, size) : false;
  const isMineIcon = def.id.startsWith('mine');
  const drewMineIcon = isMineIcon && !drewIronIcon && !drewCopperIcon && !drewDiamondIcon ? drawMineSprite(ctx, def, x, y, size) : false;
  if (!drewFarmSprite && !drewMineIcon && !drewIronIcon && !drewCopperIcon && !drewDiamondIcon) {
    drawBaseRect(ctx, def.color, x, y, size, radius);
    switch (def.id) {
      case 'farm-wheat':
        drawFarmWheat(ctx, def, x, y, size);
        break;
      case 'farm-potato':
        drawFarmPotato(ctx, def, x, y, size);
        break;
      case 'farm-rice':
        drawFarmRice(ctx, def, x, y, size);
        break;
    }
  }

  switch (def.id) {
    case 'farm-wheat':
    case 'farm-potato':
    case 'farm-rice':
      break;
    case 'mine-copper': {
      if (!drewCopperIcon && !drewMineIcon) drawMinerCopper(ctx, def, x, y, size);
      break;
    }
    case 'mine-iron': {
      if (!drewIronIcon && !drewMineIcon) drawMinerIron(ctx, def, x, y, size);
      break;
    }
    case 'mine-diamond': {
      if (!drewDiamondIcon && !drewMineIcon) drawMineDiamond(ctx, def, x, y, size);
      break;
    }
    case 'warehouse': {
      drawWarehouse(ctx, def, x, y, size);
      break;
    }
    case 'smelter': {
      drawSmelter(ctx, def, x, y, size);
      break;
    }
    case 'mine-gold': {
      if (!drewMineIcon) drawMinerGold(ctx, def, x, y, size);
      break;
    }
    case 'bakery': {
      drawBakery(ctx, def, x, y, size);
      break;
    }
    case 'toolsmith': {
      drawToolsmith(ctx, def, x, y, size);
      break;
    }
  }

  ctx.restore();
}
