export interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function hexToHsl(hex: string): Hsl {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r0) h = (g0 - b0) / d + (g0 < b0 ? 6 : 0);
    else if (max === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export const shade = (hex: string, t: number) => (t >= 0 ? mix(hex, "#ffffff", t) : mix(hex, "#000000", -t));

/** Нейтральные цвета: чёрный, белый, серый, бежевый, тёмно-синий, коричневый, хаки-тауп. */
export function isNeutral(hex: string): boolean {
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.16 || l > 0.92) return true;
  if (s < 0.14) return true;
  // бежевые/кэмел/коричневые
  if (h >= 20 && h <= 50 && s < 0.55) return true;
  // тёмно-синий
  if (h >= 200 && h <= 250 && l < 0.3) return true;
  // оливковый/хаки приглушённый
  if (h >= 50 && h <= 90 && s < 0.35 && l < 0.5) return true;
  return false;
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Оценка сочетаемости набора основных цветов: 0..1.
 * Правило «база + 1–2 акцента», аналоговые/комплементарные пары — ок, три и больше ярких — штраф.
 */
export function harmonyScore(colors: string[]): { score: number; note: string } {
  const accents = colors.filter((c) => !isNeutral(c)).map(hexToHsl);
  if (accents.length === 0) return { score: 0.85, note: "спокойная нейтральная гамма" };
  // уникальные акценты по оттенку
  const uniq: Hsl[] = [];
  for (const a of accents) if (!uniq.some((u) => hueDist(u.h, a.h) < 18)) uniq.push(a);
  if (uniq.length === 1) return { score: 1, note: "нейтральная база с одним акцентом" };
  if (uniq.length === 2) {
    const d = hueDist(uniq[0].h, uniq[1].h);
    if (d <= 45) return { score: 0.9, note: "аналоговое сочетание оттенков" };
    if (d >= 150) return { score: 0.85, note: "комплементарный контраст" };
    if (d >= 100 && d < 150) return { score: 0.7, note: "контрастное сочетание" };
    return { score: 0.55, note: "два акцента средней совместимости" };
  }
  return { score: Math.max(0.15, 0.55 - (uniq.length - 2) * 0.2), note: "слишком много ярких цветов" };
}

const NAMED: [string, string][] = [
  ["#000000", "чёрный"],
  ["#ffffff", "белый"],
  ["#f5f0e6", "молочный"],
  ["#808080", "серый"],
  ["#c0c0c0", "светло-серый"],
  ["#3a3a3a", "графит"],
  ["#1f2a44", "тёмно-синий"],
  ["#2f5da8", "синий"],
  ["#87b5e5", "голубой"],
  ["#2aa198", "бирюзовый"],
  ["#2e7d32", "зелёный"],
  ["#6b8e23", "оливковый"],
  ["#a3b18a", "шалфей"],
  ["#1b4332", "изумрудный"],
  ["#d4c29c", "бежевый"],
  ["#c19a6b", "кэмел"],
  ["#6f4e37", "коричневый"],
  ["#4b3621", "шоколадный"],
  ["#8b5a2b", "коньячный"],
  ["#f4d35e", "жёлтый"],
  ["#e9a23b", "горчичный"],
  ["#f28c28", "оранжевый"],
  ["#e2725b", "терракотовый"],
  ["#d62828", "красный"],
  ["#7b1e2b", "бордовый"],
  ["#f4a6b8", "розовый"],
  ["#e0218a", "фуксия"],
  ["#d8a7b1", "пудровый"],
  ["#b57edc", "лавандовый"],
  ["#6a3d9a", "фиолетовый"],
  ["#b5a642", "хаки"],
  ["#d4af37", "золотой"],
  ["#c0c7cf", "серебряный"],
];

export function colorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let best = NAMED[0][1];
  let bestD = Infinity;
  for (const [h, name] of NAMED) {
    const [r2, g2, b2] = hexToRgb(h);
    // взвешенное расстояние, ближе к восприятию
    const rm = (r + r2) / 2;
    const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
