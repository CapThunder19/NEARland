'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { useGameStore } from '../store/gameStore';

export default function WalletBridge() {
  const { address } = useAccount();
  const setUserAddress = useGameStore((state) => state.setUserAddress);

  React.useEffect(() => {
    setUserAddress(address ?? null);
  }, [address, setUserAddress]);

  return null;
}
