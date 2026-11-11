'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';

export default function WalletButton() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';
  const { address } = useAccount();
  const { connect, connectors, error, isPending, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  if (projectId) {
    return <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />;
  }

  // Fallback UI using injected connectors
  const handleLogout = () => {
    try {
      disconnect();
    } finally {
      router.replace('/');
    }
  };

  if (address) {
    return (
      <div className="wallet-button">
        <span className="wallet-address">{address.slice(0, 6)}...{address.slice(-4)}</span>
        <div className="wallet-actions">
          <Link href="/profile" className="wallet-profile-link">
            Profile
          </Link>
          <button className="btn-logout" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </div>
    );
  }

  const injected = connectors.find((c) => c.id === 'injected' || c.id === 'qieWallet');
  const pendingConnector = variables?.connector;

  return (
    <div>
      <button
        onClick={() => {
          if (!injected) {
            return;
          }
          connect({ connector: injected });
        }}
        disabled={!injected || isPending}
        className="btn-connect"
      >
        {isPending && pendingConnector ? `Connecting ${pendingConnector.name}...` : 'Connect'}
      </button>
      {error && <div className="wallet-error">{error.message}</div>}
    </div>
  );
}
