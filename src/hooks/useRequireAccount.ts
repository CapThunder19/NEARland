'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useNearWallet } from 'near-connect-hooks';

/**
 * Returns the signed-in NEAR account ID (or null) and redirects to the landing page
 * once the wallet has finished restoring its session and nobody is signed in.
 */
export function useRequireAccount(): { accountId: string | null; walletLoading: boolean } {
  const { signedAccountId, loading } = useNearWallet();
  const router = useRouter();
  const accountId = signedAccountId || null;

  React.useEffect(() => {
    if (!loading && !accountId) {
      router.replace('/');
    }
  }, [loading, accountId, router]);

  return { accountId, walletLoading: loading };
}
