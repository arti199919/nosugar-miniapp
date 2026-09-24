// Локальная сборка капсулы без ИИ: шаблон по категориям + универсальность вещей.
import { CATEGORIES, seasonOf, slotOf } from "@shared/catalog";
import { isNeutral } from "@shared/color";
import type { CapsuleReport, Category, Profile, TrendReport, WardrobeItem } from "@shared/types";
import { todayISO } from "./dates";

interface Tpl {
  need: Partial<Record<Category, number>>;
  gaps: Partial<Record<Category, string>>;
}

const TEMPLATES: Record<string, Tpl> = {
  office: {
    need: { shirts: 3, tops: 2, knitwear: 2, trousers: 2, skirts: 1, dresses: 1, blazers: 2, outerwear: 1, shoes: 3, bags: 1, belts: 1 },
    gaps: {
      shirts: "белая хлопковая рубашка прямого кроя",
      knitwear: "тонкий джемпер из мериноса нейтрального цвета",
      trousers: "прямые брюки со стрелками",
      blazers: "однобортный пиджак прямого кроя",
      shoes: "кожаные лоферы",
      bags: "структурная сумка тоут A4",
      dresses: "платье-футляр миди",
      outerwear: "классическое пальто",
      belts: "кожаный ремень",
    },
  },
  weekend: {
    need: { tops: 3, knitwear: 2, jeans: 2, skirts: 1, dresses: 1, outerwear: 1, shoes: 2, bags: 1, headwear: 1 },
    gaps: { tops: "базовая футболка плотного хлопка", jeans: "прямые джинсы голубые", knitwear: "свободный свитер", shoes: "белые кожаные кеды", bags: "сумка кросс-боди", outerwear: "тренч", headwear: "бейсболка" },
  },
  travel: {
    need: { tops: 3, shirts: 1, knitwear: 1, trousers: 1, jeans: 1, dresses: 1, outerwear: 1, shoes: 2, bags: 1, scarves: 1 },
    gaps: { tops: "футболка из быстросохнущего хлопка", dresses: "платье-трансформер из немнущейся ткани", shoes: "удобные кроссовки", scarves: "лёгкий шарф-палантин", bags: "складной рюкзак" },
  },
  sea: {
    need: { tops: 3, shirts: 1, shorts: 2, dresses: 2, skirts: 1, shoes: 2, headwear: 1, bags: 1, accessories: 1 },
    gaps: { dresses: "льняное платье миди", shorts: "льняные шорты", shoes: "кожаные сандалии", headwear: "соломенная шляпа", bags: "плетёная сумка", accessories: "солнцезащитные очки" },
  },
};

export const CAPSULE_GOALS = [
  { id: "office", label: "Офис на 2 недели" },
  { id: "weekend", label: "Городские выходные" },
  { id: "travel", label: "Командировка / поездка" },
  { id: "sea", label: "Отпуск у моря" },
];

export function localCapsule(goalId: string, goalLabel: string, items: WardrobeItem[]): CapsuleReport {
  const tpl = TEMPLATES[goalId] ?? TEMPLATES.weekend;
  const targetFormality = goalId === "office" ? 3.6 : goalId === "sea" ? 1.6 : 2.3;
  const season = seasonOf(todayISO());
  const active = items.filter((i) => i.status === "active");
  const versatility = (i: WardrobeItem) =>
    (isNeutral(i.colors[0]) ? 1 : 0.4) + (i.pattern === "solid" || i.pattern === "denim" ? 0.4 : 0) + (i.seasons.includes(season) ? 0.5 : 0) + (i.favorite ? 0.2 : 0) + Math.min(i.wearCount, 10) * 0.03 - Math.abs(i.formality - targetFormality) * 0.35;
  const chosen: WardrobeItem[] = [];
  const gaps: CapsuleReport["gaps"] = [];
  for (const [cat, n] of Object.entries(tpl.need) as [Category, number][]) {
    const pool = active.filter((i) => i.category === cat).sort((a, b) => versatility(b) - versatility(a));
    chosen.push(...pool.slice(0, n));
    if (pool.length < n && tpl.gaps[cat])
      gaps.push({
        item: tpl.gaps[cat]!,
        why: `${CATEGORIES[cat].label}: в капсуле нужно ${n}, у вас ${pool.length}`,
        priority: pool.length === 0 ? "high" : "medium",
        query: tpl.gaps[cat]!,
      });
  }
  const tops = chosen.filter((i) => ["top", "mid"].includes(slotOf(i.category)));
  const bottoms = chosen.filter((i) => slotOf(i.category) === "bottom");
  const shoes = chosen.filter((i) => i.category === "shoes");
  const combos: CapsuleReport["combos"] = [];
  for (const t of tops)
    for (const b of bottoms) {
      if (combos.length >= 8) break;
      const s = shoes[(combos.length + 1) % Math.max(1, shoes.length)];
      combos.push({ title: `${t.name} + ${b.name}`, itemIds: [t.id, b.id, ...(s ? [s.id] : [])] });
    }
  for (const d of chosen.filter((i) => slotOf(i.category) === "onepiece")) combos.push({ title: d.name, itemIds: [d.id, ...(shoes[0] ? [shoes[0].id] : [])] });
  return {
    goal: goalLabel,
    summary: `Из ${chosen.length} вещей получается минимум ${tops.length * Math.max(1, bottoms.length) + chosen.filter((i) => slotOf(i.category) === "onepiece").length} сочетаний. Вещи отобраны по универсальности: нейтральные цвета, однотонность, сезон.`,
    capsuleItemIds: chosen.map((i) => i.id),
    combos,
    gaps,
    source: "local",
  };
}

/** Базовые ориентиры сезона без ИИ (не «тренды», а принципы). */
export function localTrends(profile: Profile): TrendReport {
  const s = seasonOf(todayISO());
  const f = profile.gender === "female";
  const base: Record<string, TrendReport["trends"]> = {
    autumn: [
      { title: "Многослойность", description: "Рубашка + джемпер + жакет + пальто — тепло и выразительно.", howToWear: "Выпустите воротник рубашки из-под джемпера, сверху — пальто на размер свободнее.", keyItems: ["тонкий джемпер", "рубашка оверсайз", "пальто прямого кроя"] },
      { title: "Тренч как база", description: "Главная межсезонная вещь.", howToWear: "С джинсами и лоферами днём, с платьем миди и сапогами вечером.", keyItems: ["тренч бежевый"] },
      { title: "Фактуры", description: "Замша, трикотаж крупной вязки, кожа.", howToWear: "Смешивайте 2–3 фактуры в одном цвете.", keyItems: ["замшевая куртка", "свитер крупной вязки"] },
      { title: f ? "Сапоги с юбкой миди" : "Ботинки челси", description: "Практично для дождя и слякоти.", howToWear: f ? "Сапог заходит под юбку — нога визуально длиннее." : "С прямыми брюками без заломов.", keyItems: [f ? "сапоги кожаные на низком каблуке" : "ботинки челси"] },
    ],
    winter: [
      { title: "Тёплый монохром", description: "Один цвет от шапки до ботинок вытягивает силуэт.", howToWear: "Молочный, кэмел или серый — разные оттенки одного тона.", keyItems: ["кашемировый свитер", "шерстяные брюки"] },
      { title: "Объёмный пуховик + строгий низ", description: "Контраст объёма и классики.", howToWear: "Пуховик с брюками со стрелками и лоферами на толстой подошве.", keyItems: ["пуховик оверсайз", "лоферы на тракторной подошве"] },
      { title: "Акцентные аксессуары", description: "Шарф, шапка, перчатки — место для цвета.", howToWear: "Один яркий аксессуар на нейтральный образ.", keyItems: ["шарф шерстяной яркий", "кожаные перчатки"] },
    ],
    spring: [
      { title: "Лёгкие слои", description: "Жакеты, тренчи, кардиганы.", howToWear: "Жакет поверх платья, кардиган на плечи.", keyItems: ["лёгкий жакет", "кардиган тонкой вязки"] },
      { title: "Пастель с нейтральным", description: "Мягкие оттенки на бежевой базе.", howToWear: "Один пастельный предмет на образ.", keyItems: ["рубашка пастельная"] },
    ],
    summer: [
      { title: "Лён и хлопок", description: "Дышащие натуральные ткани.", howToWear: "Льняной костюм, свободные рубашки.", keyItems: ["льняная рубашка", "льняные брюки"] },
      { title: "Белое на белом", description: "Свежо и дорого.", howToWear: "Разные фактуры белого, аксессуары — натуральные.", keyItems: ["белое платье", "плетёная сумка"] },
    ],
  };
  return {
    season: `${{ autumn: "Осень", winter: "Зима", spring: "Весна", summer: "Лето" }[s]} — базовые ориентиры`,
    summary: "Это общие принципы сезона без выхода в интернет. Подключите Claude, чтобы получать актуальные тренды с показов и из модных изданий.",
    trends: base[s],
    colors: [
      { name: "Кэмел", hex: "#c19a6b" },
      { name: "Шоколад", hex: "#4b3621" },
      { name: "Молочный", hex: "#f5f0e6" },
      { name: "Графит", hex: "#3a3a3a" },
      { name: "Бордо", hex: "#7b1e2b" },
    ],
    antiTrends: [],
    sources: [],
    fetchedAt: Date.now(),
    source: "local",
  };
}
