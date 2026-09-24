import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Apple, Bell, CalendarPlus, ChevronLeft, ChevronRight, Download, Pencil, Plus, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { EVENT_TYPES, TRANSPORTS } from "@shared/catalog";
import type { CalendarEvent, EventType, Transport } from "@shared/types";
import { PlacePicker } from "../components/PlacePicker";
import { Field, Modal, PageHeader, Spinner } from "../components/ui";
import { db, getKV, uid, useEvents, useItems, useProfile } from "../db";
import { addDays, daysBetween, formatDay, iso, relativeDay, todayISO } from "../lib/dates";
import { downloadIcs, guessType, parseIcs } from "../lib/ics";
import { syncCalendar } from "../lib/calendarSync";
import { makePlan } from "../lib/planner";
import { errorText, toast } from "../store";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function Calendar() {
  const events = useEvents();
  const profile = useProfile();
  const items = useItems();
  const nav = useNavigate();
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [selected, setSelected] = useState(todayISO());
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [appleOpen, setAppleOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const grid = useMemo(() => {
    const first = new Date(month + "-01T12:00:00");
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return iso(d);
    });
  }, [month]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  const dayEvents = (byDate.get(selected) ?? []).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const shiftMonth = (n: number) => {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + n);
    setMonth(iso(d).slice(0, 7));
  };

  const prepareWeek = async () => {
    if (!profile || !items) return;
    const today = todayISO();
    const todo = (events ?? []).filter((e) => !e.planId && e.date >= today && daysBetween(today, e.date) <= 7);
    if (!todo.length) return toast("На неделю всё уже подготовлено", "ok");
    for (const [i, e] of todo.entries()) {
      try {
        await makePlan({
          profile,
          items,
          date: e.date,
          event: e,
          eventType: e.type,
          dressCode: e.dressCode,
          transport: e.transport,
          from: e.from ?? profile.home,
          to: e.location,
          onStep: (t) => setBusy(`${i + 1}/${todo.length} «${e.title}»: ${t}`),
        });
      } catch (err) {
        toast(errorText(err), "error");
      }
    }
    setBusy(null);
    toast(`Подготовлено образов: ${todo.length}`, "ok");
  };

  return (
    <div>
      <PageHeader
        title="Календарь"
        subtitle="События с дресс-кодом, местом и дорогой — стилист подготовит образы заранее."
        actions={
          <>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} title="Импорт .ics из Google/Яндекс/Apple календаря">
              <Upload size={16} /> .ics
            </button>
            <button className="btn-ghost" onClick={() => setAppleOpen(true)}>
              <Apple size={16} /> Apple Календарь
            </button>
            <button className="btn-ghost" title="Экспорт всех событий в .ics" onClick={() => downloadIcs(events ?? [])}>
              <Download size={16} />
            </button>
            <button
              className="btn-ghost"
              title="Напоминать вечером"
              onClick={async () => {
                if (typeof Notification === "undefined") return toast("Браузер не поддерживает уведомления", "error");
                const r = await Notification.requestPermission();
                toast(r === "granted" ? "Напомню вечером про образ на завтра (пока приложение открыто)" : "Уведомления запрещены", r === "granted" ? "ok" : "error");
              }}
            >
              <Bell size={16} />
            </button>
            <button className="btn-ghost" onClick={prepareWeek} disabled={!!busy}>
              {busy ? <Spinner /> : <Sparkles size={16} />} Подготовить неделю
            </button>
            <button className="btn-primary" onClick={() => setEditing(newEvent(selected))}>
              <Plus size={16} /> Событие
            </button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const known = new Set((events ?? []).map((x) => x.externalId).filter(Boolean));
          const list = parseIcs(await f.text(), { from: addDays(todayISO(), -1), to: addDays(todayISO(), 120) }).filter((x) => !known.has(x.externalId));
          await db.events.bulkAdd(list);
          toast(`Импортировано событий: ${list.length}`, "ok");
        }}
      />
      {busy && <div className="mb-4 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">{busy}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button className="btn-icon" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="text-lg font-bold capitalize">{monthLabel}</div>
            <button className="btn-icon" onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d) => {
              const evs = byDate.get(d) ?? [];
              const inMonth = d.startsWith(month);
              const isToday = d === todayISO();
              return (
                <button
                  key={d}
                  onClick={() => setSelected(d)}
                  className={clsx(
                    "flex aspect-square flex-col items-center justify-start gap-1 rounded-2xl p-1 text-sm transition sm:aspect-[1.15]",
                    selected === d ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-surface-2",
                    !inMonth && "opacity-35",
                  )}
                >
                  <span className={clsx("mt-1 flex h-7 w-7 items-center justify-center rounded-full font-semibold", isToday && "bg-accent text-[#140f1a]")}>{Number(d.slice(8))}</span>
                  <span className="flex flex-wrap justify-center gap-0.5 text-[11px] leading-none">
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} title={e.title}>
                        {EVENT_TYPES[e.type].emoji}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-muted uppercase">{relativeDay(selected)}</div>
              <div className="text-lg font-bold capitalize">{formatDay(selected)}</div>
            </div>
            <button className="btn-ghost py-2 text-xs" onClick={() => nav("/stylist", { state: { date: selected } })}>
              <Sparkles size={14} /> Образ на день
            </button>
          </div>
          {dayEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Событий нет</p>
          ) : (
            <div className="space-y-2.5">
              {dayEvents.map((e) => (
                <div key={e.id} className="rounded-3xl bg-surface-2 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{EVENT_TYPES[e.type].emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{e.title}</div>
                      <div className="text-xs text-muted">
                        {[e.start && `${e.start}${e.end ? `–${e.end}` : ""}`, EVENT_TYPES[e.type].label, e.dressCode && `дресс-код: ${e.dressCode}`, `${TRANSPORTS[e.transport].emoji} ${TRANSPORTS[e.transport].label}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {e.location && <div className="mt-1 truncate text-xs text-muted">📍 {e.location.label}</div>}
                    </div>
                    <button className="btn-icon h-8 w-8" onClick={() => setEditing(e)}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className={clsx("flex-1", e.planId ? "btn-ghost" : "btn-primary")} onClick={() => nav("/stylist", { state: { date: e.date, eventId: e.id } })}>
                      <Sparkles size={15} /> {e.planId ? "Открыть подготовленный образ" : "Подготовить образ"}
                    </button>
                    {!e.externalId && (
                      <button className="btn-icon h-auto w-11" title="Добавить в Apple Календарь" onClick={() => downloadIcs([e], `${e.title || "событие"}.ics`)}>
                        <CalendarPlus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <EventModal event={editing} onClose={() => setEditing(null)} />
      <AppleModal open={appleOpen} onClose={() => setAppleOpen(false)} />
    </div>
  );
}

function newEvent(date: string): CalendarEvent {
  return { id: uid(), title: "", date, type: "work", transport: "metro", createdAt: Date.now() };
}

function EventModal({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  const profile = useProfile();
  const [e, setE] = useState<CalendarEvent | null>(event);
  const [lastId, setLastId] = useState<string | undefined>(event?.id);
  if (event?.id !== lastId) {
    setLastId(event?.id);
    setE(event ? { ...event, from: event.from ?? profile?.home } : null);
  }
  if (!e) return null;
  const set = <K extends keyof CalendarEvent>(k: K, v: CalendarEvent[K]) => setE({ ...e, [k]: v });
  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title={event && event.title ? "Событие" : "Новое событие"}
      footer={
        <div className="flex gap-2">
          {event?.title && (
            <button
              className="btn-ghost text-bad"
              onClick={async () => {
                await db.events.delete(e.id);
                onClose();
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            className="btn-primary flex-1"
            disabled={!e.title.trim()}
            onClick={async () => {
              await db.events.put({ ...e, planId: undefined });
              toast("Событие сохранено", "ok");
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Название">
          <input
            className="input"
            value={e.title}
            autoFocus
            onChange={(ev) => setE({ ...e, title: ev.target.value, type: e.title ? e.type : guessType(ev.target.value) })}
            placeholder="Ужин с друзьями, презентация, свадьба Ани…"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Дата">
            <input className="input" type="date" value={e.date} onChange={(ev) => set("date", ev.target.value)} />
          </Field>
          <Field label="Начало">
            <input className="input" type="time" value={e.start ?? ""} onChange={(ev) => set("start", ev.target.value || undefined)} />
          </Field>
          <Field label="Конец">
            <input className="input" type="time" value={e.end ?? ""} onChange={(ev) => set("end", ev.target.value || undefined)} />
          </Field>
        </div>
        <Field label="Тип">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
              <button key={t} type="button" className={clsx("chip", e.type === t && "chip-on")} onClick={() => set("type", t)}>
                {EVENT_TYPES[t].emoji} {EVENT_TYPES[t].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Дресс-код">
          <input className="input" value={e.dressCode ?? ""} onChange={(ev) => set("dressCode", ev.target.value || undefined)} placeholder="cocktail, total white…" />
        </Field>
        <Field label="Место">
          <PlacePicker value={e.location} onChange={(p) => set("location", p)} />
        </Field>
        <Field label="Откуда">
          <PlacePicker value={e.from} onChange={(p) => set("from", p)} placeholder="По умолчанию — дом" />
        </Field>
        <Field label="Транспорт">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TRANSPORTS) as Transport[]).map((t) => (
              <button key={t} type="button" className={clsx("chip", e.transport === t && "chip-on")} onClick={() => set("transport", t)}>
                {TRANSPORTS[t].emoji} {TRANSPORTS[t].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Заметки для стилиста">
          <textarea className="input min-h-16" value={e.notes ?? ""} onChange={(ev) => set("notes", ev.target.value || undefined)} placeholder="Будут фотографии, мероприятие на террасе…" />
        </Field>
      </div>
    </Modal>
  );
}

function AppleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sub = useLiveQuery(() => getKV<{ url: string; lastSync?: number; lastCount?: number; error?: string } | null>("icsSub", null), []);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const connect = async (u: string) => {
    setBusy(true);
    try {
      const r = await syncCalendar(u.trim());
      toast(`Синхронизировано: +${r.added}, изменено ${r.updated}, удалено ${r.removed}`, "ok");
      setUrl("");
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title="Apple Календарь">
      {sub?.url ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div className="font-semibold">Подключено</div>
            <div className="truncate text-xs text-muted">{sub.url}</div>
            <div className="mt-1 text-xs text-muted">
              {sub.lastSync ? `Последняя синхронизация: ${new Date(sub.lastSync).toLocaleString("ru-RU")}, событий: ${sub.lastCount ?? 0}` : "Ещё не синхронизировано"}
            </div>
            {sub.error && <div className="mt-1 text-xs text-bad">{sub.error}</div>}
          </div>
          <p className="text-xs text-muted">События подтягиваются при каждом открытии приложения (не чаще раза в 30 минут). Тип события, дресс-код и транспорт, которые вы укажете здесь, сохраняются.</p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => connect(sub.url)} disabled={busy}>
              {busy ? <Spinner /> : <RefreshCw size={16} />} Синхронизировать
            </button>
            <button
              className="btn-ghost text-bad"
              onClick={async () => {
                if (!confirm("Отключить календарь и удалить импортированные из него события?")) return;
                const ids = (await db.events.toArray()).filter((e) => e.externalId).map((e) => e.id);
                await db.events.bulkDelete(ids);
                await db.kv.delete("icsSub");
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p>Подключите календарь iCloud по ссылке — стилист будет видеть ваши встречи и готовить образы заранее.</p>
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="mb-1 font-bold">На iPhone</div>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Откройте «Календарь» → внизу «Календари».</li>
              <li>Нажмите ⓘ рядом с нужным календарём.</li>
              <li>Включите «Общий календарь» (Public Calendar) → «Поделиться ссылкой…» → «Скопировать».</li>
            </ol>
            <div className="mt-2 mb-1 font-bold">На Mac</div>
            <p className="text-muted">Календарь → правый клик по календарю → «Общий доступ» → «Общий календарь» → скопируйте ссылку webcal://…</p>
          </div>
          <p className="text-xs text-warn">Публичная ссылка открывает календарь всем, у кого она есть. Лучше завести отдельный календарь «Мероприятия» и подключить только его.</p>
          <Field label="Ссылка на календарь">
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="webcal://p123-caldav.icloud.com/published/2/…" />
          </Field>
          <button className="btn-primary w-full" disabled={!/^(webcal|https):\/\//i.test(url.trim()) || busy} onClick={() => connect(url)}>
            {busy ? <Spinner /> : <Apple size={16} />} Подключить
          </button>
          <p className="text-xs text-muted">Добавить событие отсюда в Apple Календарь можно кнопкой с календариком у события — откроется системный диалог.</p>
        </div>
      )}
    </Modal>
  );
}
