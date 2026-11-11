import { create } from 'zustand';
import { getSupabaseClient } from '../lib/supabaseClient';
import { BASE_WORKER_COSTS, LEVEL_UPGRADE_COST } from '../game/economyConstants';

export type WorkerType = 'farmer' | 'miner' | 'engineer';

export interface Worker {
  id: string;
  type: WorkerType;
  assignedBuildingId: string | null;
}

export interface Inventory {
  money: number;
  wheat: number;
  potato: number;
  rice: number;
  iron_ore: number;
  copper_ore: number;
  diamond: number;
  iron_bar: number;
  copper_bar: number;
  gold_ore: number;
  gold_bar: number;
  bread: number;
  tool: number;
}

interface GameState {
  userAddress: string | null;
  villageName: string;
  level: number;
  inventory: Inventory;
  workers: Worker[];
  isHydrated: boolean;
  isHydrating: boolean;
  
  // Actions
  setUserAddress: (address: string | null) => void;
  setVillageName: (name: string) => Promise<boolean>;
  upgradeLevel: () => boolean;
  buyWorker: (type: WorkerType) => boolean;
  assignWorker: (workerId: string, buildingId: string) => void;
  unassignWorker: (workerId: string) => void;
  addResource: (type: keyof Inventory, amount: number) => void;
  hydrateFromSupabase: () => Promise<void>;
  flushToSupabase: () => Promise<boolean>;
  
  // Helpers
  getAvailableWorker: (type: WorkerType) => Worker | undefined;
}

const WORKER_PRICE_CONFIG = {
  sameTypeScale: 0.18,
  totalScale: 0.06,
  step: 5,
  maxMultiplier: 3,
};


const DEFAULT_INVENTORY: Inventory = {
  money: 500,
  wheat: 0,
  potato: 0,
  rice: 0,
  iron_ore: 0,
  copper_ore: 0,
  diamond: 0,
  iron_bar: 0,
  copper_bar: 0,
  gold_ore: 0,
  gold_bar: 0,
  bread: 0,
  tool: 0,
};

type InventoryRow = {
  save_id: string;
  money: number;
  wheat: number;
  potato: number;
  rice: number;
  iron_ore: number;
  copper_ore: number;
  diamond: number;
  iron_bar?: number;
  copper_bar?: number;
  gold_ore?: number;
  gold_bar?: number;
  bread?: number;
  tool?: number;
  village_name?: string;
  food?: number;
  level?: number;
};

type LegacyInventoryRow = {
  save_id: string;
  money: number;
  food: number;
};

type WorkerRow = {
  id: string;
  save_id: string;
  type: WorkerType;
  assigned_building_id: string | null;
};

function normalizeInventory(row?: Partial<InventoryRow> | null): Inventory {
  const base = {
    money: typeof row?.money === 'number' ? row.money : DEFAULT_INVENTORY.money,
    wheat: typeof row?.wheat === 'number' ? row.wheat : DEFAULT_INVENTORY.wheat,
    potato: typeof row?.potato === 'number' ? row.potato : DEFAULT_INVENTORY.potato,
    rice: typeof row?.rice === 'number' ? row.rice : DEFAULT_INVENTORY.rice,
    iron_ore: typeof row?.iron_ore === 'number' ? row.iron_ore : DEFAULT_INVENTORY.iron_ore,
    copper_ore: typeof row?.copper_ore === 'number' ? row.copper_ore : DEFAULT_INVENTORY.copper_ore,
    diamond: typeof row?.diamond === 'number' ? row.diamond : DEFAULT_INVENTORY.diamond,
    iron_bar: typeof row?.iron_bar === 'number' ? row.iron_bar : DEFAULT_INVENTORY.iron_bar,
    copper_bar: typeof row?.copper_bar === 'number' ? row.copper_bar : DEFAULT_INVENTORY.copper_bar,
    gold_ore: typeof row?.gold_ore === 'number' ? row.gold_ore : DEFAULT_INVENTORY.gold_ore,
    gold_bar: typeof row?.gold_bar === 'number' ? row.gold_bar : DEFAULT_INVENTORY.gold_bar,
    bread: typeof row?.bread === 'number' ? row.bread : DEFAULT_INVENTORY.bread,
    tool: typeof row?.tool === 'number' ? row.tool : DEFAULT_INVENTORY.tool,
  };

  const hasNewCrops =
    typeof row?.wheat === 'number' || typeof row?.potato === 'number' || typeof row?.rice === 'number';

  if (!hasNewCrops && typeof row?.food === 'number' && row.food > 0) {
    const total = row.food;
    const baseShare = Math.floor(total / 3);
    const remainder = total - baseShare * 3;

    return {
      ...base,
      wheat: baseShare + (remainder > 0 ? 1 : 0),
      potato: baseShare + (remainder > 1 ? 1 : 0),
      rice: baseShare,
    };
  }

  return base;
}

function normalizeVillageName(row?: Partial<InventoryRow> | null): string {
  return typeof row?.village_name === 'string' ? row.village_name.trim() : '';
}

function mapWorkerRow(row: WorkerRow): Worker {
  return {
    id: row.id,
    type: row.type,
    assignedBuildingId: row.assigned_building_id ?? null,
  };
}

function formatSaveId(address: string | null): string | null {
  return address ? `wallet:${address.toLowerCase()}` : null;
}

function toLegacyFood(inventory: Inventory): number {
  return inventory.wheat + inventory.potato + inventory.rice;
}

function toLegacyInventoryRow(saveId: string, inventory: Inventory): LegacyInventoryRow {
  return {
    save_id: saveId,
    money: inventory.money,
    food: toLegacyFood(inventory),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function getWorkerCost(type: WorkerType, workers: Worker[]): number {
  const base = BASE_WORKER_COSTS[type];
  const sameTypeCount = workers.filter((worker) => worker.type === type).length;
  const totalCount = workers.length;
  const multiplier = clampNumber(
    1 + sameTypeCount * WORKER_PRICE_CONFIG.sameTypeScale + totalCount * WORKER_PRICE_CONFIG.totalScale,
    1,
    WORKER_PRICE_CONFIG.maxMultiplier
  );

  return Math.max(base, roundToStep(base * multiplier, WORKER_PRICE_CONFIG.step));
}

export const useGameStore = create<GameState>((set, get) => {
  const getSaveId = () => formatSaveId(get().userAddress);

  const saveState = async (): Promise<boolean> => {
    const saveId = getSaveId();
    if (!saveId) {
      console.warn('No saveId (wallet not connected); aborting save.');
      return false;
    }

    const { inventory, workers, villageName, level } = get();
    const inventoryRow: InventoryRow = { save_id: saveId, ...inventory, village_name: villageName.trim(), level };
    const persistedInventoryRow = {
      save_id: saveId,
      ...inventory,
      village_name: villageName.trim(),
    };
    const legacyInventoryRow = toLegacyInventoryRow(saveId, inventory);
    const workerRows: WorkerRow[] = workers.map((worker) => ({
      id: worker.id,
      save_id: saveId,
      type: worker.type,
      assigned_building_id: worker.assignedBuildingId,
    }));

    try {
      const response = await fetch('/api/save-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          inventory: persistedInventoryRow,
          workers: workerRows,
        }),
      });

      if (response.ok) {
        return true;
      }

      const errorText = await response.text();
      console.warn('Server save-state endpoint failed:', response.status, errorText);
    } catch (error) {
      console.warn('Server save-state endpoint unavailable:', error);
    }

    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase client unavailable; aborting fallback save.');
      return false;
    }

    const { error: inventoryError } = await client
      .from('inventory')
      .upsert(persistedInventoryRow, { onConflict: 'save_id' });

    if (inventoryError) {
      const legacyFallback = await client
        .from('inventory')
        .upsert(legacyInventoryRow, { onConflict: 'save_id' });

      if (legacyFallback.error) {
        console.warn('Supabase inventory fallback save failed:', legacyFallback.error.message, {
          inventoryRow,
          legacyInventoryRow,
        });
        return false;
      }
    }

    if (workerRows.length === 0) return true;

    const { error: workerError } = await client
      .from('workers')
      .upsert(workerRows, { onConflict: 'save_id,id' });

    if (workerError) {
      console.warn('Supabase worker fallback save failed:', workerError.message, { workerRows });
      return false;
    }

    return true;
  };

  const hydrateFromSupabase = async () => {
    const { isHydrated, isHydrating } = get();
    if (isHydrated || isHydrating) return;

    set({ isHydrating: true });

    const client = getSupabaseClient();
    if (!client) {
      set({ isHydrated: true, isHydrating: false });
      return;
    }

    const saveId = getSaveId();
    if (!saveId) {
      set({ isHydrated: true, isHydrating: false });
      return;
    }

    const inventoryResponse = await client
      .from('inventory')
      .select('save_id, money, wheat, potato, rice, iron_ore, copper_ore, diamond, iron_bar, copper_bar, gold_ore, gold_bar, bread, tool, village_name, food, level')
      .eq('save_id', saveId)
      .maybeSingle();

    let inventory = normalizeInventory(inventoryResponse.data ?? undefined);
    let villageName = normalizeVillageName(inventoryResponse.data ?? undefined);
    let level = typeof inventoryResponse.data?.level === 'number' ? inventoryResponse.data.level : 1;

    if (inventoryResponse.error) {
      console.warn('Supabase inventory load failed:', inventoryResponse.error.message);

      const legacyInventoryResponse = await client
        .from('inventory')
        .select('save_id, money, food')
        .eq('save_id', saveId)
        .maybeSingle();

      if (legacyInventoryResponse.error) {
        console.warn('Supabase legacy inventory load failed:', legacyInventoryResponse.error.message);
      } else {
        inventory = normalizeInventory(legacyInventoryResponse.data ?? undefined);
        villageName = normalizeVillageName(legacyInventoryResponse.data ?? undefined);
      }
    }

    if (!inventoryResponse.data && !inventoryResponse.error) {
      await client.from('inventory').upsert({ save_id: saveId, ...inventory, village_name: villageName, level }, { onConflict: 'save_id' });
    }

    const workersResponse = await client
      .from('workers')
      .select('id, type, assigned_building_id, save_id')
      .eq('save_id', saveId);

    if (workersResponse.error) {
      console.warn('Supabase worker load failed:', workersResponse.error.message);
    }

    const workers = (workersResponse.data ?? []).map(mapWorkerRow);

    set({ inventory, workers, villageName, level, isHydrated: true, isHydrating: false });
  };

  return {
    userAddress: null,
    villageName: '',
    level: 1,
    inventory: { ...DEFAULT_INVENTORY },
    workers: [],
    isHydrated: false,
    isHydrating: false,
    hydrateFromSupabase,
    flushToSupabase: saveState,

    setUserAddress: (address: string | null) => {
      const normalized = address ? address.toLowerCase() : null;
      if (normalized === get().userAddress) return;

      set({
        userAddress: normalized,
        isHydrated: false,
        isHydrating: false,
        villageName: '',
        level: 1,
        inventory: { ...DEFAULT_INVENTORY },
        workers: [],
      });

      if (normalized) {
        void get().hydrateFromSupabase();
      }
    },

    buyWorker: (type: WorkerType) => {
      const { inventory, workers } = get();
      const cost = getWorkerCost(type, workers);
      
      if (inventory.money >= cost) {
        set({
          inventory: { ...inventory, money: inventory.money - cost },
          workers: [
            ...workers,
            {
              id: `worker-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type,
              assignedBuildingId: null,
            },
          ],
        });
        void saveState();
        return true;
      }
      return false;
    },

    setVillageName: async (name: string) => {
      const villageName = name.trim();

      set({ villageName });
      return saveState();
    },

    upgradeLevel: () => {
      const { inventory, level } = get();
      const nextLevel = level + 1;
      const cost = LEVEL_UPGRADE_COST[nextLevel as keyof typeof LEVEL_UPGRADE_COST];
      if (cost === undefined || inventory.money < cost) return false;

      set({
        level: nextLevel,
        inventory: { ...inventory, money: inventory.money - cost },
      });
      void saveState();
      return true;
    },

    assignWorker: (workerId: string, buildingId: string) => {
      set((state) => ({
        workers: state.workers.map((w) =>
          w.id === workerId ? { ...w, assignedBuildingId: buildingId } : w
        ),
      }));
      void saveState();
    },

    unassignWorker: (workerId: string) => {
      set((state) => ({
        workers: state.workers.map((w) =>
          w.id === workerId ? { ...w, assignedBuildingId: null } : w
        ),
      }));
      void saveState();
    },

    addResource: (type: keyof Inventory, amount: number) => {
      set((state) => ({
        inventory: {
          ...state.inventory,
          [type]: state.inventory[type] + amount,
        },
      }));
      void saveState();
    },

    getAvailableWorker: (type: WorkerType) => {
      return get().workers.find((w) => w.type === type && w.assignedBuildingId === null);
    },
  };
});

export function getActiveSaveId(): string | null {
  return formatSaveId(useGameStore.getState().userAddress);
}
