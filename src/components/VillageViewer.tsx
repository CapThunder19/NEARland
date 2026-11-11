'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PlacedBuilding } from '../game/buildings';
import { loadBuildings } from '../game/persistence';
import { createCamera } from '../game/camera';
import { render } from '../game/renderer';
import { createInputState } from '../game/input';
import { GameWorld } from '../game/placement';

interface VillageViewerProps {
  saveId: string;
  villageName: string;
  onClose: () => void;
}

export default function VillageViewer({ saveId, villageName, onClose }: VillageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [buildings, setBuildings] = useState<PlacedBuilding[] | null>(null);

  useEffect(() => {
    let mounted = true;
    loadBuildings(saveId).then((data) => {
      if (mounted) setBuildings(data);
    });
    return () => {
      mounted = false;
    };
  }, [saveId]);

  useEffect(() => {
    if (!buildings || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const camera = createCamera();
    camera.zoom = 0.5;

    if (buildings.length > 0) {
      let sumCol = 0,
        sumRow = 0;
      for (const b of buildings) {
        sumCol += b.col;
        sumRow += b.row;
      }
      camera.x = (sumCol / buildings.length) * 32;
      camera.y = (sumRow / buildings.length) * 32;
      camera.targetX = camera.x;
      camera.targetY = camera.y;
    }

    const world: GameWorld = { buildings, nextBuildingId: 1000 };
    const input = createInputState();

    let animationId: number;
    const animate = (time: number) => {
      // Keep canvas size synced if modal changes size
      const currentWidth = canvas.clientWidth;
      const currentHeight = canvas.clientHeight;
      if (canvas.width !== currentWidth * dpr || canvas.height !== currentHeight * dpr) {
        canvas.width = currentWidth * dpr;
        canvas.height = currentHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      render(ctx, camera, currentWidth, currentHeight, world, input, time);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [buildings]);

  return (
    <div className="village-viewer-overlay">
      <div className="village-viewer-modal hub-side-card">
        <div className="village-viewer-header">
          <div className="hub-panel-title">
            <span>{villageName}</span>
            <span className="hub-panel-subtitle">Village Overview</span>
          </div>
          <button className="btn village-viewer-close" onClick={onClose}>
            X
          </button>
        </div>
        <div className="village-viewer-content">
          {!buildings ? (
            <p className="village-viewer-loading">Syncing {villageName} data...</p>
          ) : (
            <canvas ref={canvasRef} className="village-viewer-canvas" />
          )}
        </div>
        {buildings && (
          <div className="village-viewer-footer">
            <span className="hub-panel-subtitle">{buildings.length} buildings constructed</span>
          </div>
        )}
      </div>
    </div>
  );
}
