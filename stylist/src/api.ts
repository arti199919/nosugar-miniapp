import type {
  CapsuleReport,
  OutfitOption,
  OutfitRequestContext,
  PhotoRating,
  Place,
  Profile,
  RouteInfo,
  ShopResult,
  Transport,
  TrendReport,
  WeatherDay,
  ItemBrief,
  BeautyAdvice,
  WardrobeItem,
  ColorPalette,
} from "@shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function req<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method: init?.json !== undefined ? "POST" : (init?.method ?? "GET"),
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 404 || res.status === 504) msg = "Сервер Atelier недоступен. Запустите `npm run dev`.";
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as T;
}

export interface Health {
  ok: boolean;
  ai: boolean;
  model: string;
}

export interface TagResult {
  name: string;
  category: WardrobeItem["category"];
  subtype: string;
  colors: string[];
  pattern: WardrobeItem["pattern"];
  material: string;
  seasons: WardrobeItem["seasons"];
  formality: number;
  warmth: number;
  styles: string[];
  waterproof: boolean;
  walkComfort: number;
  shape: WardrobeItem["shape"];
  brand: string;
  notes: string;
}

export interface PlanResult {
  options: OutfitOption[];
  beauty: BeautyAdvice;
  tips: string[];
  gaps: string[];
}

export interface ReferenceResult {
  description: string;
  pieces: { piece: string; category: WardrobeItem["category"]; matchId: string; matchQuality: "exact" | "close" | "substitute" | "none"; comment: string; shopQuery: string }[];
  tips: string[];
  score: number;
}

export const api = {
  health: () => req<Health>("/api/health"),
  weather: (lat: number, lon: number) => req<WeatherDay[]>(`/api/weather?lat=${lat}&lon=${lon}`),
  geocode: (q: string) => req<Place[]>(`/api/geocode?q=${encodeURIComponent(q)}`),
  route: (from: Place, to: Place, transport: Transport) => req<RouteInfo>("/api/route", { json: { from, to, transport } }),
  tag: (image: string, hint?: string) => req<TagResult>("/api/ai/tag", { json: { image, hint } }),
  detect: (image: string) =>
    req<{ items: { label: string; category: WardrobeItem["category"]; box: { x: number; y: number; w: number; h: number } }[] }>(
      "/api/ai/detect",
      { json: { image } },
    ),
  outfit: (body: { profile: Profile; items: ItemBrief[]; context: OutfitRequestContext; drafts: OutfitOption[]; trends?: string }) =>
    req<PlanResult>("/api/ai/outfit", { json: body }),
  rate: (body: { image: string; profile: Profile; occasion?: string; weather?: string }) => req<PhotoRating>("/api/ai/rate", { json: body }),
  trends: (body: { gender: string; city?: string; styles: string[]; date: string }) => req<TrendReport>("/api/ai/trends", { json: body }),
  capsule: (body: { goal: string; profile: Profile; items: ItemBrief[]; trends?: string }) =>
    req<CapsuleReport>("/api/ai/capsule", { json: body }),
  shop: (body: { query: string; profile: Profile; budget?: string; useAi?: boolean }) => req<ShopResult>("/api/shop/search", { json: body }),
  colorType: (image: string, measured?: { skin: string; hair: string; eyes: string }) => req<ColorPalette>("/api/ai/colortype", { json: { image, measured } }),
  reference: (body: { image: string; profile: Profile; items: ItemBrief[] }) => req<ReferenceResult>("/api/ai/reference", { json: body }),
  ics: async (url: string) => {
    const res = await fetch(`/api/ics?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).error ?? `Ошибка ${res.status}`, res.status);
    return res.text();
  },
  importUrl: (url: string) =>
    req<{ name: string; imageUrl?: string; price?: string; brand?: string; description?: string }>("/api/ai/import-url", { json: { url } }),
};

/** Стриминг ответа стилиста (SSE поверх POST). */
export async function streamChat(
  body: unknown,
  onText: (t: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError("Сервер Atelier недоступен", res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = /^event: (.+)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!ev || data == null) continue;
      const parsed = JSON.parse(data);
      if (ev === "text") onText(parsed);
      if (ev === "error") throw new ApiError(parsed.message, 502);
    }
  }
}
