import type { BodyMeasurements, Gender, Profile } from "./types";

export function bodyShape(b: BodyMeasurements, gender: Gender): { id: string; label: string; advice: string } {
  const { chest, waist, hips } = b;
  if (gender === "male") {
    if (chest - waist >= 18) return { id: "v", label: "V-силуэт", advice: "Подчёркивайте талию приталенными рубашками, прямые брюки уравновесят плечи." };
    if (waist >= chest) return { id: "oval", label: "Овал", advice: "Вертикальные линии, однотонные костюмы, пиджаки без лишнего объёма, тёмный низ." };
    if (chest - waist < 8) return { id: "rect", label: "Прямоугольник", advice: "Добавьте структуру плечам: жакеты, слои, фактурный трикотаж." };
    return { id: "trapezoid", label: "Трапеция", advice: "Универсальный тип: подойдёт большинство классических кроев." };
  }
  const bh = chest - hips;
  if (Math.abs(bh) <= 5 && waist / hips <= 0.76) return { id: "hourglass", label: "Песочные часы", advice: "Подчёркивайте талию: пояса, запах, приталенные жакеты, юбки-карандаш." };
  if (hips - chest > 5) return { id: "pear", label: "Груша", advice: "Акцент на верх: вырезы, объёмные рукава; низ — прямой или А-силуэт в тёмных тонах." };
  if (bh > 5) return { id: "invtri", label: "Перевёрнутый треугольник", advice: "Объём вниз: широкие брюки, юбки А-силуэта; верх — лаконичный, V-вырез." };
  if (waist / Math.min(chest, hips) > 0.88) return { id: "apple", label: "Яблоко", advice: "Ампирная линия, струящиеся ткани, V-вырез, открытые ноги и руки, удлинённые жакеты." };
  return { id: "rect", label: "Прямоугольник", advice: "Создавайте талию поясом, баской, слоями; хороши жакеты и асимметрия." };
}

export function bmi(b: BodyMeasurements): number {
  return Math.round((b.weight / (b.height / 100) ** 2) * 10) / 10;
}

export function defaultProfile(gender: Gender = "female"): Profile {
  const female = gender === "female";
  return {
    name: "",
    gender,
    body: female
      ? { height: 168, weight: 58, chest: 88, underbust: 74, waist: 68, hips: 94, shoulders: 38, neck: 33, armLength: 58, inseam: 78, thigh: 54, calf: 35, footLength: 24 }
      : { height: 180, weight: 76, chest: 100, waist: 84, hips: 98, shoulders: 46, neck: 39, armLength: 63, inseam: 83, thigh: 57, calf: 38, footLength: 27 },
    sizes: female
      ? { top: "44", bottom: "44", shoes: "38", international: "S", bra: "75B" }
      : { top: "50", bottom: "50", shoes: "43", international: "L" },
    appearance: {
      skinTone: "#e8c4a8",
      undertone: "neutral",
      hairColor: female ? "#5a3b28" : "#3b2a20",
      hairLength: female ? "long" : "short",
      hairType: "straight",
      eyeColor: "#5b7a5a",
    },
    style: { preferred: ["минимализм", "смарт-кэжуал"], avoid: [], favoriteColors: [], avoidColors: [], budget: "mid", notes: "" },
    comfort: { maxHeelCm: female ? 9 : 4, maxWalkKmInHeels: 1, coldSensitive: false },
    home: { label: "Москва, центр", lat: 55.7558, lon: 37.6173 },
  };
}

/** Российский размер одежды по обхвату груди/бёдер (упрощённая таблица). */
export function ruSize(b: BodyMeasurements, gender: Gender): { top: string; bottom: string; international: string } {
  const top = Math.max(38, Math.round(b.chest / 2 / 2) * 2);
  const bottom = Math.max(38, Math.round((gender === "female" ? b.hips - 4 : b.waist + 16) / 2 / 2) * 2);
  const intl = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const idx = Math.max(0, Math.min(intl.length - 1, Math.round((top - (gender === "female" ? 40 : 44)) / 2)));
  return { top: String(top), bottom: String(bottom), international: intl[idx] };
}
