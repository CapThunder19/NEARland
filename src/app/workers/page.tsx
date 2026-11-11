'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { getWorkerCost, useGameStore } from '../../store/gameStore';
import { getBuildingDef } from '../../game/buildings';
import { loadBuildings } from '../../game/persistence';
import HubPageShell from '../../components/HubPageShell';
import PixelArt from '../../components/PixelArt';
import './workers.css';

function workerLabel(type: 'farmer' | 'miner' | 'engineer'): string {
  if (type === 'farmer') return '👨‍🌾 Farmer';
  if (type === 'miner') return '⛏️ Miner';
  return '🔧 Engineer';
}

export default function WorkersPage() {
  const { address } = useAccount();
  const router = useRouter();
  const { inventory, workers, buyWorker, hydrateFromSupabase, isHydrated, isHydrating } = useGameStore();
  const [storageLoading, setStorageLoading] = React.useState(true);
  const [storageList, setStorageList] = React.useState<{ total: number; items: { id: string; name: string; count: number }[] }>(
    { total: 0, items: [] },
  );

  React.useEffect(() => {
    if (!address) {
      router.replace('/');
    }
  }, [address, router]);

  React.useEffect(() => {
    const loadHubData = async () => {
      await hydrateFromSupabase();

      const buildings = await loadBuildings();
      const counts = new Map<string, number>();

      for (const building of buildings) {
        counts.set(building.defId, (counts.get(building.defId) ?? 0) + 1);
      }

      const items = Array.from(counts.entries())
        .map(([id, count]) => {
          const def = getBuildingDef(id);
          return { id, name: def?.name ?? id, count };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setStorageList({ total: buildings.length, items });
      setStorageLoading(false);
    };

    void loadHubData();
  }, [hydrateFromSupabase]);

  if (!isHydrated && isHydrating) {
    return (
      <HubPageShell
        kicker="Settlement Crew"
        title="Worker Hub"
        subtitle="Loading your factory roster from the cloud save..."
        showHubLinks={false}
      >
        <p className="empty-roster">Loading factory data...</p>
      </HubPageShell>
    );
  }

  const handleBuyFarmer = () => buyWorker('farmer');
  const handleBuyMiner = () => buyWorker('miner');
  const handleBuyEngineer = () => buyWorker('engineer');
  const availableWorkers = workers.filter((worker) => !worker.assignedBuildingId);
  const farmerCost = getWorkerCost('farmer', workers);
  const minerCost = getWorkerCost('miner', workers);
  const engineerCost = getWorkerCost('engineer', workers);

  return (
    <HubPageShell
      kicker="Settlement Crew"
      title="Worker Hub"
      subtitle="Hire farmers and miners, then assign them to plots on the Factory Hub grid."
      headerAside={
        <div className="hub-stat-chip">
          <span className="hub-stat-label">Treasury</span>
          <span className="hub-stat-value">${inventory.money.toLocaleString()}</span>
        </div>
      }
    >
      <div className="workers-header-row">
        <PixelArt scale={5} />
        <p className="workers-hint">Workers auto-sync when you return to the Factory Hub.</p>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card shop-card">
          <h2>Hiring Bay</h2>
          <div className="shop-grid">
            <div className="shop-item">
              <div className="shop-icon farmer-icon">👨‍🌾</div>
              <div className="shop-info">
                <h3>Farmer</h3>
                <p>Produces carrots, rice, and cabbage at farms, and bakes bread at the Bakery.</p>
                <button className="buy-btn" onClick={handleBuyFarmer} disabled={inventory.money < farmerCost}>
                  Hire ${farmerCost.toLocaleString()}
                </button>
              </div>
            </div>

            <div className="shop-item">
              <div className="shop-icon miner-icon">⛏️</div>
              <div className="shop-info">
                <h3>Miner</h3>
                <p>Extracts ore at copper, iron, gold, and diamond mines.</p>
                <button className="buy-btn" onClick={handleBuyMiner} disabled={inventory.money < minerCost}>
                  Hire ${minerCost.toLocaleString()}
                </button>
              </div>
            </div>

            <div className="shop-item">
              <div className="shop-icon engineer-icon">🔧</div>
              <div className="shop-info">
                <h3>Engineer</h3>
                <p>Operates the Smelter and Toolsmith, refining ore into bars and forging tools.</p>
                <button className="buy-btn" onClick={handleBuyEngineer} disabled={inventory.money < engineerCost}>
                  Hire ${engineerCost.toLocaleString()}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-card available-card">
          <h2>Idle Workers ({availableWorkers.length})</h2>
          {availableWorkers.length === 0 ? (
            <p className="empty-roster">No idle workers right now.</p>
          ) : (
            <ul className="worker-list">
              {availableWorkers.map((w) => (
                <li key={w.id} className="worker-list-item">
                  <div className="worker-type">{workerLabel(w.type)}</div>
                  <div className="worker-status idle">Available</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card storage-card">
          <h2>Placed Structures ({storageList.total})</h2>
          {storageLoading ? (
            <p className="empty-roster">Loading structure list...</p>
          ) : storageList.items.length === 0 ? (
            <p className="empty-roster">No farms or mines placed yet.</p>
          ) : (
            <ul className="storage-list">
              {storageList.items.map((item) => (
                <li key={item.id} className="storage-item">
                  <span className="storage-name">{item.name}</span>
                  <span className="storage-count">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card roster-card">
          <h2>Full Roster ({workers.length})</h2>
          {workers.length === 0 ? (
            <p className="empty-roster">You have no workers yet. Hire some from the bay above.</p>
          ) : (
            <ul className="worker-list worker-list-scroll">
              {workers.map((w) => (
                <li key={w.id} className="worker-list-item">
                  <div className="worker-type">{workerLabel(w.type)}</div>
                  <div className={`worker-status ${w.assignedBuildingId ? 'assigned' : 'idle'}`}>
                    {w.assignedBuildingId ? 'On assignment' : 'Idle'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </HubPageShell>
  );
}
