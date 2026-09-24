import { useState } from "react";
import clsx from "clsx";
import { Archive, Heart, Save, Trash2 } from "lucide-react";
import { CATEGORIES, CATEGORY_ORDER, FORMALITY_LABELS, PATTERNS, SEASONS, STYLE_TAGS, WARMTH_LABELS, inferShape } from "@shared/catalog";
import { colorName } from "@shared/color";
import type { Category, GarmentLength, ItemStatus, Pattern, Season, ShoeType, SleeveLength, WardrobeItem } from "@shared/types";
import { itemImage } from "./items";
import { ColorDot, Dots, Field } from "./ui";

const LENGTHS: Record<GarmentLength, string> = {
  crop: "Кроп",
  waist: "До талии",
  hip: "До бедра",
  thigh: "Мини / середина бедра",
  knee: "До колена",
  midi: "Миди",
  maxi: "Макси",
  ankle: "До щиколотки",
};
const SLEEVES: Record<SleeveLength, string> = { none: "Без рукавов", short: "Короткий", three_quarter: "3/4", long: "Длинный" };
const SHOE_TYPES: Record<ShoeType, string> = {
  sneakers: "Кроссовки / кеды",
  loafers: "Лоферы",
  flats: "Балетки",
  heels: "Туфли на каблуке",
  sandals: "Босоножки / сандалии",
  ankle_boots: "Ботинки / ботильоны",
  boots: "Сапоги до середины икры",
  knee_boots: "Сапоги до колена",
};

export function ItemEditor({
  item,
  onSave,
  onDelete,
  saveLabel = "Сохранить",
}: {
  item: WardrobeItem;
  onSave: (i: WardrobeItem) => void;
  onDelete?: () => void;
  saveLabel?: string;
}) {
  const [it, setIt] = useState<WardrobeItem>(item);
  const set = <K extends keyof WardrobeItem>(k: K, v: WardrobeItem[K]) => setIt((p) => ({ ...p, [k]: v }));
  const setShape = (patch: Partial<WardrobeItem["shape"]>) => setIt((p) => ({ ...p, shape: { ...p.shape, ...patch } }));
  const isShoes = it.category === "shoes";
  const hasSleeves = ["tops", "shirts", "knitwear", "dresses", "jumpsuits"].includes(it.category);
  const hasLength = ["tops", "shirts", "knitwear", "trousers", "jeans", "skirts", "shorts", "dresses", "jumpsuits", "blazers", "outerwear"].includes(it.category);

  return (
    <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
      <div className="space-y-3">
        <div className="checker aspect-[4/5] overflow-hidden rounded-3xl">
          <img src={itemImage(it)} alt="" className="h-full w-full object-contain p-3" />
        </div>
        <div className="flex gap-2">
          <button type="button" className={clsx("btn-ghost flex-1", it.favorite && "chip-on")} onClick={() => set("favorite", !it.favorite)}>
            <Heart size={15} className={it.favorite ? "fill-accent-2 text-accent-2" : ""} /> Любимая
          </button>
        </div>
        <Field label="Статус">
          <select className="input" value={it.status} onChange={(e) => set("status", e.target.value as ItemStatus)}>
            <option value="active">В гардеробе</option>
            <option value="laundry">В стирке</option>
            <option value="repair">В ремонте</option>
            <option value="archived">Архив</option>
          </select>
        </Field>
        {it.wearCount > 0 && (
          <div className="rounded-2xl bg-surface-2 p-3 text-xs text-muted">
            Надевали {it.wearCount} раз{it.lastWorn ? `, последний — ${it.lastWorn}` : ""}
            {it.price ? (
              <div className="mt-1 font-semibold text-fg">Цена за выход: {Math.round(it.price / Math.max(1, it.wearCount))} ₽</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Field label="Название">
          <input className="input" value={it.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Категория">
            <select
              className="input"
              value={it.category}
              onChange={(e) => {
                const c = e.target.value as Category;
                setIt((p) => ({ ...p, category: c, shape: inferShape(c, p.subtype) }));
              }}
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES[c].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Тип">
            <input
              className="input"
              list={`sub-${it.category}`}
              value={it.subtype ?? ""}
              onChange={(e) => setIt((p) => ({ ...p, subtype: e.target.value, shape: { ...inferShape(p.category, e.target.value), ...pickUserShape(p.shape) } }))}
            />
            <datalist id={`sub-${it.category}`}>
              {CATEGORIES[it.category].subtypes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Цвета">
          <div className="flex flex-wrap items-center gap-2">
            {it.colors.map((c, idx) => (
              <label key={idx} className="chip cursor-pointer pr-1.5">
                <ColorDot hex={c} />
                {colorName(c)}
                <input
                  type="color"
                  value={c}
                  className="h-0 w-0 opacity-0"
                  onChange={(e) => set("colors", it.colors.map((x, j) => (j === idx ? e.target.value : x)))}
                />
                <button type="button" className="ml-1 text-muted hover:text-bad" onClick={(e) => (e.preventDefault(), set("colors", it.colors.filter((_, j) => j !== idx)))}>
                  ×
                </button>
              </label>
            ))}
            {it.colors.length < 4 && (
              <label className="chip cursor-pointer">
                + цвет
                <input type="color" className="h-0 w-0 opacity-0" onChange={(e) => set("colors", [...it.colors, e.target.value])} />
              </label>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Узор / фактура">
            <select className="input" value={it.pattern} onChange={(e) => set("pattern", e.target.value as Pattern)}>
              {Object.entries(PATTERNS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Материал">
            <input className="input" value={it.material ?? ""} onChange={(e) => set("material", e.target.value)} placeholder="хлопок, шерсть…" />
          </Field>
        </div>

        {(hasLength || hasSleeves) && (
          <div className="grid grid-cols-3 gap-3">
            {hasLength && (
              <Field label="Длина">
                <select className="input" value={it.shape.length ?? ""} onChange={(e) => setShape({ length: e.target.value as GarmentLength })}>
                  {Object.entries(LENGTHS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {hasSleeves && (
              <Field label="Рукав">
                <select className="input" value={it.shape.sleeve ?? "long"} onChange={(e) => setShape({ sleeve: e.target.value as SleeveLength })}>
                  {Object.entries(SLEEVES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Посадка">
              <select className="input" value={it.shape.fit ?? "regular"} onChange={(e) => setShape({ fit: e.target.value as WardrobeItem["shape"]["fit"] })}>
                <option value="slim">Облегающая</option>
                <option value="regular">Обычная</option>
                <option value="oversize">Оверсайз</option>
                <option value="wide">Широкая</option>
              </select>
            </Field>
          </div>
        )}

        {isShoes && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Вид обуви">
              <select className="input" value={it.shape.shoeType ?? "sneakers"} onChange={(e) => setShape({ shoeType: e.target.value as ShoeType })}>
                {Object.entries(SHOE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Каблук, см">
              <input className="input" type="number" min={0} max={15} value={it.shape.heelCm ?? 0} onChange={(e) => setShape({ heelCm: Number(e.target.value) })} />
            </Field>
            <Field label="Удобство ходьбы">
              <div className="pt-3">
                <Dots value={it.walkComfort ?? 3} onChange={(v) => set("walkComfort", v)} />
              </div>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Формальность: ${FORMALITY_LABELS[it.formality]}`}>
            <Dots value={it.formality} onChange={(v) => set("formality", v)} />
          </Field>
          <Field label={`Тепло: ${WARMTH_LABELS[it.warmth]}`}>
            <Dots value={it.warmth} onChange={(v) => set("warmth", v)} color="var(--accent-2)" />
          </Field>
        </div>

        <Field label="Сезоны">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SEASONS) as Season[]).map((s) => (
              <button
                type="button"
                key={s}
                className={clsx("chip", it.seasons.includes(s) && "chip-on")}
                onClick={() => set("seasons", it.seasons.includes(s) ? it.seasons.filter((x) => x !== s) : [...it.seasons, s])}
              >
                {SEASONS[s]}
              </button>
            ))}
            <button type="button" className={clsx("chip", it.waterproof && "chip-on")} onClick={() => set("waterproof", !it.waterproof)}>
              ☔ Непромокаемое
            </button>
          </div>
        </Field>

        <Field label="Стиль">
          <div className="flex flex-wrap gap-1.5">
            {STYLE_TAGS.map((s) => (
              <button
                type="button"
                key={s}
                className={clsx("chip", it.styles.includes(s) && "chip-on")}
                onClick={() => set("styles", it.styles.includes(s) ? it.styles.filter((x) => x !== s) : [...it.styles, s])}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Бренд">
            <input className="input" value={it.brand ?? ""} onChange={(e) => set("brand", e.target.value)} />
          </Field>
          <Field label="Размер">
            <input className="input" value={it.size ?? ""} onChange={(e) => set("size", e.target.value)} />
          </Field>
          <Field label="Цена, ₽">
            <input className="input" type="number" value={it.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
        <Field label="Заметки">
          <textarea className="input min-h-16" value={it.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn-primary flex-1" onClick={() => onSave(it)} disabled={!it.name.trim()}>
            <Save size={16} /> {saveLabel}
          </button>
          {onDelete && (
            <>
              <button className="btn-ghost" onClick={() => onSave({ ...it, status: it.status === "archived" ? "active" : "archived" })}>
                <Archive size={16} /> {it.status === "archived" ? "Вернуть" : "В архив"}
              </button>
              <button className="btn-ghost text-bad" onClick={onDelete}>
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const pickUserShape = (s: WardrobeItem["shape"]) => ({ fit: s.fit });
