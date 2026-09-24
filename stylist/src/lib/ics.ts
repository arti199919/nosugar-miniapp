import type { CalendarEvent, EventType } from "@shared/types";
import { uid } from "../db";

function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseDate(v: string): { date: string; time?: string } {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v);
  if (!m) return { date: v.slice(0, 10) };
  if (v.endsWith("Z") && m[4]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    const pad = (n: number) => String(n).padStart(2, "0");
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
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

export function parseIcs(text: string): CalendarEvent[] {
  const lines = unfold(text).split(/\r?\n/);
  const out: CalendarEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const s = parseDate(cur.DTSTART ?? "");
      const e = cur.DTEND ? parseDate(cur.DTEND) : undefined;
      const title = (cur.SUMMARY ?? "Событие").replace(/\\,/g, ",").replace(/\\n/g, " ");
      out.push({
        id: uid(),
        title,
        date: s.date,
        start: s.time,
        end: e?.time,
        type: guessType(title),
        transport: "metro",
        notes: [cur.LOCATION, cur.DESCRIPTION].filter(Boolean).join("\n").replace(/\\n/g, "\n").replace(/\\,/g, ",").slice(0, 500) || undefined,
        createdAt: Date.now(),
      });
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) cur[line.slice(0, idx).split(";")[0]] = line.slice(idx + 1);
    }
  }
  return out;
}

export function toIcs(events: CalendarEvent[]): string {
  const esc = (s: string) => s.replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const dt = (d: string, t?: string) => d.replace(/-/g, "") + (t ? `T${t.replace(":", "")}00` : "");
  const body = events.map((e) =>
    [
      "BEGIN:VEVENT",
      `UID:${e.id}@atelier`,
      e.start ? `DTSTART:${dt(e.date, e.start)}` : `DTSTART;VALUE=DATE:${dt(e.date)}`,
      e.end ? `DTEND:${dt(e.date, e.end)}` : "",
      `SUMMARY:${esc(e.title)}`,
      e.location ? `LOCATION:${esc(e.location.label)}` : "",
      e.dressCode ? `DESCRIPTION:${esc("Дресс-код: " + e.dressCode)}` : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n"),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Atelier//RU", ...body, "END:VCALENDAR"].join("\r\n");
}
