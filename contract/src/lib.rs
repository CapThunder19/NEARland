//! NEARland market contract.
//!
//! Holds on-chain balances of the game's 12 resources (a simplified multi-token ledger in the
//! spirit of NEP-245) and runs an escrowed player-to-player market settled in NEAR:
//!
//! * The game server (`owner_id`) mints items when a player moves harvested goods on-chain.
//! * A seller lists items; they are moved into escrow inside this contract.
//! * A buyer attaches NEAR to `buy_listing`; in the same transaction the seller is paid,
//!   the buyer receives the items and any overpayment is refunded.
//! * Players can burn items back into the off-chain game with `withdraw_to_game`.
//!
//! Every state change emits a NEP-297 `EVENT_JSON:` log so the game server and indexers can
//! follow the economy.

use near_sdk::json_types::U128;
use near_sdk::serde::Serialize;
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

/// Resource keys, identical to `ProduceKey` in the game (src/game/economyConstants.ts).
pub const ITEMS: [&str; 12] = [
    "wheat",
    "potato",
    "rice",
    "iron_ore",
    "copper_ore",
    "diamond",
    "iron_bar",
    "copper_bar",
    "gold_ore",
    "gold_bar",
    "bread",
    "tool",
];

const EVENT_STANDARD: &str = "nearland";
const EVENT_VERSION: &str = "1.0.0";
const MAX_PAGE: u64 = 100;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Listing {
    pub id: u64,
    pub seller_id: AccountId,
    pub item: String,
    pub quantity: u32,
    /// Price per unit in yoctoNEAR.
    pub unit_price: U128,
}

impl Listing {
    pub fn total_price(&self) -> u128 {
        self.unit_price
            .0
            .checked_mul(self.quantity as u128)
            .unwrap_or_else(|| env::panic_str("price overflow"))
    }
}

#[near(serializers = [json])]
#[derive(Debug, PartialEq)]
pub struct ItemBalance {
    pub item: String,
    pub balance: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Game server account allowed to mint items.
    owner_id: AccountId,
    /// (account, item) -> balance
    balances: LookupMap<(AccountId, String), u128>,
    listings: IterableMap<u64, Listing>,
    next_listing_id: u64,
}

fn assert_item(item: &str) {
    require!(ITEMS.contains(&item), format!("unknown item: {item}"));
}

fn emit<T: Serialize>(event: &str, data: T) {
    let payload = json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_VERSION,
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            balances: LookupMap::new(b"b"),
            listings: IterableMap::new(b"l"),
            next_listing_id: 0,
        }
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// Game server only: credit harvested items to a player's on-chain balance.
    pub fn mint(&mut self, account_id: AccountId, item: String, amount: U128) {
        require!(env::predecessor_account_id() == self.owner_id, "only the game server can mint");
        assert_item(&item);
        require!(amount.0 > 0, "amount must be positive");
        self.credit(&account_id, &item, amount.0);
        emit("mint", json!({ "owner_id": account_id, "item": item, "amount": amount }));
    }

    pub fn set_owner(&mut self, owner_id: AccountId) {
        require!(env::predecessor_account_id() == self.owner_id, "only the owner can change the owner");
        self.owner_id = owner_id;
    }

    // ── Player actions ────────────────────────────────────────────────────────

    /// Send items to another account (gifts, NPC deliveries).
    pub fn transfer(&mut self, receiver_id: AccountId, item: String, amount: U128) {
        assert_item(&item);
        let sender_id = env::predecessor_account_id();
        require!(sender_id != receiver_id, "cannot transfer to yourself");
        require!(amount.0 > 0, "amount must be positive");
        self.debit(&sender_id, &item, amount.0);
        self.credit(&receiver_id, &item, amount.0);
        emit(
            "transfer",
            json!({ "old_owner_id": sender_id, "new_owner_id": receiver_id, "item": item, "amount": amount }),
        );
    }

    /// Burn items so the game server credits them back to the player's in-game storehouse.
    pub fn withdraw_to_game(&mut self, item: String, amount: U128) {
        assert_item(&item);
        let account_id = env::predecessor_account_id();
        require!(amount.0 > 0, "amount must be positive");
        self.debit(&account_id, &item, amount.0);
        emit("withdraw_to_game", json!({ "owner_id": account_id, "item": item, "amount": amount }));
    }

    /// Move items into escrow and open a listing. Returns the listing id.
    pub fn create_listing(&mut self, item: String, quantity: u32, unit_price: U128) -> u64 {
        assert_item(&item);
        require!(quantity > 0, "quantity must be positive");
        require!(unit_price.0 > 0, "price must be positive");
        let seller_id = env::predecessor_account_id();
        self.debit(&seller_id, &item, quantity as u128);

        let id = self.next_listing_id;
        self.next_listing_id += 1;
        let listing = Listing { id, seller_id, item, quantity, unit_price };
        listing.total_price(); // overflow check up front
        emit("listing_created", &listing);
        self.listings.insert(id, listing);
        id
    }

    /// Seller only: close a listing and return the escrowed items.
    pub fn cancel_listing(&mut self, listing_id: u64) {
        let listing = self.listings.remove(&listing_id).unwrap_or_else(|| env::panic_str("listing not found"));
        require!(env::predecessor_account_id() == listing.seller_id, "only the seller can cancel");
        self.credit(&listing.seller_id, &listing.item, listing.quantity as u128);
        emit("listing_cancelled", &listing);
    }

    /// Buy a whole listing. Attach at least the total price in NEAR; the seller is paid and any
    /// excess is refunded in the same transaction.
    #[payable]
    pub fn buy_listing(&mut self, listing_id: u64) -> Promise {
        let listing = self.listings.remove(&listing_id).unwrap_or_else(|| env::panic_str("listing not found"));
        let buyer_id = env::predecessor_account_id();
        require!(buyer_id != listing.seller_id, "cannot buy your own listing");

        let price = listing.total_price();
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= price, format!("attached deposit {deposit} is below the price {price}"));

        self.credit(&buyer_id, &listing.item, listing.quantity as u128);
        emit(
            "listing_sold",
            json!({
                "listing_id": listing.id,
                "seller_id": listing.seller_id,
                "buyer_id": buyer_id,
                "item": listing.item,
                "quantity": listing.quantity,
                "price": U128(price),
            }),
        );

        let payout = Promise::new(listing.seller_id).transfer(NearToken::from_yoctonear(price));
        let refund = deposit - price;
        if refund > 0 {
            payout.and(Promise::new(buyer_id).transfer(NearToken::from_yoctonear(refund)))
        } else {
            payout
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn get_items(&self) -> Vec<String> {
        ITEMS.iter().map(|s| s.to_string()).collect()
    }

    pub fn balance_of(&self, account_id: AccountId, item: String) -> U128 {
        U128(self.balances.get(&(account_id, item)).copied().unwrap_or(0))
    }

    /// All non-zero balances for an account.
    pub fn balances_of(&self, account_id: AccountId) -> Vec<ItemBalance> {
        ITEMS
            .iter()
            .filter_map(|item| {
                let balance = self.balances.get(&(account_id.clone(), item.to_string())).copied().unwrap_or(0);
                (balance > 0).then(|| ItemBalance { item: item.to_string(), balance: U128(balance) })
            })
            .collect()
    }

    /// NEP-245 style view: balance of one token id (item key) for an account.
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        self.balance_of(account_id, token_id)
    }

    pub fn get_listing(&self, listing_id: u64) -> Option<Listing> {
        self.listings.get(&listing_id).cloned()
    }

    pub fn get_listings(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<Listing> {
        let from = from_index.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(50).min(MAX_PAGE) as usize;
        self.listings.values().skip(from).take(limit).cloned().collect()
    }

    pub fn get_listings_count(&self) -> u64 {
        self.listings.len() as u64
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    fn credit(&mut self, account_id: &AccountId, item: &str, amount: u128) {
        let key = (account_id.clone(), item.to_string());
        let current = self.balances.get(&key).copied().unwrap_or(0);
        let next = current.checked_add(amount).unwrap_or_else(|| env::panic_str("balance overflow"));
        self.balances.insert(key, next);
    }

    fn debit(&mut self, account_id: &AccountId, item: &str, amount: u128) {
        let key = (account_id.clone(), item.to_string());
        let current = self.balances.get(&key).copied().unwrap_or(0);
        require!(current >= amount, format!("insufficient {item}: have {current}, need {amount}"));
        let next = current - amount;
        if next == 0 {
            self.balances.remove(&key);
        } else {
            self.balances.insert(key, next);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    fn acc(name: &str) -> AccountId {
        name.parse().unwrap()
    }

    fn ctx(predecessor: &str, deposit: u128) {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(acc(predecessor))
            .attached_deposit(NearToken::from_yoctonear(deposit));
        testing_env!(builder.build());
    }

    fn setup() -> Contract {
        ctx("game.testnet", 0);
        let mut c = Contract::new(acc("game.testnet"));
        c.mint(acc("alice.testnet"), "tool".into(), U128(10));
        c
    }

    #[test]
    fn mint_credits_balance_and_logs_event() {
        let c = setup();
        assert_eq!(c.balance_of(acc("alice.testnet"), "tool".into()), U128(10));
        assert!(get_logs()[0].starts_with("EVENT_JSON:"));
        assert!(get_logs()[0].contains("\"event\":\"mint\""));
    }

    #[test]
    #[should_panic(expected = "only the game server can mint")]
    fn only_owner_can_mint() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        c.mint(acc("alice.testnet"), "tool".into(), U128(1));
    }

    #[test]
    #[should_panic(expected = "unknown item")]
    fn rejects_unknown_items() {
        let mut c = setup();
        c.mint(acc("alice.testnet"), "gold_coin".into(), U128(1));
    }

    #[test]
    fn listing_escrows_and_buy_settles() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        let id = c.create_listing("tool".into(), 4, U128(100));
        assert_eq!(c.balance_of(acc("alice.testnet"), "tool".into()), U128(6));
        assert_eq!(c.get_listings(None, None).len(), 1);

        ctx("bob.testnet", 450);
        let _ = c.buy_listing(id);
        assert_eq!(c.balance_of(acc("bob.testnet"), "tool".into()), U128(4));
        assert_eq!(c.get_listings_count(), 0);
        assert!(get_logs().iter().any(|l| l.contains("listing_sold")));
    }

    #[test]
    #[should_panic(expected = "below the price")]
    fn buy_requires_full_payment() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        let id = c.create_listing("tool".into(), 4, U128(100));
        ctx("bob.testnet", 399);
        let _ = c.buy_listing(id);
    }

    #[test]
    #[should_panic(expected = "cannot buy your own listing")]
    fn cannot_buy_own_listing() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        let id = c.create_listing("tool".into(), 1, U128(100));
        ctx("alice.testnet", 100);
        let _ = c.buy_listing(id);
    }

    #[test]
    fn cancel_returns_escrow() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        let id = c.create_listing("tool".into(), 3, U128(100));
        c.cancel_listing(id);
        assert_eq!(c.balance_of(acc("alice.testnet"), "tool".into()), U128(10));
        assert!(c.get_listing(id).is_none());
    }

    #[test]
    #[should_panic(expected = "only the seller can cancel")]
    fn only_seller_can_cancel() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        let id = c.create_listing("tool".into(), 3, U128(100));
        ctx("bob.testnet", 0);
        c.cancel_listing(id);
    }

    #[test]
    #[should_panic(expected = "insufficient tool")]
    fn cannot_list_more_than_owned() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        c.create_listing("tool".into(), 11, U128(1));
    }

    #[test]
    fn transfer_and_withdraw() {
        let mut c = setup();
        ctx("alice.testnet", 0);
        c.transfer(acc("bob.testnet"), "tool".into(), U128(2));
        c.withdraw_to_game("tool".into(), U128(3));
        assert_eq!(c.balance_of(acc("alice.testnet"), "tool".into()), U128(5));
        assert_eq!(
            c.balances_of(acc("bob.testnet")),
            vec![ItemBalance { item: "tool".into(), balance: U128(2) }]
        );
    }
}
