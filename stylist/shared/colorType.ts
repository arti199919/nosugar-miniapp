// Цветотип по цветам кожи, волос и глаз (метод 4 сезонов с подтипами).
import { hexToRgb } from "./color";
import type { ColorPalette, NamedColor } from "./types";

export function hexToLab(hex: string): { L: number; a: number; b: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

export const deltaE = (h1: string, h2: string) => {
  const a = hexToLab(h1);
  const b = hexToLab(h2);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
};

const c = (name: string, hex: string): NamedColor => ({ name, hex });

const PALETTES: Record<ColorPalette["season"], Pick<ColorPalette, "best" | "neutrals" | "avoid" | "metals" | "makeup" | "hair">> = {
  spring: {
    best: [c("коралловый", "#ff7f61"), c("персиковый", "#ffb38a"), c("тёплый жёлтый", "#f6c945"), c("травяной", "#7cb342"), c("бирюзовый", "#2ec4b6"), c("лососевый", "#fa8072"), c("маковый", "#e63b2e"), c("светло-голубой тёплый", "#7ec8e3")],
    neutrals: [c("слоновая кость", "#fff5e1"), c("кремовый", "#f3e5c0"), c("светлый кэмел", "#d2a86e"), c("тёплый серо-бежевый", "#c8b79e")],
    avoid: [c("чёрный", "#000000"), c("холодный серый", "#8a8f98"), c("фуксия", "#e0218a"), c("бордовый", "#6d1a36")],
    metals: "золото, розовое золото",
    makeup: ["персиковые и коралловые румяна", "тёплый нюд и коралловая помада", "золотистые и бронзовые тени"],
    hair: ["медовый блонд", "золотисто-русый", "светлая карамель"],
  },
  summer: {
    best: [c("пыльная роза", "#d8a7b1"), c("лавандовый", "#b7a6d6"), c("серо-голубой", "#8fa9c7"), c("шалфей", "#a3b18a"), c("малиновый приглушённый", "#b5577a"), c("сливовый светлый", "#9b6b8e"), c("морская волна", "#6fa8a4"), c("голубой лёд", "#bcd7ea")],
    neutrals: [c("мягкий белый", "#f4f4f2"), c("светло-серый", "#c5c7cc"), c("серо-синий", "#4b5d73"), c("розово-бежевый", "#d9c3bb")],
    avoid: [c("оранжевый", "#f28c28"), c("горчичный", "#e9a23b"), c("чисто-чёрный", "#000000"), c("рыжий", "#c1440e")],
    metals: "серебро, белое золото, платина",
    makeup: ["розовые румяна", "ягодный нюд, розовая помада", "серо-коричневые и сиреневые тени"],
    hair: ["пепельный блонд", "холодный русый", "жемчужные оттенки"],
  },
  autumn: {
    best: [c("терракотовый", "#c1553b"), c("горчичный", "#d39e2a"), c("оливковый", "#6b7a45"), c("ржавчина", "#a44a1f"), c("тыквенный", "#d9772b"), c("изумрудный тёплый", "#1f6f50"), c("шоколад", "#4b3621"), c("бордо тёплый", "#7a2a2a")],
    neutrals: [c("кэмел", "#c19a6b"), c("хаки", "#8a7f5a"), c("молочный", "#f5eddc"), c("тёплый коричневый", "#6f4e37")],
    avoid: [c("фуксия", "#e0218a"), c("холодный розовый", "#f4a6d7"), c("ледяной голубой", "#cde8f6"), c("чисто-белый", "#ffffff")],
    metals: "золото, бронза, медь",
    makeup: ["терракотовые румяна", "кирпичная или карамельная помада", "бронзовые, оливковые, медные тени"],
    hair: ["каштан", "медный", "шоколадный с тёплым отливом"],
  },
  winter: {
    best: [c("чисто-белый", "#ffffff"), c("чёрный", "#000000"), c("королевский синий", "#2c4fb3"), c("изумрудный", "#00875a"), c("фуксия", "#d0197c"), c("красный вишнёвый", "#c1121f"), c("ледяной розовый", "#f2d4e4"), c("баклажан", "#4b2046")],
    neutrals: [c("угольно-серый", "#36393f"), c("тёмно-синий", "#1b2440"), c("белый", "#fafafa"), c("серебристо-серый", "#b8bcc4")],
    avoid: [c("оранжевый", "#f28c28"), c("бежевый тёплый", "#d8bf94"), c("горчичный", "#d39e2a"), c("персиковый", "#ffb38a")],
    metals: "серебро, платина, белое золото",
    makeup: ["холодные розовые румяна", "красная или ягодная помада", "графитовые стрелки, холодные тени"],
    hair: ["чёрный", "холодный тёмный шоколад", "графитовый"],
  },
};

export function localColorType(colors: { skin: string; hair: string; eyes: string }): ColorPalette {
  const skin = hexToLab(colors.skin);
  const hair = hexToLab(colors.hair);
  const eyes = hexToLab(colors.eyes);
  // подтон: угол оттенка кожи в плоскости a*b*: больше жёлтого (b*) — тёплый
  const hue = (Math.atan2(skin.b, skin.a) * 180) / Math.PI;
  const undertone: ColorPalette["undertone"] = hue > 58 ? "warm" : hue < 48 ? "cool" : "neutral";
  const contrastL = Math.max(Math.abs(skin.L - hair.L), Math.abs(skin.L - eyes.L));
  const contrast: ColorPalette["contrast"] = contrastL > 45 ? "high" : contrastL > 25 ? "medium" : "low";
  const light = (skin.L + hair.L) / 2 > 55;
  const hairWarm = Math.atan2(hair.b, hair.a) > 0.95; // рыжеватые/золотистые волосы
  const warm = undertone === "warm" || (undertone === "neutral" && hairWarm);
  let season: ColorPalette["season"];
  if (warm) season = light && contrast !== "high" ? "spring" : "autumn";
  else season = contrast === "high" ? "winter" : light || contrast === "low" ? "summer" : "winter";
  const subtype =
    {
      spring: contrast === "low" ? "светлая весна" : "тёплая весна",
      summer: contrast === "low" ? "мягкое лето" : "светлое лето",
      autumn: contrast === "high" ? "глубокая осень" : contrast === "low" ? "мягкая осень" : "тёплая осень",
      winter: light ? "холодная зима" : "глубокая зима",
    }[season];
  const names = { spring: "Весна", summer: "Лето", autumn: "Осень", winter: "Зима" };
  const ut = { warm: "тёплый", cool: "холодный", neutral: "нейтральный" }[undertone];
  const ct = { low: "низкий", medium: "средний", high: "высокий" }[contrast];
  return {
    season,
    subtype,
    undertone,
    contrast,
    ...PALETTES[season],
    summary: `${names[season]} (${subtype}): подтон кожи ${ut}, контраст внешности ${ct}. Это автоматическая оценка по цветам селфи — при дневном свете без фильтров она точнее. Для детального разбора используйте анализ Claude.`,
    source: "local",
  };
}

/** Насколько цвет вещи попадает в палитру: >0 — идёт, <0 — лучше избегать у лица. */
export function paletteFit(hex: string, palette?: ColorPalette): number {
  if (!palette) return 0;
  const near = (list: NamedColor[]) => Math.min(...list.map((x) => deltaE(hex, x.hex)));
  const best = Math.min(near(palette.best), near(palette.neutrals));
  const bad = near(palette.avoid);
  if (best < 18) return 1;
  if (bad < 15) return -1;
  return 0;
}
