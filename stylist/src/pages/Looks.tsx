import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Bookmark, CheckCircle2, PersonStanding, Star, Trash2 } from "lucide-react";
import type { Look, WardrobeItem } from "@shared/types";
import { OutfitCollage } from "../components/items";
import { Empty, PageHeader } from "../components/ui";
import { db, markWorn, useItems, useLooks } from "../db";
import { todayISO } from "../lib/dates";
import { toast, useUI } from "../store";

export default function Looks() {
  const looks = useLooks();
  const items = useItems();
  const [tag, setTag] = useState<string | null>(null);
  const setFitting = useUI((s) => s.setFitting);
  const nav = useNavigate();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const tags = useMemo(() => [...new Set((looks ?? []).flatMap((l) => [...l.tags, ...(l.occasion ? [l.occasion] : [])]))], [looks]);
  if (!looks || !items) return null;
  const list = looks.filter((l) => !tag || l.tags.includes(tag) || l.occasion === tag);
  return (
    <div>
      <PageHeader title="Образы" subtitle="Ваши сохранённые шаблоны — из примерочной и от стилиста." />
      {looks.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Bookmark size={28} />}
            title="Пока нет сохранённых образов"
            text="Соберите образ в примерочной или попросите стилиста, затем нажмите «Сохранить»."
            action={
              <button className="btn-primary" onClick={() => nav("/fitting")}>
                В примерочную
              </button>
            }
          />
        </div>
      ) : (
        <>
          {tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button className={clsx("chip", !tag && "chip-on")} onClick={() => setTag(null)}>
                Все
              </button>
              {tags.map((t) => (
                <button key={t} className={clsx("chip", tag === t && "chip-on")} onClick={() => setTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((l) => (
              <LookCard
                key={l.id}
                look={l}
                items={l.itemIds.map((id) => byId.get(id)).filter((x): x is WardrobeItem => !!x)}
                onTry={() => {
                  setFitting(l.itemIds);
                  nav("/fitting");
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LookCard({ look, items, onTry }: { look: Look; items: WardrobeItem[]; onTry: () => void }) {
  const [view3d, setView3d] = useState(!!look.thumbnail);
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="relative">
        {view3d && look.thumbnail ? (
          <img src={look.thumbnail} alt="" className="h-72 w-full bg-surface-2 object-contain" />
        ) : (
          <OutfitCollage items={items} className="m-3 min-h-64" />
        )}
        {look.thumbnail && (
          <button className="glass absolute top-4 right-4 rounded-full px-2.5 py-1 text-xs font-bold" onClick={() => setView3d(!view3d)}>
            {view3d ? "Коллаж" : "3D-снимок"}
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold">{look.name}</div>
            <div className="text-xs text-muted">
              {look.occasion ?? "без повода"} · {items.length} вещей
            </div>
          </div>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => db.looks.update(look.id, { rating: n })} aria-label={`${n}`}>
                <Star size={15} className={n <= (look.rating ?? 0) ? "fill-warn text-warn" : "text-muted"} />
              </button>
            ))}
          </div>
        </div>
        {(look.hair || look.makeup) && (
          <div className="text-xs text-muted">
            {look.hair && `💇 ${look.hair}`} {look.makeup && `· 💄 ${look.makeup}`}
          </div>
        )}
        {look.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {look.tags.map((t) => (
              <span key={t} className="chip py-0.5">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto grid grid-cols-[1fr_1fr_auto] gap-2 pt-2">
          <button className="btn-ghost px-2 text-xs" onClick={onTry}>
            <PersonStanding size={15} /> Примерить
          </button>
          <button
            className="btn-ghost px-2 text-xs"
            onClick={async () => {
              await markWorn(look.itemIds, todayISO(), look.id);
              toast("Отметил: надето сегодня", "ok");
            }}
          >
            <CheckCircle2 size={15} /> Надето
          </button>
          <button
            className="btn-icon"
            onClick={async () => {
              if (confirm(`Удалить образ «${look.name}»?`)) await db.looks.delete(look.id);
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
