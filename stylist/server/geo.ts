// Погода (Open-Meteo), геокодинг (Nominatim / Open-Meteo) и маршруты (OSRM).
import { WEATHER_CODES } from "../shared/catalog";
import { estimateWalk } from "../shared/engine";
import type { Place, RouteInfo, Transport, WeatherDay } from "../shared/types";

const UA = "AtelierStylist/0.1 (personal wardrobe app)";
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function getJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface OpenMeteoForecast {
  daily: Record<string, (number | string)[]> & { time: string[] };
  hourly: Record<string, (number | string)[]> & { time: string[] };
}

export async function forecast(lat: number, lon: number): Promise<WeatherDay[]> {
  const key = `wx:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  return cached(key, 30 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily:
        "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code,uv_index_max,sunrise,sunset",
      hourly: "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m",
      timezone: "auto",
      forecast_days: "16",
      wind_speed_unit: "ms",
    });
    const data = await getJson<OpenMeteoForecast>(`https://api.open-meteo.com/v1/forecast?${params}`);
    const d = data.daily;
    return d.time.map((date, i) => {
      const hourly = data.hourly.time
        .map((t, j) => ({
          time: t,
          temp: Number(data.hourly.temperature_2m[j]),
          feels: Number(data.hourly.apparent_temperature[j]),
          precipProb: Number(data.hourly.precipitation_probability[j] ?? 0),
          wind: Number(data.hourly.wind_speed_10m[j]),
          code: Number(data.hourly.weather_code[j]),
        }))
        .filter((h) => h.time.startsWith(date) && Number(h.time.slice(11, 13)) % 2 === 0);
      const code = Number(d.weather_code[i]);
      return {
        date,
        tMin: Number(d.temperature_2m_min[i]),
        tMax: Number(d.temperature_2m_max[i]),
        feelsMin: Number(d.apparent_temperature_min[i]),
        feelsMax: Number(d.apparent_temperature_max[i]),
        precipProb: Number(d.precipitation_probability_max[i] ?? 0),
        precipSum: Number(d.precipitation_sum[i] ?? 0),
        windMax: Number(d.wind_speed_10m_max[i]),
        code,
        uvMax: Number(d.uv_index_max[i] ?? 0),
        description: WEATHER_CODES[code] ?? "—",
        sunrise: String(d.sunrise[i]).slice(11),
        sunset: String(d.sunset[i]).slice(11),
        hourly,
      } satisfies WeatherDay;
    });
  });
}

interface NominatimHit {
  display_name: string;
  lat: string;
  lon: string;
}
interface OMGeoHit {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

export async function geocode(q: string): Promise<Place[]> {
  return cached(`geo:${q}`, 24 * 3600 * 1000, async () => {
    try {
      const hits = await getJson<NominatimHit[]>(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "jsonv2", limit: "6", "accept-language": "ru" })}`,
      );
      if (hits.length)
        return hits.map((h) => ({ label: h.display_name.split(",").slice(0, 3).join(","), lat: Number(h.lat), lon: Number(h.lon) }));
    } catch {
      /* fallback ниже */
    }
    const om = await getJson<{ results?: OMGeoHit[] }>(
      `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: "6", language: "ru" })}`,
    );
    return (om.results ?? []).map((h) => ({
      label: [h.name, h.admin1, h.country].filter(Boolean).join(", "),
      lat: h.latitude,
      lon: h.longitude,
    }));
  });
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const OSRM_PROFILE: Record<Transport, string> = {
  walk: "routed-foot",
  metro: "routed-foot",
  bus: "routed-car",
  car: "routed-car",
  taxi: "routed-car",
  bike: "routed-bike",
  scooter: "routed-bike",
};

export async function route(from: Place, to: Place, transport: Transport): Promise<RouteInfo> {
  const straight = haversineKm(from, to);
  let distanceKm = straight * 1.3;
  let source: RouteInfo["source"] = "estimate";
  let routedMin: number | undefined;
  try {
    const profile = OSRM_PROFILE[transport];
    const url = `https://routing.openstreetmap.de/${profile}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const data = await cached(`route:${url}`, 3600 * 1000, () =>
      getJson<{ routes?: { distance: number; duration: number }[] }>(url, 8000),
    );
    const r = data.routes?.[0];
    if (r) {
      distanceKm = r.distance / 1000;
      if (transport === "walk" || transport === "car" || transport === "taxi" || transport === "bike") routedMin = Math.round(r.duration / 60);
      source = "routing";
    }
  } catch {
    /* используем оценку по прямой */
  }
  const w = estimateWalk(transport, distanceKm);
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin: routedMin ?? w.durationMin,
    transport,
    walkKm: Math.round(w.walkKm * 10) / 10,
    outdoorMin: w.outdoorMin,
    source,
  };
}
