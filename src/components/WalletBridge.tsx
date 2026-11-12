'use client';

import React from 'react';
import { useNearWallet } from 'near-connect-hooks';
import { useGameStore } from '../store/gameStore';

/** Mirrors the signed-in NEAR account into the game store so saves are keyed to it. */
export default function WalletBridge() {
  const { signedAccountId, loading } = useNearWallet();
  const setUserAddress = useGameStore((state) => state.setUserAddress);

  React.useEffect(() => {
    if (loading) return;
    setUserAddress(signedAccountId || null);
  }, [signedAccountId, loading, setUserAddress]);

  return null;
}
