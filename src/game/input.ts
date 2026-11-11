import { Camera, screenToGrid, zoomAt } from './camera';
import { Direction } from './buildings';
import { RECIPES_BY_BUILDING, type RecipeKey } from './economyConstants';

// ---------------------------------------------------------------------------
// Input state
// ---------------------------------------------------------------------------

export interface InputState {
  // Keys currently held down
  keysDown: Set<string>;
  // Mouse state
  mouseScreenX: number;
  mouseScreenY: number;
  mouseGridCol: number;
  mouseGridRow: number;
  // Building placement
  selectedBuildingId: string | null;
  removeMode: boolean;
  currentDirection: Direction;
  currentRecipeKey: RecipeKey | null;
  canAffordPlacement: boolean;
  // Actions (consumed each frame)
  placeRequested: boolean;
  removeRequested: boolean;
  rotateRequested: boolean;
  deselectRequested: boolean;
}

export function createInputState(): InputState {
  return {
    keysDown: new Set<string>(),
    mouseScreenX: 0,
    mouseScreenY: 0,
    mouseGridCol: 0,
    mouseGridRow: 0,
    selectedBuildingId: null,
    removeMode: false,
    currentDirection: 'up' as Direction,
    currentRecipeKey: null,
    canAffordPlacement: true,
    placeRequested: false,
    removeRequested: false,
    rotateRequested: false,
    deselectRequested: false,
  };
}

// ---------------------------------------------------------------------------
// Number‑key → building ID mapping
// ---------------------------------------------------------------------------

const BUILDING_HOTKEYS: Record<string, string> = {
  '1': 'farm-wheat',
  '2': 'farm-potato',
  '3': 'farm-rice',
  '4': 'mine-copper',
  '5': 'mine-iron',
  '6': 'mine-diamond',
  '7': 'mine-gold',
  '8': 'smelter',
  '9': 'bakery',
  '0': 'toolsmith',
};

function defaultRecipeFor(buildingId: string | null): RecipeKey | null {
  if (!buildingId) return null;
  return RECIPES_BY_BUILDING[buildingId]?.[0] ?? null;
}

function nextRecipe(current: RecipeKey | null, buildingId: string | null): RecipeKey | null {
  const cycle = buildingId ? RECIPES_BY_BUILDING[buildingId] : undefined;
  if (!cycle || cycle.length === 0) return null;
  const idx = current ? cycle.indexOf(current) : -1;
  return cycle[(idx + 1) % cycle.length];
}

// ---------------------------------------------------------------------------
// Direction rotation cycle
// ---------------------------------------------------------------------------

const DIRECTION_CYCLE: Direction[] = ['up', 'right', 'down', 'left'];
const PAN_CONTROLS_ENABLED = false;

function nextDirection(current: Direction): Direction {
  const idx = DIRECTION_CYCLE.indexOf(current);
  return DIRECTION_CYCLE[(idx + 1) % DIRECTION_CYCLE.length];
}

// ---------------------------------------------------------------------------
// Update mouse grid coordinates from screen position
// ---------------------------------------------------------------------------

function updateMouseGrid(
  input: InputState,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const grid = screenToGrid(
    camera,
    canvasWidth,
    canvasHeight,
    input.mouseScreenX,
    input.mouseScreenY,
  );
  input.mouseGridCol = grid.col;
  input.mouseGridRow = grid.row;
}

// ---------------------------------------------------------------------------
// Attach / detach event listeners
// ---------------------------------------------------------------------------

export function setupInputHandlers(
  canvas: HTMLElement,
  inputState: InputState,
  camera: Camera,
  canvasWidth: () => number,
  canvasHeight: () => number,
): () => void {
  // --- Drag bookkeeping (not stored in inputState) ---
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  let dragStartCamX = 0;
  let dragStartCamY = 0;

  // -----------------------------------------------------------------------
  // Keyboard
  // -----------------------------------------------------------------------

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key;
    inputState.keysDown.add(key);

    // Rotation
    if (key === 'r' || key === 'R') {
      inputState.currentDirection = nextDirection(inputState.currentDirection);
      inputState.rotateRequested = true;
    }

    // Deselect
    if (key === 'q' || key === 'Q' || key === 'Escape') {
      inputState.selectedBuildingId = null;
      inputState.removeMode = false;
      inputState.deselectRequested = true;
    }

    // Toggle remove mode
    if (key === 'x' || key === 'X') {
      inputState.removeMode = !inputState.removeMode;
      if (inputState.removeMode) {
        inputState.selectedBuildingId = null;
      }
    }

    // Cycle the active recipe (only meaningful while placing a recipe-driven building)
    if (key === 'c' || key === 'C') {
      inputState.currentRecipeKey = nextRecipe(inputState.currentRecipeKey, inputState.selectedBuildingId);
    }

    // Building hotkeys
    const buildingId = BUILDING_HOTKEYS[key];
    if (buildingId) {
      inputState.selectedBuildingId = buildingId;
      inputState.currentDirection = 'up' as Direction;
      inputState.currentRecipeKey = defaultRecipeFor(buildingId);
      inputState.removeMode = false;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    inputState.keysDown.delete(e.key);
  };

  // -----------------------------------------------------------------------
  // Mouse move
  // -----------------------------------------------------------------------

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    inputState.mouseScreenX = e.clientX - rect.left;
    inputState.mouseScreenY = e.clientY - rect.top;

    updateMouseGrid(inputState, camera, canvasWidth(), canvasHeight());

    // Camera drag
    if (PAN_CONTROLS_ENABLED && camera.isDragging) {
      const dx = (e.clientX - dragStartScreenX) / camera.zoom;
      const dy = (e.clientY - dragStartScreenY) / camera.zoom;
      camera.targetX = dragStartCamX - dx;
      camera.targetY = dragStartCamY - dy;
    }
  };

  // -----------------------------------------------------------------------
  // Mouse buttons
  // -----------------------------------------------------------------------

  const onMouseDown = (e: MouseEvent) => {
    // Ensure canvas can receive keyboard events
    canvas.focus();

    if (e.button === 0) {
      // Left click → place
      inputState.placeRequested = true;
    } else if (e.button === 2) {
      // Right click → remove
      inputState.removeRequested = true;
    } else if (e.button === 1 && PAN_CONTROLS_ENABLED) {
      // Middle click → start camera drag
      e.preventDefault();
      camera.isDragging = true;
      dragStartScreenX = e.clientX;
      dragStartScreenY = e.clientY;
      dragStartCamX = camera.targetX;
      dragStartCamY = camera.targetY;
    }
  };

  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 1 && PAN_CONTROLS_ENABLED) {
      camera.isDragging = false;
    }
  };

  // -----------------------------------------------------------------------
  // Scroll (zoom)
  // -----------------------------------------------------------------------

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomAt(
      camera,
      canvasWidth(),
      canvasHeight(),
      inputState.mouseScreenX,
      inputState.mouseScreenY,
      e.deltaY,
    );
    // Recompute grid after zoom change
    updateMouseGrid(inputState, camera, canvasWidth(), canvasHeight());
  };

  // -----------------------------------------------------------------------
  // Context menu (suppress)
  // -----------------------------------------------------------------------

  const onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  // -----------------------------------------------------------------------
  // Attach
  // -----------------------------------------------------------------------

  // Canvas must be focusable to receive keyboard events
  if (!canvas.hasAttribute('tabindex')) {
    canvas.setAttribute('tabindex', '0');
  }

  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  return () => {
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
}

// ---------------------------------------------------------------------------
// Consume per‑frame action flags
// ---------------------------------------------------------------------------

export function consumeActions(
  inputState: InputState,
): { place: boolean; remove: boolean; rotate: boolean; deselect: boolean } {
  const result = {
    place: inputState.placeRequested,
    remove: inputState.removeRequested,
    rotate: inputState.rotateRequested,
    deselect: inputState.deselectRequested,
  };
  inputState.placeRequested = false;
  inputState.removeRequested = false;
  inputState.rotateRequested = false;
  inputState.deselectRequested = false;
  return result;
}

// ---------------------------------------------------------------------------
// WASD / Arrow key movement delta (normalised for diagonal)
// ---------------------------------------------------------------------------

export function getMovementDelta(
  inputState: InputState,
): { dx: number; dy: number } {
  if (!PAN_CONTROLS_ENABLED) {
    return { dx: 0, dy: 0 };
  }

  let dx = 0;
  let dy = 0;

  const keys = inputState.keysDown;

  if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('a') || keys.has('A') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('d') || keys.has('D') || keys.has('ArrowRight')) dx += 1;

  // Normalise diagonal movement to length 1
  if (dx !== 0 && dy !== 0) {
    const inv = 1 / Math.SQRT2;
    dx *= inv;
    dy *= inv;
  }

  return { dx, dy };
}
