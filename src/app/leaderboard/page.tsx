import React from 'react';
import { headers } from 'next/headers';
import Leaderboard from '../../components/Leaderboard';
import HubPageShell from '../../components/HubPageShell';

type Row = {
  save_id: string;
  wallet_address: string;
  village_name: string;
  score: number;
  updated_at?: string;
};

async function loadLeaderboard(): Promise<{ rows: Row[]; error: string | null }> {
  try {
    const headerList = await headers();
    const host = headerList.get('host');
    if (!host) return { rows: [], error: 'Unable to determine host for leaderboard fetch.' };
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const url = `${protocol}://${host}/api/leaderboard`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { rows: [], error: data?.error ?? 'Failed to load leaderboard.' };
    }
    if (!Array.isArray(data?.rows)) {
      return { rows: [], error: 'No leaderboard data returned.' };
    }
    return { rows: data.rows as Row[], error: data.rows.length === 0 ? 'No registered wallets found yet.' : null };
  } catch (error) {
    console.warn('Leaderboard server fetch failed', error);
    return { rows: [], error: 'Failed to load leaderboard.' };
  }
}

export default async function LeaderboardPage() {
  const { rows, error } = await loadLeaderboard();

  return (
    <HubPageShell
      kicker="Global Rankings"
      title="Leaderboard"
      subtitle="Top settlements ranked by wealth, crops, and mined resources saved on-chain."
    >
      <Leaderboard initialRows={rows} initialError={error} />
    </HubPageShell>
  );
}
