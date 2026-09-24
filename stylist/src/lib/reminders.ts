// Вечернее напоминание: если на завтра есть события без подготовленного образа.
import { db, getKV, setKV } from "../db";
import { tomorrowISO, todayISO } from "./dates";

export async function checkReminder() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (new Date().getHours() < 19) return;
  const key = `reminded:${todayISO()}`;
  if (await getKV(key, false)) return;
  const events = await db.events.where("date").equals(tomorrowISO()).toArray();
  const pending = events.filter((e) => !e.planId);
  const plans = await db.plans.where("date").equals(tomorrowISO()).count();
  if (!pending.length && plans) return;
  await setKV(key, true);
  new Notification("Atelier: что надеть завтра?", {
    body: pending.length ? `Завтра: ${pending.map((e) => e.title).join(", ")}. Подготовим образ?` : "Соберём образ на завтра с учётом погоды?",
    icon: "/favicon.svg",
  });
}

export function startReminders() {
  checkReminder();
  return window.setInterval(checkReminder, 10 * 60 * 1000);
}
