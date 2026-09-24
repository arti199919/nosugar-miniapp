// Локальный движок подбора образов: работает без ИИ и служит «черновиком» для Claude.
import { CATEGORIES, EVENT_TYPES, TRANSPORTS, isRainCode, isSnowCode, seasonOf, slotOf } from "./catalog";
import type { Slot } from "./catalog";
import { harmonyScore, colorName, isNeutral } from "./color";
import { paletteFit } from "./colorType";
import type {
  BeautyAdvice,
  CalendarEvent,
  EventType,
  OutfitOption,
  Profile,
  RouteInfo,
  Transport,
  WardrobeItem,
  WeatherDay,
} from "./types";

export interface EngineInput {
  items: WardrobeItem[];
  profile: Profile;
  date: string;
  eventType?: EventType;
  dressCode?: string;
  weather?: WeatherDay;
  route?: RouteInfo;
  /** Вещи, которые обязательно должны быть в образе */
  mustInclude?: string[];
  count?: number;
}

export interface Conditions {
  formality: number;
  warmthNeed: number; // 1..5
  feels: number;
  rainy: boolean;
  snowy: boolean;
  windy: boolean;
  sunny: boolean;
  hot: boolean;
  walkKm: number;
  outdoorMin: number;
  bike: boolean;
}

export function dressCodeFormality(dressCode?: string): number | undefined {
  if (!dressCode) return undefined;
  const d = dressCode.toLowerCase();
  if (/black ?tie|вечерн|white ?tie|гала/.test(d)) return 5;
  if (/cocktail|коктейл|business formal|строг|формал|деловой/.test(d)) return 4;
  if (/smart|смарт|business casual|полуформ/.test(d)) return 3;
  if (/casual|кэжуал|свобод|повседн/.test(d)) return 2;
  if (/спорт|sport|дом/.test(d)) return 1;
  return undefined;
}

/** Сколько реально идти пешком и сколько быть на улице при выбранном транспорте. */
export function estimateWalk(transport: Transport, distanceKm: number): { walkKm: number; outdoorMin: number; durationMin: number } {
  const speed = TRANSPORTS[transport].speedKmh;
  const durationMin = Math.round((distanceKm / speed) * 60 + (transport === "metro" ? 10 : transport === "bus" ? 8 : 3));
  switch (transport) {
    case "walk":
      return { walkKm: distanceKm, outdoorMin: Math.round((distanceKm / 4.8) * 60), durationMin };
    case "metro": {
      const walkKm = Math.min(2, 0.6 + distanceKm * 0.05);
      return { walkKm, outdoorMin: Math.round((walkKm / 4.8) * 60 + 2), durationMin };
    }
    case "bus": {
      const walkKm = Math.min(1.5, 0.4 + distanceKm * 0.03);
      return { walkKm, outdoorMin: Math.round((walkKm / 4.8) * 60 + 8), durationMin };
    }
    case "car":
      return { walkKm: 0.3, outdoorMin: 5, durationMin };
    case "taxi":
      return { walkKm: 0.1, outdoorMin: 3, durationMin };
    case "bike":
    case "scooter":
      return { walkKm: 0.2, outdoorMin: durationMin, durationMin };
  }
}

export function conditions(input: Pick<EngineInput, "weather" | "route" | "eventType" | "dressCode" | "profile" | "date">): Conditions {
  const w = input.weather;
  const feels = w ? (w.feelsMin + w.feelsMax * 2) / 3 : seasonalFeels(input.date);
  const cold = input.profile.comfort.coldSensitive ? 2.5 : 0;
  const f = feels - cold;
  const warmthNeed = f >= 24 ? 1 : f >= 17 ? 2 : f >= 10 ? 3 : f >= 0 ? 4 : 5;
  const formality =
    dressCodeFormality(input.dressCode) ?? (input.eventType ? EVENT_TYPES[input.eventType].formality : 2);
  return {
    formality,
    warmthNeed,
    feels,
    rainy: !!w && (w.precipProb >= 55 || w.precipSum >= 1.5 || isRainCode(w.code)),
    snowy: !!w && isSnowCode(w.code),
    windy: !!w && w.windMax >= 9,
    sunny: !!w && w.code <= 1 && w.uvMax >= 5,
    hot: feels >= 26,
    walkKm: input.route?.walkKm ?? 0.8,
    outdoorMin: input.route?.outdoorMin ?? 15,
    bike: input.route?.transport === "bike" || input.route?.transport === "scooter",
  };
}

function seasonalFeels(date: string): number {
  const s = seasonOf(date);
  return s === "winter" ? -6 : s === "summer" ? 22 : s === "spring" ? 9 : 7;
}

const daysSince = (from?: string, to?: string) => {
  if (!from || !to) return 999;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
};

/** Базовая оценка вещи для условий, 0..~1.5 */
function itemScore(i: WardrobeItem, c: Conditions, date: string, profile: Profile): number {
  let s = 1;
  s -= Math.abs(i.formality - c.formality) * 0.22;
  if (!i.seasons.includes(seasonOf(date)) && i.seasons.length) s -= 0.25;
  const since = daysSince(i.lastWorn, date);
  if (since <= 1) s -= 0.5;
  else if (since <= 3) s -= 0.2;
  if (i.favorite) s += 0.12;
  if (i.wearCount === 0) s += 0.05; // дать шанс неношеным вещам
  const avoid = profile.style.avoidColors.map((x) => x.toLowerCase());
  if (i.colors.some((h) => avoid.includes(colorName(h)))) s -= 0.3;
  const fav = profile.style.favoriteColors.map((x) => x.toLowerCase());
  if (i.colors.some((h) => fav.includes(colorName(h)))) s += 0.08;
  if (profile.style.preferred.length && i.styles.some((st) => profile.style.preferred.includes(st))) s += 0.1;
  // цвета, которые находятся у лица, сверяем с палитрой цветотипа
  if (["top", "mid", "onepiece", "scarf", "blazer", "outer"].includes(slotOf(i.category))) s += paletteFit(i.colors[0], profile.palette) * 0.12;
  return s;
}

function shoeScore(i: WardrobeItem, c: Conditions, profile: Profile, warnings: string[], carry: string[]): number {
  let s = 0;
  const heel = i.shape.heelCm ?? 0;
  const type = i.shape.shoeType ?? "sneakers";
  if (heel > profile.comfort.maxHeelCm) s -= 1;
  if (heel >= 5 && c.walkKm > profile.comfort.maxWalkKmInHeels) {
    s -= 0.35 + (c.walkKm - profile.comfort.maxWalkKmInHeels) * 0.25;
    warnings.push(`Каблук ${heel} см, а пешком ≈${c.walkKm.toFixed(1)} км — возьмите сменную обувь или поезжайте на такси`);
    carry.push("сменная удобная обувь");
  }
  if (c.bike && heel >= 4) s -= 0.6;
  s += ((i.walkComfort ?? (heel >= 7 ? 2 : heel >= 4 ? 3 : 4)) - 3) * 0.08 * Math.min(3, c.walkKm);
  if ((c.rainy || c.snowy) && !i.waterproof) s -= type === "sandals" ? 1 : 0.25;
  if ((c.rainy || c.snowy) && i.waterproof) s += 0.25;
  if (c.snowy && !["boots", "knee_boots", "ankle_boots"].includes(type)) s -= 0.6;
  if (c.feels < 8 && (type === "sandals" || type === "flats")) s -= 0.7;
  if (c.feels < 0 && !["boots", "knee_boots", "ankle_boots"].includes(type)) s -= 0.5;
  if (c.hot && ["boots", "knee_boots", "ankle_boots"].includes(type)) s -= 0.7;
  if (c.formality >= 4 && type === "sneakers") s -= 0.5;
  if (c.formality <= 1 && type === "heels") s -= 0.6;
  return s;
}

const warmthOf = (items: WardrobeItem[]) => {
  // тепло слоёв складывается с убывающей отдачей
  const w = items.map((i) => i.warmth).sort((a, b) => b - a);
  return w.reduce((acc, v, idx) => acc + v * (idx === 0 ? 1 : 0.45), 0);
};

interface Draft {
  items: WardrobeItem[];
  score: number;
  warnings: string[];
  carry: string[];
  notes: string[];
}

function pickBest(cands: WardrobeItem[], fn: (i: WardrobeItem) => number): WardrobeItem | undefined {
  let best: WardrobeItem | undefined;
  let bestS = -Infinity;
  for (const c of cands) {
    const s = fn(c);
    if (s > bestS) {
      bestS = s;
      best = c;
    }
  }
  return best;
}

export function recommendOutfits(input: EngineInput): OutfitOption[] {
  const { profile, date } = input;
  const c = conditions(input);
  const pool = input.items.filter((i) => i.status === "active");
  const by = (slot: Slot) => pool.filter((i) => slotOf(i.category) === slot);
  const must = new Set(input.mustInclude ?? []);
  const base = (i: WardrobeItem) => itemScore(i, c, date, profile) + (must.has(i.id) ? 5 : 0);

  const uppers = [...by("top"), ...by("mid").filter((k) => !k.shape.open)];
  const bottoms = by("bottom");
  const onepieces = by("onepiece");

  // Кандидаты-основы
  type BaseCand = { items: WardrobeItem[]; s: number };
  const bases: BaseCand[] = [];
  const topU = [...uppers].sort((a, b) => base(b) - base(a)).slice(0, 14);
  const topB = [...bottoms].sort((a, b) => base(b) - base(a)).slice(0, 12);
  for (const u of topU)
    for (const b of topB) {
      let s = base(u) + base(b);
      const h = harmonyScore([u.colors[0], b.colors[0]]);
      s += h.score * 0.6;
      if (u.pattern !== "solid" && b.pattern !== "solid" && b.pattern !== "denim" && u.pattern !== "knit") s -= 0.4;
      if (b.category === "shorts" && c.feels < 18) s -= 1.2;
      if (b.category === "skirts" && b.shape.length === "maxi" && c.bike) s -= 0.8;
      if (b.category === "skirts" && c.windy && (b.shape.length === "thigh" || b.shape.length === "knee")) s -= 0.15;
      bases.push({ items: [u, b], s });
    }
  for (const d of onepieces) {
    let s = base(d) * 2 + 0.5;
    if (c.bike && (d.shape.length === "maxi" || d.shape.length === "midi")) s -= 0.8;
    bases.push({ items: [d], s });
  }
  bases.sort((a, b) => b.s - a.s);

  const drafts: Draft[] = [];
  const usedMain = new Set<string>();
  for (const b of bases) {
    if (drafts.length >= (input.count ?? 3) * 3) break;
    const key = b.items.map((i) => i.id).join("+");
    if (usedMain.has(key)) continue;
    usedMain.add(key);
    drafts.push(completeOutfit(b.items, b.s, c, pool, input));
  }

  // Разнообразие: не повторять одну и ту же главную вещь в топ-вариантах
  drafts.sort((a, b) => b.score - a.score);
  const result: Draft[] = [];
  const seen = new Map<string, number>();
  for (const d of drafts) {
    const main = d.items.filter((i) => ["top", "bottom", "onepiece"].includes(slotOf(i.category)));
    if (main.some((i) => (seen.get(i.id) ?? 0) >= 1) && drafts.length > (input.count ?? 3)) continue;
    main.forEach((i) => seen.set(i.id, (seen.get(i.id) ?? 0) + 1));
    result.push(d);
    if (result.length >= (input.count ?? 3)) break;
  }
  if (result.length < (input.count ?? 3))
    for (const d of drafts) if (!result.includes(d) && result.length < (input.count ?? 3)) result.push(d);

  return result.map((d, idx) => ({
    title: titleFor(d, idx),
    itemIds: d.items.map((i) => i.id),
    reasoning: d.notes.join(". ") + ".",
    score: Math.round(Math.max(0, Math.min(1, d.score / 4.5)) * 100),
    warnings: [...new Set(d.warnings)],
    carry: [...new Set(d.carry)],
  }));
}

function titleFor(d: Draft, idx: number): string {
  const main = d.items.find((i) => ["onepiece", "top"].includes(slotOf(i.category)));
  const names = ["Основной вариант", "Альтернатива", "Смелее"];
  return main ? `${names[idx] ?? "Вариант"}: ${main.name.toLowerCase()}` : names[idx] ?? "Вариант";
}

function completeOutfit(baseItems: WardrobeItem[], baseScore: number, c: Conditions, pool: WardrobeItem[], input: EngineInput): Draft {
  const { profile, date } = input;
  const items = [...baseItems];
  const warnings: string[] = [];
  const carry: string[] = [];
  const notes: string[] = [];
  let score = baseScore;
  const by = (slot: Slot) => pool.filter((i) => slotOf(i.category) === slot);
  const colorsNow = () => items.map((i) => i.colors[0]).filter(Boolean);
  const fit = (i: WardrobeItem) =>
    itemScore(i, c, date, profile) + harmonyScore([...colorsNow(), i.colors[0]]).score * 0.5 + ((input.mustInclude ?? []).includes(i.id) ? 5 : 0);

  const main = baseItems.map((i) => i.name.toLowerCase()).join(" + ");
  notes.push(`Основа — ${main}`);

  // Слои по теплу
  const indoorWarmthNeed = Math.min(c.warmthNeed, 3);
  if (warmthOf(items) < indoorWarmthNeed + 0.5 || c.formality >= 4) {
    const hasKnitTop = items.some((i) => i.category === "knitwear");
    const candidatesMid = by("mid").filter((k) => !hasKnitTop && k.shape.open);
    const candidatesBlazer = by("blazer");
    const layer =
      c.formality >= 3 && candidatesBlazer.length
        ? pickBest(candidatesBlazer, fit)
        : pickBest([...candidatesMid, ...candidatesBlazer], fit);
    if (layer && (c.formality >= 4 || warmthOf(items) < indoorWarmthNeed + 0.5)) {
      items.push(layer);
      notes.push(`${layer.name} — второй слой${c.formality >= 4 ? " для делового силуэта" : " для тепла в помещении"}`);
    }
  }

  // Верхняя одежда
  const needOuter = c.feels < 17 || c.rainy || c.snowy || (c.windy && c.feels < 20);
  if (needOuter) {
    const outers = by("outer");
    const target = c.warmthNeed;
    const outer = pickBest(outers, (o) => {
      let s = fit(o) - Math.abs(o.warmth + warmthOf(items) * 0.35 - (target + 1)) * 0.35;
      if ((c.rainy || c.snowy) && o.waterproof) s += 0.4;
      if (o.shape.length === "knee" && items.some((i) => i.shape.length === "maxi")) s -= 0.2;
      return s;
    });
    if (outer) {
      items.push(outer);
      notes.push(`${outer.name} — по погоде (ощущается как ${Math.round(c.feels)}°)`);
      score += 0.3;
    } else {
      warnings.push("В гардеробе нет подходящей верхней одежды для такой погоды");
      score -= 0.6;
    }
  }

  // Обувь
  const shoes = by("shoes");
  const shoeWarn: string[] = [];
  const shoeCarry: string[] = [];
  const shoe = pickBest(shoes, (s) => fit(s) + shoeScore(s, c, profile, [], []));
  if (shoe) {
    shoeScore(shoe, c, profile, shoeWarn, shoeCarry);
    items.push(shoe);
    warnings.push(...shoeWarn);
    carry.push(...shoeCarry);
    notes.push(`${shoe.name}${c.walkKm > 1.5 ? ` — удобно на ${c.walkKm.toFixed(1)} км пешком` : ""}`);
    score += shoeScore(shoe, c, profile, [], []) * 0.5;
  } else warnings.push("Добавьте обувь в гардероб, чтобы я мог её подобрать");

  // Колготки при юбке/платье в холод
  const hasLegsOpen = items.some((i) => i.category === "skirts" || i.category === "dresses");
  if (hasLegsOpen && c.feels < 14) {
    const h = pickBest(by("hosiery"), fit);
    if (h) {
      items.push(h);
      notes.push(`${h.name} — ноги не замёрзнут`);
    } else warnings.push("Юбка/платье в прохладную погоду — стоит надеть плотные колготки");
  }

  // Ремень к брюкам/джинсам при заправленном верхе
  const hasTrousers = items.some((i) => i.category === "trousers" || i.category === "jeans");
  if (hasTrousers && c.formality >= 2) {
    const belts = by("belt");
    const shoeHex = shoe?.colors[0];
    const belt = pickBest(belts, (b) => fit(b) + (shoeHex && harmonyScore([b.colors[0], shoeHex]).score > 0.8 ? 0.2 : 0));
    if (belt) {
      items.push(belt);
      notes.push(`${belt.name} в тон обуви`);
    }
  }

  // Шарф
  if (c.feels < 8 || (c.windy && c.feels < 14)) {
    const sc = pickBest(by("scarf"), fit);
    if (sc) {
      items.push(sc);
      notes.push(`${sc.name} — защита от ветра`);
    }
  }

  // Головной убор
  const hats = by("headwear");
  if (c.feels < 5) {
    const hat = pickBest(hats.filter((h) => h.warmth >= 3), fit);
    if (hat) {
      items.push(hat);
      notes.push(`${hat.name} — на улице холодно`);
    } else warnings.push("Холодно — нужна шапка");
  } else if (c.sunny && c.hot) {
    const hat = pickBest(hats.filter((h) => h.warmth <= 2), fit);
    if (hat) items.push(hat);
    carry.push("солнцезащитные очки", "SPF");
  }

  // Сумка
  const bag = pickBest(by("bag"), (b) => fit(b) + (c.bike && /рюкзак|кросс/.test(b.subtype ?? "") ? 0.4 : 0));
  if (bag) items.push(bag);

  // Украшения — для формальных и вечерних событий
  if (c.formality >= 3) {
    const j = pickBest(by("jewelry"), fit);
    if (j) items.push(j);
  }

  if (c.rainy) carry.push("зонт");
  if (c.outdoorMin > 40 && c.feels < 10) carry.push("перчатки");

  const h = harmonyScore(items.filter((i) => ["top", "mid", "bottom", "onepiece", "blazer", "outer", "shoes"].includes(slotOf(i.category))).map((i) => i.colors[0]));
  notes.push(`Цвета: ${h.note}`);
  score += h.score * 0.8;
  const patterned = items.filter((i) => !["solid", "denim", "knit", "leather"].includes(i.pattern));
  if (patterned.length > 1) {
    score -= 0.3;
    warnings.push("Несколько принтов в одном образе — проверьте, что они не спорят");
  }
  const neutralsShare = items.filter((i) => isNeutral(i.colors[0])).length / Math.max(1, items.length);
  if (neutralsShare > 0.9 && c.formality <= 3) notes.push("Можно добавить один цветной акцент — аксессуар или помаду");

  return { items, score, warnings, carry, notes };
}

export function localBeauty(input: { profile: Profile; weather?: WeatherDay; eventType?: EventType; date: string }): BeautyAdvice {
  const c = conditions({ ...input, route: undefined, dressCode: undefined });
  const { appearance, gender } = input.profile;
  const evening = input.eventType && ["party", "wedding", "theatre", "date", "restaurant", "birthday"].includes(input.eventType);
  const business = input.eventType && ["work", "business", "interview", "conference"].includes(input.eventType);

  let hairStyle = "Свободная укладка с объёмом у корней";
  let why = "универсально для дня";
  const steps: string[] = [];
  if (c.rainy || (input.weather && input.weather.precipProb > 50)) {
    hairStyle = appearance.hairLength === "short" ? "Гладкая укладка с текстурирующей пастой" : "Гладкий низкий пучок или коса";
    why = "влажность и дождь разрушат объём — собранные волосы сохранят вид";
    steps.push("Нанесите средство против пушения на влажные волосы", "Соберите волосы, зафиксируйте лаком лёгкой фиксации");
  } else if (c.windy) {
    hairStyle = appearance.hairLength === "long" ? "Высокий хвост или небрежная коса" : "Укладка с воском, волосы от лица";
    why = "ветер — распущенные длинные волосы будут путаться";
    steps.push("Сделайте основу из текстурирующего спрея", "Зафиксируйте резинкой-пружинкой, выпустите пару прядей у лица");
  } else if (evening) {
    hairStyle = appearance.hairLength === "short" ? "Гладкий зачёс с блеском" : appearance.hairType === "curly" ? "Подчёркнутые локоны с диффузором" : "Голливудская волна или низкий элегантный пучок";
    why = "вечернее событие — добавим праздничности";
    steps.push("Термозащита", "Крупная плойка или диффузор", "Расчешите пальцами и зафиксируйте");
  } else if (business) {
    hairStyle = appearance.hairLength === "short" ? "Аккуратная укладка на бок" : "Гладкие распущенные волосы или низкий хвост";
    why = "деловой контекст — чисто и собранно";
    steps.push("Разгладьте брашингом", "Капля масла на кончики");
  } else {
    steps.push("Высушите волосы с приподнятыми корнями", "Лёгкая текстура руками");
  }
  if (c.feels < 3) steps.push("Под шапку — сухой шампунь с собой, чтобы вернуть объём");

  const warm = appearance.undertone === "warm";
  const palette = evening
    ? warm
      ? ["бронза", "терракотовые тени", "кирпичная помада"]
      : ["графитовые тени", "ягодная помада", "холодный хайлайтер"]
    : warm
      ? ["персиковые румяна", "золотистый хайлайтер", "нюдовая помада"]
      : ["розовые румяна", "холодный нюд", "прозрачный блеск"];
  const mSteps = [
    c.hot || c.sunny ? "Лёгкий флюид с SPF 30+ вместо плотного тона" : "Увлажняющий крем и лёгкий тон",
    evening ? "Растушёванная дымка или стрелка" : "Тушь в один слой, брови гелем",
    evening ? "Акцент на губах или глазах — одно из двух" : "Кремовые румяна для свежести",
  ];
  if (c.rainy) mSteps.push("Водостойкая тушь и фиксирующий спрей");
  if (c.feels < 0) mSteps.push("Плотный бальзам для губ — от мороза");

  return {
    hair: { style: hairStyle, why, steps },
    makeup: {
      look: evening ? "Вечерний акцент" : business ? "Деловой нюд" : "Свежий дневной",
      palette,
      steps: mSteps,
    },
    grooming:
      gender === "male"
        ? ["Аккуратная линия бороды или гладкое бритьё", "Матирующий крем при жаре", "Лёгкий парфюм — 1–2 нажатия"]
        : undefined,
  };
}

export function eventOccasion(e?: Pick<CalendarEvent, "title" | "type" | "dressCode">): string {
  if (!e) return "Обычный день";
  return `${EVENT_TYPES[e.type].label}${e.title ? ` — ${e.title}` : ""}${e.dressCode ? ` (дресс-код: ${e.dressCode})` : ""}`;
}

export const categoryLabel = (c: WardrobeItem["category"]) => CATEGORIES[c].label;
