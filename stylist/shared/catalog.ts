import type {
  Category,
  EventType,
  GarmentShape,
  Pattern,
  Season,
  Transport,
  WardrobeItem,
  ItemBrief,
} from "./types";

/** Слот образа: вещи одного слота взаимоисключающие. */
export type Slot =
  | "top"
  | "mid"
  | "bottom"
  | "onepiece"
  | "blazer"
  | "outer"
  | "shoes"
  | "belt"
  | "headwear"
  | "bag"
  | "scarf"
  | "jewelry"
  | "accessory"
  | "hosiery";

interface CategoryMeta {
  label: string;
  short: string;
  slot: Slot;
  group: "clothes" | "shoes" | "accessories";
  defaults: { shape: GarmentShape; formality: number; warmth: number; pattern?: Pattern };
  subtypes: string[];
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  tops: {
    label: "Футболки и топы",
    short: "Топы",
    slot: "top",
    group: "clothes",
    defaults: { shape: { sleeve: "short", length: "hip", fit: "regular" }, formality: 2, warmth: 1 },
    subtypes: ["футболка", "топ", "майка", "лонгслив", "поло", "боди", "худи", "свитшот"],
  },
  shirts: {
    label: "Рубашки и блузы",
    short: "Рубашки",
    slot: "top",
    group: "clothes",
    defaults: { shape: { sleeve: "long", length: "hip", fit: "regular" }, formality: 3, warmth: 2 },
    subtypes: ["рубашка", "блуза", "сорочка", "рубашка оверсайз"],
  },
  knitwear: {
    label: "Свитеры и кардиганы",
    short: "Трикотаж",
    slot: "mid",
    group: "clothes",
    defaults: { shape: { sleeve: "long", length: "hip", fit: "regular" }, formality: 2, warmth: 3, pattern: "knit" },
    subtypes: ["свитер", "джемпер", "водолазка", "кардиган", "жилет", "пуловер"],
  },
  trousers: {
    label: "Брюки",
    short: "Брюки",
    slot: "bottom",
    group: "clothes",
    defaults: { shape: { length: "ankle", fit: "regular" }, formality: 3, warmth: 2 },
    subtypes: ["классические брюки", "палаццо", "чиносы", "карго", "джоггеры", "леггинсы"],
  },
  jeans: {
    label: "Джинсы",
    short: "Джинсы",
    slot: "bottom",
    group: "clothes",
    defaults: { shape: { length: "ankle", fit: "regular" }, formality: 2, warmth: 2, pattern: "denim" },
    subtypes: ["прямые", "скинни", "клёш", "мом", "широкие", "бойфренды"],
  },
  skirts: {
    label: "Юбки",
    short: "Юбки",
    slot: "bottom",
    group: "clothes",
    defaults: { shape: { length: "knee", fit: "regular" }, formality: 3, warmth: 1 },
    subtypes: ["мини", "карандаш", "миди", "плиссе", "макси", "джинсовая"],
  },
  shorts: {
    label: "Шорты",
    short: "Шорты",
    slot: "bottom",
    group: "clothes",
    defaults: { shape: { length: "thigh", fit: "regular" }, formality: 1, warmth: 1 },
    subtypes: ["джинсовые", "бермуды", "спортивные", "классические"],
  },
  dresses: {
    label: "Платья",
    short: "Платья",
    slot: "onepiece",
    group: "clothes",
    defaults: { shape: { sleeve: "none", length: "knee", fit: "regular" }, formality: 3, warmth: 1 },
    subtypes: ["мини", "миди", "макси", "футляр", "рубашка", "трикотажное", "вечернее", "коктейльное"],
  },
  jumpsuits: {
    label: "Комбинезоны",
    short: "Комбинезоны",
    slot: "onepiece",
    group: "clothes",
    defaults: { shape: { sleeve: "none", length: "ankle", fit: "regular" }, formality: 2, warmth: 2 },
    subtypes: ["комбинезон", "ромпер"],
  },
  blazers: {
    label: "Пиджаки и жакеты",
    short: "Пиджаки",
    slot: "blazer",
    group: "clothes",
    defaults: { shape: { sleeve: "long", length: "hip", fit: "regular", open: true }, formality: 4, warmth: 2 },
    subtypes: ["пиджак", "жакет", "блейзер", "жилет костюмный", "твидовый жакет"],
  },
  outerwear: {
    label: "Верхняя одежда",
    short: "Верхняя",
    slot: "outer",
    group: "clothes",
    defaults: { shape: { sleeve: "long", length: "knee", fit: "regular" }, formality: 3, warmth: 4 },
    subtypes: ["пальто", "тренч", "куртка", "пуховик", "косуха", "бомбер", "парка", "шуба", "ветровка"],
  },
  shoes: {
    label: "Обувь",
    short: "Обувь",
    slot: "shoes",
    group: "shoes",
    defaults: { shape: { shoeType: "sneakers", heelCm: 2 }, formality: 2, warmth: 2 },
    subtypes: ["кроссовки", "кеды", "лоферы", "балетки", "туфли", "босоножки", "ботильоны", "ботинки", "сапоги", "мюли"],
  },
  belts: {
    label: "Ремни",
    short: "Ремни",
    slot: "belt",
    group: "accessories",
    defaults: { shape: {}, formality: 3, warmth: 1, pattern: "leather" },
    subtypes: ["кожаный ремень", "тонкий пояс", "широкий пояс", "цепочка"],
  },
  headwear: {
    label: "Головные уборы",
    short: "Шапки",
    slot: "headwear",
    group: "accessories",
    defaults: { shape: { hatType: "beanie" }, formality: 2, warmth: 3 },
    subtypes: ["шапка", "кепка", "шляпа", "панама", "берет", "бандана"],
  },
  bags: {
    label: "Сумки",
    short: "Сумки",
    slot: "bag",
    group: "accessories",
    defaults: { shape: {}, formality: 3, warmth: 1 },
    subtypes: ["кросс-боди", "тоут", "клатч", "рюкзак", "шопер", "поясная", "портфель"],
  },
  scarves: {
    label: "Шарфы и платки",
    short: "Шарфы",
    slot: "scarf",
    group: "accessories",
    defaults: { shape: {}, formality: 2, warmth: 3 },
    subtypes: ["шарф", "платок", "палантин", "снуд"],
  },
  jewelry: {
    label: "Украшения",
    short: "Украшения",
    slot: "jewelry",
    group: "accessories",
    defaults: { shape: {}, formality: 3, warmth: 1 },
    subtypes: ["колье", "цепочка", "серьги", "браслет", "кольцо", "брошь"],
  },
  accessories: {
    label: "Аксессуары",
    short: "Аксессуары",
    slot: "accessory",
    group: "accessories",
    defaults: { shape: {}, formality: 2, warmth: 1 },
    subtypes: ["очки", "часы", "перчатки", "зонт", "галстук", "заколка"],
  },
  hosiery: {
    label: "Колготки и носки",
    short: "Колготки",
    slot: "hosiery",
    group: "accessories",
    defaults: { shape: {}, formality: 3, warmth: 2 },
    subtypes: ["колготки", "чулки", "носки", "гольфы"],
  },
};

export const CATEGORY_ORDER: Category[] = [
  "tops",
  "shirts",
  "knitwear",
  "trousers",
  "jeans",
  "skirts",
  "shorts",
  "dresses",
  "jumpsuits",
  "blazers",
  "outerwear",
  "shoes",
  "belts",
  "headwear",
  "bags",
  "scarves",
  "jewelry",
  "accessories",
  "hosiery",
];

export const slotOf = (c: Category): Slot => CATEGORIES[c].slot;

export const SEASONS: Record<Season, string> = {
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
  winter: "Зима",
};

export const PATTERNS: Record<Pattern, string> = {
  solid: "Однотонный",
  stripes: "Полоска",
  check: "Клетка",
  dots: "Горох",
  floral: "Цветочный",
  print: "Принт",
  denim: "Деним",
  knit: "Вязка",
  leather: "Кожа",
  animal: "Анималистичный",
};

export const EVENT_TYPES: Record<EventType, { label: string; formality: number; emoji: string }> = {
  work: { label: "Работа / офис", formality: 3, emoji: "💼" },
  business: { label: "Деловая встреча", formality: 4, emoji: "🤝" },
  interview: { label: "Собеседование", formality: 4, emoji: "🎯" },
  conference: { label: "Конференция", formality: 3, emoji: "🎤" },
  date: { label: "Свидание", formality: 3, emoji: "💘" },
  restaurant: { label: "Ресторан", formality: 3, emoji: "🍷" },
  party: { label: "Вечеринка", formality: 3, emoji: "🪩" },
  birthday: { label: "День рождения", formality: 3, emoji: "🎂" },
  wedding: { label: "Свадьба", formality: 5, emoji: "💍" },
  theatre: { label: "Театр / концерт", formality: 4, emoji: "🎭" },
  walk: { label: "Прогулка", formality: 1, emoji: "🌳" },
  sport: { label: "Спорт", formality: 1, emoji: "🏃" },
  travel: { label: "Поездка", formality: 2, emoji: "✈️" },
  casual: { label: "Повседневно", formality: 2, emoji: "☕" },
  other: { label: "Другое", formality: 2, emoji: "📌" },
};

export const TRANSPORTS: Record<Transport, { label: string; emoji: string; speedKmh: number }> = {
  walk: { label: "Пешком", emoji: "🚶", speedKmh: 4.8 },
  metro: { label: "Метро", emoji: "🚇", speedKmh: 28 },
  bus: { label: "Автобус", emoji: "🚌", speedKmh: 18 },
  car: { label: "Автомобиль", emoji: "🚗", speedKmh: 30 },
  taxi: { label: "Такси", emoji: "🚕", speedKmh: 30 },
  bike: { label: "Велосипед", emoji: "🚲", speedKmh: 15 },
  scooter: { label: "Самокат", emoji: "🛴", speedKmh: 15 },
};

export const FORMALITY_LABELS = ["", "Спорт / дом", "Кэжуал", "Смарт-кэжуал", "Деловой", "Вечерний"];
export const WARMTH_LABELS = ["", "Очень лёгкая", "Лёгкая", "Средняя", "Тёплая", "Очень тёплая"];

export const STYLE_TAGS = [
  "классика",
  "минимализм",
  "кэжуал",
  "смарт-кэжуал",
  "спорт-шик",
  "романтичный",
  "бохо",
  "стритстайл",
  "old money",
  "гранж",
  "преппи",
  "вечерний",
  "деловой",
];

export const WEATHER_CODES: Record<number, string> = {
  0: "Ясно",
  1: "Преимущественно ясно",
  2: "Переменная облачность",
  3: "Пасмурно",
  45: "Туман",
  48: "Изморозь",
  51: "Лёгкая морось",
  53: "Морось",
  55: "Сильная морось",
  56: "Ледяная морось",
  57: "Ледяная морось",
  61: "Небольшой дождь",
  63: "Дождь",
  65: "Сильный дождь",
  66: "Ледяной дождь",
  67: "Ледяной дождь",
  71: "Небольшой снег",
  73: "Снег",
  75: "Сильный снег",
  77: "Снежная крупа",
  80: "Ливень",
  81: "Ливни",
  82: "Сильные ливни",
  85: "Снегопад",
  86: "Сильный снегопад",
  95: "Гроза",
  96: "Гроза с градом",
  99: "Гроза с градом",
};

export const isSnowCode = (c: number) => [71, 73, 75, 77, 85, 86].includes(c);
export const isRainCode = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (isSnowCode(code)) return "🌨️";
  if (code >= 95) return "⛈️";
  if (isRainCode(code)) return "🌧️";
  return "🌥️";
}

export function seasonOf(dateIso: string): Season {
  const m = Number(dateIso.slice(5, 7));
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "autumn";
}

/** Форма по умолчанию с учётом подтипа (например, «сапоги» → высокие, «туфли» → каблук). */
export function inferShape(category: Category, subtype = "", shape: GarmentShape = {}): GarmentShape {
  const s = subtype.toLowerCase();
  const base: GarmentShape = { ...CATEGORIES[category].defaults.shape };
  if (category === "shoes") {
    if (/сапог/.test(s)) Object.assign(base, { shoeType: "knee_boots", heelCm: 4 });
    else if (/ботильон/.test(s)) Object.assign(base, { shoeType: "ankle_boots", heelCm: 6 });
    else if (/ботин|челси|дерби|берц/.test(s)) Object.assign(base, { shoeType: "ankle_boots", heelCm: 3 });
    else if (/туфл|лодоч|шпильк|мюли/.test(s)) Object.assign(base, { shoeType: "heels", heelCm: 8 });
    else if (/босонож|сандал|шлёп|шлеп/.test(s)) Object.assign(base, { shoeType: "sandals", heelCm: 2 });
    else if (/лофер|мокас|оксфорд/.test(s)) Object.assign(base, { shoeType: "loafers", heelCm: 2 });
    else if (/балетк/.test(s)) Object.assign(base, { shoeType: "flats", heelCm: 1 });
  }
  if (category === "headwear") {
    if (/кепк|бейсбол/.test(s)) base.hatType = "cap";
    else if (/шляп|федор/.test(s)) base.hatType = "fedora";
    else if (/панам/.test(s)) base.hatType = "panama";
    else if (/берет/.test(s)) base.hatType = "beret";
    else if (/бакет/.test(s)) base.hatType = "bucket";
  }
  if (category === "outerwear") {
    if (/куртк|косух|бомбер|ветровк|пуховик/.test(s)) Object.assign(base, { length: "hip" });
    if (/парк/.test(s)) Object.assign(base, { length: "thigh" });
  }
  if (category === "skirts") {
    if (/мини/.test(s)) base.length = "thigh";
    else if (/миди|плиссе/.test(s)) base.length = "midi";
    else if (/макси/.test(s)) base.length = "maxi";
  }
  if (category === "dresses") {
    if (/мини/.test(s)) base.length = "thigh";
    else if (/миди/.test(s)) base.length = "midi";
    else if (/макси|вечер/.test(s)) base.length = "maxi";
  }
  if (category === "knitwear" && /кардиган/.test(s)) base.open = true;
  if (category === "tops" && /майк|топ/.test(s)) base.sleeve = "none";
  if (category === "tops" && /лонгслив|худи|свитшот/.test(s)) base.sleeve = "long";
  return { ...base, ...shape };
}

export function toBrief(i: WardrobeItem): ItemBrief {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    subtype: i.subtype,
    colors: i.colors,
    pattern: i.pattern,
    material: i.material,
    formality: i.formality,
    warmth: i.warmth,
    seasons: i.seasons,
    styles: i.styles,
    heelCm: i.shape.heelCm,
    shoeType: i.shape.shoeType,
    waterproof: i.waterproof,
    walkComfort: i.walkComfort,
    lastWorn: i.lastWorn,
    favorite: i.favorite,
  };
}

/** Магазины РФ для поиска. */
export const SHOPS = [
  { id: "wb", name: "Wildberries", domain: "wildberries.ru", search: (q: string) => `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(q)}` },
  { id: "ozon", name: "Ozon", domain: "ozon.ru", search: (q: string) => `https://www.ozon.ru/search/?text=${encodeURIComponent(q)}` },
  { id: "lamoda", name: "Lamoda", domain: "lamoda.ru", search: (q: string) => `https://www.lamoda.ru/catalogsearch/result/?q=${encodeURIComponent(q)}` },
  { id: "ym", name: "Яндекс Маркет", domain: "market.yandex.ru", search: (q: string) => `https://market.yandex.ru/search?text=${encodeURIComponent(q)}` },
  { id: "ga", name: "Золотое Яблоко", domain: "goldapple.ru", search: (q: string) => `https://goldapple.ru/catalogsearch/result?q=${encodeURIComponent(q)}` },
];

export const SHOP_DOMAINS = [
  "wildberries.ru",
  "ozon.ru",
  "lamoda.ru",
  "market.yandex.ru",
  "goldapple.ru",
  "12storeez.com",
  "lime-shop.com",
  "zarina.ru",
  "befree.ru",
  "loverepublic.ru",
  "gloria-jeans.ru",
  "ushatava.ru",
  "sela.ru",
  "tsum.ru",
  "brandshop.ru",
  "sportmaster.ru",
  "rendez-vous.ru",
  "ekonika.ru",
];
