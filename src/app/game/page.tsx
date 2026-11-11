'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/shallow';
import Toolbar from '../../components/Toolbar';
import HUD from '../../components/HUD';
import BuildingInfo from '../../components/BuildingInfo';
import LevelUpgrade from '../../components/LevelUpgrade';
import { createEngine, tick, GameEngine } from '../../game/engine';
import { setupInputHandlers } from '../../game/input';
import { getBuildingAt } from '../../game/placement';
import { Direction } from '../../game/buildings';
import { useGameStore } from '../../store/gameStore';
import { computeNextBuildingId, loadBuildings, upsertBuildings } from '../../game/persistence';
import { RECIPE_BUILDING_IDS, type RecipeKey } from '../../game/economyConstants';

export default function GamePage() {
  const { address } = useAccount();
  const router = useRouter();

  React.useEffect(() => {
    if (!address) {
      router.replace('/');
    }
  }, [address, router]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number | null>(null);
  const { hydrateFromSupabase, inventory, level, isHydrated, isHydrating, workers, userAddress, flushToSupabase } = useGameStore(
    useShallow((state) => ({
      hydrateFromSupabase: state.hydrateFromSupabase,
      flushToSupabase: state.flushToSupabase,
      inventory: state.inventory,
      level: state.level,
      isHydrated: state.isHydrated,
      isHydrating: state.isHydrating,
      workers: state.workers,
      userAddress: state.userAddress,
    }))
  );
  
  // UI State extracted from engine each frame
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [recipeKey, setRecipeKey] = useState<RecipeKey | null>(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [gridPos, setGridPos] = useState({ col: 0, row: 0 });
  const [zoom, setZoom] = useState(1);
  const [fps, setFps] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const storageLoading = isHydrating && !isHydrated;
  const idleWorkers = workers.filter((worker) => !worker.assignedBuildingId);
  const assignedWorkers = workers.length - idleWorkers.length;
  
  // Tooltip state
  const [hoverInfo, setHoverInfo] = useState<{
    visible: boolean;
    defId: string | null;
    direction: Direction | null;
    x: number;
    y: number;
  }>({
    visible: false,
    defId: null,
    direction: null,
    x: 0,
    y: 0
  });

  useEffect(() => {
    if (!address) return;
    if (!canvasRef.current || !minimapCanvasRef.current) return;

    const canvas = canvasRef.current;
    const minimapCanvas = minimapCanvasRef.current;

    // Initialize engine
    const engine = createEngine(canvas, minimapCanvas);
    engineRef.current = engine;
    engine.running = true;

    setEngineReady(true);

    // Setup input handlers
    const cleanupInput = setupInputHandlers(
      canvas,
      engine.input,
      engine.camera,
      () => canvas.width / (window.devicePixelRatio || 1),
      () => canvas.height / (window.devicePixelRatio || 1)
    );

    // Main game loop
    const animate = (time: number) => {
      if (!engine.running) return;

      tick(engine, time);

      // Sync specific engine state to React UI (throttled/only when changed to avoid excessive re-renders)
      setGridPos(prev => {
        if (prev.col !== engine.input.mouseGridCol || prev.row !== engine.input.mouseGridRow) {
          return { col: engine.input.mouseGridCol, row: engine.input.mouseGridRow };
        }
        return prev;
      });

      setSelectedBuildingId(prev => {
        if (prev !== engine.input.selectedBuildingId) {
          return engine.input.selectedBuildingId;
        }
        return prev;
      });

      setRecipeKey(prev => {
        if (prev !== engine.input.currentRecipeKey) {
          return engine.input.currentRecipeKey;
        }
        return prev;
      });

      setRemoveMode(prev => {
        if (prev !== engine.input.removeMode) {
          return engine.input.removeMode;
        }
        return prev;
      });

      setZoom(prev => {
        if (Math.abs(prev - engine.camera.zoom) > 0.01) {
          return engine.camera.zoom;
        }
        return prev;
      });

      setFps(prev => {
        if (prev !== engine.fps) return engine.fps;
        return prev;
      });

      // Update hover tooltip (only if not dragging or placing)
      if (!engine.camera.isDragging && !engine.input.selectedBuildingId) {
        const hoveredBuilding = getBuildingAt(engine.world, engine.input.mouseGridCol, engine.input.mouseGridRow);
        setHoverInfo(prev => {
          if (hoveredBuilding) {
            return {
              visible: true,
              defId: hoveredBuilding.defId,
              direction: hoveredBuilding.direction,
              x: engine.input.mouseScreenX,
              y: engine.input.mouseScreenY
            };
          } else if (prev.visible) {
            return { ...prev, visible: false };
          }
          return prev;
        });
      } else {
        setHoverInfo(prev => prev.visible ? { ...prev, visible: false } : prev);
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      setEngineReady(false);
      engine.running = false;
      cleanupInput();
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [address]);

  useEffect(() => {
    if (!engineReady || !engineRef.current) return;

    let isMounted = true;
    const engine = engineRef.current;

    const loadWorld = async () => {
      await hydrateFromSupabase();
      const buildings = await loadBuildings();
      if (!isMounted) return;

      engine.world.buildings = buildings;
      engine.world.nextBuildingId = computeNextBuildingId(buildings);

      const store = useGameStore.getState();
      const buildingMap = new Map(buildings.map((b) => [b.id, b] as const));

      store.workers.forEach((worker) => {
        if (!worker.assignedBuildingId) return;
        const building = buildingMap.get(worker.assignedBuildingId);
        if (building) {
          building.assignedWorkerId = worker.id;
        } else {
          store.unassignWorker(worker.id);
        }
      });
    };

    void loadWorld();

    return () => {
      isMounted = false;
    };
  }, [engineReady, hydrateFromSupabase, userAddress]);

  useEffect(() => {
    if (!engineReady || !address) return;

    const autosaveId = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      void upsertBuildings(engine.world.buildings);
      void flushToSupabase();
    }, 10000);

    return () => {
      window.clearInterval(autosaveId);
    };
  }, [engineReady, address, flushToSupabase]);

  const handleSelectBuilding = (id: string | null) => {
    if (engineRef.current) {
      engineRef.current.input.selectedBuildingId = id;
      engineRef.current.input.removeMode = false;
      // Also update React state immediately for snappy UI
      setSelectedBuildingId(id);
      setRemoveMode(false);
    }
  };

  const handleToggleRemove = () => {
    if (!engineRef.current) return;
    const next = !engineRef.current.input.removeMode;
    engineRef.current.input.removeMode = next;
    if (next) {
      engineRef.current.input.selectedBuildingId = null;
      setSelectedBuildingId(null);
    }
    setRemoveMode(next);
  };

  return (
    <div className="game-container">
      {/* Main Game World */}
      <canvas 
        ref={canvasRef} 
        className="game-canvas" 
        tabIndex={0} // Allows canvas to receive keyboard events
        style={{ outline: 'none' }} 
      />

      {/* UI Overlays */}
      <HUD
        gridCol={gridPos.col}
        gridRow={gridPos.row}
        zoom={zoom}
        fps={fps}
        activeRecipeKey={RECIPE_BUILDING_IDS.has(selectedBuildingId ?? '') ? recipeKey : null}
      />

      <aside className="hub-side-panel">
        <LevelUpgrade />
        <section className="hub-side-card hub-storage-panel">
          <div className="hub-panel-title">
            <span>Storage</span>
            <span className="hub-panel-subtitle">Produced</span>
          </div>
          {storageLoading ? (
            <p className="hub-panel-loading">Syncing resource data...</p>
          ) : (
            <ul className="hub-storage-list">
              <li className="hub-storage-item">
                <span className="hub-storage-label">Money</span>
                <span className="hub-storage-value money">${inventory.money.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Carrot</span>
                <span className="hub-storage-value wheat">{inventory.wheat.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Rice</span>
                <span className="hub-storage-value potato">{inventory.potato.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Cabbage</span>
                <span className="hub-storage-value rice">{inventory.rice.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Iron Ore</span>
                <span className="hub-storage-value iron">{inventory.iron_ore.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Copper Ore</span>
                <span className="hub-storage-value copper">{inventory.copper_ore.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Diamond</span>
                <span className="hub-storage-value diamond">{inventory.diamond.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Iron Bar</span>
                <span className="hub-storage-value iron">{inventory.iron_bar.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Copper Bar</span>
                <span className="hub-storage-value copper">{inventory.copper_bar.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Gold Ore</span>
                <span className="hub-storage-value diamond">{inventory.gold_ore.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Gold Bar</span>
                <span className="hub-storage-value diamond">{inventory.gold_bar.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Bread</span>
                <span className="hub-storage-value wheat">{inventory.bread.toLocaleString()}</span>
              </li>
              <li className="hub-storage-item">
                <span className="hub-storage-label">Tools</span>
                <span className="hub-storage-value iron">{inventory.tool.toLocaleString()}</span>
              </li>
            </ul>
          )}
        </section>

        <section className="hub-side-card hub-workers-panel">
          <div className="hub-panel-title">
            <span>Workers</span>
            <span className="hub-panel-subtitle">Roster</span>
          </div>
          {storageLoading ? (
            <p className="hub-panel-loading">Syncing worker data...</p>
          ) : (
            <>
              <div className="hub-workers-metrics">
                <div className="hub-workers-metric">
                  <span className="hub-workers-metric-label">Total</span>
                  <span className="hub-workers-metric-value">{workers.length}</span>
                </div>
                <div className="hub-workers-metric">
                  <span className="hub-workers-metric-label">Idle</span>
                  <span className="hub-workers-metric-value">{idleWorkers.length}</span>
                </div>
                <div className="hub-workers-metric">
                  <span className="hub-workers-metric-label">Assigned</span>
                  <span className="hub-workers-metric-value">{assignedWorkers}</span>
                </div>
              </div>
              {workers.length === 0 ? (
                <p className="hub-workers-empty">No workers hired yet.</p>
              ) : (
                <ul className="hub-workers-list">
                  {workers.map((worker) => (
                    <li key={worker.id} className="hub-worker-item">
                      <span className="hub-worker-type">
                        {worker.type === 'farmer' ? '👨‍🌾 Farmer' : worker.type === 'miner' ? '⛏️ Miner' : '🔧 Engineer'}
                      </span>
                      <span
                        className={`hub-worker-status ${worker.assignedBuildingId ? 'assigned' : 'idle'}`}
                      >
                        {worker.assignedBuildingId ? 'Working' : 'Idle'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </aside>

      <div className="minimap-wrapper">
        <span className="minimap-label">Radar</span>
        <div className="minimap-container">
          <canvas ref={minimapCanvasRef} className="minimap-canvas" />
        </div>
      </div>

      <Toolbar 
        level={level}
        selectedBuildingId={selectedBuildingId} 
        removeMode={removeMode}
        onSelectBuilding={handleSelectBuilding}
        onToggleRemove={handleToggleRemove}
      />

      <BuildingInfo 
        visible={hoverInfo.visible}
        defId={hoverInfo.defId}
        direction={hoverInfo.direction}
        x={hoverInfo.x}
        y={hoverInfo.y}
      />

    </div>
  );
}
