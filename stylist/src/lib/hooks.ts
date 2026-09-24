import { useEffect, useState } from "react";
import type { WeatherDay } from "@shared/types";
import { api } from "../api";
import { useProfile } from "../db";

const wxCache = new Map<string, { at: number; days: WeatherDay[] }>();

export async function loadForecast(lat: number, lon: number): Promise<WeatherDay[]> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = wxCache.get(key);
  if (hit && Date.now() - hit.at < 20 * 60 * 1000) return hit.days;
  const days = await api.weather(lat, lon);
  wxCache.set(key, { at: Date.now(), days });
  return days;
}

/** Прогноз для даты по «домашней» точке профиля (или переданной). */
export function useWeather(date: string, place?: { lat: number; lon: number }) {
  const profile = useProfile();
  const p = place ?? profile?.home;
  const [state, setState] = useState<{ weather?: WeatherDay; days?: WeatherDay[]; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!p) {
      if (profile) setState({ loading: false, error: "Укажите город в профиле" });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    loadForecast(p.lat, p.lon)
      .then((days) => alive && setState({ loading: false, days, weather: days.find((d) => d.date === date), error: days.some((d) => d.date === date) ? undefined : "Прогноз доступен на 16 дней вперёд" }))
      .catch((e) => alive && setState({ loading: false, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [p?.lat, p?.lon, date, profile]);
  return state;
}
