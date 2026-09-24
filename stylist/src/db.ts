import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import type { CalendarEvent, ChatMessage, Look, OutfitPlan, Profile, TrendReport, WardrobeItem } from "@shared/types";
import { defaultProfile } from "@shared/body";
import type { FaceScan } from "./lib/faceScan";

export interface WearLog {
  id: string;
  date: string;
  itemIds: string[];
  lookId?: string;
}

interface KV {
  key: string;
  value: unknown;
}

class AtelierDB extends Dexie {
  items!: Table<WardrobeItem, string>;
  looks!: Table<Look, string>;
  events!: Table<CalendarEvent, string>;
  plans!: Table<OutfitPlan, string>;
  chat!: Table<ChatMessage, string>;
  wear!: Table<WearLog, string>;
  kv!: Table<KV, string>;

  constructor() {
    super("atelier");
    this.version(1).stores({
      items: "id, category, status, createdAt",
      looks: "id, createdAt",
      events: "id, date",
      plans: "id, date, eventId, createdAt",
      chat: "id, createdAt",
      wear: "id, date",
      kv: "key",
    });
  }
}

export const db = new AtelierDB();

export const uid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return (row?.value as T) ?? fallback;
}
export const setKV = (key: string, value: unknown) => db.kv.put({ key, value });

export function useProfile(): Profile | undefined {
  return useLiveQuery(async () => {
    const p = await getKV<Profile | null>("profile", null);
    return p ? { ...defaultProfile(p.gender), ...p } : defaultProfile();
  });
}
export const getProfile = async () => {
  const p = await getKV<Profile | null>("profile", null);
  return p ? { ...defaultProfile(p.gender), ...p } : defaultProfile();
};
export const saveProfile = (p: Profile) => setKV("profile", p);
export const hasProfile = async () => (await db.kv.get("profile")) != null;

export const useItems = () => useLiveQuery(() => db.items.orderBy("createdAt").reverse().toArray(), []);
export const useLooks = () => useLiveQuery(() => db.looks.orderBy("createdAt").reverse().toArray(), []);
export const useEvents = () => useLiveQuery(() => db.events.orderBy("date").toArray(), []);

export async function getTrends(): Promise<TrendReport | null> {
  return getKV<TrendReport | null>("trends", null);
}

/** Отметить, что образ надет в указанный день. */
export async function markWorn(itemIds: string[], date: string, lookId?: string) {
  await db.transaction("rw", db.items, db.wear, async () => {
    await db.wear.add({ id: uid(), date, itemIds, lookId });
    for (const id of itemIds) {
      const it = await db.items.get(id);
      if (it) await db.items.update(id, { wearCount: (it.wearCount ?? 0) + 1, lastWorn: date });
    }
  });
}

export async function exportAll(): Promise<string> {
  const [items, looks, events, plans, kv] = await Promise.all([
    db.items.toArray(),
    db.looks.toArray(),
    db.events.toArray(),
    db.plans.toArray(),
    db.kv.toArray(),
  ]);
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items, looks, events, plans, kv });
}

export async function importAll(json: string) {
  const data = JSON.parse(json);
  await db.transaction("rw", [db.items, db.looks, db.events, db.plans, db.kv], async () => {
    if (data.items) await db.items.bulkPut(data.items);
    if (data.looks) await db.looks.bulkPut(data.looks);
    if (data.events) await db.events.bulkPut(data.events);
    if (data.plans) await db.plans.bulkPut(data.plans);
    if (data.kv) await db.kv.bulkPut(data.kv);
  });
}

export const useFaceScan = () => useLiveQuery(() => getKV<FaceScan | null>("faceScan", null), []);
