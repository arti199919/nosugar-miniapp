// Интеграция с Claude: разметка вещей по фото, подбор образов, оценка фото,
// тренды и поиск по магазинам через веб-поиск, чат со стилистом.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORY_ORDER, SHOP_DOMAINS } from "../shared/catalog";
import { bodyShape } from "../shared/body";
import type {
  CapsuleReport,
  ItemBrief,
  OutfitOption,
  OutfitRequestContext,
  PhotoRating,
  Profile,
  ShopProduct,
  TrendReport,
} from "../shared/types";

export const MODEL = process.env.STYLIST_MODEL || "claude-opus-5";
export const FAST_MODEL = process.env.STYLIST_FAST_MODEL || MODEL;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let _client: Anthropic | null = null;
const client = () => (_client ??= new Anthropic({ timeout: 180_000, maxRetries: 2 }));

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function describeApiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AiError("Неверный ключ ANTHROPIC_API_KEY", 401);
  if (err instanceof Anthropic.RateLimitError) return new AiError("Слишком много запросов к ИИ, попробуйте через минуту", 429);
  if (err instanceof Anthropic.BadRequestError) return new AiError(`Запрос к ИИ отклонён: ${err.message}`, 400);
  if (err instanceof Anthropic.APIError) return new AiError(`Ошибка ИИ (${err.status}): ${err.message}`, 502);
  if (err instanceof Error) return new AiError(err.message, 500);
  return new AiError("Неизвестная ошибка ИИ", 500);
}

// ---------- helpers ----------

type ImageMedia = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export function imageBlock(dataUrl: string): Anthropic.Beta.BetaImageBlockParam {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new AiError("Ожидалось изображение в формате data URL (jpeg/png/webp)", 400);
  return { type: "image", source: { type: "base64", media_type: m[1] as ImageMedia, data: m[2] } };
}

const STYLIST_PERSONA = `Ты — Atelier, персональный ИИ-стилист. Говоришь по-русски, тепло и по делу, как опытный стилист, который хорошо знает гардероб клиента.
Учитываешь: погоду и время на улице, транспорт и сколько идти пешком (на высоком каблуке далеко не уйдёшь), дресс-код и характер мероприятия, тип фигуры и цветотип, сочетания цветов и фактур, актуальные тренды текущего сезона, комфорт.
Предлагай только то, что реально есть в гардеробе, если не просят иного; честно говори, чего не хватает.`;

export function describeProfile(p: Profile): string {
  const shape = bodyShape(p.body, p.gender);
  const b = p.body;
  return [
    `Клиент: ${p.name || "без имени"}, ${p.gender === "female" ? "женщина" : "мужчина"}${p.birthYear ? `, ${new Date().getFullYear() - p.birthYear} лет` : ""}.`,
    `Мерки: рост ${b.height} см, вес ${b.weight} кг, грудь ${b.chest}, талия ${b.waist}, бёдра ${b.hips}, плечи ${b.shoulders}, длина ноги ${b.inseam} см. Тип фигуры: ${shape.label}.`,
    `Размеры: верх ${p.sizes.top} RU, низ ${p.sizes.bottom} RU, обувь ${p.sizes.shoes}, ${p.sizes.international}.`,
    `Внешность: подтон кожи ${p.appearance.undertone}, волосы ${p.appearance.hairLength}/${p.appearance.hairType}${p.appearance.colorType ? `, цветотип ${p.appearance.colorType}` : ""}.`,
    `Стиль: любит ${p.style.preferred.join(", ") || "—"}; избегает ${p.style.avoid.join(", ") || "—"}; любимые цвета ${p.style.favoriteColors.join(", ") || "—"}; нелюбимые ${p.style.avoidColors.join(", ") || "—"}; бюджет ${p.style.budget}. ${p.style.notes}`,
    `Комфорт: каблук не выше ${p.comfort.maxHeelCm} см, на каблуке пешком не больше ${p.comfort.maxWalkKmInHeels} км${p.comfort.coldSensitive ? ", мерзлява(ый)" : ""}.`,
    p.home ? `Город/дом: ${p.home.label}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const briefLine = (i: ItemBrief) =>
  `${i.id} | ${i.name} | ${i.category}${i.subtype ? `/${i.subtype}` : ""} | цвета ${i.colors.join(" ")} | ${i.pattern}${i.material ? ` | ${i.material}` : ""} | формальность ${i.formality} | тепло ${i.warmth}${i.heelCm != null ? ` | каблук ${i.heelCm}см` : ""}${i.waterproof ? " | непромокаемое" : ""}${i.lastWorn ? ` | носил(а) ${i.lastWorn}` : ""}${i.favorite ? " | ★" : ""}`;

export const wardrobeText = (items: ItemBrief[]) =>
  items.length ? items.map(briefLine).join("\n") : "(гардероб пуст)";

async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: string | Anthropic.Beta.BetaContentBlockParam[];
  model?: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!aiAvailable()) throw new AiError("ИИ не подключён: задайте ANTHROPIC_API_KEY на сервере", 503);
  try {
    const res = await client().beta.messages.parse({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    });
    if (res.stop_reason === "refusal") throw new AiError("ИИ отказался обрабатывать этот запрос", 422);
    if (res.stop_reason === "max_tokens") throw new AiError("Ответ ИИ оказался слишком длинным, попробуйте ещё раз", 502);
    if (res.parsed_output == null) throw new AiError("Не удалось разобрать ответ ИИ", 502);
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    throw describeApiError(e);
  }
}

/** Запрос с веб-поиском: возвращает финальный текст и найденные источники. */
async function withWebSearch(opts: {
  system: string;
  prompt: string;
  allowedDomains?: string[];
  maxUses?: number;
  city?: string;
  withFetch?: boolean;
}): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  if (!aiAvailable()) throw new AiError("ИИ не подключён: задайте ANTHROPIC_API_KEY на сервере", 503);
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: opts.maxUses ?? 5,
      ...(opts.allowedDomains ? { allowed_domains: opts.allowedDomains } : {}),
      user_location: { type: "approximate", country: "RU", ...(opts.city ? { city: opts.city } : {}) },
    },
  ];
  if (opts.withFetch) tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const sources = new Map<string, string>();
  try {
    for (let turn = 0; turn < 5; turn++) {
      const stream = client().beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: opts.system,
        tools,
        messages,
        output_config: { effort: "medium" },
      });
      const res = await stream.finalMessage();
      for (const block of res.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content))
          for (const r of block.content) sources.set(r.url, r.title);
      }
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      if (res.stop_reason === "refusal") throw new AiError("ИИ отказался выполнять поиск", 422);
      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { text, sources: [...sources].map(([url, title]) => ({ url, title })) };
    }
    throw new AiError("Поиск занял слишком много шагов", 504);
  } catch (e) {
    throw describeApiError(e);
  }
}

/** Достаёт JSON из ответа модели (из ```json блока или первого объекта). */
export function extractJson<T>(text: string): T | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fence?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c) as T;
    } catch {
      /* next */
    }
  }
  return null;
}

// ---------- 1. Разметка вещи по фото ----------

const TagSchema = z.object({
  name: z.string().describe("Короткое название по-русски, например «Белая хлопковая рубашка оверсайз»"),
  category: z.enum(CATEGORY_ORDER as [string, ...string[]]),
  subtype: z.string().describe("Подтип по-русски: пальто, лоферы, водолазка, миди и т.п."),
  colors: z.array(z.string()).describe("1–3 основных цвета в HEX, первый — доминирующий"),
  pattern: z.enum(["solid", "stripes", "check", "dots", "floral", "print", "denim", "knit", "leather", "animal"]),
  material: z.string(),
  seasons: z.array(z.enum(["spring", "summer", "autumn", "winter"])),
  formality: z.number().int().describe("1 спорт/дом, 2 кэжуал, 3 смарт-кэжуал, 4 деловой, 5 вечерний"),
  warmth: z.number().int().describe("1 очень лёгкая … 5 очень тёплая"),
  styles: z.array(z.string()),
  waterproof: z.boolean(),
  walkComfort: z.number().int().describe("для обуви 1–5, для остального 3"),
  shape: z.object({
    sleeve: z.enum(["none", "short", "three_quarter", "long"]).optional(),
    length: z.enum(["crop", "waist", "hip", "thigh", "knee", "midi", "maxi", "ankle"]).optional(),
    fit: z.enum(["slim", "regular", "oversize", "wide"]).optional(),
    heelCm: z.number().optional(),
    shoeType: z.enum(["sneakers", "loafers", "flats", "heels", "sandals", "ankle_boots", "boots", "knee_boots"]).optional(),
    hatType: z.enum(["cap", "beanie", "fedora", "bucket", "beret", "panama"]).optional(),
    open: z.boolean().optional(),
  }),
  brand: z.string().describe("Бренд, если виден на фото, иначе пустая строка"),
  notes: z.string().describe("Совет по сочетанию или уходу, 1 предложение"),
});
export type TagResult = z.infer<typeof TagSchema>;

export function tagItem(image: string, hint?: string) {
  return structured({
    schema: TagSchema,
    model: FAST_MODEL,
    effort: "low",
    maxTokens: 4000,
    system:
      "Ты помогаешь каталогизировать гардероб. Определи по фото ОДНУ главную вещь и заполни её карточку. Цвета — реальные HEX ткани, без учёта фона. Для обуви оцени высоту каблука в сантиметрах.",
    content: [imageBlock(image), { type: "text", text: hint ? `Подсказка пользователя: ${hint}` : "Опиши вещь." }],
  });
}

// ---------- 2. Распознавание нескольких вещей на фото человека ----------

const DetectSchema = z.object({
  items: z.array(
    z.object({
      label: z.string().describe("Название по-русски"),
      category: z.enum(CATEGORY_ORDER as [string, ...string[]]),
      box: z
        .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
        .describe("Рамка вещи в долях изображения 0..1: левый верхний угол x,y, ширина w, высота h"),
    }),
  ),
});

export function detectItems(image: string) {
  return structured({
    schema: DetectSchema,
    model: FAST_MODEL,
    effort: "low",
    maxTokens: 4000,
    system:
      "На фото человек в одежде. Перечисли каждую различимую вещь гардероба (одежда, обувь, сумка, головной убор, ремень, шарф, очки, украшения) и её прямоугольную рамку в долях изображения. Не включай части тела.",
    content: [imageBlock(image), { type: "text", text: "Найди все вещи." }],
  });
}

// ---------- 3. Подбор образа ----------

const PlanSchema = z.object({
  options: z.array(
    z.object({
      title: z.string(),
      itemIds: z.array(z.string()),
      reasoning: z.string().describe("Почему этот образ: погода, дорога, мероприятие, фигура, цвета, тренды. 2–4 предложения."),
      warnings: z.array(z.string()),
      carry: z.array(z.string()).describe("Что взять с собой"),
    }),
  ),
  beauty: z.object({
    hair: z.object({ style: z.string(), why: z.string(), steps: z.array(z.string()) }),
    makeup: z.object({ look: z.string(), palette: z.array(z.string()), steps: z.array(z.string()) }),
    grooming: z.array(z.string()),
  }),
  tips: z.array(z.string()),
  gaps: z.array(z.string()).describe("Каких вещей не хватило для идеального образа"),
});
export type PlanResult = z.infer<typeof PlanSchema>;

export async function planOutfit(input: {
  profile: Profile;
  items: ItemBrief[];
  context: OutfitRequestContext;
  drafts: OutfitOption[];
  trends?: string;
}): Promise<PlanResult> {
  const { context: c } = input;
  const w = c.weather;
  const text = [
    `Дата: ${c.date}. Повод: ${c.occasion}.`,
    c.event ? `Событие: ${JSON.stringify(c.event)}` : "",
    w
      ? `Погода: ${w.description}, ${Math.round(w.tMin)}…${Math.round(w.tMax)}°C (ощущается ${Math.round(w.feelsMin)}…${Math.round(w.feelsMax)}°), осадки ${w.precipProb}% / ${w.precipSum} мм, ветер до ${w.windMax} м/с, UV ${w.uvMax}.`
      : "Погода неизвестна — ориентируйся на сезон.",
    c.route
      ? `Дорога: ${c.route.transport}, ${c.route.distanceKm} км, ~${c.route.durationMin} мин; пешком ≈${c.route.walkKm} км, на улице ≈${c.route.outdoorMin} мин.`
      : "",
    c.wishes ? `Пожелания: ${c.wishes}` : "",
    input.trends ? `Актуальные тренды сезона:\n${input.trends}` : "",
    `\nЧерновики локального алгоритма (можно улучшать или заменять):\n${input.drafts.map((d, i) => `${i + 1}. ${d.title}: ${d.itemIds.join(", ")}`).join("\n")}`,
    `\nГардероб (id | название | категория | ...):\n${wardrobeText(input.items)}`,
    `\nСобери 3 полных образа (от белья до аксессуаров, что есть), используя только id из гардероба. В каждом образе одна вещь на слот: верх+низ ИЛИ платье/комбинезон, при необходимости второй слой, верхняя одежда, обувь, аксессуары. Добавь советы по причёске и макияжу (для мужчины — грумингу) под этот образ, погоду и событие.`,
  ]
    .filter(Boolean)
    .join("\n");
  const res = await structured({
    schema: PlanSchema,
    effort: "medium",
    system: `${STYLIST_PERSONA}\n\n${describeProfile(input.profile)}`,
    content: text,
  });
  const ids = new Set(input.items.map((i) => i.id));
  res.options = res.options.map((o) => ({ ...o, itemIds: o.itemIds.filter((id) => ids.has(id)) })).filter((o) => o.itemIds.length > 0);
  return res;
}

// ---------- 4. Живая оценка фото ----------

const RatingSchema = z.object({
  score: z.number().describe("Общая оценка 1–10, можно с десятыми"),
  verdict: z.string().describe("Одна фраза-вердикт"),
  breakdown: z.array(z.object({ aspect: z.string(), score: z.number(), comment: z.string() })),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()).describe("Конкретные быстрые правки: что заменить, подвернуть, заправить, добавить"),
  detectedItems: z.array(z.string()),
});

export function ratePhoto(input: { image: string; profile: Profile; occasion?: string; weather?: string }): Promise<PhotoRating> {
  return structured({
    schema: RatingSchema,
    effort: "low",
    maxTokens: 6000,
    system: `${STYLIST_PERSONA}\n\n${describeProfile(input.profile)}\n\nОцени образ человека на фото честно и доброжелательно. Аспекты: посадка и пропорции, сочетание цветов, уместность поводу и погоде, стиль и актуальность, детали (обувь, аксессуары, причёска). Оценивай одежду и стайлинг, а не внешность человека.`,
    content: [
      imageBlock(input.image),
      { type: "text", text: `Повод: ${input.occasion || "повседневный день"}. ${input.weather ? `Погода: ${input.weather}.` : ""}` },
    ],
  });
}

// ---------- 5. Тренды ----------

export async function trends(input: { gender: string; city?: string; styles: string[]; date: string }): Promise<TrendReport> {
  const { text, sources } = await withWebSearch({
    system: STYLIST_PERSONA,
    city: input.city,
    maxUses: 6,
    prompt: `Сегодня ${input.date}. Найди в интернете актуальные модные тренды ТЕКУЩЕГО и ближайшего сезона (${input.gender === "male" ? "мужская" : "женская"} мода) — показы, Vogue/Harper's Bazaar/Elle, в том числе российские издания, стритстайл. Учитывай климат России${input.city ? ` (${input.city})` : ""} и предпочтения: ${input.styles.join(", ") || "не указаны"}.
Ответь ТОЛЬКО JSON в блоке \`\`\`json:
{"season": "название сезона", "summary": "2–3 предложения", "trends": [{"title": "", "description": "", "howToWear": "как носить в реальной жизни", "keyItems": ["вещь для поиска в магазине"]}], "colors": [{"name": "", "hex": "#"}], "antiTrends": ["что устарело"]}
6–8 трендов, 5–6 цветов.`,
  });
  const data = extractJson<Omit<TrendReport, "sources" | "fetchedAt" | "source">>(text);
  if (!data) throw new AiError("Не удалось разобрать тренды", 502);
  return { ...data, sources: sources.slice(0, 12), fetchedAt: Date.now(), source: "ai" };
}

// ---------- 6. Капсулы ----------

const CapsuleSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  capsuleItemIds: z.array(z.string()),
  combos: z.array(z.object({ title: z.string(), itemIds: z.array(z.string()) })),
  gaps: z.array(
    z.object({
      item: z.string(),
      why: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      query: z.string().describe("Поисковый запрос для маркетплейса по-русски, с цветом и фасоном"),
      budgetRub: z.number(),
    }),
  ),
});

export async function capsule(input: { goal: string; profile: Profile; items: ItemBrief[]; trends?: string }): Promise<CapsuleReport> {
  const res = await structured({
    schema: CapsuleSchema,
    effort: "medium",
    system: `${STYLIST_PERSONA}\n\n${describeProfile(input.profile)}`,
    content: `Цель капсулы: ${input.goal}.
${input.trends ? `Тренды сезона:\n${input.trends}\n` : ""}
Гардероб:\n${wardrobeText(input.items)}

Собери капсулу 12–20 вещей из имеющихся (capsuleItemIds), покажи 6–10 комбинаций (combos) и список покупок (gaps), которые максимально увеличат число сочетаний. Для каждой покупки — поисковый запрос для Wildberries/Ozon/Lamoda и ориентир бюджета в рублях с учётом бюджета клиента.`,
  });
  const ids = new Set(input.items.map((i) => i.id));
  return {
    ...res,
    capsuleItemIds: res.capsuleItemIds.filter((id) => ids.has(id)),
    combos: res.combos.map((c) => ({ ...c, itemIds: c.itemIds.filter((id) => ids.has(id)) })),
    source: "ai",
  };
}

// ---------- 7. Поиск в магазинах ----------

export async function shopSearch(input: { query: string; profile: Profile; budget?: string }): Promise<{ products: ShopProduct[]; note?: string }> {
  const p = input.profile;
  const { text } = await withWebSearch({
    system: STYLIST_PERSONA,
    allowedDomains: SHOP_DOMAINS,
    maxUses: 6,
    city: p.home?.label,
    prompt: `Найди в российских интернет-магазинах и маркетплейсах товары по запросу: «${input.query}».
Размеры клиента: одежда ${p.sizes.top}/${p.sizes.bottom} RU (${p.sizes.international}), обувь ${p.sizes.shoes}. ${input.budget ? `Бюджет: ${input.budget}.` : `Бюджет: ${p.style.budget}.`}
Стиль клиента: ${p.style.preferred.join(", ")}. Тип фигуры: ${bodyShape(p.body, p.gender).label}.
Отбери 6–10 конкретных товаров со ссылками на карточки (не на поиск), где вероятно есть нужный размер. Ответь ТОЛЬКО JSON в блоке \`\`\`json:
{"products": [{"title": "", "shop": "", "url": "", "price": "цена в ₽ если видна", "why": "почему подходит"}], "note": "общий совет по покупке"}`,
  });
  const data = extractJson<{ products: ShopProduct[]; note?: string }>(text);
  return data ?? { products: [], note: text.slice(0, 600) };
}

// ---------- 8. Импорт вещи по ссылке ----------

export async function importFromUrl(url: string): Promise<{ name: string; imageUrl?: string; price?: string; brand?: string; description?: string }> {
  const { text } = await withWebSearch({
    system: "Ты извлекаешь данные о товаре из карточки интернет-магазина.",
    maxUses: 1,
    withFetch: true,
    prompt: `Открой страницу товара ${url} и верни ТОЛЬКО JSON в блоке \`\`\`json: {"name": "название", "imageUrl": "прямая ссылка на главное фото", "price": "", "brand": "", "description": "состав, цвет, фасон"}`,
  });
  const data = extractJson<{ name: string; imageUrl?: string; price?: string; brand?: string; description?: string }>(text);
  if (!data) throw new AiError("Не удалось прочитать карточку товара", 502);
  return data;
}

// ---------- 9. Чат ----------

export async function chatStream(input: {
  messages: { role: "user" | "assistant"; text: string; image?: string }[];
  profile: Profile;
  items: ItemBrief[];
  context: string;
  onText: (t: string) => void;
}): Promise<void> {
  if (!aiAvailable()) throw new AiError("ИИ не подключён: задайте ANTHROPIC_API_KEY на сервере", 503);
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    {
      type: "text",
      text: `${STYLIST_PERSONA}\n\n${describeProfile(input.profile)}\n\nГардероб клиента (id | название | ...):\n${wardrobeText(input.items)}\n\nКогда упоминаешь вещь из гардероба, пиши её название. Отвечай компактно, с markdown-списками. Для свежих трендов и поиска вещей используй веб-поиск.`,
      cache_control: { type: "ephemeral" },
    },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = input.messages.map((m, idx) => {
    const isLast = idx === input.messages.length - 1;
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (m.image && m.role === "user") content.push(imageBlock(m.image));
    content.push({ type: "text", text: isLast && m.role === "user" ? `${input.context}\n\n${m.text}` : m.text || "…" });
    return { role: m.role, content };
  });
  try {
    for (let turn = 0; turn < 4; turn++) {
      const stream = client().beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "RU" } }],
        messages,
        output_config: { effort: "low" },
      });
      stream.on("text", (t) => input.onText(t));
      const res = await stream.finalMessage();
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      if (res.stop_reason === "refusal") input.onText("\n\n_Не могу помочь с этим запросом._");
      return;
    }
  } catch (e) {
    throw describeApiError(e);
  }
}
