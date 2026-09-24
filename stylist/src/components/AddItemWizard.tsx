import { useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, ImagePlus, Link2, PencilLine, ScanLine, Sparkles, Trash2, UserRound } from "lucide-react";
import { CATEGORIES, CATEGORY_ORDER, inferShape } from "@shared/catalog";
import type { Category, WardrobeItem } from "@shared/types";
import { api } from "../api";
import { db, uid } from "../db";
import { garmentIcon } from "../lib/garmentIcon";
import { dominantColors, fileToDataUrl, removeBackground, resizeImage } from "../lib/image";
import { segmentOutfit } from "../lib/segment";
import { errorText, toast, useUI } from "../store";
import { ItemEditor } from "./ItemEditor";
import { Modal, Spinner } from "./ui";

type Mode = "item" | "outfit" | "link" | "manual";

export function blankItem(category: Category, extra: Partial<WardrobeItem> = {}): WardrobeItem {
  const meta = CATEGORIES[category];
  const colors = extra.colors ?? ["#8a8a8a"];
  const shape = inferShape(category, extra.subtype, extra.shape);
  return {
    id: uid(),
    name: extra.name ?? meta.subtypes[0][0].toUpperCase() + meta.subtypes[0].slice(1),
    category,
    shape,
    colors,
    pattern: meta.defaults.pattern ?? "solid",
    seasons: ["spring", "summer", "autumn", "winter"],
    formality: meta.defaults.formality,
    warmth: meta.defaults.warmth,
    styles: [],
    wearCount: 0,
    status: "active",
    createdAt: Date.now(),
    ...extra,
  };
}

/** Из вырезанного изображения — черновик карточки (с ИИ-разметкой, если доступна). */
async function draftFromCutout(cutout: string, photo: string | undefined, hint: { category?: Category; label?: string } = {}, onProgress?: (t: string) => void): Promise<WardrobeItem> {
  const colors = await dominantColors(cutout).catch(() => ["#8a8a8a"]);
  const ai = useUI.getState().health?.ai;
  if (ai) {
    try {
      onProgress?.("Claude описывает вещь…");
      const flat = await resizeImage(cutout, 900, "image/jpeg");
      const t = await api.tag(flat, hint.label ? `на фото: ${hint.label}` : undefined);
      return blankItem(t.category, {
        name: t.name,
        subtype: t.subtype,
        colors: t.colors?.length ? t.colors : colors,
        pattern: t.pattern,
        material: t.material,
        seasons: t.seasons,
        formality: clamp(t.formality),
        warmth: clamp(t.warmth),
        styles: t.styles,
        waterproof: t.waterproof,
        walkComfort: t.category === "shoes" ? clamp(t.walkComfort) : undefined,
        shape: inferShape(t.category, t.subtype, stripNulls(t.shape)),
        brand: t.brand || undefined,
        notes: t.notes,
        image: cutout,
        photo,
      });
    } catch (e) {
      toast(`ИИ-разметка не удалась: ${errorText(e)}`, "error");
    }
  }
  const category = hint.category ?? "tops";
  return blankItem(category, { name: hint.label ?? CATEGORIES[category].label, colors, image: cutout, photo });
}

const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v || 3)));
const stripNulls = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as T;

export function AddItemWizard({ open, onClose, initialMode }: { open: boolean; onClose: () => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<WardrobeItem[]>([]);
  const [editing, setEditing] = useState<WardrobeItem | null>(null);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const ai = useUI((s) => s.health?.ai);

  const reset = () => {
    setMode(null);
    setDrafts([]);
    setBusy(null);
    setEditing(null);
    setUrl("");
  };
  const close = () => {
    reset();
    onClose();
  };

  const processItemPhotos = async (files: File[]) => {
    const out: WardrobeItem[] = [];
    for (const [idx, f] of files.entries()) {
      try {
        setBusy(`Фото ${idx + 1}/${files.length}: подготовка…`);
        const photo = await resizeImage(await fileToDataUrl(f), 1280);
        const { image } = await removeBackground(photo, (t) => setBusy(`Фото ${idx + 1}/${files.length}: ${t}`));
        out.push(await draftFromCutout(image, photo, {}, (t) => setBusy(`Фото ${idx + 1}/${files.length}: ${t}`)));
      } catch (e) {
        toast(errorText(e), "error");
      }
    }
    setDrafts((d) => [...d, ...out]);
    setBusy(null);
  };

  const processOutfitPhoto = async (file: File) => {
    try {
      setBusy("Подготовка фото…");
      const photo = await resizeImage(await fileToDataUrl(file), 1280);
      const { garments, method } = await segmentOutfit(photo, setBusy);
      if (!garments.length) throw new Error("Не нашёл вещей на фото — попробуйте фото в полный рост при хорошем свете");
      const out: WardrobeItem[] = [];
      for (const [i, g] of garments.entries()) {
        setBusy(`Вещь ${i + 1}/${garments.length}: ${g.label.toLowerCase()}…`);
        out.push(await draftFromCutout(g.image, photo, { category: g.category, label: g.label }));
      }
      setDrafts(out);
      toast(`Нашёл вещей: ${out.length}${method === "claude" ? " (распознавание через Claude)" : ""}`, "ok");
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  const processLink = async () => {
    try {
      setBusy("Читаю карточку товара…");
      const p = await api.importUrl(url.trim());
      let cutout: string | undefined;
      let photo: string | undefined;
      if (p.imageUrl) {
        setBusy("Загружаю фото товара…");
        photo = await resizeImage(`/api/proxy-image?url=${encodeURIComponent(p.imageUrl)}`, 1280);
        cutout = (await removeBackground(photo, setBusy)).image;
      }
      const d = cutout
        ? await draftFromCutout(cutout, photo, { label: p.name }, setBusy)
        : blankItem("tops", { name: p.name });
      d.brand = d.brand || p.brand;
      d.price = p.price ? Number(String(p.price).replace(/[^\d]/g, "")) || undefined : undefined;
      d.notes = [d.notes, p.description, url].filter(Boolean).join("\n");
      setDrafts([d]);
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  const saveAll = async () => {
    await db.items.bulkPut(drafts.map((d) => ({ ...d, image: d.image ?? garmentIcon(d.category, d.colors, d.shape, d.subtype) })));
    toast(`Добавлено в гардероб: ${drafts.length}`, "ok");
    close();
  };

  return (
    <Modal open={open} onClose={close} wide title={editing ? "Карточка вещи" : "Добавить вещи"}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple={mode !== "outfit"}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          if (mode === "outfit") processOutfitPhoto(files[0]);
          else processItemPhotos(files);
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (mode === "outfit") processOutfitPhoto(f);
          else processItemPhotos([f]);
        }}
      />

      {editing ? (
        <ItemEditor
          item={editing}
          saveLabel="Готово"
          onSave={(i) => {
            setDrafts((d) => (d.some((x) => x.id === i.id) ? d.map((x) => (x.id === i.id ? i : x)) : [...d, i]));
            setEditing(null);
          }}
        />
      ) : busy ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-surface-2">
            <Spinner size={30} className="text-accent" />
          </div>
          <div className="font-semibold">{busy}</div>
          <p className="max-w-sm text-xs text-muted">Нейросети работают прямо в браузере — при первом запуске скачивается модель, дальше быстрее.</p>
        </div>
      ) : drafts.length > 0 ? (
        <div>
          <p className="mb-3 text-sm text-muted">Проверьте карточки: нажмите, чтобы поправить категорию, цвета, длину и прочее.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {drafts.map((d) => (
              <div key={d.id} className="overflow-hidden rounded-3xl border border-line bg-surface-2">
                <button className="checker block aspect-square w-full" onClick={() => setEditing(d)}>
                  <img src={d.image ?? garmentIcon(d.category, d.colors, d.shape)} alt="" className="h-full w-full object-contain p-2" />
                </button>
                <div className="space-y-2 p-2.5">
                  <input className="input px-2.5 py-1.5 text-xs" value={d.name} onChange={(e) => setDrafts((all) => all.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))} />
                  <div className="flex gap-1.5">
                    <select
                      className="input flex-1 px-2 py-1.5 text-xs"
                      value={d.category}
                      onChange={(e) => {
                        const c = e.target.value as Category;
                        setDrafts((all) => all.map((x) => (x.id === d.id ? { ...x, category: c, shape: inferShape(c, x.subtype) } : x)));
                      }}
                    >
                      {CATEGORY_ORDER.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORIES[c].short}
                        </option>
                      ))}
                    </select>
                    <button className="btn-icon h-8 w-8 shrink-0" onClick={() => setEditing(d)} aria-label="Редактировать">
                      <PencilLine size={14} />
                    </button>
                    <button className="btn-icon h-8 w-8 shrink-0 text-bad" onClick={() => setDrafts((all) => all.filter((x) => x.id !== d.id))} aria-label="Убрать">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost" onClick={reset}>
              Отмена
            </button>
            <button className="btn-primary flex-1" onClick={saveAll}>
              <Check size={16} /> Добавить в гардероб ({drafts.length})
            </button>
          </div>
        </div>
      ) : mode === "link" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Вставьте ссылку на товар с Wildberries, Ozon, Lamoda или сайта бренда — Claude прочитает карточку, а фон с фото будет удалён.</p>
          <input className="input" placeholder="https://www.wildberries.ru/catalog/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          {!ai && <p className="text-xs text-warn">Нужен подключённый Claude (ANTHROPIC_API_KEY на сервере).</p>}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setMode(null)}>
              Назад
            </button>
            <button className="btn-primary flex-1" disabled={!/^https?:\/\//.test(url.trim()) || !ai} onClick={processLink}>
              <Link2 size={16} /> Импортировать
            </button>
          </div>
        </div>
      ) : mode === "manual" ? (
        <div>
          <p className="mb-3 text-sm text-muted">Выберите категорию — карточку заполните вручную.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORY_ORDER.map((c) => (
              <button key={c} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-2.5 text-left text-sm font-semibold hover:bg-surface-3" onClick={() => setEditing(blankItem(c))}>
                <img src={garmentIcon(c, ["#b9a6e6"], inferShape(c))} alt="" className="h-8 w-8" />
                {CATEGORIES[c].short}
              </button>
            ))}
          </div>
        </div>
      ) : mode ? (
        <div className="space-y-4">
          <div className="rounded-3xl bg-surface-2 p-4 text-sm">
            {mode === "item" ? (
              <>
                <b>Как сфотографировать вещь:</b> разложите на однотонной поверхности (пол, кровать, стена) или повесьте на плечики, снимите сверху при дневном свете. Можно выбрать сразу несколько фото — фон удалится автоматически, а Claude определит категорию, цвет, материал и сезон.
              </>
            ) : (
              <>
                <b>Фото в образе:</b> встаньте в полный рост перед зеркалом или попросите сфотографировать, свет — ровный. Нейросеть найдёт на фото верх, низ, платье, обувь, сумку, головной убор, ремень и шарф, вырежет их и добавит отдельными карточками.
              </>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-primary py-4" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={18} /> Выбрать из галереи
            </button>
            <button className="btn-ghost py-4" onClick={() => camRef.current?.click()}>
              <Camera size={18} /> Снять камерой
            </button>
          </div>
          <button className="btn-ghost" onClick={() => setMode(null)}>
            Назад
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard icon={<ScanLine />} title="Фото вещи" text="Вещь на плечиках или разложенная. Фон уберётся, ИИ заполнит карточку." onClick={() => setMode("item")} accent />
          <ModeCard icon={<UserRound />} title="Фото меня в образе" text="Одно фото в полный рост → все вещи с него отдельными карточками." onClick={() => setMode("outfit")} />
          <ModeCard icon={<Link2 />} title="Ссылка на товар" text="Wildberries, Ozon, Lamoda, сайт бренда — импорт фото и описания." onClick={() => setMode("link")} />
          <ModeCard icon={<PencilLine />} title="Вручную" text="Выберите категорию и заполните карточку сами." onClick={() => setMode("manual")} />
          {!ai && (
            <p className="text-xs text-muted sm:col-span-2">
              <Sparkles size={12} className="mr-1 inline" /> Без ключа Claude вещи тоже добавляются: фон вырезается в браузере, цвета определяются автоматически, остальное — вручную.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function ModeCard({ icon, title, text, onClick, accent }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} className={clsx("flex gap-3 rounded-3xl border p-4 text-left transition hover:-translate-y-0.5", accent ? "border-accent/50 bg-accent/10" : "border-line bg-surface-2")}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent">{icon}</span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{text}</span>
      </span>
    </button>
  );
}
