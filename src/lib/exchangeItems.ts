// Items players can list on the NEAR Exchange, with suggested unit prices in NEAR.
export type ExchangeItemKey =
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

export type ExchangeItem = {
  key: ExchangeItemKey;
  label: string;
  description: string;
  toneClass: string;
  suggestedUnitPriceNear: string;
};

export const EXCHANGE_ITEMS: ExchangeItem[] = [
  {
    key: 'wheat',
    label: 'Carrot Bundles',
    description: 'Staple grain for hungry builders.',
    toneClass: 'tone-wheat',
    suggestedUnitPriceNear: '0.001',
  },
  {
    key: 'potato',
    label: 'Rice Lots',
    description: 'Reliable food stock for long sessions.',
    toneClass: 'tone-potato',
    suggestedUnitPriceNear: '0.0012',
  },
  {
    key: 'rice',
    label: 'Cabbage Sacks',
    description: 'Compact food bundles for transport.',
    toneClass: 'tone-rice',
    suggestedUnitPriceNear: '0.0013',
  },
  {
    key: 'iron_ore',
    label: 'Iron Ore',
    description: 'Foundational material for industrial buyers.',
    toneClass: 'tone-iron',
    suggestedUnitPriceNear: '0.002',
  },
  {
    key: 'copper_ore',
    label: 'Copper Ore',
    description: 'Useful for wiring and precision parts.',
    toneClass: 'tone-copper',
    suggestedUnitPriceNear: '0.0025',
  },
  {
    key: 'diamond',
    label: 'Diamond Crystals',
    description: 'Rare stock for premium orders.',
    toneClass: 'tone-diamond',
    suggestedUnitPriceNear: '0.005',
  },
  {
    key: 'iron_bar',
    label: 'Iron Bars',
    description: 'Refined ingots, smelted from raw iron ore.',
    toneClass: 'tone-iron',
    suggestedUnitPriceNear: '0.01',
  },
  {
    key: 'copper_bar',
    label: 'Copper Bars',
    description: 'Refined ingots, smelted from raw copper ore.',
    toneClass: 'tone-copper',
    suggestedUnitPriceNear: '0.012',
  },
  {
    key: 'gold_ore',
    label: 'Gold Ore',
    description: 'Precious ore fresh from the deep vein.',
    toneClass: 'tone-diamond',
    suggestedUnitPriceNear: '0.008',
  },
  {
    key: 'gold_bar',
    label: 'Gold Bars',
    description: 'Refined bullion, smelted from raw gold ore.',
    toneClass: 'tone-diamond',
    suggestedUnitPriceNear: '0.044',
  },
  {
    key: 'bread',
    label: 'Bread Loaves',
    description: 'Fresh-baked loaves, ready for market stalls.',
    toneClass: 'tone-wheat',
    suggestedUnitPriceNear: '0.009',
  },
  {
    key: 'tool',
    label: 'Tools',
    description: 'Forged implements, prized by every settlement.',
    toneClass: 'tone-iron',
    suggestedUnitPriceNear: '0.05',
  },
];
