'use client';

import React from 'react';
import { useAccount, useBalance, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { qie } from '../../lib/chains';
import { formatEther, parseEther, type Hex } from 'viem';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../../store/gameStore';
import { EXCHANGE_ITEMS, type ExchangeItemKey } from '../../lib/qieExchange';
import {
  completeqieListingSale,
  createqieListing,
  createqieListingDraft,
  loadqieListings,
  releaseqieListing,
  reserveqieListing,
  type qieListing,
} from '../../game/qieMarket';
import HubPageShell from '../../components/HubPageShell';
import './qie-exchange.css';

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function qieExchangePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingTransaction } = useSendTransaction();
  const router = useRouter();
  const { inventory, hydrateFromSupabase, addResource, isHydrated, isHydrating } = useGameStore();
  const { data: balance } = useBalance({ address });

  const [selectedItem, setSelectedItem] = React.useState<ExchangeItemKey>('wheat');
  const [quantity, setQuantity] = React.useState(1);
  const [unitPriceQie, setUnitPriceQie] = React.useState(EXCHANGE_ITEMS[0].suggestedUnitPriceQie);
  const [listings, setListings] = React.useState<qieListing[]>([]);
  const [loadingListings, setLoadingListings] = React.useState(true);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [activeListingId, setActiveListingId] = React.useState<string | null>(null);
  const [activeTxHash, setActiveTxHash] = React.useState<Hex | undefined>();
  const [saleIntent, setSaleIntent] = React.useState<{ listingId: string; buyerAddress: string; itemKey: ExchangeItemKey; quantity: number } | null>(null);

  React.useEffect(() => {
    if (!address) {
      router.replace('/');
    }
  }, [address, router]);

  React.useEffect(() => {
    if (address) {
      void hydrateFromSupabase();
    }
  }, [address, hydrateFromSupabase]);

  React.useEffect(() => {
    const item = EXCHANGE_ITEMS.find((entry) => entry.key === selectedItem);
    if (!item) return;

    if (!unitPriceQie || unitPriceQie === '0') {
      setUnitPriceQie(item.suggestedUnitPriceQie);
    }
  }, [selectedItem, unitPriceQie]);

  const loadListings = React.useCallback(async () => {
    setLoadingListings(true);
    const nextListings = await loadqieListings();
    setListings(nextListings);
    setLoadingListings(false);
  }, []);

  React.useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const receipt = useWaitForTransactionReceipt({
    hash: activeTxHash,
    query: { enabled: Boolean(activeTxHash) },
  });

  React.useEffect(() => {
    if (!receipt.isSuccess || !saleIntent || !activeTxHash || !address) return;

    const finalizeSale = async () => {
      addResource(saleIntent.itemKey, saleIntent.quantity);
      await completeqieListingSale(saleIntent.listingId, saleIntent.buyerAddress, activeTxHash);
      setStatusMessage('Purchase confirmed on QIE.');
      setSaleIntent(null);
      setActiveTxHash(undefined);
      setActiveListingId(null);
      await loadListings();
    };

    void finalizeSale();
  }, [address, activeTxHash, loadListings, receipt.isSuccess, saleIntent, addResource]);

  React.useEffect(() => {
    if (receipt.isError && saleIntent) {
      void releaseqieListing(saleIntent.listingId, saleIntent.buyerAddress);
      setErrorMessage('The payment transaction failed or was rejected.');
      setSaleIntent(null);
      setActiveTxHash(undefined);
      setActiveListingId(null);
      void loadListings();
    }
  }, [loadListings, receipt.isError, saleIntent]);

  const activeItem = EXCHANGE_ITEMS.find((item) => item.key === selectedItem) ?? EXCHANGE_ITEMS[0];
  const availableQty = inventory[selectedItem];
  const maxQuantity = Math.max(1, availableQty);
  const canList = Boolean(address && quantity > 0 && quantity <= availableQty && unitPriceQie.trim().length > 0);

  const listingPreviewQie = React.useMemo(() => {
    try {
      return formatEther(parseEther(unitPriceQie) * BigInt(quantity));
    } catch {
      return '0';
    }
  }, [quantity, unitPriceQie]);

  const onCreateListing = async () => {
    if (!address) return;
    if (!canList) {
      setErrorMessage('Choose a valid amount and price before listing.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const parsedPrice = unitPriceQie.trim();
      const draft = createqieListingDraft({
        sellerAddress: address,
        itemKey: selectedItem,
        amount: quantity,
        unitPriceWei: parseEther(parsedPrice).toString(),
      });

      const created = await createqieListing(draft);

      if (!created) {
        setErrorMessage('Unable to publish listing to QIE market.');
        return;
      }

      addResource(selectedItem, -quantity);
      setStatusMessage('Listing published. Buyers can now pay your wallet on QIE.');
      setQuantity(1);
      setUnitPriceQie(activeItem.suggestedUnitPriceQie);
      await loadListings();
    } catch {
      setErrorMessage('Enter a valid QIE price such as 0.00001.');
    }
  };

  const onBuyListing = async (listing: qieListing) => {
    if (!address) return;
    if (listing.seller_address.toLowerCase() === address.toLowerCase()) {
      setErrorMessage('You cannot buy your own listing.');
      return;
    }

    if (chainId !== qie.id) {
      setErrorMessage('Switch to QIE to buy items.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    const reserved = await reserveqieListing(listing.id, address);
    if (!reserved) {
      setErrorMessage('That listing was just bought by someone else.');
      await loadListings();
      return;
    }

    setActiveListingId(listing.id);

    try {
      const txHash = await sendTransactionAsync({
        to: listing.seller_address as `0x${string}`,
        value: BigInt(listing.total_price_wei),
      });
      setActiveTxHash(txHash);
      setSaleIntent({ listingId: listing.id, buyerAddress: address, itemKey: listing.item_key, quantity: listing.quantity });
      setStatusMessage('Transaction submitted. Waiting for QIE confirmation...');
    } catch (error) {
      await releaseqieListing(listing.id, address);
      setActiveListingId(null);
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'QIE payment failed.');
      await loadListings();
    }
  };

  const handleSwitchToqie = async () => {
    try {
      await switchChainAsync({ chainId: qie.id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to switch to QIE.');
    }
  };

  const currentBalance = balance?.formatted ?? '0';
  const isqie = chainId === qie.id;
  const storageLoading = isHydrating && !isHydrated;

  return (
    <HubPageShell
      kicker="QIE Settlement"
      title="Public Exchange"
      subtitle="List farm and mine output for direct QIE payment. Buyers pay your wallet on-chain and listings sync through Supabase."
      headerAside={
        <div className="exchange-wallet-card hub-stat-chip">
          <span className="exchange-wallet-label hub-stat-label">Wallet</span>
          <span className="exchange-wallet-value hub-stat-value">
            {isConnected && address ? shortAddress(address) : 'Not connected'}
          </span>
          <span className="exchange-wallet-meta">QIE & ETH</span>
          {!isqie ? (
            <button className="exchange-btn exchange-btn-accent" onClick={handleSwitchToqie} disabled={isSwitchingChain}>
              Switch to QIE
            </button>
          ) : (
            <span className="exchange-chain-pill">QIE active</span>
          )}
        </div>
      }
    >
      {(statusMessage || errorMessage) && (
        <div className={`exchange-banner ${errorMessage ? 'error' : 'success'}`}>
          {errorMessage ?? statusMessage}
        </div>
      )}

      <div className="exchange-grid">
        <section className="exchange-card exchange-form-card">
          <div className="exchange-card-head">
            <div>
              <h2>List Produce</h2>
              <p>Pull stock from your game inventory and publish it for QIE buyers.</p>
            </div>
            <span className="exchange-card-badge">Seller</span>
          </div>

          {storageLoading ? (
            <p className="exchange-loading">Syncing inventory...</p>
          ) : (
            <>
              <div className="exchange-form-grid">
                <label className="exchange-field">
                  <span>Item</span>
                  <select value={selectedItem} onChange={(event) => setSelectedItem(event.target.value as ExchangeItemKey)}>
                    {EXCHANGE_ITEMS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label} ({inventory[item.key]})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="exchange-field">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>

                <label className="exchange-field exchange-field-wide">
                  <span>Unit price in QIE</span>
                  <input
                    type="text"
                    value={unitPriceQie}
                    onChange={(event) => setUnitPriceQie(event.target.value)}
                    placeholder={activeItem.suggestedUnitPriceQie}
                  />
                </label>
              </div>

              <div className="exchange-preview">
                <div>
                  <span className="metric-label">Available</span>
                  <span className="metric-value">{availableQty.toLocaleString()}</span>
                </div>
                <div>
                  <span className="metric-label">Listing total</span>
                  <span className="metric-value">{listingPreviewQie} QIE</span>
                </div>
                <div>
                  <span className="metric-label">On-chain settlement</span>
                  <span className="metric-value">QIE</span>
                </div>
              </div>

              <div className="exchange-actions">
                <button className="exchange-btn exchange-btn-accent" onClick={onCreateListing} disabled={!canList || isSendingTransaction}>
                  Publish Listing
                </button>
                {!isqie && <span className="exchange-help">Switch to QIE to publish or buy listings.</span>}
              </div>
            </>
          )}
        </section>

        <section className="exchange-card exchange-listings-card">
          <div className="exchange-card-head">
            <div>
              <h2>Live Listings</h2>
              <p>Buyers can pay directly to the seller wallet on QIE.</p>
            </div>
            <button className="exchange-btn" onClick={() => void loadListings()} disabled={loadingListings}>
              Refresh
            </button>
          </div>

          {loadingListings ? (
            <p className="exchange-loading">Loading public listings...</p>
          ) : listings.length === 0 ? (
            <p className="exchange-empty">No active listings yet. Be the first to publish produce.</p>
          ) : (
            <ul className="exchange-list">
              {listings.map((listing) => {
                const item = EXCHANGE_ITEMS.find((entry) => entry.key === listing.item_key);
                const isOwnListing = address ? listing.seller_address.toLowerCase() === address.toLowerCase() : false;

                return (
                  <li key={listing.id} className={`exchange-listing ${item?.toneClass ?? ''}`}>
                    <div className="exchange-listing-main">
                      <div className="exchange-listing-title">
                        <span className="exchange-listing-name">{item?.label ?? listing.item_key}</span>
                        <span className="exchange-listing-count">x{listing.quantity}</span>
                      </div>
                      <p className="exchange-listing-desc">{item?.description ?? 'Public produce order'}</p>
                      <div className="exchange-listing-meta">
                        <span>Seller: {shortAddress(listing.seller_address)}</span>
                        <span>Unit: {formatEther(BigInt(listing.unit_price_wei))} QIE</span>
                        <span>Total: {formatEther(BigInt(listing.total_price_wei))} QIE</span>
                      </div>
                    </div>

                    <div className="exchange-listing-actions">
                      <button
                        className="exchange-btn exchange-btn-buy"
                        onClick={() => void onBuyListing(listing)}
                        disabled={isOwnListing || activeListingId === listing.id || !isConnected || !isqie || isSendingTransaction}
                      >
                        {activeListingId === listing.id ? 'Buying...' : 'Buy on QIE'}
                      </button>
                      {isOwnListing && <span className="exchange-help">Your listing</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </HubPageShell>
  );
}