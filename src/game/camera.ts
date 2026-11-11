export const TILE_SIZE = 32; // pixels per tile at 1x zoom

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const LERP_FACTOR = 0.15;
const LERP_SNAP_THRESHOLD = 0.5; // snap to target when close enough (world pixels)
const ZOOM_SNAP_THRESHOLD = 0.001;

export const PAN_SPEED = 500; // pixels/second at 1x zoom

export interface Camera {
  x: number;       // world X (center of viewport)
  y: number;       // world Y (center of viewport)
  zoom: number;    // 0.25 to 3.0
  targetX: number; // for smooth interpolation
  targetY: number;
  targetZoom: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragCameraStartX: number;
  dragCameraStartY: number;
}

/** Create a camera centered at the world origin with 1x zoom. */
export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 1.0,
    targetX: 0,
    targetY: 0,
    targetZoom: 1.0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragCameraStartX: 0,
    dragCameraStartY: 0,
  };
}

/**
 * Smoothly interpolate the camera position and zoom toward their targets.
 * Called once per frame with dt in seconds.
 */
export function updateCamera(camera: Camera, dt: number): void {
  // Use a frame-rate-independent lerp: factor per 16.67ms frame ≈ 0.15
  // Generalized: 1 - (1 - baseFactor)^(dt / baseDt)
  const baseDt = 1 / 60;
  const t = 1 - Math.pow(1 - LERP_FACTOR, dt / baseDt);

  // Interpolate position
  camera.x += (camera.targetX - camera.x) * t;
  camera.y += (camera.targetY - camera.y) * t;

  // Snap when close enough to avoid endless micro-movements
  if (Math.abs(camera.targetX - camera.x) < LERP_SNAP_THRESHOLD) {
    camera.x = camera.targetX;
  }
  if (Math.abs(camera.targetY - camera.y) < LERP_SNAP_THRESHOLD) {
    camera.y = camera.targetY;
  }

  // Interpolate zoom
  camera.zoom += (camera.targetZoom - camera.zoom) * t;
  if (Math.abs(camera.targetZoom - camera.zoom) < ZOOM_SNAP_THRESHOLD) {
    camera.zoom = camera.targetZoom;
  }
}

/**
 * Convert a world-space coordinate to a screen-space pixel coordinate.
 * The camera's (x, y) maps to the center of the canvas.
 */
export function worldToScreen(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const screenX = (worldX - camera.x) * camera.zoom + canvasWidth * 0.5;
  const screenY = (worldY - camera.y) * camera.zoom + canvasHeight * 0.5;
  return { x: screenX, y: screenY };
}

/**
 * Convert a screen-space pixel coordinate to a world-space coordinate.
 */
export function screenToWorld(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const worldX = (screenX - canvasWidth * 0.5) / camera.zoom + camera.x;
  const worldY = (screenY - canvasHeight * 0.5) / camera.zoom + camera.y;
  return { x: worldX, y: worldY };
}

/**
 * Convert a screen-space pixel coordinate to grid tile coordinates (floored).
 * Each tile occupies TILE_SIZE x TILE_SIZE world units.
 */
export function screenToGrid(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  screenX: number,
  screenY: number,
): { col: number; row: number } {
  const world = screenToWorld(camera, canvasWidth, canvasHeight, screenX, screenY);
  return {
    col: Math.floor(world.x / TILE_SIZE),
    row: Math.floor(world.y / TILE_SIZE),
  };
}

/**
 * Zoom the camera toward or away from a specific screen position.
 * delta > 0 zooms in, delta < 0 zooms out.
 * The world point under the cursor remains fixed on screen after zooming.
 */
export function zoomAt(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  screenX: number,
  screenY: number,
  delta: number,
): void {
  const oldZoom = camera.targetZoom;

  // Exponential zoom scaling for a natural feel
  const zoomFactor = 1.1;
  const newZoom = delta > 0
    ? oldZoom * zoomFactor
    : oldZoom / zoomFactor;

  camera.targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));

  // Adjust camera position so the world point under the cursor stays fixed.
  // worldPoint = (screenX - canvasWidth/2) / oldZoom + camera.targetX
  // After zoom, we want that same worldPoint to map back to screenX:
  // worldPoint = (screenX - canvasWidth/2) / newZoom + newCameraX
  // => newCameraX = worldPoint - (screenX - canvasWidth/2) / newZoom
  const worldX = (screenX - canvasWidth * 0.5) / oldZoom + camera.targetX;
  const worldY = (screenY - canvasHeight * 0.5) / oldZoom + camera.targetY;

  camera.targetX = worldX - (screenX - canvasWidth * 0.5) / camera.targetZoom;
  camera.targetY = worldY - (screenY - canvasHeight * 0.5) / camera.targetZoom;
}

/**
 * Return the range of grid columns and rows currently visible in the viewport,
 * with 1 tile of padding on each side for smooth scrolling.
 */
export function getVisibleBounds(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  // Top-left and bottom-right world coordinates of the viewport
  const topLeft = screenToWorld(camera, canvasWidth, canvasHeight, 0, 0);
  const bottomRight = screenToWorld(camera, canvasWidth, canvasHeight, canvasWidth, canvasHeight);

  return {
    minCol: Math.floor(topLeft.x / TILE_SIZE) - 1,
    maxCol: Math.floor(bottomRight.x / TILE_SIZE) + 1,
    minRow: Math.floor(topLeft.y / TILE_SIZE) - 1,
    maxRow: Math.floor(bottomRight.y / TILE_SIZE) + 1,
  };
}
