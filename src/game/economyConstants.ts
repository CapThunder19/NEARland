// Shared economy constants — imported by both client (gameStore, marketplace, engine)
// and server (API routes) so validation can never drift from what the client actually does.

export type ProduceKey =
  | 'wheat'
  | 'potato'
  | 'rice'
  | 'iron_ore'
  | 'copper_ore'
  | 'diamond'
  | 'iron_bar'
  | 'copper_bar'
  | 'gold_ore'
  | 'gold_bar'
  | 'bread'
  | 'tool';

export const PRODUCE_KEYS: ProduceKey[] = [
  'wheat',
  'potato',
  'rice',
  'iron_ore',
  'copper_ore',
  'diamond',
  'iron_bar',
  'copper_bar',
  'gold_ore',
  'gold_bar',
  'bread',
  'tool',
];

/** Seconds for an assigned worker to fill one building's production bar (engine.ts tick loop). */
export const PRODUCTION_CYCLE_SECONDS = 5;

/** Resource yielded per harvest of a ready building, by building defId. */
export const HARVEST_YIELD: Record<string, { resource: ProduceKey; amount: number }> = {
  'farm-wheat': { resource: 'wheat', amount: 10 },
  'farm-potato': { resource: 'potato', amount: 10 },
  'farm-rice': { resource: 'rice', amount: 10 },
  'mine-iron': { resource: 'iron_ore', amount: 10 },
  'mine-copper': { resource: 'copper_ore', amount: 10 },
  'mine-diamond': { resource: 'diamond', amount: 5 },
  'mine-gold': { resource: 'gold_ore', amount: 5 },
};

/** Money yielded per harvest of a ready building with no dedicated resource (e.g. warehouse). */
export const GENERIC_BUILDING_MONEY_YIELD = 5;

/** Crafting recipes — consume `inputAmount` of `input` to produce `outputAmount` of `output`
 * at the building identified by `building` (a BuildingDef id). */
export type RecipeKey =
  | 'iron'
  | 'copper'
  | 'gold'
  | 'bread-wheat'
  | 'bread-potato'
  | 'bread-rice'
  | 'tool-iron'
  | 'tool-copper';

export const RECIPES: Record<
  RecipeKey,
  { building: string; input: ProduceKey; inputAmount: number; output: ProduceKey; outputAmount: number }
> = {
  iron: { building: 'smelter', input: 'iron_ore', inputAmount: 4, output: 'iron_bar', outputAmount: 1 },
  copper: { building: 'smelter', input: 'copper_ore', inputAmount: 4, output: 'copper_bar', outputAmount: 1 },
  gold: { building: 'smelter', input: 'gold_ore', inputAmount: 4, output: 'gold_bar', outputAmount: 1 },
  'bread-wheat': { building: 'bakery', input: 'wheat', inputAmount: 5, output: 'bread', outputAmount: 1 },
  'bread-potato': { building: 'bakery', input: 'potato', inputAmount: 5, output: 'bread', outputAmount: 1 },
  'bread-rice': { building: 'bakery', input: 'rice', inputAmount: 5, output: 'bread', outputAmount: 1 },
  'tool-iron': { building: 'toolsmith', input: 'iron_bar', inputAmount: 2, output: 'tool', outputAmount: 1 },
  'tool-copper': { building: 'toolsmith', input: 'copper_bar', inputAmount: 2, output: 'tool', outputAmount: 1 },
};

const RECIPE_KEYS = Object.keys(RECIPES) as RecipeKey[];

/** Which recipes are available at each crafting building, in cycle order. Derived from RECIPES
 * so the per-building list can never drift out of sync with the recipe table itself. */
export const RECIPES_BY_BUILDING: Record<string, RecipeKey[]> = RECIPE_KEYS.reduce(
  (acc, key) => {
    const building = RECIPES[key].building;
    (acc[building] ??= []).push(key);
    return acc;
  },
  {} as Record<string, RecipeKey[]>,
);

/** BuildingDef ids that are flexible, recipe-driven crafting buildings (as opposed to raw harvesters). */
export const RECIPE_BUILDING_IDS = new Set(Object.keys(RECIPES_BY_BUILDING));

/** Display label for a recipe, shown in the HUD while placing/operating a crafting building.
 * Uses the same "Carrot/Rice/Cabbage" crop reskin that buildings.ts and marketplace/page.tsx use
 * for wheat/potato/rice, not the literal ProduceKey names. */
export const RECIPE_LABELS: Record<RecipeKey, string> = {
  iron: 'IRON',
  copper: 'COPPER',
  gold: 'GOLD',
  'bread-wheat': 'CARROT BREAD',
  'bread-potato': 'RICE BREAD',
  'bread-rice': 'CABBAGE BREAD',
  'tool-iron': 'IRON TOOL',
  'tool-copper': 'COPPER TOOL',
};

/** Worker type required to operate a given building, for buildings that don't follow the
 * default farm->farmer / mine->miner rule. */
export const REQUIRED_WORKER_TYPE: Record<string, 'farmer' | 'miner' | 'engineer'> = {
  smelter: 'engineer',
  toolsmith: 'engineer',
  bakery: 'farmer',
};

export const BASE_WORKER_COSTS: Record<'farmer' | 'miner' | 'engineer', number> = {
  farmer: 50,
  miner: 100,
  engineer: 150,
};

export const MAX_LEVEL = 8;

export const LEVEL_UPGRADE_COST: Record<2 | 3 | 4 | 5 | 6 | 7 | 8, number> = {
  2: 5000,
  3: 10000,
  4: 20000,
  5: 40000,
  6: 80000,
  7: 150000,
  8: 300000,
};

/** Global production-speed multiplier unlocked at higher levels (applied to engine.ts's tick progress). */
export function getProductionSpeedMultiplier(level: number): number {
  let multiplier = 1;
  if (level >= 6) multiplier *= 1.1;
  if (level >= 7) multiplier *= 1.1;
  return multiplier;
}

/** NPC sell-to-house pricing curve (marketplace/page.tsx) — single source of truth so the
 * server-side sell-price ceiling can never drift from what the market page actually pays out. */
export type MarketPriceConfig = {
  basePrice: number;
  targetStock: number;
  minMultiplier: number;
  maxMultiplier: number;
  step: number;
};

export const MARKET_PRICE_CONFIG: Record<ProduceKey, MarketPriceConfig> = {
  wheat: { basePrice: 6, targetStock: 140, minMultiplier: 0.6, maxMultiplier: 1.6, step: 1 },
  potato: { basePrice: 7, targetStock: 120, minMultiplier: 0.6, maxMultiplier: 1.7, step: 1 },
  rice: { basePrice: 8, targetStock: 110, minMultiplier: 0.6, maxMultiplier: 1.7, step: 1 },
  iron_ore: { basePrice: 12, targetStock: 80, minMultiplier: 0.6, maxMultiplier: 1.7, step: 1 },
  copper_ore: { basePrice: 14, targetStock: 60, minMultiplier: 0.6, maxMultiplier: 1.8, step: 1 },
  diamond: { basePrice: 30, targetStock: 40, minMultiplier: 0.7, maxMultiplier: 2.2, step: 1 },
  iron_bar: { basePrice: 70, targetStock: 30, minMultiplier: 0.6, maxMultiplier: 1.8, step: 1 },
  copper_bar: { basePrice: 85, targetStock: 25, minMultiplier: 0.6, maxMultiplier: 1.9, step: 1 },
  gold_ore: { basePrice: 45, targetStock: 25, minMultiplier: 0.6, maxMultiplier: 2.0, step: 1 },
  gold_bar: { basePrice: 260, targetStock: 15, minMultiplier: 0.6, maxMultiplier: 2.0, step: 1 },
  bread: { basePrice: 50, targetStock: 60, minMultiplier: 0.6, maxMultiplier: 1.7, step: 1 },
  tool: { basePrice: 300, targetStock: 15, minMultiplier: 0.6, maxMultiplier: 2.0, step: 1 },
};

/** basePrice * maxMultiplier — the ceiling price a single unit could ever legitimately sell for. */
export const MAX_MARKET_SELL_PRICE: Record<ProduceKey, number> = PRODUCE_KEYS.reduce(
  (acc, key) => {
    acc[key] = MARKET_PRICE_CONFIG[key].basePrice * MARKET_PRICE_CONFIG[key].maxMultiplier;
    return acc;
  },
  {} as Record<ProduceKey, number>,
);
