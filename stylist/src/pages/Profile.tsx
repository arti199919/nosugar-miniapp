import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Download, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { STYLE_TAGS } from "@shared/catalog";
import { bmi, bodyShape, defaultProfile, ruSize } from "@shared/body";
import type { BodyMeasurements, Profile as P } from "@shared/types";
import { Avatar3D } from "../components/avatar/Avatar3D";
import { PlacePicker } from "../components/PlacePicker";
import { Field, PageHeader, Segmented } from "../components/ui";
import { db, exportAll, importAll, saveProfile, useItems, useProfile } from "../db";
import { toast, useUI } from "../store";

const MEASURES: { key: keyof BodyMeasurements; label: string; hint: string }[] = [
  { key: "height", label: "Рост", hint: "см" },
  { key: "weight", label: "Вес", hint: "кг" },
  { key: "chest", label: "Обхват груди", hint: "по самым выступающим точкам" },
  { key: "underbust", label: "Под грудью", hint: "для женской фигуры" },
  { key: "waist", label: "Талия", hint: "самое узкое место" },
  { key: "hips", label: "Бёдра", hint: "самое широкое место" },
  { key: "shoulders", label: "Ширина плеч", hint: "от плеча до плеча по спине" },
  { key: "neck", label: "Обхват шеи", hint: "у основания" },
  { key: "armLength", label: "Длина руки", hint: "от плеча до запястья" },
  { key: "inseam", label: "Длина ноги", hint: "по внутр. шву от паха до пола" },
  { key: "thigh", label: "Обхват бедра", hint: "одной ноги, у паха" },
  { key: "calf", label: "Обхват икры", hint: "в самом широком месте" },
  { key: "footLength", label: "Длина стопы", hint: "см, от пятки до большого пальца" },
];

const COLOR_WORDS = ["чёрный", "белый", "бежевый", "серый", "тёмно-синий", "синий", "голубой", "зелёный", "оливковый", "коричневый", "кэмел", "бордовый", "красный", "розовый", "пудровый", "жёлтый", "горчичный", "оранжевый", "терракотовый", "лавандовый", "фиолетовый", "изумрудный", "хаки", "молочный"];

export default function Profile() {
  const stored = useProfile();
  const [p, setP] = useState<P | null>(null);
  const items = useItems();
  const fitting = useUI((s) => s.fitting);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stored && !p) setP(stored);
  }, [stored, p]);
  if (!p) return null;

  const setBody = (k: keyof BodyMeasurements, v: number) => setP({ ...p, body: { ...p.body, [k]: v } });
  const shape = bodyShape(p.body, p.gender);
  const worn = (items ?? []).filter((i) => fitting.includes(i.id));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    await saveProfile(p);
    toast("Профиль сохранён", "ok");
  };

  return (
    <div>
      <PageHeader
        title="Профиль и мерки"
        subtitle="Чем точнее мерки, тем точнее аватар, размеры для покупок и советы по посадке."
        actions={
          <button className="btn-primary" onClick={save}>
            <Save size={16} /> Сохранить
          </button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Основное</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Имя">
                <input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Как к вам обращаться" />
              </Field>
              <Field label="Год рождения">
                <input className="input" type="number" value={p.birthYear ?? ""} onChange={(e) => setP({ ...p, birthYear: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
              <Field label="Гардероб">
                <Segmented
                  value={p.gender}
                  onChange={(g) => setP({ ...defaultProfile(g), ...p, gender: g })}
                  options={[
                    { value: "female", label: "Женский" },
                    { value: "male", label: "Мужской" },
                  ]}
                />
              </Field>
              <Field label="Дом (для погоды и маршрутов)">
                <PlacePicker value={p.home} onChange={(home) => setP({ ...p, home })} placeholder="Город или адрес" />
              </Field>
              <Field label="Работа / офис" className="sm:col-span-2">
                <PlacePicker value={p.work} onChange={(work) => setP({ ...p, work })} placeholder="Адрес работы — чтобы считать дорогу" />
              </Field>
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Мерки, см</h2>
              <span className="chip chip-on">
                {shape.label} · ИМТ {bmi(p.body)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {MEASURES.filter((m) => p.gender === "female" || m.key !== "underbust").map((m) => (
                <Field key={m.key} label={m.label} hint={m.hint}>
                  <input className="input" type="number" step="0.5" value={p.body[m.key] ?? ""} onChange={(e) => setBody(m.key, Number(e.target.value))} />
                </Field>
              ))}
            </div>
            <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm">
              <b>{shape.label}.</b> {shape.advice}
            </p>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Размеры</h2>
              <button className="btn-ghost py-1.5 text-xs" onClick={() => setP({ ...p, sizes: { ...p.sizes, ...ruSize(p.body, p.gender) } })}>
                <RefreshCw size={14} /> Рассчитать по меркам
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Верх, RU">
                <input className="input" value={p.sizes.top} onChange={(e) => setP({ ...p, sizes: { ...p.sizes, top: e.target.value } })} />
              </Field>
              <Field label="Низ, RU">
                <input className="input" value={p.sizes.bottom} onChange={(e) => setP({ ...p, sizes: { ...p.sizes, bottom: e.target.value } })} />
              </Field>
              <Field label="Международный">
                <input className="input" value={p.sizes.international} onChange={(e) => setP({ ...p, sizes: { ...p.sizes, international: e.target.value } })} />
              </Field>
              <Field label="Обувь">
                <input className="input" value={p.sizes.shoes} onChange={(e) => setP({ ...p, sizes: { ...p.sizes, shoes: e.target.value } })} />
              </Field>
              {p.gender === "female" && (
                <Field label="Бельё">
                  <input className="input" value={p.sizes.bra ?? ""} onChange={(e) => setP({ ...p, sizes: { ...p.sizes, bra: e.target.value } })} />
                </Field>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Внешность</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Тон кожи">
                <input type="color" className="input h-11 p-1" value={p.appearance.skinTone} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, skinTone: e.target.value } })} />
              </Field>
              <Field label="Цвет волос">
                <input type="color" className="input h-11 p-1" value={p.appearance.hairColor} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, hairColor: e.target.value } })} />
              </Field>
              <Field label="Цвет глаз">
                <input type="color" className="input h-11 p-1" value={p.appearance.eyeColor} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, eyeColor: e.target.value } })} />
              </Field>
              <Field label="Подтон">
                <select className="input" value={p.appearance.undertone} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, undertone: e.target.value as P["appearance"]["undertone"] } })}>
                  <option value="warm">Тёплый</option>
                  <option value="cool">Холодный</option>
                  <option value="neutral">Нейтральный</option>
                </select>
              </Field>
              <Field label="Длина волос">
                <select className="input" value={p.appearance.hairLength} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, hairLength: e.target.value as P["appearance"]["hairLength"] } })}>
                  <option value="short">Короткие</option>
                  <option value="medium">До плеч</option>
                  <option value="long">Длинные</option>
                </select>
              </Field>
              <Field label="Тип волос">
                <select className="input" value={p.appearance.hairType} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, hairType: e.target.value as P["appearance"]["hairType"] } })}>
                  <option value="straight">Прямые</option>
                  <option value="wavy">Волнистые</option>
                  <option value="curly">Кудрявые</option>
                </select>
              </Field>
              <Field label="Цветотип">
                <select className="input" value={p.appearance.colorType ?? ""} onChange={(e) => setP({ ...p, appearance: { ...p.appearance, colorType: (e.target.value || undefined) as P["appearance"]["colorType"] } })}>
                  <option value="">Не знаю</option>
                  <option value="spring">Весна</option>
                  <option value="summer">Лето</option>
                  <option value="autumn">Осень</option>
                  <option value="winter">Зима</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Стиль и предпочтения</h2>
            <Field label="Любимые стили">
              <div className="flex flex-wrap gap-1.5">
                {STYLE_TAGS.map((s) => (
                  <button key={s} className={clsx("chip", p.style.preferred.includes(s) && "chip-on")} onClick={() => setP({ ...p, style: { ...p.style, preferred: toggle(p.style.preferred, s) } })}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Любимые цвета">
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_WORDS.map((c) => (
                    <button key={c} className={clsx("chip", p.style.favoriteColors.includes(c) && "chip-on")} onClick={() => setP({ ...p, style: { ...p.style, favoriteColors: toggle(p.style.favoriteColors, c) } })}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Не люблю цвета">
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_WORDS.map((c) => (
                    <button key={c} className={clsx("chip", p.style.avoidColors.includes(c) && "chip-on")} onClick={() => setP({ ...p, style: { ...p.style, avoidColors: toggle(p.style.avoidColors, c) } })}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Бюджет на покупки">
                <Segmented
                  value={p.style.budget}
                  onChange={(budget) => setP({ ...p, style: { ...p.style, budget } })}
                  options={[
                    { value: "low", label: "Экономно" },
                    { value: "mid", label: "Средний" },
                    { value: "high", label: "Премиум" },
                  ]}
                />
              </Field>
              <Field label="Что не носите никогда">
                <input
                  className="input"
                  value={p.style.avoid.join(", ")}
                  onChange={(e) => setP({ ...p, style: { ...p.style, avoid: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })}
                  placeholder="мини, леопард, кроп-топы…"
                />
              </Field>
            </div>
            <Field label="О себе для стилиста" className="mt-3">
              <textarea
                className="input min-h-20"
                value={p.style.notes}
                onChange={(e) => setP({ ...p, style: { ...p.style, notes: e.target.value } })}
                placeholder="Работаю в офисе с дресс-кодом smart casual, хочу выглядеть собранно, но не скучно…"
              />
            </Field>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Комфорт</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={`Максимальный каблук: ${p.comfort.maxHeelCm} см`}>
                <input type="range" min={0} max={14} value={p.comfort.maxHeelCm} className="w-full accent-[var(--accent)]" onChange={(e) => setP({ ...p, comfort: { ...p.comfort, maxHeelCm: Number(e.target.value) } })} />
              </Field>
              <Field label={`На каблуке пешком до: ${p.comfort.maxWalkKmInHeels} км`}>
                <input type="range" min={0} max={5} step={0.5} value={p.comfort.maxWalkKmInHeels} className="w-full accent-[var(--accent)]" onChange={(e) => setP({ ...p, comfort: { ...p.comfort, maxWalkKmInHeels: Number(e.target.value) } })} />
              </Field>
              <Field label="Мёрзну">
                <button className={clsx("chip", p.comfort.coldSensitive && "chip-on")} onClick={() => setP({ ...p, comfort: { ...p.comfort, coldSensitive: !p.comfort.coldSensitive } })}>
                  🥶 Одевать теплее
                </button>
              </Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-2 text-lg font-bold">Данные</h2>
            <p className="mb-4 text-sm text-muted">Всё хранится локально в браузере (IndexedDB). Сделайте резервную копию, чтобы перенести гардероб на другое устройство.</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost"
                onClick={async () => {
                  const blob = new Blob([await exportAll()], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `atelier-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
              >
                <Download size={16} /> Экспорт
              </button>
              <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> Импорт
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    await importAll(await f.text());
                    toast("Данные восстановлены", "ok");
                    location.reload();
                  } catch {
                    toast("Файл не подошёл", "error");
                  }
                }}
              />
              <button
                className="btn-ghost text-bad"
                onClick={async () => {
                  if (!confirm("Удалить весь гардероб, образы, события и профиль?")) return;
                  await db.delete();
                  location.reload();
                }}
              >
                <Trash2 size={16} /> Стереть всё
              </button>
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="card overflow-hidden">
            <Avatar3D profile={p} items={worn} className="h-[520px] w-full" />
            <div className="border-t border-line p-4 text-xs text-muted">
              Аватар меняется вместе с мерками. На нём надет образ из примерочной.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
