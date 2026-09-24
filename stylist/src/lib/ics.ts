import type { CalendarEvent, EventType } from "@shared/types";
import { uid } from "../db";

function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseDate(v: string): { date: string; time?: string } {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v);
  if (!m) return { date: v.slice(0, 10) };
  if (v.endsWith("Z") && m[4]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return { date: isoOf(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : undefined };
}

export function guessType(title: string): EventType {
  const t = title.toLowerCase();
  if (/свадьб|wedding/.test(t)) return "wedding";
  if (/театр|концерт|опер|балет|филармон/.test(t)) return "theatre";
  if (/собесед|interview/.test(t)) return "interview";
  if (/конференц|форум|митап|выступ/.test(t)) return "conference";
  if (/свидан|date/.test(t)) return "date";
  if (/ресторан|ужин|бранч|кафе/.test(t)) return "restaurant";
  if (/день рожд|др |birthday/.test(t)) return "birthday";
  if (/вечерин|party|клуб/.test(t)) return "party";
  if (/трениров|спорт|йог|бег|зал|фитнес/.test(t)) return "sport";
  if (/перелёт|рейс|поезд|поездк|командиров/.test(t)) return "travel";
  if (/встреч|переговор|клиент|совещ/.test(t)) return "business";
  if (/прогулк|парк/.test(t)) return "walk";
  return "work";
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Разворачивает простые RRULE (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY) в даты в окне. */
export function expandRRule(start: string, rrule: string, from: string, to: string, exdates: Set<string>): string[] {
  const p = Object.fromEntries(rrule.split(";").map((kv) => kv.split("=")));
  const freq = p.FREQ as string;
  const interval = Number(p.INTERVAL ?? 1);
  const count = p.COUNT ? Number(p.COUNT) : Infinity;
  const until = p.UNTIL ? parseDate(p.UNTIL).date : "9999-12-31";
  const byday: number[] = p.BYDAY ? String(p.BYDAY).split(",").map((d: string) => DAYS.indexOf(d.slice(-2))).filter((x: number) => x >= 0) : [];
  const out: string[] = [];
  const s = new Date(start + "T12:00:00");
  let n = 0;
  const push = (d: Date) => {
    const iso = isoOf(d);
    if (iso < start || iso > until) return;
    n++;
    if (iso >= from && iso <= to && !exdates.has(iso)) out.push(iso);
  };
  const limit = 2000;
  if (freq === "DAILY") {
    for (let i = 0, d = new Date(s); i < limit && n < count && isoOf(d) <= to && isoOf(d) <= until; i++, d.setDate(d.getDate() + interval)) push(d);
  } else if (freq === "WEEKLY") {
    const days = byday.length ? byday : [s.getDay()];
    const weekStart = new Date(s);
    weekStart.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    for (let w = 0; w < limit && n < count; w += interval) {
      const base = new Date(weekStart);
      base.setDate(weekStart.getDate() + w * 7);
      if (isoOf(base) > to || isoOf(base) > until) break;
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = new Date(base);
        d.setDate(base.getDate() + ((wd + 6) % 7));
        if (n >= count) break;
        push(d);
      }
    }
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    for (let i = 0; i < limit && n < count; i++) {
      const d = new Date(s);
      if (freq === "MONTHLY") d.setMonth(s.getMonth() + i * interval);
      else d.setFullYear(s.getFullYear() + i * interval);
      if (isoOf(d) > to || isoOf(d) > until) break;
      push(d);
    }
  } else push(s);
  return out;
}

export interface IcsOptions {
  from?: string;
  to?: string;
}

export function parseIcs(text: string, opts: IcsOptions = {}): CalendarEvent[] {
  const from = opts.from ?? "0000-01-01";
  const to = opts.to ?? "9999-12-31";
  const lines = unfold(text).split(/\r?\n/);
  const out: CalendarEvent[] = [];
  let cur: Record<string, string[]> | null = null;
  const get = (k: string) => cur?.[k]?.[0];
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      if (get("STATUS") === "CANCELLED") {
        cur = null;
        continue;
      }
      const s = parseDate(get("DTSTART") ?? "");
      const e = get("DTEND") ? parseDate(get("DTEND")!) : undefined;
      const title = (get("SUMMARY") ?? "Событие").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/g, " ");
      const notes = [get("LOCATION"), get("DESCRIPTION")].filter(Boolean).join("\n").replace(/\\n/g, "\n").replace(/\\,/g, ",").slice(0, 500) || undefined;
      const exdates = new Set((cur.EXDATE ?? []).flatMap((v) => v.split(",")).map((v) => parseDate(v).date));
      const rrule = get("RRULE");
      const dates = rrule ? expandRRule(s.date, rrule, from, to, exdates) : s.date >= from && s.date <= to ? [s.date] : [];
      const baseUid = get("UID") ?? uid();
      const recId = get("RECURRENCE-ID");
      for (const date of dates)
        out.push({
          id: uid(),
          externalId: rrule ? `${baseUid}#${date}` : recId ? `${baseUid}#${parseDate(recId).date}` : baseUid,
          title,
          date,
          start: s.time,
          end: e?.time,
          type: guessType(title),
          transport: "metro",
          notes,
          createdAt: Date.now(),
        });
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const key = line.slice(0, idx).split(";")[0];
        (cur[key] ??= []).push(line.slice(idx + 1));
      }
    }
  }
  // переопределённые экземпляры (RECURRENCE-ID) заменяют развёрнутые из RRULE
  const byKey = new Map<string, CalendarEvent>();
  for (const ev of out) byKey.set(ev.externalId!, ev);
  return [...byKey.values()];
}

export function toIcs(events: CalendarEvent[]): string {
  const esc = (s: string) => s.replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const dt = (d: string, t?: string) => d.replace(/-/g, "") + (t ? `T${t.replace(":", "")}00` : "");
  const body = events.map((e) => {
    const endTime = e.end ?? (e.start ? `${pad(Math.min(23, Number(e.start.slice(0, 2)) + 1))}:${e.start.slice(3)}` : undefined);
    return [
      "BEGIN:VEVENT",
      `UID:${e.id}@atelier`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      e.start ? `DTSTART:${dt(e.date, e.start)}` : `DTSTART;VALUE=DATE:${dt(e.date)}`,
      e.start && endTime ? `DTEND:${dt(e.date, endTime)}` : "",
      `SUMMARY:${esc(e.title)}`,
      e.location ? `LOCATION:${esc(e.location.label)}` : "",
      e.dressCode || e.notes ? `DESCRIPTION:${esc([e.dressCode && `Дресс-код: ${e.dressCode}`, e.notes].filter(Boolean).join("\n"))}` : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Atelier//RU", "CALSCALE:GREGORIAN", ...body, "END:VCALENDAR"].join("\r\n");
}

/** Скачать .ics — на iPhone/Mac откроется диалог «Добавить в Календарь». */
export function downloadIcs(events: CalendarEvent[], name = "atelier.ics") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([toIcs(events)], { type: "text/calendar;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
