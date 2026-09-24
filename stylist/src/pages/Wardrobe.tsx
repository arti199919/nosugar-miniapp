import { useMemo, useState } from "react";
import clsx from "clsx";
import { Plus, Search, Shirt, Sparkles } from "lucide-react";
import { CATEGORIES, CATEGORY_ORDER } from "@shared/catalog";
import { colorName } from "@shared/color";
import type { Category, WardrobeItem } from "@shared/types";
import { AddItemWizard } from "../components/AddItemWizard";
import { ItemCard } from "../components/items";
import { ItemEditor } from "../components/ItemEditor";
import { Empty, Modal, PageHeader, Segmented, plural } from "../components/ui";
import { db, useItems, useProfile } from "../db";
import { daysBetween, todayISO } from "../lib/dates";
import { loadDemoWardrobe } from "../lib/demo";
import { toast } from "../store";

type Sort = "new" | "worn" | "forgotten" | "name";
type View = "active" | "archived" | "all";

export default function Wardrobe() {
  const items = useItems();
  const profile = useProfile();
  const [cat, setCat] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [view, setView] = useState<View>("active");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<WardrobeItem | null>(null);

  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const i of items ?? []) if (i.status !== "archived") m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);

  const list = useMemo(() => {
    const today = todayISO();
    let l = (items ?? []).filter((i) => (view === "all" ? true : view === "archived" ? i.status === "archived" : i.status !== "archived"));
    if (cat !== "all") l = l.filter((i) => i.category === cat);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter((i) =>
        [i.name, i.subtype, i.brand, i.material, ...i.colors.map(colorName), CATEGORIES[i.category].label].some((f) => f?.toLowerCase().includes(s)),
      );
    }
    const since = (i: WardrobeItem) => (i.lastWorn ? daysBetween(i.lastWorn, today) : 10000);
    return [...l].sort((a, b) =>
      sort === "worn" ? b.wearCount - a.wearCount : sort === "forgotten" ? since(b) - since(a) : sort === "name" ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt,
    );
  }, [items, cat, q, sort, view]);

  if (!items) return null;
  const active = items.filter((i) => i.status !== "archived");
  const forgotten = active.filter((i) => !i.lastWorn || daysBetween(i.lastWorn, todayISO()) > 60).length;
  const totalValue = active.reduce((a, i) => a + (i.price ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Гардероб"
        subtitle={`${plural(active.length, ["вещь", "вещи", "вещей"])}${forgotten ? ` · ${forgotten} давно не надевали` : ""}${totalValue ? ` · стоимость ≈ ${totalValue.toLocaleString("ru-RU")} ₽` : ""}`}
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Добавить вещи
          </button>
        }
      />

      {items.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Shirt size={28} />}
            title="Соберём ваш цифровой гардероб"
            text="Сфотографируйте вещи по одной или себя в образе — нейросеть вырежет каждую вещь и заполнит карточку. Или начните с демо-гардероба, чтобы посмотреть, как всё работает."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => setAdding(true)}>
                  <Plus size={16} /> Добавить первые вещи
                </button>
                <button
                  className="btn-ghost"
                  onClick={async () => {
                    const n = await loadDemoWardrobe(profile?.gender ?? "female");
                    toast(`Загружено ${n} демо-вещей`, "ok");
                  }}
                >
                  <Sparkles size={16} /> Демо-гардероб
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Поиск: «чёрн», «кашемир», бренд…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented<Sort>
              value={sort}
              onChange={setSort}
              options={[
                { value: "new", label: "Новые" },
                { value: "worn", label: "Частые" },
                { value: "forgotten", label: "Забытые" },
                { value: "name", label: "А–Я" },
              ]}
            />
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: "active", label: "В гардеробе" },
                { value: "archived", label: "Архив" },
              ]}
            />
          </div>
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            <button className={clsx("chip shrink-0", cat === "all" && "chip-on")} onClick={() => setCat("all")}>
              Все · {active.length}
            </button>
            {CATEGORY_ORDER.filter((c) => counts.get(c)).map((c) => (
              <button key={c} className={clsx("chip shrink-0", cat === c && "chip-on")} onClick={() => setCat(c)}>
                {CATEGORIES[c].short} · {counts.get(c)}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <Empty title="Ничего не найдено" text="Попробуйте другой запрос или категорию." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {list.map((i) => (
                <ItemCard key={i.id} item={i} onClick={() => setEditing(i)} />
              ))}
            </div>
          )}
        </>
      )}

      <AddItemWizard open={adding} onClose={() => setAdding(false)} />
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title="Карточка вещи">
        {editing && (
          <ItemEditor
            key={editing.id}
            item={editing}
            onSave={async (i) => {
              await db.items.put(i);
              toast("Сохранено", "ok");
              setEditing(null);
            }}
            onDelete={async () => {
              if (!confirm(`Удалить «${editing.name}» навсегда?`)) return;
              await db.items.delete(editing.id);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
