// Доменная модель, общая для клиента и сервера.

export type Category =
  | "tops"
  | "shirts"
  | "knitwear"
  | "trousers"
  | "jeans"
  | "skirts"
  | "shorts"
  | "dresses"
  | "jumpsuits"
  | "blazers"
  | "outerwear"
  | "shoes"
  | "belts"
  | "headwear"
  | "bags"
  | "scarves"
  | "jewelry"
  | "accessories"
  | "hosiery";

export type Season = "spring" | "summer" | "autumn" | "winter";

export type Pattern =
  | "solid"
  | "stripes"
  | "check"
  | "dots"
  | "floral"
  | "print"
  | "denim"
  | "knit"
  | "leather"
  | "animal";

export type SleeveLength = "none" | "short" | "three_quarter" | "long";
export type GarmentLength = "crop" | "waist" | "hip" | "thigh" | "knee" | "midi" | "maxi" | "ankle";
export type Fit = "slim" | "regular" | "oversize" | "wide";
export type ShoeType =
  | "sneakers"
  | "loafers"
  | "flats"
  | "heels"
  | "sandals"
  | "ankle_boots"
  | "boots"
  | "knee_boots";
export type HatType = "cap" | "beanie" | "fedora" | "bucket" | "beret" | "panama";

/** Параметры формы вещи — по ним строится 3D-геометрия на аватаре. */
export interface GarmentShape {
  sleeve?: SleeveLength;
  length?: GarmentLength;
  fit?: Fit;
  heelCm?: number;
  shoeType?: ShoeType;
  hatType?: HatType;
  open?: boolean; // расстёгнутый жакет/кардиган
}

export type ItemStatus = "active" | "laundry" | "repair" | "archived";

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  subtype?: string;
  shape: GarmentShape;
  colors: string[]; // hex, первый — основной
  pattern: Pattern;
  material?: string;
  seasons: Season[];
  formality: number; // 1 спорт/дом … 5 black tie
  warmth: number; // 1 очень лёгкая … 5 очень тёплая
  styles: string[];
  waterproof?: boolean;
  walkComfort?: number; // 1…5, для обуви
  brand?: string;
  size?: string;
  price?: number;
  notes?: string;
  image?: string; // вырезанная вещь (data URL)
  photo?: string; // исходное фото
  favorite?: boolean;
  wearCount: number;
  lastWorn?: string; // YYYY-MM-DD
  status: ItemStatus;
  createdAt: number;
}

export type Gender = "female" | "male";

export interface BodyMeasurements {
  height: number; // см
  weight: number; // кг
  chest: number; // обхват груди
  underbust?: number;
  waist: number;
  hips: number;
  shoulders: number; // ширина плеч
  neck: number;
  armLength: number; // от плеча до запястья
  inseam: number; // внутренняя длина ноги
  thigh: number;
  calf: number;
  footLength: number; // см
}

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface Profile {
  name: string;
  gender: Gender;
  birthYear?: number;
  body: BodyMeasurements;
  sizes: { top: string; bottom: string; shoes: string; international: string; bra?: string };
  appearance: {
    skinTone: string;
    undertone: "warm" | "cool" | "neutral";
    hairColor: string;
    hairLength: "short" | "medium" | "long";
    hairType: "straight" | "wavy" | "curly";
    eyeColor: string;
    colorType?: "spring" | "summer" | "autumn" | "winter";
  };
  style: {
    preferred: string[];
    avoid: string[];
    favoriteColors: string[];
    avoidColors: string[];
    budget: "low" | "mid" | "high";
    notes: string;
  };
  comfort: {
    maxHeelCm: number;
    maxWalkKmInHeels: number;
    coldSensitive: boolean;
  };
  home?: Place;
  work?: Place;
  palette?: ColorPalette;
}

export interface NamedColor {
  name: string;
  hex: string;
}

/** Результат анализа цветотипа. */
export interface ColorPalette {
  season: "spring" | "summer" | "autumn" | "winter";
  subtype: string; // например «мягкое лето»
  undertone: "warm" | "cool" | "neutral";
  contrast: "low" | "medium" | "high";
  best: NamedColor[];
  neutrals: NamedColor[];
  avoid: NamedColor[];
  metals: string;
  makeup: string[];
  hair: string[];
  summary: string;
  source: "ai" | "local";
}

export interface Look {
  id: string;
  name: string;
  itemIds: string[];
  occasion?: string;
  tags: string[];
  thumbnail?: string;
  notes?: string;
  rating?: number;
  hair?: string;
  makeup?: string;
  source: "ai" | "manual" | "local";
  createdAt: number;
}

export type EventType =
  | "work"
  | "business"
  | "interview"
  | "conference"
  | "date"
  | "restaurant"
  | "party"
  | "birthday"
  | "wedding"
  | "theatre"
  | "walk"
  | "sport"
  | "travel"
  | "casual"
  | "other";

export type Transport = "walk" | "metro" | "bus" | "car" | "taxi" | "bike" | "scooter";

export interface WeatherDay {
  date: string;
  tMin: number;
  tMax: number;
  feelsMin: number;
  feelsMax: number;
  precipProb: number;
  precipSum: number;
  windMax: number;
  code: number;
  uvMax: number;
  description: string;
  sunrise?: string;
  sunset?: string;
  hourly?: { time: string; temp: number; feels: number; precipProb: number; wind: number; code: number }[];
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  transport: Transport;
  walkKm: number; // сколько реально идти пешком
  outdoorMin: number; // сколько времени на улице
  source: "routing" | "estimate" | "manual";
}

export interface OutfitOption {
  title: string;
  itemIds: string[];
  reasoning: string;
  score?: number;
  warnings: string[];
  carry: string[];
}

export interface BeautyAdvice {
  hair: { style: string; why: string; steps: string[] };
  makeup: { look: string; palette: string[]; steps: string[] };
  grooming?: string[];
}

export interface OutfitPlan {
  id: string;
  date: string;
  eventId?: string;
  occasion: string;
  weather?: WeatherDay;
  route?: RouteInfo;
  options: OutfitOption[];
  chosen?: number;
  beauty?: BeautyAdvice;
  tips: string[];
  gaps: string[];
  source: "ai" | "local";
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start?: string; // HH:MM
  end?: string;
  type: EventType;
  dressCode?: string;
  location?: Place;
  from?: Place;
  transport: Transport;
  outdoorMin?: number;
  notes?: string;
  planId?: string;
  lookId?: string;
  externalId?: string; // UID из подписанного календаря (Apple/iCloud)
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  image?: string;
  createdAt: number;
}

export interface PhotoRating {
  score: number;
  verdict: string;
  breakdown: { aspect: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  detectedItems: string[];
}

export interface TrendReport {
  season: string;
  summary: string;
  trends: { title: string; description: string; howToWear: string; keyItems: string[] }[];
  colors: { name: string; hex: string }[];
  antiTrends: string[];
  sources: { title: string; url: string }[];
  fetchedAt: number;
  source: "ai" | "local";
}

export interface CapsuleReport {
  goal: string;
  summary: string;
  capsuleItemIds: string[];
  combos: { title: string; itemIds: string[] }[];
  gaps: { item: string; why: string; priority: "high" | "medium" | "low"; query: string; budgetRub?: number }[];
  source: "ai" | "local";
}

export interface ShopProduct {
  title: string;
  shop: string;
  url: string;
  price?: string;
  why?: string;
}

export interface ShopResult {
  query: string;
  products: ShopProduct[];
  links: { shop: string; url: string }[];
  note?: string;
}

/** Сжатое описание вещи для передачи в модель. */
export interface ItemBrief {
  id: string;
  name: string;
  category: Category;
  subtype?: string;
  colors: string[];
  pattern: Pattern;
  material?: string;
  formality: number;
  warmth: number;
  seasons: Season[];
  styles: string[];
  heelCm?: number;
  shoeType?: ShoeType;
  waterproof?: boolean;
  walkComfort?: number;
  lastWorn?: string;
  favorite?: boolean;
}

export interface OutfitRequestContext {
  date: string;
  occasion: string;
  event?: Pick<CalendarEvent, "title" | "type" | "dressCode" | "start" | "end" | "notes" | "transport">;
  weather?: WeatherDay;
  route?: RouteInfo;
  wishes?: string;
}
