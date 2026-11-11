"use client";

import React, { useState } from 'react';
import VillageViewer from './VillageViewer';

type Row = {
  save_id: string;
  wallet_address: string;
  village_name: string;
  score: number;
  updated_at?: string;
};

function formatAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

type LeaderboardProps = {
  initialRows?: Row[];
  initialError?: string | null;
};

export default function Leaderboard({ initialRows = [], initialError = null }: LeaderboardProps) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [viewingVillage, setViewingVillage] = useState<{ saveId: string; villageName: string } | null>(null);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRows([]);
        setError(data?.error ?? 'Failed to load leaderboard.');
        return;
      }
      if (Array.isArray(data?.rows)) {
        setRows(data.rows as Row[]);
        if (data.rows.length === 0) {
          setError('No registered wallets found yet.');
        }
      } else {
        setRows([]);
        setError('No leaderboard data returned.');
      }
    } catch (e) {
      setRows([]);
      setError('Failed to load leaderboard.');
      console.warn('Failed to load leaderboard', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  return (
    <div className="leaderboard-panel">
      <div className="leaderboard-header">
        <p className="leaderboard-tagline">Rankings refresh from your Supabase save scores.</p>
        <button onClick={fetchRows} disabled={loading} className="btn">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="leaderboard-meta">Rows: {rows.length}</div>
      {error && !loading && <div className="leaderboard-error">{error}</div>}
      {loading ? (
        <p className="empty-roster">Loading rankings...</p>
      ) : (
        <ol className="leaderboard-list">
          {rows.map((r, idx) => (
            <li key={r.save_id} className="leaderboard-row">
              <span className="rank">#{idx + 1}</span>
              <span className="leaderboard-name-block">
                <span className="name">{r.village_name}</span>
                <span className="wallet">{formatAddress(r.wallet_address)}</span>
              </span>
              <span className="score">{r.score.toLocaleString()}</span>
              <button 
                className="btn btn-view-village" 
                onClick={() => setViewingVillage({ saveId: r.save_id, villageName: r.village_name })}
              >
                View Village
              </button>
            </li>
          ))}
          {rows.length === 0 && !error && <li>Click Refresh to load the leaderboard.</li>}
        </ol>
      )}

      {viewingVillage && (
        <VillageViewer 
          saveId={viewingVillage.saveId} 
          villageName={viewingVillage.villageName} 
          onClose={() => setViewingVillage(null)} 
        />
      )}
    </div>
  );
}
