import { describe, expect, it } from "vitest";
import { conditions, dressCodeFormality, estimateWalk, recommendOutfits } from "../shared/engine";
import { harmonyScore, isNeutral } from "../shared/color";
import { bodyShape, defaultProfile } from "../shared/body";
import { inferShape } from "../shared/catalog";
import type { Category, WardrobeItem, WeatherDay } from "../shared/types";
import { extractJson } from "../server/ai";

let n = 0;
const item = (category: Category, patch: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id: `i${++n}`,
  name: `${category} ${n}`,
  category,
  shape: inferShape(category, patch.subtype, patch.shape),
  colors: ["#222222"],
  pattern: "solid",
  seasons: ["spring", "summer", "autumn", "winter"],
  formality: 3,
  warmth: 2,
  styles: [],
  wearCount: 0,
  status: "active",
  createdAt: 0,
  ...patch,
});

const weather = (p: Partial<WeatherDay>): WeatherDay => ({
  date: "2026-10-01",
  tMin: 8,
  tMax: 14,
  feelsMin: 6,
  feelsMax: 12,
  precipProb: 10,
  precipSum: 0,
  windMax: 3,
  code: 2,
  uvMax: 2,
  description: "",
  ...p,
});

const profile = defaultProfile("female");

describe("estimateWalk", () => {
  it("пешком — весь маршрут", () => expect(estimateWalk("walk", 3).walkKm).toBe(3));
  it("такси — почти не идём", () => expect(estimateWalk("taxi", 20).walkKm).toBeLessThan(0.3));
  it("метро — дорога до станций", () => {
    const w = estimateWalk("metro", 10);
    expect(w.walkKm).toBeGreaterThan(0.5);
    expect(w.walkKm).toBeLessThanOrEqual(2);
  });
});

describe("conditions", () => {
  it("дождь по вероятности осадков", () => {
    expect(conditions({ profile, date: "2026-10-01", weather: weather({ precipProb: 80 }) }).rainy).toBe(true);
  });
  it("дресс-код важнее типа события", () => {
    expect(dressCodeFormality("Black tie")).toBe(5);
    expect(conditions({ profile, date: "2026-10-01", eventType: "walk", dressCode: "cocktail" }).formality).toBe(4);
  });
  it("мерзлявым нужно теплее", () => {
    const w = weather({ feelsMin: 12, feelsMax: 14 });
    const a = conditions({ profile, date: "2026-10-01", weather: w }).warmthNeed;
    const b = conditions({ profile: { ...profile, comfort: { ...profile.comfort, coldSensitive: true } }, date: "2026-10-01", weather: w }).warmthNeed;
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

describe("recommendOutfits", () => {
  const base = [
    item("shirts", { colors: ["#ffffff"] }),
    item("trousers", { colors: ["#1c1b1f"] }),
    item("dresses", { colors: ["#121114"], formality: 4 }),
  ];
  const heels = item("shoes", { name: "Шпильки", subtype: "туфли", shape: { shoeType: "heels", heelCm: 10 }, formality: 5, walkComfort: 1 });
  const sneakers = item("shoes", { name: "Кеды", subtype: "кеды", shape: { shoeType: "sneakers", heelCm: 2 }, formality: 2, walkComfort: 5 });

  it("на длинную прогулку не выбирает высокие каблуки", () => {
    const [o] = recommendOutfits({
      items: [...base, heels, sneakers],
      profile,
      date: "2026-10-01",
      eventType: "work",
      weather: weather({}),
      route: { distanceKm: 4, durationMin: 50, transport: "walk", walkKm: 4, outdoorMin: 50, source: "estimate" },
    });
    expect(o.itemIds).toContain(sneakers.id);
    expect(o.itemIds).not.toContain(heels.id);
  });

  it("предупреждает о каблуках, если других туфель нет", () => {
    const [o] = recommendOutfits({
      items: [...base, heels],
      profile: { ...profile, comfort: { ...profile.comfort, maxHeelCm: 12 } },
      date: "2026-10-01",
      eventType: "theatre",
      weather: weather({}),
      route: { distanceKm: 3, durationMin: 40, transport: "walk", walkKm: 3, outdoorMin: 40, source: "estimate" },
    });
    expect(o.warnings.join(" ")).toMatch(/Каблук/);
    expect(o.carry).toContain("сменная удобная обувь");
  });

  it("в дождь берёт непромокаемую верхнюю одежду и зонт", () => {
    const trench = item("outerwear", { name: "Тренч", waterproof: true, warmth: 3 });
    const coat = item("outerwear", { name: "Пальто", warmth: 3 });
    const [o] = recommendOutfits({ items: [...base, sneakers, trench, coat], profile, date: "2026-10-01", eventType: "work", weather: weather({ precipProb: 90, code: 63 }) });
    expect(o.itemIds).toContain(trench.id);
    expect(o.carry).toContain("зонт");
  });

  it("платье не сочетается с отдельными верхом и низом", () => {
    for (const o of recommendOutfits({ items: [...base, sneakers], profile, date: "2026-10-01", eventType: "party" })) {
      const hasDress = o.itemIds.includes(base[2].id);
      if (hasDress) expect(o.itemIds).not.toContain(base[1].id);
    }
  });
});

describe("цвет и фигура", () => {
  it("нейтральные цвета", () => {
    expect(isNeutral("#000000")).toBe(true);
    expect(isNeutral("#d4c29c")).toBe(true);
    expect(isNeutral("#d62828")).toBe(false);
  });
  it("три ярких цвета хуже одного акцента", () => {
    expect(harmonyScore(["#000000", "#d62828"]).score).toBeGreaterThan(harmonyScore(["#d62828", "#2e7d32", "#f4d35e"]).score);
  });
  it("тип фигуры", () => {
    expect(bodyShape({ ...profile.body, chest: 90, waist: 64, hips: 92 }, "female").id).toBe("hourglass");
    expect(bodyShape({ ...profile.body, chest: 84, waist: 68, hips: 100 }, "female").id).toBe("pear");
  });
});

describe("extractJson", () => {
  it("достаёт JSON из блока ```json", () => {
    expect(extractJson<{ a: number }>("Вот результат:\n```json\n{\"a\": 1}\n```")).toEqual({ a: 1 });
  });
  it("достаёт голый объект", () => {
    expect(extractJson<{ b: string }>('Итог {"b": "x"} конец')).toEqual({ b: "x" });
  });
});
