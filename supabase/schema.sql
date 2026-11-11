ALTER TABLE inventory ADD COLUMN IF NOT EXISTS village_name text not null default '';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS money bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS food bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS wheat bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS potato bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS rice bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS iron_ore bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS copper_ore bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS diamond bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS iron_bar bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS copper_bar bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS gold_ore bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS gold_bar bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bread bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS tool bigint not null default 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now();

create table if not exists inventory (
  save_id text primary key,
  money bigint not null default 0,
  food bigint not null default 0,
  village_name text not null default '',
  wheat bigint not null default 0,
  potato bigint not null default 0,
  rice bigint not null default 0,
  iron_ore bigint not null default 0,
  copper_ore bigint not null default 0,
  diamond bigint not null default 0,
  iron_bar bigint not null default 0,
  copper_bar bigint not null default 0,
  gold_ore bigint not null default 0,
  gold_bar bigint not null default 0,
  bread bigint not null default 0,
  tool bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists workers (
  save_id text not null,
  id text not null,
  type text not null,
  assigned_building_id text,
  updated_at timestamptz not null default now(),
  primary key (save_id, id)
);

create table if not exists buildings (
  save_id text not null,
  id text not null,
  def_id text not null,
  col integer not null,
  row integer not null,
  direction text not null,
  assigned_worker_id text,
  production_progress numeric not null default 0,
  ready_to_harvest boolean not null default false,
  recipe_key text,
  updated_at timestamptz not null default now(),
  primary key (save_id, id)
);

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS recipe_key text;

create index if not exists buildings_save_id_idx on buildings (save_id);
create index if not exists workers_save_id_idx on workers (save_id);

create table if not exists market_listings (
  id text primary key,
  seller_address text not null,
  item_key text not null,
  quantity integer not null,
  unit_price_wei text not null,
  total_price_wei text not null,
  status text not null default 'open',
  buyer_address text,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz
);

create index if not exists market_listings_status_idx on market_listings (status);
create index if not exists market_listings_seller_idx on market_listings (seller_address);

-- Replay-attack guard: a given on-chain tx hash can only ever mark one listing sold.
create unique index if not exists market_listings_tx_hash_unique_idx
  on market_listings (tx_hash) where tx_hash is not null;

-- ── Server-trust economy functions ───────────────────────────────────────────
-- These are the only sanctioned write paths for spending/crediting inventory items.
-- Callers must use the service_role key (i.e. only from Next.js API routes).

create or replace function debit_inventory_item(p_save_id text, p_item text, p_amount bigint)
returns boolean
language plpgsql
as $$
declare
  v_updated int;
begin
  if p_item not in ('money', 'wheat', 'potato', 'rice', 'iron_ore', 'copper_ore', 'diamond') then
    raise exception 'invalid_item_column: %', p_item;
  end if;

  if p_amount <= 0 then
    return true;
  end if;

  execute format(
    'update inventory set %I = %I - $1, updated_at = now() where save_id = $2 and %I >= $1',
    p_item, p_item, p_item
  ) using p_amount, p_save_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function credit_inventory_item(p_save_id text, p_item text, p_amount bigint)
returns void
language plpgsql
as $$
begin
  if p_item not in ('money', 'wheat', 'potato', 'rice', 'iron_ore', 'copper_ore', 'diamond') then
    raise exception 'invalid_item_column: %', p_item;
  end if;

  if p_amount <= 0 then
    return;
  end if;

  execute format(
    'insert into inventory (save_id, %I) values ($1, $2)
     on conflict (save_id) do update set %I = inventory.%I + $2, updated_at = now()',
    p_item, p_item, p_item
  ) using p_save_id, p_amount;
end;
$$;

create or replace function create_market_listing(
  p_id text,
  p_seller_address text,
  p_item_key text,
  p_quantity int,
  p_unit_price_wei text,
  p_total_price_wei text
) returns void
language plpgsql
as $$
declare
  v_save_id text := 'wallet:' || lower(p_seller_address);
  v_debited boolean;
begin
  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select debit_inventory_item(v_save_id, p_item_key, p_quantity) into v_debited;
  if not v_debited then
    raise exception 'insufficient_inventory';
  end if;

  insert into market_listings (
    id, seller_address, item_key, quantity, unit_price_wei, total_price_wei, status
  ) values (
    p_id, lower(p_seller_address), p_item_key, p_quantity, p_unit_price_wei, p_total_price_wei, 'open'
  );
end;
$$;

create or replace function cancel_market_listing(p_id text, p_seller_address text)
returns boolean
language plpgsql
as $$
declare
  v_listing record;
begin
  select * into v_listing from market_listings
    where id = p_id and seller_address = lower(p_seller_address) and status = 'open'
    for update;

  if not found then
    return false;
  end if;

  update market_listings set status = 'cancelled', updated_at = now() where id = p_id;
  perform credit_inventory_item('wallet:' || lower(p_seller_address), v_listing.item_key, v_listing.quantity);
  return true;
end;
$$;
