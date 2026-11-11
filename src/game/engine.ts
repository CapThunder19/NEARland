import { Camera, createCamera, updateCamera, PAN_SPEED } from './camera';
import { GameWorld, createGameWorld } from './placement';
import { InputState, createInputState, consumeActions, getMovementDelta } from './input';
import { render, renderMinimap } from './renderer';
import { getBuildingDef, Direction } from './buildings';
import { placeBuilding, removeBuilding, getBuildingAt } from './placement';
import { useGameStore } from '../store/gameStore';
import { deleteBuilding, upsertBuilding } from './persistence';
import {
  RECIPES,
  RECIPE_BUILDING_IDS,
  REQUIRED_WORKER_TYPE,
  HARVEST_YIELD,
  GENERIC_BUILDING_MONEY_YIELD,
  PRODUCTION_CYCLE_SECONDS,
  getProductionSpeedMultiplier,
} from './economyConstants';

export interface GameEngine {
  camera: Camera;
  world: GameWorld;
  input: InputState;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  minimapCanvas: HTMLCanvasElement;
  minimapCtx: CanvasRenderingContext2D;
  running: boolean;
  lastTime: number;
  fps: number;
  fpsFrames: number;
  fpsTime: number;
  time: number;
}

export function createEngine(
  canvas: HTMLCanvasElement,
  minimapCanvas: HTMLCanvasElement
): GameEngine {
  const ctx = canvas.getContext('2d')!;
  const minimapCtx = minimapCanvas.getContext('2d')!;

  return {
    camera: createCamera(),
    world: createGameWorld(),
    input: createInputState(),
    canvas,
    ctx,
    minimapCanvas,
    minimapCtx,
    running: false,
    lastTime: 0,
    fps: 0,
    fpsFrames: 0,
    fpsTime: 0,
    time: 0,
  };
}

function rotateDirection(dir: Direction): Direction {
  const order: Direction[] = ['up', 'right', 'down', 'left'];
  const idx = order.indexOf(dir);
  return order[(idx + 1) % 4];
}

export function tick(engine: GameEngine, timestamp: number): void {
  // Delta time calculation
  if (engine.lastTime === 0) engine.lastTime = timestamp;
  const dt = Math.min((timestamp - engine.lastTime) / 1000, 0.1); // cap at 100ms
  engine.lastTime = timestamp;
  engine.time = timestamp;

  // FPS counter
  engine.fpsFrames++;
  engine.fpsTime += dt;
  if (engine.fpsTime >= 1.0) {
    engine.fps = Math.round(engine.fpsFrames / engine.fpsTime);
    engine.fpsFrames = 0;
    engine.fpsTime = 0;
  }

  // Production Ticking
  const speedMultiplier = getProductionSpeedMultiplier(useGameStore.getState().level);
  for (let i = 0; i < engine.world.buildings.length; i++) {
    const b = engine.world.buildings[i];
    if (b.assignedWorkerId && !b.readyToHarvest) {
      const wasReady = b.readyToHarvest;
      b.productionProgress += (dt / PRODUCTION_CYCLE_SECONDS) * 100 * speedMultiplier;
      if (b.productionProgress >= 100) {
        b.productionProgress = 100;
        b.readyToHarvest = true;
      }
      if (!wasReady && b.readyToHarvest) {
        void upsertBuilding(b);
      }
    }
  }

  // Resize canvas to fill window
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = window.innerWidth;
  const displayHeight = window.innerHeight;
  if (engine.canvas.width !== displayWidth * dpr || engine.canvas.height !== displayHeight * dpr) {
    engine.canvas.width = displayWidth * dpr;
    engine.canvas.height = displayHeight * dpr;
    engine.canvas.style.width = displayWidth + 'px';
    engine.canvas.style.height = displayHeight + 'px';
    engine.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const canvasWidth = displayWidth;
  const canvasHeight = displayHeight;

  // Process input actions
  const actions = consumeActions(engine.input);
  const store = useGameStore.getState();

  if (engine.input.selectedBuildingId) {
    const selectedDef = getBuildingDef(engine.input.selectedBuildingId);
    const selectedCost = selectedDef?.cost ?? 0;
    engine.input.canAffordPlacement = store.level >= (selectedDef?.minLevel ?? 1) && store.inventory.money >= selectedCost;
  } else {
    engine.input.canAffordPlacement = true;
  }

  if (actions.rotate) {
    engine.input.currentDirection = rotateDirection(engine.input.currentDirection);
  }

  if (actions.deselect) {
    engine.input.selectedBuildingId = null;
    engine.input.removeMode = false;
  }

  if (actions.place) {
    if (engine.input.removeMode) {
      const removed = removeBuilding(engine.world, engine.input.mouseGridCol, engine.input.mouseGridRow);
      if (removed) {
        void deleteBuilding(removed.id);
      }
    } else if (engine.input.selectedBuildingId) {
      const def = getBuildingDef(engine.input.selectedBuildingId);
      if (def) {
        const cost = def.cost ?? 0;
        if (store.level >= def.minLevel && store.inventory.money >= cost) {
          const placed = placeBuilding(
            engine.world,
            def.id,
            engine.input.mouseGridCol,
            engine.input.mouseGridRow,
            engine.input.currentDirection,
            RECIPE_BUILDING_IDS.has(def.id) ? engine.input.currentRecipeKey : null
          );
          if (placed) {
            if (cost > 0) {
              store.addResource('money', -cost);
            }
            void upsertBuilding(placed);
          }
        }
      }
    } else {
      // Interaction mode (no building selected)
      const b = getBuildingAt(engine.world, engine.input.mouseGridCol, engine.input.mouseGridRow);
      if (b) {
        if (b.readyToHarvest) {
          if (RECIPE_BUILDING_IDS.has(b.defId)) {
            // Recipe-building harvest is gated on having enough input stock — if the
            // player hasn't stockpiled enough yet, leave it "ready" and try
            // again on a later click instead of harvesting nothing.
            const recipe = b.recipeKey ? RECIPES[b.recipeKey] : null;
            if (recipe && store.inventory[recipe.input] >= recipe.inputAmount) {
              store.addResource(recipe.input, -recipe.inputAmount);
              store.addResource(recipe.output, recipe.outputAmount);
              b.readyToHarvest = false;
              b.productionProgress = 0;
              void upsertBuilding(b);
            }
          } else {
            // Harvest!
            b.readyToHarvest = false;
            b.productionProgress = 0;

            const yieldInfo = HARVEST_YIELD[b.defId];
            if (yieldInfo) {
              store.addResource(yieldInfo.resource, yieldInfo.amount);
            } else {
              store.addResource('money', GENERIC_BUILDING_MONEY_YIELD);
            }
            void upsertBuilding(b);
          }
        } else if (!b.assignedWorkerId) {
          // Try to assign a worker
          const requiredType = REQUIRED_WORKER_TYPE[b.defId] ?? (b.defId.startsWith('farm') ? 'farmer' : 'miner');
          const availableWorker = store.getAvailableWorker(requiredType);
          if (availableWorker) {
            store.assignWorker(availableWorker.id, b.id);
            b.assignedWorkerId = availableWorker.id;
            void upsertBuilding(b);
          }
        }
      }
    }
  }

  if (actions.remove) {
    const removed = removeBuilding(engine.world, engine.input.mouseGridCol, engine.input.mouseGridRow);
    if (removed) {
      void deleteBuilding(removed.id);
    }
  }

  // Camera movement from keyboard
  const movement = getMovementDelta(engine.input);
  if (movement.dx !== 0 || movement.dy !== 0) {
    const speed = (PAN_SPEED / engine.camera.zoom) * dt;
    engine.camera.targetX += movement.dx * speed;
    engine.camera.targetY += movement.dy * speed;
  }

  // Update camera interpolation
  updateCamera(engine.camera, dt);

  // Render main canvas
  render(
    engine.ctx,
    engine.camera,
    canvasWidth,
    canvasHeight,
    engine.world,
    engine.input,
    engine.time
  );

  // Render minimap
  const minimapSize = 160;
  engine.minimapCanvas.width = minimapSize * dpr;
  engine.minimapCanvas.height = minimapSize * dpr;
  engine.minimapCanvas.style.width = minimapSize + 'px';
  engine.minimapCanvas.style.height = minimapSize + 'px';
  engine.minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  renderMinimap(
    engine.minimapCtx,
    engine.camera,
    canvasWidth,
    canvasHeight,
    engine.world,
    0,
    0,
    minimapSize
  );
}
