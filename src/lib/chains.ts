import { type Chain } from 'viem';

export const qie = {
  id: 1990,
  name: 'QIE Mainnet',
  nativeCurrency: { name: 'QIE', symbol: 'QIE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc1mainnet.qie.digital/'] },
  },
} as const satisfies Chain;
