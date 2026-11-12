'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNearWallet } from 'near-connect-hooks';
import { shortAccountId } from '../lib/near';

export default function WalletButton() {
  const { signedAccountId, loading, signIn, signOut } = useNearWallet();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      router.replace('/');
    }
  };

  if (signedAccountId) {
    return (
      <div className="wallet-button">
        <span className="wallet-address" title={signedAccountId}>{shortAccountId(signedAccountId)}</span>
        <div className="wallet-actions">
          <Link href="/profile" className="wallet-profile-link">
            Profile
          </Link>
          <button className="btn-logout" onClick={() => void handleLogout()} type="button">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => void handleLogin()} disabled={loading} className="btn-connect" type="button">
        {loading ? 'Loading...' : 'Connect NEAR'}
      </button>
      {error && <div className="wallet-error">{error}</div>}
    </div>
  );
}
