import clsx from "clsx";
import { Heart } from "lucide-react";
import type { WardrobeItem, WeatherDay } from "@shared/types";
import { CATEGORIES, slotOf, weatherEmoji } from "@shared/catalog";
import { garmentIcon } from "../lib/garmentIcon";
import { ColorDot } from "./ui";

export const itemImage = (i: WardrobeItem) => i.image ?? garmentIcon(i.category, i.colors, i.shape, i.subtype);

export function ItemThumb({ item, className, onClick }: { item: WardrobeItem; className?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={clsx("checker relative overflow-hidden rounded-2xl", className)} title={item.name}>
      <img src={itemImage(item)} alt={item.name} className="h-full w-full object-contain p-1.5" loading="lazy" />
    </button>
  );
}

export function ItemCard({ item, onClick, selected, compact }: { item: WardrobeItem; onClick?: () => void; selected?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-surface text-left transition hover:-translate-y-0.5",
        selected ? "border-accent ring-2 ring-accent/40" : "border-line",
      )}
    >
      <div className={clsx("checker relative w-full", compact ? "aspect-square" : "aspect-[4/5]")}>
        <img src={itemImage(item)} alt={item.name} className="absolute inset-0 h-full w-full object-contain p-3 transition group-hover:scale-[1.03]" loading="lazy" />
        {item.favorite && <Heart size={14} className="absolute top-2.5 right-2.5 fill-accent-2 text-accent-2" />}
        {item.status !== "active" && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
            {item.status === "laundry" ? "в стирке" : item.status === "repair" ? "в ремонте" : "архив"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className={clsx("line-clamp-2 font-semibold", compact ? "text-xs" : "text-sm")}>{item.name}</div>
        {!compact && (
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">{CATEGORIES[item.category].short}</span>
            <span className="flex -space-x-1">
              {item.colors.slice(0, 3).map((c, idx) => (
                <ColorDot key={idx} hex={c} size={12} />
              ))}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

const COLLAGE_ORDER = ["headwear", "outer", "blazer", "mid", "top", "onepiece", "bottom", "belt", "scarf", "bag", "jewelry", "accessory", "hosiery", "shoes"];

/** Флэт-лей коллаж образа из вырезанных вещей. */
export function OutfitCollage({ items, className }: { items: WardrobeItem[]; className?: string }) {
  const sorted = [...items].sort((a, b) => COLLAGE_ORDER.indexOf(slotOf(a.category)) - COLLAGE_ORDER.indexOf(slotOf(b.category)));
  const big = sorted.filter((i) => ["outer", "blazer", "top", "mid", "onepiece", "bottom"].includes(slotOf(i.category)));
  const small = sorted.filter((i) => !big.includes(i));
  return (
    <div className={clsx("checker grid grid-cols-3 gap-1.5 rounded-3xl p-2", className)}>
      <div className="col-span-2 grid grid-cols-2 gap-1.5">
        {big.map((i) => (
          <div key={i.id} className={clsx("rounded-2xl bg-surface/40", big.length === 1 && "col-span-2 row-span-2")}>
            <img src={itemImage(i)} alt={i.name} title={i.name} className="aspect-square h-full w-full object-contain p-1.5" />
          </div>
        ))}
      </div>
      <div className="grid auto-rows-min grid-cols-1 gap-1.5">
        {small.map((i) => (
          <div key={i.id} className="rounded-2xl bg-surface/40">
            <img src={itemImage(i)} alt={i.name} title={i.name} className="aspect-[4/3] w-full object-contain p-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeatherChip({ w }: { w: WeatherDay }) {
  return (
    <span className="chip chip-on">
      {weatherEmoji(w.code)} {Math.round(w.tMin)}…{Math.round(w.tMax)}° · {w.description.toLowerCase()}
    </span>
  );
}

export function WeatherCard({ w, compact }: { w: WeatherDay; compact?: boolean }) {
  const hours = (w.hourly ?? []).filter((h) => {
    const hr = Number(h.time.slice(11, 13));
    return hr >= 8 && hr <= 22;
  });
  return (
    <div className="rounded-3xl bg-surface-2 p-4">
      <div className="flex items-center gap-4">
        <div className="text-5xl">{weatherEmoji(w.code)}</div>
        <div className="flex-1">
          <div className="text-3xl font-bold">
            {Math.round(w.tMax)}°<span className="text-lg text-muted"> / {Math.round(w.tMin)}°</span>
          </div>
          <div className="text-sm text-muted">
            {w.description}, ощущается {Math.round(w.feelsMin)}…{Math.round(w.feelsMax)}°
          </div>
        </div>
      </div>
      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <span className="chip">☔ {w.precipProb}% · {w.precipSum} мм</span>
            <span className="chip">💨 до {Math.round(w.windMax)} м/с</span>
            <span className="chip">☀️ UV {Math.round(w.uvMax)}</span>
            {w.sunset && <span className="chip">🌇 закат {w.sunset}</span>}
          </div>
          {hours.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {hours.map((h) => (
                <div key={h.time} className="flex min-w-12 flex-col items-center rounded-2xl bg-surface px-2 py-1.5 text-xs">
                  <span className="text-muted">{h.time.slice(11, 13)}:00</span>
                  <span>{weatherEmoji(h.code)}</span>
                  <span className="font-bold">{Math.round(h.temp)}°</span>
                  {h.precipProb > 20 && <span className="text-[10px] text-accent">{h.precipProb}%</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
