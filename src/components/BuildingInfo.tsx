'use client';

import React from 'react';
import { BUILDINGS, Direction } from '../game/buildings';

interface BuildingInfoProps {
  defId: string | null;
  direction: Direction | null;
  x: number;
  y: number;
  visible: boolean;
}

export default function BuildingInfo({ defId, direction, x, y, visible }: BuildingInfoProps) {
  if (!visible || !defId) return null;

  const def = BUILDINGS.find(b => b.id === defId);
  if (!def) return null;

  // Position tooltip near cursor, but avoid going off-screen
  const style: React.CSSProperties = {
    left: `${x + 16}px`,
    top: `${y + 16}px`,
  };

  return (
    <div className="building-info" style={style}>
      <div className="building-info-name">{def.name}</div>
      <div className="building-info-desc">{def.description}</div>
      <div className="building-info-meta">
        <span>Size: {def.size}x{def.size}</span>
        {def.cost > 0 && <span>Cost: ${def.cost.toLocaleString()}</span>}
        {direction && <span>Dir: {direction.toUpperCase()}</span>}
      </div>
    </div>
  );
}
