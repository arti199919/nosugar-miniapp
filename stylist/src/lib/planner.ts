import { EVENT_TYPES, TRANSPORTS, toBrief } from "@shared/catalog";
import { estimateWalk, eventOccasion, localBeauty, recommendOutfits } from "@shared/engine";
import type { CalendarEvent, EventType, OutfitPlan, Place, Profile, RouteInfo, Transport, WardrobeItem, WeatherDay } from "@shared/types";
import { api } from "../api";
import { db, getTrends, uid } from "../db";
import { useUI } from "../store";
import { loadForecast } from "./hooks";

export interface PlanRequest {
  profile: Profile;
  items: WardrobeItem[];
  date: string;
  event?: CalendarEvent;
  eventType: EventType;
  title?: string;
  dressCode?: string;
  transport: Transport;
  from?: Place;
  to?: Place;
  distanceKm?: number;
  wishes?: string;
  mustInclude?: string[];
  onStep?: (t: string) => void;
}

export async function getRoute(req: Pick<PlanRequest, "from" | "to" | "transport" | "distanceKm">): Promise<RouteInfo | undefined> {
  if (req.from && req.to) {
    try {
      return await api.route(req.from, req.to, req.transport);
    } catch {
      /* оценка ниже */
    }
  }
  const d = req.distanceKm ?? (req.transport === "walk" ? 1.5 : 8);
  const w = estimateWalk(req.transport, d);
  return { distanceKm: d, durationMin: w.durationMin, transport: req.transport, walkKm: Math.round(w.walkKm * 10) / 10, outdoorMin: w.outdoorMin, source: req.distanceKm ? "manual" : "estimate" };
}

export async function getWeather(profile: Profile, date: string, place?: Place): Promise<WeatherDay | undefined> {
  const p = place ?? profile.home;
  if (!p) return undefined;
  try {
    const days = await loadForecast(p.lat, p.lon);
    return days.find((d) => d.date === date);
  } catch {
    return undefined;
  }
}

export function trendsDigest(t: Awaited<ReturnType<typeof getTrends>>): string | undefined {
  if (!t) return undefined;
  return `${t.season}: ${t.trends.map((x) => `${x.title} (${x.keyItems.slice(0, 3).join(", ")})`).join("; ")}. Цвета: ${t.colors.map((c) => c.name).join(", ")}.`;
}

export async function makePlan(req: PlanRequest): Promise<OutfitPlan> {
  const step = req.onStep ?? (() => {});
  step("Смотрю прогноз погоды…");
  const weather = await getWeather(req.profile, req.date, req.to);
  step("Считаю дорогу…");
  const route = await getRoute(req);
  const occasion = req.event ? eventOccasion(req.event) : `${EVENT_TYPES[req.eventType].label}${req.title ? ` — ${req.title}` : ""}${req.dressCode ? ` (дресс-код: ${req.dressCode})` : ""}`;
  step("Перебираю гардероб…");
  const active = req.items.filter((i) => i.status === "active");
  const drafts = recommendOutfits({
    items: active,
    profile: req.profile,
    date: req.date,
    eventType: req.eventType,
    dressCode: req.dressCode,
    weather,
    route,
    mustInclude: req.mustInclude,
    count: 3,
  });

  const base: Omit<OutfitPlan, "options" | "tips" | "gaps" | "source" | "beauty"> = {
    id: uid(),
    date: req.date,
    eventId: req.event?.id,
    occasion,
    weather,
    route,
    createdAt: Date.now(),
  };

  let plan: OutfitPlan | null = null;
  if (useUI.getState().health?.ai && active.length) {
    try {
      step("Claude собирает образы…");
      const trends = trendsDigest(await getTrends());
      const res = await api.outfit({
        profile: req.profile,
        items: active.map(toBrief),
        drafts,
        trends,
        context: {
          date: req.date,
          occasion,
          event: req.event
            ? { title: req.event.title, type: req.event.type, dressCode: req.event.dressCode, start: req.event.start, end: req.event.end, notes: req.event.notes, transport: req.event.transport }
            : undefined,
          weather: weather ? { ...weather, hourly: undefined } : undefined,
          route,
          wishes: [req.wishes, req.mustInclude?.length ? `Обязательно использовать: ${req.mustInclude.map((id) => active.find((i) => i.id === id)?.name).join(", ")}` : ""].filter(Boolean).join(". "),
        },
      });
      if (res.options.length) plan = { ...base, options: res.options, beauty: res.beauty, tips: res.tips, gaps: res.gaps, source: "ai" };
    } catch (e) {
      useUI.getState().toast(`ИИ недоступен, использую локальный алгоритм: ${e instanceof Error ? e.message : e}`, "error");
    }
  }
  if (!plan) {
    const tips: string[] = [];
    if (weather && weather.precipProb >= 50) tips.push("Высокая вероятность осадков — зонт в сумку и обувь, которой не страшны лужи.");
    if (route && route.walkKm > 2) tips.push(`Пешком около ${route.walkKm} км — приоритет удобной обуви.`);
    if (route && (route.transport === "bike" || route.transport === "scooter")) tips.push(`${TRANSPORTS[route.transport].label}: избегайте длинных широких юбок и высоких каблуков.`);
    if (weather && weather.tMax - weather.tMin >= 8) tips.push("Большой перепад температур за день — одевайтесь слоями.");
    plan = {
      ...base,
      options: drafts,
      beauty: localBeauty({ profile: req.profile, weather, eventType: req.eventType, date: req.date }),
      tips,
      gaps: active.length ? [] : ["Гардероб пуст — добавьте вещи"],
      source: "local",
    };
  }
  await db.plans.put(plan);
  if (req.event) await db.events.update(req.event.id, { planId: plan.id });
  return plan;
}
