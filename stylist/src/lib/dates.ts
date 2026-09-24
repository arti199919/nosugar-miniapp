export const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const todayISO = () => iso(new Date());
export const addDays = (isoDate: string, n: number) => {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const tomorrowISO = () => addDays(todayISO(), 1);

export function formatDay(isoDate: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("ru-RU", opts);
}

export function relativeDay(isoDate: string): string {
  const t = todayISO();
  if (isoDate === t) return "Сегодня";
  if (isoDate === addDays(t, 1)) return "Завтра";
  if (isoDate === addDays(t, 2)) return "Послезавтра";
  if (isoDate === addDays(t, -1)) return "Вчера";
  return formatDay(isoDate, { weekday: "short", day: "numeric", month: "short" });
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 86400000);
