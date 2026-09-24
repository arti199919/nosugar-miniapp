// Подписка на Apple (iCloud) календарь по публичной ссылке: подтягиваем события на 60 дней вперёд.
import { api } from "../api";
import { db, getKV, setKV } from "../db";
import { addDays, todayISO } from "./dates";
import { parseIcs } from "./ics";

export interface IcsSubscription {
  url: string;
  lastSync?: number;
  lastCount?: number;
  error?: string;
}

export const getSubscription = () => getKV<IcsSubscription | null>("icsSub", null);

export async function syncCalendar(url?: string): Promise<{ added: number; updated: number; removed: number }> {
  const sub = url ? { url } : await getSubscription();
  if (!sub?.url) throw new Error("Календарь не подключён");
  try {
    const text = await api.ics(sub.url);
    const from = addDays(todayISO(), -1);
    const to = addDays(todayISO(), 60);
    const incoming = parseIcs(text, { from, to });
    const existing = (await db.events.toArray()).filter((e) => e.externalId);
    const byExt = new Map(existing.map((e) => [e.externalId!, e]));
    let added = 0;
    let updated = 0;
    await db.transaction("rw", db.events, async () => {
      for (const ev of incoming) {
        const old = byExt.get(ev.externalId!);
        if (!old) {
          await db.events.add(ev);
          added++;
        } else {
          // время и название — из календаря; тип, дресс-код, транспорт и подготовленный образ — ваши
          const changed = old.title !== ev.title || old.date !== ev.date || old.start !== ev.start || old.end !== ev.end;
          if (changed) {
            await db.events.update(old.id, { title: ev.title, date: ev.date, start: ev.start, end: ev.end, notes: old.notes ?? ev.notes, planId: old.date === ev.date ? old.planId : undefined });
            updated++;
          }
          byExt.delete(ev.externalId!);
        }
      }
    });
    // удалённые в календаре будущие события
    const stale = [...byExt.values()].filter((e) => e.date >= from && e.date <= to);
    await db.events.bulkDelete(stale.map((e) => e.id));
    await setKV("icsSub", { url: sub.url, lastSync: Date.now(), lastCount: incoming.length });
    return { added, updated, removed: stale.length };
  } catch (e) {
    await setKV("icsSub", { ...sub, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Фоновая синхронизация при открытии приложения (не чаще раза в 30 минут). */
export async function autoSyncCalendar() {
  const sub = await getSubscription();
  if (!sub?.url || (sub.lastSync && Date.now() - sub.lastSync < 30 * 60 * 1000)) return;
  try {
    await syncCalendar();
  } catch {
    /* ошибка сохранена в подписке и видна на странице календаря */
  }
}
