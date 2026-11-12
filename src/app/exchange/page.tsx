'use client';

import React from 'react';
import { useNearWallet } from 'near-connect-hooks';
import { useGameStore } from '../../store/gameStore';
import { EXCHANGE_ITEMS, type ExchangeItemKey } from '../../lib/exchangeItems';
import {
  NEAR_CONTRACT_ID,
  NEAR_NETWORK,
  explorerAccountUrl,
  explorerTxUrl,
  formatNear,
  parseNear,
  shortAccountId,
} from '../../lib/near';
import { useRequireAccount } from '../../hooks/useRequireAccount';
import {
  buyListing,
  cancelListing,
  createListing,
  depositToChain,
  listingTotal,
  loadListings,
  loadOnChainBalances,
  redeemWithdrawal,
  withdrawToGameOnChain,
  type ContractListing,
  type ItemBalance,
} from '../../game/nearMarket';
import HubPageShell from '../../components/HubPageShell';
import './exchange.css';

const NETWORK_LABEL = NEAR_NETWORK === 'mainnet' ? 'NEAR Mainnet' : 'NEAR Testnet';

function itemLabel(key: string): string {
  return EXCHANGE_ITEMS.find((item) => item.key === key)?.label ?? key;
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer">
      View transaction
    </a>
  );
}

export default function ExchangePage() {
  const { accountId: address } = useRequireAccount();
  const wallet = useNearWallet();
  const { inventory, hydrateFromSupabase, addResource, flushToSupabase, isHydrated, isHydrating } = useGameStore();

  const [balanceYocto, setBalanceYocto] = React.useState<bigint | null>(null);
  const [chainBalances, setChainBalances] = React.useState<ItemBalance[]>([]);
  const [listings, setListings] = React.useState<ContractListing[]>([]);
  const [loadingListings, setLoadingListings] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<React.ReactNode>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Bridge form (storehouse -> chain)
  const [depositItem, setDepositItem] = React.useState<ExchangeItemKey>('wheat');
  const [depositAmount, setDepositAmount] = React.useState(1);

  // Listing form (chain -> market)
  const [listItem, setListItem] = React.useState<ExchangeItemKey>('wheat');
  const [listQuantity, setListQuantity] = React.useState(1);
  const [unitPriceNear, setUnitPriceNear] = React.useState(EXCHANGE_ITEMS[0].suggestedUnitPriceNear);

  React.useEffect(() => {
    if (address) void hydrateFromSupabase();
  }, [address, hydrateFromSupabase]);

  const refreshChain = React.useCallback(async () => {
    if (!NEAR_CONTRACT_ID) {
      setLoadingListings(false);
      return;
    }
    setLoadingListings(true);
    try {
      const [nextListings, nextBalances, nextNear] = await Promise.all([
        loadListings(wallet),
        address ? loadOnChainBalances(wallet, address) : Promise.resolve([]),
        address ? wallet.getBalance(address) : Promise.resolve(null),
      ]);
      setListings(nextListings);
      setChainBalances(nextBalances);
      setBalanceYocto(nextNear);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not reach the NEAR contract.');
    } finally {
      setLoadingListings(false);
    }
    // wallet functions are recreated every render by the provider; refresh only when the account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  React.useEffect(() => {
    void refreshChain();
  }, [refreshChain]);

  const chainBalanceOf = (key: string) => Number(chainBalances.find((entry) => entry.item === key)?.balance ?? 0);

  const run = async (label: string, action: () => Promise<React.ReactNode>) => {
    setBusy(label);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      setStatusMessage(await action());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(null);
      void refreshChain();
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const onDeposit = () =>
    run('deposit', async () => {
      if (!address) throw new Error('Connect a NEAR account first.');
      if (depositAmount < 1 || depositAmount > inventory[depositItem]) throw new Error('You do not have that many in your storehouse.');
      await flushToSupabase(); // make sure the server sees the latest storehouse before it debits
      const result = await depositToChain(wallet, address, depositItem, depositAmount);
      addResource(depositItem, -depositAmount);
      return (
        <>
          Sent {depositAmount} {itemLabel(depositItem)} to your NEAR account. {result.txHash && <TxLink hash={result.txHash} />}
        </>
      );
    });

  const onReturnToGame = (item: string, amount: number) =>
    run(`return-${item}`, async () => {
      if (!address) throw new Error('Connect a NEAR account first.');
      const txHash = await withdrawToGameOnChain(wallet, item as ExchangeItemKey, amount);
      const result = await redeemWithdrawal(wallet, address, txHash);
      for (const entry of result.credited) addResource(entry.item, entry.amount);
      return (
        <>
          {amount} {itemLabel(item)} returned to your storehouse. <TxLink hash={txHash} />
        </>
      );
    });

  const onCreateListing = () =>
    run('list', async () => {
      let price: bigint;
      try {
        price = parseNear(unitPriceNear);
      } catch {
        throw new Error('Enter a valid NEAR price such as 0.001.');
      }
      if (price <= BigInt(0)) throw new Error('Price must be above zero.');
      if (listQuantity < 1 || listQuantity > chainBalanceOf(listItem)) {
        throw new Error('Send these items to your NEAR account first (Bridge panel).');
      }
      const txHash = await createListing(wallet, listItem, listQuantity, price);
      return (
        <>
          Listed {listQuantity} {itemLabel(listItem)} at {unitPriceNear} NEAR each. <TxLink hash={txHash} />
        </>
      );
    });

  const onBuy = (listing: ContractListing) =>
    run(`buy-${listing.id}`, async () => {
      const txHash = await buyListing(wallet, listing);
      return (
        <>
          Bought {listing.quantity} {itemLabel(listing.item)} for {formatNear(listingTotal(listing), 6)} NEAR. They are in your
          NEAR account — use “Return to game” to move them into your storehouse. <TxLink hash={txHash} />
        </>
      );
    });

  const onCancel = (listing: ContractListing) =>
    run(`cancel-${listing.id}`, async () => {
      const txHash = await cancelListing(wallet, listing.id);
      return (
        <>
          Listing cancelled; items are back in your NEAR account. <TxLink hash={txHash} />
        </>
      );
    });

  const storageLoading = isHydrating && !isHydrated;
  const disabled = busy !== null || !address;

  if (!NEAR_CONTRACT_ID) {
    return (
      <HubPageShell kicker="NEAR Settlement" title="NEAR Exchange" subtitle="The market contract is not configured.">
        <div className="exchange-banner error">Set NEXT_PUBLIC_NEAR_CONTRACT_ID in .env.local and restart the server.</div>
      </HubPageShell>
    );
  }

  return (
    <HubPageShell
      kicker="NEAR Settlement"
      title="NEAR Exchange"
      subtitle="Move goods from your storehouse onto NEAR, list them, and buy from other players. Payment and delivery happen in one transaction on the market contract."
      headerAside={
        <div className="exchange-wallet-card hub-stat-chip">
          <span className="exchange-wallet-label hub-stat-label">Account</span>
          <span className="exchange-wallet-value hub-stat-value" title={address ?? undefined}>
            {address ? shortAccountId(address) : 'Not connected'}
          </span>
          <span className="exchange-wallet-meta">{balanceYocto !== null ? `${formatNear(balanceYocto, 4)} NEAR` : '— NEAR'}</span>
          <a className="exchange-chain-pill" href={explorerAccountUrl(NEAR_CONTRACT_ID)} target="_blank" rel="noopener noreferrer">
            {NETWORK_LABEL} · contract
          </a>
        </div>
      }
    >
      {(statusMessage || errorMessage) && (
        <div className={`exchange-banner ${errorMessage ? 'error' : 'success'}`}>{errorMessage ?? statusMessage}</div>
      )}

      <div className="exchange-grid">
        {/* ── Bridge ─────────────────────────────────────────────────────── */}
        <section className="exchange-card exchange-form-card">
          <div className="exchange-card-head">
            <div>
              <h2>Bridge</h2>
              <p>Send goods from your storehouse to your NEAR account, or return them to the game.</p>
            </div>
            <span className="exchange-card-badge">Storehouse ⇄ NEAR</span>
          </div>

          {storageLoading ? (
            <p className="exchange-loading">Syncing storehouse...</p>
          ) : (
            <>
              <div className="exchange-form-grid">
                <label className="exchange-field">
                  <span>Item</span>
                  <select value={depositItem} onChange={(event) => setDepositItem(event.target.value as ExchangeItemKey)}>
                    {EXCHANGE_ITEMS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label} ({inventory[item.key]} in storehouse)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="exchange-field">
                  <span>Amount</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, inventory[depositItem])}
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(Math.max(1, Math.floor(Number(event.target.value)) || 1))}
                  />
                </label>
              </div>
              <div className="exchange-actions">
                <button className="exchange-btn exchange-btn-accent" onClick={() => void onDeposit()} disabled={disabled || inventory[depositItem] < 1}>
                  {busy === 'deposit' ? 'Sending...' : 'Send to NEAR'}
                </button>
              </div>
            </>
          )}

          <h3 className="exchange-subhead">On your NEAR account</h3>
          {chainBalances.length === 0 ? (
            <p className="exchange-empty">Nothing on-chain yet.</p>
          ) : (
            <ul className="exchange-list">
              {chainBalances.map((entry) => (
                <li key={entry.item} className="exchange-listing">
                  <div className="exchange-listing-main">
                    <div className="exchange-listing-title">
                      <span className="exchange-listing-name">{itemLabel(entry.item)}</span>
                      <span className="exchange-listing-count">x{entry.balance}</span>
                    </div>
                  </div>
                  <div className="exchange-listing-actions">
                    <button
                      className="exchange-btn"
                      onClick={() => void onReturnToGame(entry.item, Number(entry.balance))}
                      disabled={disabled}
                    >
                      {busy === `return-${entry.item}` ? 'Returning...' : 'Return to game'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── List ───────────────────────────────────────────────────────── */}
        <section className="exchange-card exchange-form-card">
          <div className="exchange-card-head">
            <div>
              <h2>List for NEAR</h2>
              <p>Items move into escrow on the contract until someone buys them or you cancel.</p>
            </div>
            <span className="exchange-card-badge">Seller</span>
          </div>
          <div className="exchange-form-grid">
            <label className="exchange-field">
              <span>Item</span>
              <select
                value={listItem}
                onChange={(event) => {
                  const key = event.target.value as ExchangeItemKey;
                  setListItem(key);
                  const item = EXCHANGE_ITEMS.find((entry) => entry.key === key);
                  if (item) setUnitPriceNear(item.suggestedUnitPriceNear);
                }}
              >
                {EXCHANGE_ITEMS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} ({chainBalanceOf(item.key)} on NEAR)
                  </option>
                ))}
              </select>
            </label>
            <label className="exchange-field">
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, chainBalanceOf(listItem))}
                value={listQuantity}
                onChange={(event) => setListQuantity(Math.max(1, Math.floor(Number(event.target.value)) || 1))}
              />
            </label>
            <label className="exchange-field exchange-field-wide">
              <span>Unit price in NEAR</span>
              <input type="text" inputMode="decimal" value={unitPriceNear} onChange={(event) => setUnitPriceNear(event.target.value)} />
            </label>
          </div>
          <div className="exchange-actions">
            <button
              className="exchange-btn exchange-btn-accent"
              onClick={() => void onCreateListing()}
              disabled={disabled || chainBalanceOf(listItem) < 1}
            >
              {busy === 'list' ? 'Listing...' : 'Publish listing'}
            </button>
          </div>
        </section>

        {/* ── Listings ───────────────────────────────────────────────────── */}
        <section className="exchange-card exchange-listings-card">
          <div className="exchange-card-head">
            <div>
              <h2>Live Listings</h2>
              <p>Buying pays the seller and delivers the goods in a single NEAR transaction.</p>
            </div>
            <button className="exchange-btn" onClick={() => void refreshChain()} disabled={loadingListings}>
              Refresh
            </button>
          </div>

          {loadingListings && listings.length === 0 ? (
            <p className="exchange-loading">Reading the market contract...</p>
          ) : listings.length === 0 ? (
            <p className="exchange-empty">No active listings yet. Be the first to publish produce.</p>
          ) : (
            <ul className="exchange-list">
              {listings.map((listing) => {
                const item = EXCHANGE_ITEMS.find((entry) => entry.key === listing.item);
                const isOwn = address === listing.seller_id;
                return (
                  <li key={listing.id} className={`exchange-listing ${item?.toneClass ?? ''}`}>
                    <div className="exchange-listing-main">
                      <div className="exchange-listing-title">
                        <span className="exchange-listing-name">{item?.label ?? listing.item}</span>
                        <span className="exchange-listing-count">x{listing.quantity}</span>
                      </div>
                      <p className="exchange-listing-desc">{item?.description ?? 'Public produce order'}</p>
                      <div className="exchange-listing-meta">
                        <span title={listing.seller_id}>Seller: {shortAccountId(listing.seller_id)}</span>
                        <span>Unit: {formatNear(listing.unit_price, 6)} NEAR</span>
                        <span>Total: {formatNear(listingTotal(listing), 6)} NEAR</span>
                      </div>
                    </div>
                    <div className="exchange-listing-actions">
                      {isOwn ? (
                        <button className="exchange-btn" onClick={() => void onCancel(listing)} disabled={disabled}>
                          {busy === `cancel-${listing.id}` ? 'Cancelling...' : 'Cancel'}
                        </button>
                      ) : (
                        <button className="exchange-btn exchange-btn-buy" onClick={() => void onBuy(listing)} disabled={disabled}>
                          {busy === `buy-${listing.id}` ? 'Buying...' : 'Buy with NEAR'}
                        </button>
                      )}
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
