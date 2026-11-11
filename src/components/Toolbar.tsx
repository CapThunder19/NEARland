'use client';

import React from 'react';
import Link from 'next/link';
import { BUILDINGS, BuildingDef, drawBuildingIcon } from '../game/buildings';

interface ToolbarProps {
  level: number;
  selectedBuildingId: string | null;
  removeMode: boolean;
  onSelectBuilding: (id: string | null) => void;
  onToggleRemove: () => void;
}

export default function Toolbar({ level, selectedBuildingId, removeMode, onSelectBuilding, onToggleRemove }: ToolbarProps) {
  const canvasRefs = React.useRef<Map<string, HTMLCanvasElement>>(new Map());

  const drawIcon = React.useCallback((canvas: HTMLCanvasElement, def: BuildingDef) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 36;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawBuildingIcon(ctx, def, 0, 0, size);
  }, []);

  React.useEffect(() => {
    // Draw icons on each canvas
    canvasRefs.current.forEach((canvas, id) => {
      const def = BUILDINGS.find(b => b.id === id);
      if (!def || !canvas) return;
      drawIcon(canvas, def);
    });
  }, [drawIcon]);

  return (
    <div className="toolbar-wrapper">
      <div className="toolbar">
        {BUILDINGS.filter((def) => def.id !== 'warehouse').map((def: BuildingDef) => {
          const isLocked = def.minLevel > level;
          return (
          <button
            key={def.id}
            id={`toolbar-${def.id}`}
            className={`toolbar-item ${selectedBuildingId === def.id ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
            onClick={() => {
              if (isLocked) return;
              onSelectBuilding(selectedBuildingId === def.id ? null : def.id);
            }}
            title={isLocked ? `Requires Level ${def.minLevel}` : `${def.name} (${def.hotkey})${def.cost > 0 ? ` — $${def.cost.toLocaleString()}` : ''}`}
            disabled={isLocked}
          >
            {isLocked && <div className="toolbar-lock-overlay">🔒 LVL {def.minLevel}</div>}
            <span className="toolbar-hotkey">{def.hotkey}</span>
            <div className="toolbar-icon">
              <canvas
                ref={(el) => {
                  if (el) {
                    canvasRefs.current.set(def.id, el);
                    drawIcon(el, def);
                  }
                }}
                className="toolbar-icon-canvas"
              />
            </div>
            <span className="toolbar-item-name">{def.name}</span>
          </button>
        )})}

        <button
          key="remove-mode"
          id="toolbar-remove"
          className={`toolbar-item toolbar-remove ${removeMode ? 'selected' : ''}`}
          onClick={onToggleRemove}
          title="Remove Mode (X)"
        >
          <span className="toolbar-hotkey">X</span>
          <div className="toolbar-remove-icon">X</div>
          <span className="toolbar-item-name">Remove</span>
        </button>

        <Link href="/leaderboard" className="toolbar-item toolbar-leaderboard" title="Leaderboard">
          <span className="toolbar-hotkey">L</span>
          <div className="toolbar-icon">🏆</div>
          <span className="toolbar-item-name">Leaderboard</span>
        </Link>
      </div>
    </div>
  );
}
