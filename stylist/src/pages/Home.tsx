import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, CalendarPlus, Camera, Plus, Sparkles, TrendingUp, UserRound } from "lucide-react";
import { EVENT_TYPES, weatherEmoji } from "@shared/catalog";
import type { OutfitPlan, WardrobeItem } from "@shared/types";
import { Avatar3D } from "../components/avatar/Avatar3D";
import { ItemThumb, OutfitCollage, WeatherCard } from "../components/items";
import { AiBadge, Spinner } from "../components/ui";
import { db, hasProfile, useEvents, useItems, useProfile } from "../db";
import { addDays, daysBetween, formatDay, relativeDay, todayISO, tomorrowISO } from "../lib/dates";
import { useWeather } from "../lib/hooks";
import { makePlan } from "../lib/planner";
import { errorText, toast } from "../store";

const latestPlan = (date: string) =>
  db.plans
    .where("date")
    .equals(date)
    .reverse()
    .sortBy("createdAt")
    .then((l) => l.find((p) => p.chosen != null) ?? l[0]);

export default function Home() {
  const profile = useProfile();
  const items = useItems();
  const events = useEvents();
  const nav = useNavigate();
  const today = todayISO();
  const tomorrow = tomorrowISO();
  const tPlan = useLiveQuery(() => latestPlan(tomorrow), [tomorrow]);
  const todayPlan = useLiveQuery(() => latestPlan(today), [today]);
  const { weather, error: wxError, loading } = useWeather(tomorrow);
  const [busy, setBusy] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(true);
  useEffect(() => {
    hasProfile().then(setOnboarded);
  }, []);

  const upcoming = useMemo(() => (events ?? []).filter((e) => e.date >= today && daysBetween(today, e.date) <= 14).slice(0, 6), [events, today]);
  const tomorrowEvents = upcoming.filter((e) => e.date === tomorrow);
  const forgotten = useMemo(
    () => (items ?? []).filter((i) => i.status === "active" && (!i.lastWorn || daysBetween(i.lastWorn, today) > 45)).slice(0, 8),
    [items, today],
  );

  if (!profile || !items) return null;
  const hour = new Date().getHours();
  const hello = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  const prepareTomorrow = async () => {
    setBusy("Начинаю…");
    try {
      const ev = tomorrowEvents[0];
      await makePlan({
        profile,
        items,
        date: tomorrow,
        event: ev,
        eventType: ev?.type ?? (new Date(tomorrow).getDay() % 6 === 0 ? "casual" : "work"),
        dressCode: ev?.dressCode,
        transport: ev?.transport ?? "metro",
        from: ev?.from ?? profile.home,
        to: ev?.location ?? (ev ? undefined : profile.work),
        onStep: setBusy,
      });
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-muted capitalize">{formatDay(today)}</div>
          <h1 className="font-display text-4xl leading-tight font-semibold sm:text-6xl">
            {hello}
            {profile.name ? `, ${profile.name}` : ""}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link to="/wardrobe" className="btn-ghost">
            <Plus size={16} /> Вещи
          </Link>
          <Link to="/calendar" className="btn-ghost">
            <CalendarPlus size={16} /> Событие
          </Link>
        </div>
      </div>

      {!onboarded && (
        <Link to="/profile" className="card flex items-center gap-4 border-accent/40 bg-accent/10 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent">
            <UserRound />
          </span>
          <span className="flex-1">
            <span className="block font-bold">Начните с профиля</span>
            <span className="text-sm text-muted">Рост, мерки, город и предпочтения — из них соберётся ваш 3D-аватар, а стилист будет учитывать погоду и дорогу.</span>
          </span>
          <ArrowRight className="text-accent" />
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Завтра */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <div className="text-xs font-bold tracking-wide text-accent uppercase">Завтра · {formatDay(tomorrow, { weekday: "long", day: "numeric", month: "long" })}</div>
              <div className="text-xl font-bold">
                {tomorrowEvents.length ? tomorrowEvents.map((e) => `${EVENT_TYPES[e.type].emoji} ${e.title}`).join(" · ") : "Событий нет — обычный день"}
              </div>
            </div>
            {tPlan && <AiBadge source={tPlan.source} />}
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              {weather ? <WeatherCard w={weather} compact /> : <div className="rounded-3xl bg-surface-2 p-4 text-sm text-muted">{loading ? <Spinner /> : wxError}</div>}
              {tPlan ? (
                <PlanSummary plan={tPlan} items={items} />
              ) : (
                <p className="text-sm text-muted">Я ещё не собирал образ на завтра. Учту прогноз, события из календаря, дорогу и то, что вы недавно носили.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={prepareTomorrow} disabled={!!busy || !items.length}>
                  {busy ? (
                    <>
                      <Spinner /> {busy}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> {tPlan ? "Пересобрать" : "Собрать образ на завтра"}
                    </>
                  )}
                </button>
                {tPlan && (
                  <button className="btn-ghost" onClick={() => nav("/stylist", { state: { date: tomorrow } })}>
                    Все варианты <ArrowRight size={15} />
                  </button>
                )}
              </div>
              {!items.length && (
                <p className="text-xs text-warn">
                  Гардероб пуст. <Link to="/wardrobe" className="underline">Добавьте вещи</Link> или загрузите демо-гардероб.
                </p>
              )}
            </div>
            <div className="min-h-80 overflow-hidden rounded-3xl bg-surface-2">
              <Avatar3D profile={profile} items={planItems(tPlan, items)} className="h-full min-h-80 w-full" autoRotate />
            </div>
          </div>
        </section>

        <div className="space-y-5">
          {todayPlan && todayPlan.chosen != null && (
            <section className="card p-5">
              <div className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">Сегодня на вас</div>
              <OutfitCollage items={planItems(todayPlan, items)} />
            </section>
          )}

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-bold">Ближайшие события</div>
              <Link to="/calendar" className="text-xs font-bold text-accent">
                Календарь →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">Добавьте встречи, поездки и праздники — я подготовлю образы заранее.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <button
                    key={e.id}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-3"
                    onClick={() => nav("/stylist", { state: { date: e.date, eventId: e.id } })}
                  >
                    <span className="text-xl">{EVENT_TYPES[e.type].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.title}</span>
                      <span className="text-xs text-muted">
                        {relativeDay(e.date)}
                        {e.start ? ` · ${e.start}` : ""}
                        {e.dressCode ? ` · ${e.dressCode}` : ""}
                      </span>
                    </span>
                    <span className={e.planId ? "chip chip-on py-1" : "chip py-1"}>{e.planId ? "готово" : "подготовить"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Link to="/mirror" className="card flex flex-col gap-2 p-4 hover:-translate-y-0.5">
              <Camera className="text-accent" />
              <span className="font-bold">Зеркало</span>
              <span className="text-xs text-muted">Оценка образа по фото</span>
            </Link>
            <Link to="/shop" className="card flex flex-col gap-2 p-4 hover:-translate-y-0.5">
              <TrendingUp className="text-accent-2" />
              <span className="font-bold">Тренды и капсулы</span>
              <span className="text-xs text-muted">Что носить и что купить</span>
            </Link>
          </section>

          {forgotten.length > 0 && (
            <section className="card p-5">
              <div className="mb-1 text-lg font-bold">Давно не надевали</div>
              <p className="mb-3 text-xs text-muted">Попросите стилиста построить образ вокруг одной из этих вещей.</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {forgotten.map((i) => (
                  <ItemThumb key={i.id} item={i} className="h-20 w-20 shrink-0" onClick={() => nav("/chat", { state: { prompt: `Собери образ вокруг вещи «${i.name}» на ближайшие дни.` } })} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <WeekStrip />
    </div>
  );
}

function planItems(plan: OutfitPlan | undefined, items: WardrobeItem[]): WardrobeItem[] {
  if (!plan) return [];
  const o = plan.options[plan.chosen ?? 0];
  if (!o) return [];
  return o.itemIds.map((id) => items.find((i) => i.id === id)).filter((x): x is WardrobeItem => !!x);
}

function PlanSummary({ plan, items }: { plan: OutfitPlan; items: WardrobeItem[] }) {
  const o = plan.options[plan.chosen ?? 0];
  if (!o) return null;
  return (
    <div className="space-y-2">
      <div className="font-bold">{o.title}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {planItems(plan, items).map((i) => (
          <ItemThumb key={i.id} item={i} className="h-14 w-14 shrink-0" />
        ))}
      </div>
      <p className="line-clamp-3 text-sm text-muted">{o.reasoning}</p>
      {plan.beauty && (
        <p className="text-xs text-muted">
          💇 {plan.beauty.hair.style} · 💄 {plan.beauty.makeup.look}
        </p>
      )}
    </div>
  );
}

function WeekStrip() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));
  const { days: forecast } = useWeather(todayISO());
  const nav = useNavigate();
  if (!forecast) return null;
  return (
    <section className="card p-5">
      <div className="mb-3 text-lg font-bold">Неделя вперёд</div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((d) => {
          const w = forecast.find((x) => x.date === d);
          return (
            <button key={d} className="rounded-2xl bg-surface-2 p-3 text-center hover:bg-surface-3" onClick={() => nav("/stylist", { state: { date: d } })}>
              <div className="text-xs font-bold text-muted">{relativeDay(d)}</div>
              {w && (
                <>
                  <div className="my-1 text-2xl">{weatherEmoji(w.code)}</div>
                  <div className="text-sm font-bold">
                    {Math.round(w.tMax)}° <span className="text-muted">{Math.round(w.tMin)}°</span>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
