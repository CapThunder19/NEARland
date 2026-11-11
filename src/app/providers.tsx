'use client';

import React from 'react';
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiConfig, createConfig, http, injected } from 'wagmi';
import { qie } from '../lib/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletBridge from '../components/WalletBridge';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

function getQieProvider() {
  if (typeof window === 'undefined') {
    return { id: 'qieWallet', name: 'QIE Wallet', provider: undefined };
  }

  const win = window as any;
  let provider = win.qie;

  if (!provider && (win.ethereum?.isQieWallet || win.ethereum?.isQie)) {
    provider = win.ethereum;
  }

  if (!provider && win.ethereum?.providers) {
    provider = win.ethereum.providers.find((p: any) => p.isQie || p.isQieWallet);
  }

  return {
    id: 'qieWallet',
    name: 'QIE Wallet',
    provider,
  };
}

// Custom wallet definition for QIE Wallet to isolate it from MetaMask and others
const qieWallet = () => ({
  id: 'qieWallet',
  name: 'QIE Wallet',
  iconUrl: 'https://qiewallet.me/assets/logo.png',
  iconBackground: '#0c0a0f',
  downloadUrls: {
    chrome: 'https://chromewebstore.google.com/detail/qie-wallet-and-domain-res/clldhkmlpgpjkchpldnhdfepddglifmb',
    android: 'https://play.google.com/store/apps/details?id=com.qie.wallet',
    ios: 'https://apps.apple.com/us/app/qie-wallet/id1661623847',
  },
  createConnector: () => injected({ target: getQieProvider })
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  if (projectId) {
    const connectors = connectorsForWallets(
      [
        {
          groupName: 'Recommended',
          wallets: [qieWallet, walletConnectWallet],
        },
      ],
      {
        appName: 'QuantumQie',
        projectId,
      }
    );

    const config = createConfig({
      connectors,
      chains: [qie],
      multiInjectedProviderDiscovery: false, // Disable auto discovery of other wallets like MetaMask
      transports: {
        [qie.id]: http(),
      },
    });

    return (
      <WagmiConfig config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <WalletBridge />
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiConfig>
    );
  }

  // Fallback: no WalletConnect project id — support QIE Wallet only and disable automatic discovery
  const wagmiConfig = createConfig({
    chains: [qie],
    multiInjectedProviderDiscovery: false, // Disable auto discovery of other wallets like MetaMask
    connectors: [
      injected({
        target: getQieProvider,
      }),
    ],
    transports: {
      [qie.id]: http(),
    },
  });

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletBridge />
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
}
