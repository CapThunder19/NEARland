'use client';

import React from 'react';
import Link from 'next/link';
import { useNearWallet } from 'near-connect-hooks';
import { useRouter } from 'next/navigation';
import { NEAR_NETWORK, explorerAccountUrl, formatNear } from '../../lib/near';
import HubPageShell from '../../components/HubPageShell';
import { useGameStore } from '../../store/gameStore';
import './profile.css';

const RESOURCE_KEYS = [
  'wheat',
  'potato',
  'rice',
  'iron_ore',
  'copper_ore',
  'diamond',
  'iron_bar',
  'copper_bar',
  'gold_ore',
  'gold_bar',
  'bread',
  'tool',
] as const;

const NETWORK_LABEL = NEAR_NETWORK === 'mainnet' ? 'NEAR Mainnet' : 'NEAR Testnet';

export default function ProfilePage() {
  const { signedAccountId, loading: walletLoading, getBalance, signOut } = useNearWallet();
  const address = signedAccountId || null;
  const router = useRouter();
  const [balanceYocto, setBalanceYocto] = React.useState<bigint | null>(null);
  const { inventory, workers, villageName, setVillageName, hydrateFromSupabase, isHydrated, isHydrating } = useGameStore();
  const [draftVillageName, setDraftVillageName] = React.useState('');
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!walletLoading && !address) {
      router.replace('/');
    }
  }, [walletLoading, address, router]);

  React.useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getBalance(address)
      .then((value) => {
        if (!cancelled) setBalanceYocto(value);
      })
      .catch(() => {
        if (!cancelled) setBalanceYocto(null);
      });
    return () => {
      cancelled = true;
    };
    // getBalance is recreated every render by the provider; refetch only when the account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  React.useEffect(() => {
    if (address) {
      void hydrateFromSupabase();
    }
  }, [address, hydrateFromSupabase]);

  React.useEffect(() => {
    setDraftVillageName(villageName);
  }, [villageName]);

  const resourceUnits = React.useMemo(() => {
    return RESOURCE_KEYS.reduce((total, key) => total + inventory[key], 0);
  }, [inventory]);

  const statusLabel = address ? `${NETWORK_LABEL} online` : 'Not connected';
  const displayVillageName = villageName.trim().length > 0 ? villageName.trim() : 'Unnamed Village';

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      router.replace('/');
    }
  };

  const handleSaveVillageName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const success = await setVillageName(draftVillageName);
      setSaveStatus(success ? 'Village name saved.' : 'Village name could not be saved right now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HubPageShell
      kicker="Operator Profile"
      title="Profile"
      subtitle="Track your wallet, settlement footprint, and the factory state tied to this address."
      headerAside={
        <div className="hub-stat-chip profile-header-chip">
          <span className="hub-stat-label">Session</span>
          <span className="hub-stat-value">{statusLabel}</span>
        </div>
      }
    >
      <div className="profile-grid">
        <section className="dashboard-card profile-hero-card">
          <div className="profile-hero-top">
            <div className="profile-avatar" aria-hidden="true">
              {address ? address.slice(0, 2).toUpperCase() : 'NL'}
            </div>
            <div className="profile-identity">
              <p className="profile-kicker">NEAR account</p>
              <h2 className="profile-address" title={address ?? undefined}>
                {address ? (
                  <a href={explorerAccountUrl(address)} target="_blank" rel="noopener noreferrer">{address}</a>
                ) : 'Not connected'}
              </h2>
              <p className="profile-copy">This NEAR account controls your saves, workers, marketplace stock, and exchange listings.</p>
              <div className="profile-badges">
                <span className="profile-badge">{NETWORK_LABEL}</span>
                <span className="profile-badge profile-badge-accent">{isHydrated && !isHydrating ? 'Sync complete' : 'Syncing data'}</span>
                <span className="profile-badge">{displayVillageName}</span>
              </div>
            </div>
          </div>

          <div className="profile-metrics">
            <div className="profile-metric">
              <span className="profile-metric-label">Wallet balance</span>
              <span className="profile-metric-value">
                {balanceYocto !== null ? `${formatNear(balanceYocto, 4)} NEAR` : '— NEAR'}
              </span>
            </div>
            <div className="profile-metric">
              <span className="profile-metric-label">Workers</span>
              <span className="profile-metric-value">{workers.length}</span>
            </div>
            <div className="profile-metric">
              <span className="profile-metric-label">Stored resources</span>
              <span className="profile-metric-value">{resourceUnits.toLocaleString()}</span>
            </div>
            <div className="profile-metric">
              <span className="profile-metric-label">Treasury</span>
              <span className="profile-metric-value">${inventory.money.toLocaleString()}</span>
            </div>
          </div>
        </section>

        <section className="dashboard-card profile-name-card">
          <div className="profile-card-head">
            <div>
              <h2>Village Name</h2>
              <p>Pick the name shown on your profile and leaderboard row.</p>
            </div>
          </div>
          <form className="profile-name-form" onSubmit={handleSaveVillageName}>
            <label className="profile-name-field">
              <span>Village display name</span>
              <input
                type="text"
                value={draftVillageName}
                onChange={(event) => setDraftVillageName(event.target.value)}
                placeholder="Unnamed Village"
                maxLength={40}
              />
            </label>
            <div className="profile-name-actions">
              <button type="submit" className="btn-logout profile-save-btn" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save name'}
              </button>
              <span className="profile-name-meta">Current: {displayVillageName}</span>
            </div>
            {saveStatus ? <p className="profile-name-status">{saveStatus}</p> : null}
          </form>
        </section>

        <aside className="profile-side-column">
          <section className="dashboard-card profile-actions-card">
            <h2>Quick Transit</h2>
            <div className="profile-links">
              <Link href="/game" className="profile-link-card">
                <span className="profile-link-title">Factory Hub</span>
                <span className="profile-link-copy">Go back to placement, production, and canvas management.</span>
              </Link>
              <Link href="/workers" className="profile-link-card">
                <span className="profile-link-title">Worker Hub</span>
                <span className="profile-link-copy">Review idle workers and expand the roster.</span>
              </Link>
              <Link href="/marketplace" className="profile-link-card">
                <span className="profile-link-title">Marketplace</span>
                <span className="profile-link-copy">Convert extra inventory into credits.</span>
              </Link>
              <Link href="/exchange" className="profile-link-card">
                <span className="profile-link-title">NEAR Exchange</span>
                <span className="profile-link-copy">Sell produce to other players for NEAR.</span>
              </Link>
            </div>
          </section>

          <section className="dashboard-card profile-session-card">
            <h2>Session Control</h2>
            <p className="profile-copy profile-session-copy">Sign out of this NEAR account and return to the landing screen.</p>
            <button
              type="button"
              className="profile-logout-btn btn-logout"
              onClick={() => void handleLogout()}
            >
              Sign out
            </button>
          </section>
        </aside>
      </div>
    </HubPageShell>
  );
}