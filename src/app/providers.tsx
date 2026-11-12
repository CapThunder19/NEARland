'use client';

import React from 'react';
import { NearProvider } from 'near-connect-hooks';
import WalletBridge from '../components/WalletBridge';
import { NEAR_NETWORK, NEAR_RPC_URLS } from '../lib/near';

const nearConfig = {
  network: NEAR_NETWORK,
  providers: NEAR_RPC_URLS,
};

const subscribeNoop = () => () => {};

export default function Providers({ children }: { children: React.ReactNode }) {
  // The NEAR connector touches window, localStorage and IndexedDB, so it only mounts in the browser.
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="near-boot-screen">
        <p>CONNECTING TO NEAR...</p>
      </div>
    );
  }

  return (
    <NearProvider config={nearConfig}>
      <WalletBridge />
      {children}
    </NearProvider>
  );
}
