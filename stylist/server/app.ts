import express, { type NextFunction, type Request, type Response } from "express";
import * as ai from "./ai";
import { forecast, geocode, route } from "./geo";
import { SHOPS } from "../shared/catalog";
import type { Place, Transport } from "../shared/types";

export const app = express();
app.use(express.json({ limit: "25mb" }));


type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res)
    .then((data) => {
      if (!res.headersSent) res.json(data);
    })
    .catch(next);
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: ai.aiAvailable(), model: ai.MODEL });
});

// ---- погода и маршруты ----
app.get(
  "/api/weather",
  wrap(async (req) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new ai.AiError("lat/lon обязательны", 400);
    return forecast(lat, lon);
  }),
);

app.get(
  "/api/geocode",
  wrap(async (req) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return [];
    return geocode(q);
  }),
);

app.post(
  "/api/route",
  wrap(async (req) => {
    const { from, to, transport } = req.body as { from: Place; to: Place; transport: Transport };
    if (!from || !to) throw new ai.AiError("from/to обязательны", 400);
    return route(from, to, transport ?? "metro");
  }),
);

// ---- ИИ ----
app.post("/api/ai/tag", wrap(async (req) => ai.tagItem(req.body.image, req.body.hint)));
app.post("/api/ai/detect", wrap(async (req) => ai.detectItems(req.body.image)));
app.post("/api/ai/outfit", wrap(async (req) => ai.planOutfit(req.body)));
app.post("/api/ai/rate", wrap(async (req) => ai.ratePhoto(req.body)));
app.post("/api/ai/trends", wrap(async (req) => ai.trends(req.body)));
app.post("/api/ai/capsule", wrap(async (req) => ai.capsule(req.body)));
app.post("/api/ai/colortype", wrap(async (req) => ai.colorType(req.body)));
app.post("/api/ai/reference", wrap(async (req) => ai.outfitFromReference(req.body)));
app.post("/api/ai/import-url", wrap(async (req) => ai.importFromUrl(String(req.body.url))));

app.post(
  "/api/shop/search",
  wrap(async (req) => {
    const { query, profile, budget, useAi } = req.body as { query: string; profile: Parameters<typeof ai.shopSearch>[0]["profile"]; budget?: string; useAi?: boolean };
    const sized = `${query}${profile?.sizes ? ` размер ${/обув|кроссов|туфл|ботин|сапог|лофер/i.test(query) ? profile.sizes.shoes : profile.sizes.top}` : ""}`;
    const links = SHOPS.map((s) => ({ shop: s.name, url: s.search(sized) }));
    if (!useAi || !ai.aiAvailable()) return { query, products: [], links };
    const found = await ai.shopSearch({ query, profile, budget });
    return { query, links, ...found };
  }),
);

app.post("/api/ai/chat", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    await ai.chatStream({ ...req.body, onText: (t: string) => send("text", t) });
    send("done", {});
  } catch (e) {
    send("error", { message: ai.describeApiError(e).message });
  }
  res.end();
});

// Подписка на календарь (iCloud «Общий календарь», Google, Яндекс): отдаём ICS без CORS-ограничений
app.get("/api/ics", async (req, res, next) => {
  try {
    const raw = String(req.query.url ?? "").trim().replace(/^webcal:\/\//i, "https://");
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new ai.AiError("Нужна ссылка https:// или webcal://", 400);
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "AtelierStylist/0.1" } });
    const text = await r.text();
    if (!r.ok || !text.includes("BEGIN:VCALENDAR")) throw new ai.AiError("По ссылке нет календаря — проверьте, что календарь опубликован", 502);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.send(text);
  } catch (e) {
    next(e instanceof TypeError ? new ai.AiError("Неверная ссылка на календарь", 400) : e);
  }
});

// Прокси картинок (для импорта вещей по ссылке — обход CORS)
app.get("/api/proxy-image", async (req, res, next) => {
  try {
    const url = new URL(String(req.query.url));
    if (!/^https?:$/.test(url.protocol)) throw new ai.AiError("Неверная ссылка", 400);
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0 AtelierStylist" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) throw new ai.AiError("Не удалось загрузить изображение", 502);
    res.setHeader("Content-Type", type);
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    next(e);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = ai.describeApiError(err);
  if (e.status >= 500) console.error("[api]", err);
  res.status(e.status).json({ error: e.message });
});
