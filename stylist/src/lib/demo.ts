import type { Category, Gender, GarmentShape, Pattern, Season, WardrobeItem } from "@shared/types";
import { inferShape } from "@shared/catalog";
import { db, uid } from "../db";
import { garmentIcon } from "./garmentIcon";

type Seed = [name: string, category: Category, subtype: string, colors: string[], pattern: Pattern, formality: number, warmth: number, seasons: Season[], extra?: Partial<WardrobeItem> & { shape?: GarmentShape }];

const ALL: Season[] = ["spring", "summer", "autumn", "winter"];
const DEMI: Season[] = ["spring", "autumn"];
const WARM: Season[] = ["spring", "summer"];
const COLD: Season[] = ["autumn", "winter"];

const FEMALE: Seed[] = [
  ["Белая базовая футболка", "tops", "футболка", ["#f6f4ef"], "solid", 2, 1, ALL, { material: "хлопок" }],
  ["Чёрный лонгслив", "tops", "лонгслив", ["#1b1a1d"], "solid", 2, 2, ALL, { material: "хлопок" }],
  ["Тельняшка", "tops", "лонгслив", ["#f5f3ee", "#1f2a44"], "stripes", 2, 2, DEMI],
  ["Белая рубашка оверсайз", "shirts", "рубашка", ["#fbfaf7"], "solid", 3, 2, ALL, { shape: { fit: "oversize" }, material: "хлопок поплин" }],
  ["Шёлковая блуза шампань", "shirts", "блуза", ["#e8d6b9"], "solid", 4, 1, ALL, { material: "шёлк" }],
  ["Голубая рубашка в полоску", "shirts", "рубашка", ["#bcd3ee", "#ffffff"], "stripes", 3, 2, WARM],
  ["Кашемировый джемпер кэмел", "knitwear", "джемпер", ["#c19a6b"], "knit", 3, 4, COLD, { material: "кашемир", favorite: true }],
  ["Серая водолазка", "knitwear", "водолазка", ["#8d8a8f"], "knit", 3, 3, COLD, { material: "шерсть" }],
  ["Молочный кардиган", "knitwear", "кардиган", ["#efe6d6"], "knit", 2, 3, DEMI, { shape: { open: true } }],
  ["Прямые джинсы голубые", "jeans", "прямые", ["#7d9cc4"], "denim", 2, 2, ALL, { favorite: true }],
  ["Чёрные брюки палаццо", "trousers", "палаццо", ["#1c1b1f"], "solid", 4, 2, ALL, { shape: { fit: "wide" } }],
  ["Бежевые брюки со стрелками", "trousers", "классические брюки", ["#d5c3a5"], "solid", 4, 2, ALL],
  ["Юбка-миди плиссе оливковая", "skirts", "плиссе", ["#6b7a45"], "solid", 3, 1, DEMI, { shape: { length: "midi" } }],
  ["Чёрная юбка-карандаш", "skirts", "карандаш", ["#18171b"], "solid", 4, 1, ALL, { shape: { length: "knee" } }],
  ["Джинсовые шорты", "shorts", "джинсовые", ["#8fb0d6"], "denim", 1, 1, ["summer"]],
  ["Маленькое чёрное платье", "dresses", "коктейльное", ["#121114"], "solid", 5, 1, ALL, { shape: { length: "knee", sleeve: "none" }, favorite: true }],
  ["Платье-миди в цветок", "dresses", "миди", ["#f1e3d3", "#c2566b"], "floral", 3, 1, WARM, { shape: { length: "midi", sleeve: "short" } }],
  ["Трикотажное платье бордо", "dresses", "трикотажное", ["#6e1f2e"], "knit", 3, 3, COLD, { shape: { length: "midi", sleeve: "long", fit: "slim" } }],
  ["Графитовый пиджак", "blazers", "пиджак", ["#3b3b40"], "solid", 4, 2, ALL, { material: "шерсть" }],
  ["Твидовый жакет", "blazers", "твидовый жакет", ["#e8e2d6", "#6b5e55"], "check", 4, 3, COLD],
  ["Тренч бежевый", "outerwear", "тренч", ["#cdb58f"], "solid", 3, 3, DEMI, { waterproof: true, shape: { length: "knee" }, favorite: true }],
  ["Шерстяное пальто графит", "outerwear", "пальто", ["#4a4a50"], "solid", 4, 4, COLD, { shape: { length: "knee" } }],
  ["Чёрный пуховик", "outerwear", "пуховик", ["#16151a"], "solid", 2, 5, ["winter"], { waterproof: true, shape: { length: "thigh", fit: "oversize" } }],
  ["Кожаная косуха", "outerwear", "косуха", ["#1a1a1c"], "leather", 2, 3, DEMI, { material: "кожа", shape: { length: "waist" } }],
  ["Белые кеды", "shoes", "кеды", ["#f7f6f2", "#f7f6f2"], "solid", 2, 2, WARM, { walkComfort: 5 }],
  ["Кроссовки New Balance серые", "shoes", "кроссовки", ["#b7b6b3", "#f2f0ec"], "solid", 1, 2, ALL, { walkComfort: 5 }],
  ["Чёрные лоферы", "shoes", "лоферы", ["#141316"], "leather", 3, 2, DEMI, { walkComfort: 4, material: "кожа" }],
  ["Туфли-лодочки нюд 9 см", "shoes", "туфли", ["#d8b59a"], "leather", 5, 1, ALL, { walkComfort: 2, shape: { heelCm: 9 } }],
  ["Ботильоны на каблуке", "shoes", "ботильоны", ["#231f20"], "leather", 3, 3, COLD, { walkComfort: 3, shape: { heelCm: 6 } }],
  ["Высокие сапоги", "shoes", "сапоги", ["#3a2a22"], "leather", 3, 4, COLD, { walkComfort: 3, waterproof: true, shape: { heelCm: 4 } }],
  ["Кожаный ремень чёрный", "belts", "кожаный ремень", ["#161518"], "leather", 3, 1, ALL],
  ["Коричневый ремень", "belts", "кожаный ремень", ["#7a4e2d"], "leather", 3, 1, ALL],
  ["Кашемировая шапка", "headwear", "шапка", ["#d9cfc2"], "knit", 2, 4, ["winter"]],
  ["Бейсболка", "headwear", "кепка", ["#22324f"], "solid", 1, 1, WARM],
  ["Фетровая шляпа", "headwear", "шляпа", ["#6b5645"], "solid", 3, 2, DEMI],
  ["Кросс-боди коньячная", "bags", "кросс-боди", ["#8b5a2b"], "leather", 3, 1, ALL, { favorite: true }],
  ["Чёрный тоут", "bags", "тоут", ["#18171a"], "leather", 4, 1, ALL],
  ["Клатч золото", "bags", "клатч", ["#c9a45c"], "leather", 5, 1, ALL],
  ["Шарф в клетку", "scarves", "шарф", ["#8b2f35", "#2d3a4f"], "check", 2, 4, COLD],
  ["Золотая цепочка", "jewelry", "цепочка", ["#d4af37"], "solid", 3, 1, ALL],
  ["Солнцезащитные очки", "accessories", "очки", ["#151416"], "solid", 2, 1, WARM],
  ["Чёрные колготки 40 den", "hosiery", "колготки", ["#1a1a1c"], "solid", 3, 2, COLD],
];

const MALE: Seed[] = [
  ["Белая футболка", "tops", "футболка", ["#f6f4ef"], "solid", 2, 1, ALL],
  ["Тёмно-синее поло", "tops", "поло", ["#1f2a44"], "solid", 3, 1, WARM],
  ["Серое худи", "tops", "худи", ["#8f8e92"], "solid", 1, 3, DEMI, { shape: { sleeve: "long", fit: "oversize" } }],
  ["Белая оксфордская рубашка", "shirts", "рубашка", ["#f7f6f2"], "solid", 4, 2, ALL],
  ["Голубая рубашка", "shirts", "рубашка", ["#a9c4e4"], "solid", 3, 2, ALL],
  ["Фланелевая рубашка в клетку", "shirts", "рубашка", ["#6b2c2c", "#1f2a2a"], "check", 2, 3, COLD],
  ["Джемпер мериносовый тёмно-синий", "knitwear", "джемпер", ["#22304d"], "knit", 3, 3, COLD],
  ["Водолазка чёрная", "knitwear", "водолазка", ["#151417"], "knit", 3, 3, COLD],
  ["Джинсы тёмные прямые", "jeans", "прямые", ["#2f4260"], "denim", 2, 2, ALL],
  ["Чиносы бежевые", "trousers", "чиносы", ["#cbb994"], "solid", 3, 2, WARM],
  ["Серые шерстяные брюки", "trousers", "классические брюки", ["#6e6d72"], "solid", 4, 2, COLD],
  ["Шорты-бермуды", "shorts", "бермуды", ["#8a8a6a"], "solid", 1, 1, ["summer"], { shape: { length: "knee" } }],
  ["Тёмно-синий пиджак", "blazers", "пиджак", ["#1d2640"], "solid", 4, 2, ALL],
  ["Пальто кэмел", "outerwear", "пальто", ["#b98d5c"], "solid", 4, 4, COLD, { shape: { length: "knee" } }],
  ["Бомбер оливковый", "outerwear", "бомбер", ["#4f5a3a"], "solid", 2, 3, DEMI, { shape: { length: "waist" } }],
  ["Пуховик чёрный", "outerwear", "пуховик", ["#141316"], "solid", 2, 5, ["winter"], { waterproof: true, shape: { length: "hip" } }],
  ["Белые кеды", "shoes", "кеды", ["#f6f5f1", "#f6f5f1"], "solid", 2, 2, WARM, { walkComfort: 5 }],
  ["Коричневые челси", "shoes", "ботинки челси", ["#5a3a26"], "leather", 3, 3, COLD, { walkComfort: 4, waterproof: true }],
  ["Чёрные оксфорды", "shoes", "оксфорды", ["#111013"], "leather", 5, 2, ALL, { walkComfort: 3 }],
  ["Коричневый ремень", "belts", "кожаный ремень", ["#5a3a26"], "leather", 3, 1, ALL],
  ["Шапка серая", "headwear", "шапка", ["#77767a"], "knit", 2, 4, ["winter"]],
  ["Рюкзак чёрный", "bags", "рюкзак", ["#1a191c"], "solid", 2, 1, ALL],
  ["Шарф кашемировый", "scarves", "шарф", ["#7b6a5a"], "knit", 3, 4, COLD],
  ["Часы стальные", "accessories", "часы", ["#c0c7cf"], "solid", 3, 1, ALL],
];

export async function loadDemoWardrobe(gender: Gender) {
  const seeds = gender === "male" ? MALE : FEMALE;
  const now = Date.now();
  const items: WardrobeItem[] = seeds.map(([name, category, subtype, colors, pattern, formality, warmth, seasons, extra], i) => {
    const shape = inferShape(category, subtype, extra?.shape);
    return {
      id: uid(),
      name,
      category,
      subtype,
      colors,
      pattern,
      seasons,
      formality,
      warmth,
      styles: [],
      wearCount: Math.floor(Math.random() * 12),
      lastWorn: i % 4 === 3 ? undefined : new Date(now - (3 + Math.floor(Math.random() * 40)) * 86400000).toISOString().slice(0, 10),
      status: "active",
      createdAt: now - i * 1000,
      ...extra,
      shape,
      image: garmentIcon(category, colors, shape, subtype),
    };
  });
  await db.items.bulkAdd(items);
  return items.length;
}
