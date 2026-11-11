'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useGameStore, type Inventory } from '../../store/gameStore';
import { MARKET_PRICE_CONFIG, type ProduceKey } from '../../game/economyConstants';
import HubPageShell from '../../components/HubPageShell';
import './marketplace.css';

type MarketKey = ProduceKey;

type MarketItem = {
  key: MarketKey;
  label: string;
  description: string;
  toneClass: string;
};

const MARKET_ITEMS: MarketItem[] = [
  {
    key: 'wheat',
    label: 'Carrot Crates',
    description: 'Bright harvest crates headed for city markets.',
    toneClass: 'tone-wheat',
  },
  {
    key: 'potato',
    label: 'Rice Sacks',
    description: 'Staple grain shipments for regional kitchens.',
    toneClass: 'tone-potato',
  },
  {
    key: 'rice',
    label: 'Cabbage Bundles',
    description: 'Leafy bundles packed fresh from the fields.',
    toneClass: 'tone-rice',
  },
  {
    key: 'iron_ore',
    label: 'Iron Ore',
    description: 'High-demand feedstock for refinery lines.',
    toneClass: 'tone-iron',
  },
  {
    key: 'copper_ore',
    label: 'Copper Ore',
    description: 'Premium-grade ore for coil fabrication.',
    toneClass: 'tone-copper',
  },
  {
    key: 'diamond',
    label: 'Diamond Crystals',
    description: 'Ultra-rare stock for precision tooling.',
    toneClass: 'tone-diamond',
  },
  {
    key: 'iron_bar',
    label: 'Iron Bars',
    description: 'Refined ingots, smelted from raw iron ore.',
    toneClass: 'tone-iron',
  },
  {
    key: 'copper_bar',
    label: 'Copper Bars',
    description: 'Refined ingots, smelted from raw copper ore.',
    toneClass: 'tone-copper',
  },
  {
    key: 'gold_ore',
    label: 'Gold Ore',
    description: 'Precious ore fresh from the deep vein.',
    toneClass: 'tone-diamond',
  },
  {
    key: 'gold_bar',
    label: 'Gold Bars',
    description: 'Refined bullion, smelted from raw gold ore.',
    toneClass: 'tone-diamond',
  },
  {
    key: 'bread',
    label: 'Bread Loaves',
    description: 'Fresh-baked loaves, ready for market stalls.',
    toneClass: 'tone-wheat',
  },
  {
    key: 'tool',
    label: 'Tools',
    description: 'Forged implements, prized by every settlement.',
    toneClass: 'tone-iron',
  },
];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function computeMarketPrice(key: MarketKey, inventory: Inventory): number {
  const config = MARKET_PRICE_CONFIG[key];
  const stock = inventory[key];
  const pressure = (config.targetStock - stock) / (config.targetStock * 2.5);
  const multiplier = clampNumber(1 + pressure, config.minMultiplier, config.maxMultiplier);
  const raw = config.basePrice * multiplier;

  return Math.max(1, roundToStep(raw, config.step));
}

export default function MarketplacePage() {
  const { address } = useAccount();
  const router = useRouter();
  const { inventory, addResource, hydrateFromSupabase, isHydrated, isHydrating } = useGameStore();

  React.useEffect(() => {
    if (!address) {
      router.replace('/');
    }
  }, [address, router]);

  React.useEffect(() => {
    if (address) {
      void hydrateFromSupabase();
    }
  }, [address, hydrateFromSupabase]);

  const storageLoading = isHydrating && !isHydrated;
  const priceByKey = React.useMemo(() => {
    return MARKET_ITEMS.reduce(
      (acc, item) => {
        acc[item.key] = computeMarketPrice(item.key, inventory);
        return acc;
      },
      {} as Record<MarketKey, number>,
    );
  }, [inventory]);

  const totalInventoryValue = React.useMemo(() => {
    return MARKET_ITEMS.reduce((sum, item) => sum + inventory[item.key] * priceByKey[item.key], 0);
  }, [inventory, priceByKey]);

  const totalUnits = React.useMemo(() => {
    return MARKET_ITEMS.reduce((sum, item) => sum + inventory[item.key], 0);
  }, [inventory]);

  const handleSell = (key: MarketItem['key'], amount: number, unitPrice: number) => {
    if (amount <= 0) return;
    const available = inventory[key];
    const sellAmount = Math.min(available, amount);
    if (sellAmount <= 0) return;

    addResource(key, -sellAmount);
    addResource('money', sellAmount * unitPrice);
  };

  const handleSellAll = (key: MarketItem['key'], unitPrice: number) => {
    handleSell(key, inventory[key], unitPrice);
  };

  const handleSellEverything = () => {
    MARKET_ITEMS.forEach((item) => {
      handleSell(item.key, inventory[item.key], priceByKey[item.key]);
    });
  };

  return (
    <HubPageShell
      kicker="Trade Floor"
      title="Marketplace"
      subtitle="Sell produced goods and convert stock into credits. Prices shift with your warehouse supply."
      headerAside={
        <div className="market-balance hub-stat-chip">
          <span className="market-balance-label hub-stat-label">Wallet Balance</span>
          <span className="market-balance-value hub-stat-value">${inventory.money.toLocaleString()}</span>
        </div>
      }
    >
      <div className="market-grid">
        <section className="market-card market-board" style={{ animationDelay: '0.05s' }}>
          <div className="market-card-header">
            <div>
              <h2>Market Board</h2>
              <p>Live purchase orders for your production.</p>
            </div>
            <button
              className="market-btn market-btn-ghost"
              onClick={handleSellEverything}
              disabled={storageLoading || totalUnits === 0}
            >
              Sell Everything
            </button>
          </div>

          {storageLoading ? (
            <p className="market-loading">Syncing warehouse data...</p>
          ) : (
            <ul className="market-list">
              {MARKET_ITEMS.map((item, index) => {
                const available = inventory[item.key];
                const unitPrice = priceByKey[item.key];
                const totalValue = available * unitPrice;
                const canSellOne = available >= 1;
                const canSellTen = available >= 10;
                const canSellAll = available >= 1;

                return (
                  <li
                    key={item.key}
                    className={`market-item ${item.toneClass}`}
                    style={{ animationDelay: `${0.12 + index * 0.06}s` }}
                  >
                    <div className="market-item-main">
                      <div className="market-item-title">
                        <span className="market-item-label">{item.label}</span>
                        <span className="market-item-price">${unitPrice}/unit</span>
                      </div>
                      <p className="market-item-desc">{item.description}</p>
                      <div className="market-item-metrics">
                        <div>
                          <span className="metric-label">Available</span>
                          <span className="metric-value">{available.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="metric-label">Batch Value</span>
                          <span className="metric-value">${totalValue.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="market-item-actions">
                      <button
                        className="market-btn"
                        onClick={() => handleSell(item.key, 1, unitPrice)}
                        disabled={!canSellOne}
                      >
                        Sell 1
                      </button>
                      <button
                        className="market-btn"
                        onClick={() => handleSell(item.key, 10, unitPrice)}
                        disabled={!canSellTen}
                      >
                        Sell 10
                      </button>
                      <button
                        className="market-btn market-btn-accent"
                        onClick={() => handleSellAll(item.key, unitPrice)}
                        disabled={!canSellAll}
                      >
                        Sell All
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="market-sidebar">
          <section className="market-card market-summary" style={{ animationDelay: '0.15s' }}>
            <h2>Inventory Snapshot</h2>
            <div className="market-summary-grid">
              {MARKET_ITEMS.map((item) => (
                <div key={item.key} className={`summary-tile ${item.toneClass}`}>
                  <span className="summary-label">{item.label}</span>
                  <span className="summary-value">{inventory[item.key].toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="market-summary-total">
              <div>
                <span className="metric-label">Total Units</span>
                <span className="metric-value">{totalUnits.toLocaleString()}</span>
              </div>
              <div>
                <span className="metric-label">Potential Earnings</span>
                <span className="metric-value">${totalInventoryValue.toLocaleString()}</span>
              </div>
            </div>
          </section>

          <section className="market-card market-rules" style={{ animationDelay: '0.22s' }}>
            <h2>Trade Notes</h2>
            <ul className="market-rules-list">
              <li>Prices shift with supply and demand in your storage.</li>
              <li>Sales settle instantly into your wallet balance.</li>
              <li>Market rates recalc after each batch is sold.</li>
            </ul>
          </section>
        </aside>
      </div>
    </HubPageShell>
  );
}
