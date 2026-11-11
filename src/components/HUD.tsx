'use client';

import React from 'react';
import { RECIPE_LABELS, type RecipeKey } from '../game/economyConstants';

interface HUDProps {
  gridCol: number;
  gridRow: number;
  zoom: number;
  fps: number;
  activeRecipeKey?: RecipeKey | null;
}

export default function HUD({ gridCol, gridRow, zoom, fps, activeRecipeKey }: HUDProps) {
  return (
    <div className="hud">
      <div className="hud-panel">
        <span className="hud-label">POS</span>
        <span className="hud-value">
          {gridCol}, {gridRow}
        </span>
      </div>

      <div className="hud-panel">
        <span className="hud-label">ZOOM</span>
        <span className="hud-value">{zoom.toFixed(2)}x</span>

        <div className="hud-separator"></div>

        <span className="hud-label">FPS</span>
        <span className="hud-value" style={{ color: fps < 30 ? 'var(--accent-red)' : fps < 50 ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
          {fps}
        </span>
      </div>

      {activeRecipeKey && (
        <div className="hud-panel">
          <span className="hud-label">RECIPE</span>
          <span className="hud-value">{RECIPE_LABELS[activeRecipeKey]} (C)</span>
        </div>
      )}
    </div>
  );
}
