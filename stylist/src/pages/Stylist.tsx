import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { EVENT_TYPES, TRANSPORTS } from "@shared/catalog";
import type { CalendarEvent, EventType, Place, Transport } from "@shared/types";
import { PlanView } from "../components/PlanView";
import { PlacePicker } from "../components/PlacePicker";
import { WeatherCard } from "../components/items";
import { Field, PageHeader, Spinner } from "../components/ui";
import { db, useItems, useProfile } from "../db";
import { addDays, formatDay, relativeDay, todayISO, tomorrowISO } from "../lib/dates";
import { useWeather } from "../lib/hooks";
import { makePlan } from "../lib/planner";
import { errorText, toast } from "../store";

export default function Stylist() {
  const profile = useProfile();
  const items = useItems();
  const loc = useLocation() as { state?: { date?: string; eventId?: string } };
  const [date, setDate] = useState(loc.state?.date ?? tomorrowISO());
  const events = useLiveQuery(() => db.events.where("date").equals(date).toArray(), [date]);
  const [eventId, setEventId] = useState<string | null>(loc.state?.eventId ?? null);
  const event: CalendarEvent | undefined = events?.find((e) => e.id === eventId);
  const [eventType, setEventType] = useState<EventType>("work");
  const [dressCode, setDressCode] = useState("");
  const [transport, setTransport] = useState<Transport>("metro");
  const [to, setTo] = useState<Place | undefined>();
  const [distance, setDistance] = useState("");
  const [wishes, setWishes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const plan = useLiveQuery(
    () => (planId ? db.plans.get(planId) : db.plans.where("date").equals(date).reverse().sortBy("createdAt").then((l) => l[0])),
    [planId, date],
  );
  const { weather, loading: wxLoading, error: wxError } = useWeather(date, to);

  // подставить параметры события
  useEffect(() => {
    if (!event) return;
    setEventType(event.type);
    setDressCode(event.dressCode ?? "");
    setTransport(event.transport);
    if (event.location) setTo(event.location);
  }, [event]);
  useEffect(() => {
    if (!event && eventType === "work" && profile?.work && !to) setTo(profile.work);
  }, [eventType, profile?.work, event, to]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i)), []);

  const run = async () => {
    if (!profile || !items) return;
    setBusy("Начинаю…");
    try {
      const p = await makePlan({
        profile,
        items,
        date,
        event,
        eventType,
        title: event?.title,
        dressCode: dressCode || undefined,
        transport,
        from: event?.from ?? profile.home,
        to,
        distanceKm: distance ? Number(distance) : undefined,
        wishes: wishes || undefined,
        onStep: setBusy,
      });
      setPlanId(p.id);
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  if (!profile || !items) return null;
  return (
    <div>
      <PageHeader title="Стилист" subtitle="Расскажите, какой день впереди — соберу образ с учётом погоды, дороги, дресс-кода и трендов." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card space-y-5 p-5">
          <div>
            <span className="label">Когда</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {days.map((d) => (
                <button key={d} className={clsx("chip shrink-0 py-2", d === date && "chip-on")} onClick={() => (setDate(d), setEventId(null), setPlanId(null))}>
                  {relativeDay(d)}
                </button>
              ))}
              <input type="date" className="input w-auto shrink-0 py-1.5 text-xs" value={date} onChange={(e) => e.target.value && (setDate(e.target.value), setPlanId(null))} />
            </div>
          </div>

          {events && events.length > 0 && (
            <div>
              <span className="label">События в календаре</span>
              <div className="flex flex-wrap gap-1.5">
                {events.map((e) => (
                  <button key={e.id} className={clsx("chip py-2", eventId === e.id && "chip-on")} onClick={() => setEventId(eventId === e.id ? null : e.id)}>
                    {EVENT_TYPES[e.type].emoji} {e.start ? `${e.start} · ` : ""}
                    {e.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="label">Повод</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
                <button key={t} className={clsx("chip", eventType === t && "chip-on")} onClick={() => setEventType(t)}>
                  {EVENT_TYPES[t].emoji} {EVENT_TYPES[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Дресс-код (если есть)">
              <input className="input" value={dressCode} onChange={(e) => setDressCode(e.target.value)} placeholder="smart casual, black tie, всё белое…" />
            </Field>
            <Field label="Пожелания">
              <input className="input" value={wishes} onChange={(e) => setWishes(e.target.value)} placeholder="хочу надеть новый жакет, без каблуков…" />
            </Field>
          </div>

          <div>
            <span className="label">Как добираться</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TRANSPORTS) as Transport[]).map((t) => (
                <button key={t} className={clsx("chip", transport === t && "chip-on")} onClick={() => setTransport(t)}>
                  {TRANSPORTS[t].emoji} {TRANSPORTS[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label={`Куда (от: ${profile.home?.label ?? "дом не указан"})`}>
              <PlacePicker value={to} onChange={setTo} placeholder="Адрес назначения" />
            </Field>
            <Field label="Или расстояние, км">
              <input className="input" type="number" min={0} step={0.5} value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="напр. 3" />
            </Field>
          </div>

          <button className="btn-primary w-full py-3.5 text-base" onClick={run} disabled={!!busy || items.length === 0}>
            {busy ? (
              <>
                <Spinner /> {busy}
              </>
            ) : (
              <>
                <Sparkles size={18} /> Подобрать образ на {relativeDay(date).toLowerCase()}
              </>
            )}
          </button>
          {items.length === 0 && <p className="text-center text-xs text-muted">Сначала добавьте вещи в гардероб (или загрузите демо).</p>}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-bold">Погода · {formatDay(date)}</div>
          {weather ? (
            <WeatherCard w={weather} />
          ) : (
            <div className="card p-4 text-sm text-muted">{wxLoading ? <Spinner /> : wxError ?? "Нет данных"}</div>
          )}
          {to && <div className="card p-4 text-xs text-muted">Прогноз для точки назначения: {to.label}</div>}
        </div>
      </div>

      {plan && (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-3xl font-semibold">Образы на {formatDay(plan.date, { day: "numeric", month: "long" })}</h2>
          <PlanView plan={plan} items={items} />
        </div>
      )}
    </div>
  );
}
