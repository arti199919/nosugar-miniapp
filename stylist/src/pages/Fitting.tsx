import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Bookmark, CheckCircle2, MessageCircle, RotateCw, Trash2, X } from "lucide-react";
import { CATEGORIES, CATEGORY_ORDER, slotOf } from "@shared/catalog";
import type { Category, WardrobeItem } from "@shared/types";
import { Avatar3D, type AvatarHandle } from "../components/avatar/Avatar3D";
import { ItemCard, ItemThumb } from "../components/items";
import { Empty, Field, Modal, PageHeader } from "../components/ui";
import { db, markWorn, uid, useItems, useProfile } from "../db";
import { todayISO } from "../lib/dates";
import { toast, useUI } from "../store";

export function toggleWear(current: string[], item: WardrobeItem, all: WardrobeItem[]): string[] {
  if (current.includes(item.id)) return current.filter((id) => id !== item.id);
  const slot = slotOf(item.category);
  const byId = new Map(all.map((i) => [i.id, i]));
  let next = current.filter((id) => {
    const it = byId.get(id);
    if (!it) return false;
    const s = slotOf(it.category);
    if (s === slot) return false;
    // платье заменяет верх и низ, и наоборот
    if (slot === "onepiece" && (s === "top" || s === "bottom")) return false;
    if ((slot === "top" || slot === "bottom") && s === "onepiece") return false;
    return true;
  });
  next = [...next, item.id];
  return next;
}

export default function Fitting() {
  const profile = useProfile();
  const items = useItems();
  const { fitting, setFitting } = useUI();
  const [cat, setCat] = useState<Category | "all">("all");
  const [rotate, setRotate] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const avatar = useRef<AvatarHandle>(null);
  const nav = useNavigate();

  const worn = useMemo(() => (items ?? []).filter((i) => fitting.includes(i.id)), [items, fitting]);
  const list = useMemo(() => (items ?? []).filter((i) => i.status !== "archived" && (cat === "all" || i.category === cat)), [items, cat]);
  const cats = useMemo(() => CATEGORY_ORDER.filter((c) => (items ?? []).some((i) => i.category === c)), [items]);

  if (!profile || !items) return null;

  return (
    <div>
      <PageHeader
        title="Примерочная"
        subtitle="Нажимайте на вещи — аватар по вашим меркам сразу их наденет. Крутите модель мышью или пальцем."
        actions={
          <>
            <button className={clsx("btn-ghost", rotate && "chip-on")} onClick={() => setRotate(!rotate)}>
              <RotateCw size={16} /> Вращение
            </button>
            <button className="btn-ghost" disabled={!worn.length} onClick={() => setFitting([])}>
              <Trash2 size={16} /> Снять всё
            </button>
            <button className="btn-primary" disabled={!worn.length} onClick={() => setSaveOpen(true)}>
              <Bookmark size={16} /> Сохранить образ
            </button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="card relative overflow-hidden lg:sticky lg:top-6 lg:self-start">
          <Avatar3D ref={avatar} profile={profile} items={worn} autoRotate={rotate} className="h-[62vh] min-h-[420px] w-full lg:h-[calc(100dvh-180px)]" />
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
            {worn.map((i) => (
              <span key={i.id} className="glass flex items-center gap-1.5 rounded-full py-1 pr-1 pl-1 text-xs font-semibold">
                <ItemThumb item={i} className="h-6 w-6 rounded-full" />
                <span className="max-w-32 truncate">{i.name}</span>
                <button className="rounded-full p-0.5 hover:bg-surface-3" onClick={() => setFitting(fitting.filter((id) => id !== i.id))} aria-label="Снять">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          {worn.length > 0 && (
            <div className="absolute top-3 right-3 flex flex-col gap-2">
              <button
                className="btn-icon glass"
                title="Надеть сегодня"
                onClick={async () => {
                  await markWorn(fitting, todayISO());
                  toast("Отметил: образ надет сегодня", "ok");
                }}
              >
                <CheckCircle2 size={18} />
              </button>
              <button
                className="btn-icon glass"
                title="Спросить стилиста"
                onClick={() => nav("/chat", { state: { prompt: `Оцени образ из моего гардероба: ${worn.map((i) => i.name).join(", ")}. Что улучшить?` } })}
              >
                <MessageCircle size={18} />
              </button>
            </div>
          )}
        </div>

        <div>
          {items.length === 0 ? (
            <div className="card">
              <Empty title="Гардероб пуст" text="Добавьте вещи или загрузите демо-гардероб, чтобы примерять." action={<button className="btn-primary" onClick={() => nav("/wardrobe")}>Перейти в гардероб</button>} />
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                <button className={clsx("chip shrink-0", cat === "all" && "chip-on")} onClick={() => setCat("all")}>
                  Все
                </button>
                {cats.map((c) => (
                  <button key={c} className={clsx("chip shrink-0", cat === c && "chip-on")} onClick={() => setCat(c)}>
                    {CATEGORIES[c].short}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} compact selected={fitting.includes(i.id)} onClick={() => setFitting(toggleWear(fitting, i, items))} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <SaveLookModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        itemIds={fitting}
        snapshot={() => avatar.current?.snapshot() ?? undefined}
      />
    </div>
  );
}

export function SaveLookModal({
  open,
  onClose,
  itemIds,
  snapshot,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  itemIds: string[];
  snapshot?: () => string | undefined;
  defaults?: { name?: string; occasion?: string; hair?: string; makeup?: string; source?: "ai" | "local" | "manual" };
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [occasion, setOccasion] = useState(defaults?.occasion ?? "");
  const [tags, setTags] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сохранить образ"
      footer={
        <button
          className="btn-primary w-full"
          onClick={async () => {
            await db.looks.add({
              id: uid(),
              name: name.trim() || "Образ без названия",
              itemIds,
              occasion: occasion.trim() || undefined,
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              thumbnail: snapshot?.(),
              hair: defaults?.hair,
              makeup: defaults?.makeup,
              source: defaults?.source ?? "manual",
              createdAt: Date.now(),
            });
            toast("Образ сохранён в «Образы»", "ok");
            onClose();
          }}
        >
          <Bookmark size={16} /> Сохранить
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="Название">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, «Офис в дождь»" autoFocus />
        </Field>
        <Field label="Повод">
          <input className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Работа, свидание, театр…" />
        </Field>
        <Field label="Теги через запятую">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="осень, офис, любимое" />
        </Field>
      </div>
    </Modal>
  );
}
