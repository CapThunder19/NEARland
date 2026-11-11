'use client';

import React from 'react';
import { useGameStore } from '../store/gameStore';
import { LEVEL_UPGRADE_COST, MAX_LEVEL } from '../game/economyConstants';

export default function LevelUpgrade() {
  const { level, upgradeLevel, inventory } = useGameStore();

  const isMaxLevel = level >= MAX_LEVEL;
  const upgradeCost = isMaxLevel ? 0 : LEVEL_UPGRADE_COST[(level + 1) as keyof typeof LEVEL_UPGRADE_COST];
  const canAfford = inventory.money >= upgradeCost;
  const levelSteps = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

  return (
    <section className="hub-side-card level-upgrade-card">
      <div className="hub-panel-title">
        <span>Town Hall</span>
        <span className="hub-panel-subtitle">Level {level} / {MAX_LEVEL}</span>
      </div>

      <div className="level-progress">
        {levelSteps.map((step) => (
          <div key={step} className={`level-step ${level >= step ? 'active' : ''}`} />
        ))}
      </div>

      {!isMaxLevel ? (
        <button
          className={`btn level-upgrade-btn ${canAfford ? 'affordable' : ''}`}
          onClick={() => upgradeLevel()}
          disabled={!canAfford}
        >
          Upgrade (${upgradeCost.toLocaleString()})
        </button>
      ) : (
        <div className="level-maxed">Max Level Reached!</div>
      )}
    </section>
  );
}
