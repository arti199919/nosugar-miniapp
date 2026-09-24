import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangle, Backpack, Bookmark, Box, CheckCircle2, Image as ImageIcon, PersonStanding, Scissors, ShoppingBag, Sparkles, Wand2 } from "lucide-react";
import { TRANSPORTS } from "@shared/catalog";
import type { OutfitOption, OutfitPlan, WardrobeItem } from "@shared/types";
import { Avatar3D, type AvatarHandle } from "./avatar/Avatar3D";
import { OutfitCollage, WeatherChip } from "./items";
import { AiBadge } from "./ui";
import { db, markWorn, useProfile } from "../db";
import { SaveLookModal } from "../pages/Fitting";
import { toast, useUI } from "../store";

export function PlanView({ plan, items }: { plan: OutfitPlan; items: WardrobeItem[] }) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge source={plan.source} />
        {plan.weather && <WeatherChip w={plan.weather} />}
        {plan.route && (
          <span className="chip">
            {TRANSPORTS[plan.route.transport].emoji} {plan.route.distanceKm} км · ~{plan.route.durationMin} мин · пешком ≈{plan.route.walkKm} км
          </span>
        )}
        <span className="chip">{plan.occasion}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {plan.options.map((o, idx) => (
          <OptionCard key={idx} plan={plan} option={o} index={idx} items={o.itemIds.map((id) => byId.get(id)).filter((x): x is WardrobeItem => !!x)} />
        ))}
      </div>

      {plan.beauty && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-accent">
              <Scissors size={16} /> Причёска
            </div>
            <div className="text-lg font-bold">{plan.beauty.hair.style}</div>
            <p className="mt-1 text-sm text-muted">{plan.beauty.hair.why}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {plan.beauty.hair.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-accent-2">
              <Wand2 size={16} /> {plan.beauty.grooming?.length && !plan.beauty.makeup.steps.length ? "Груминг" : "Макияж"}
            </div>
            <div className="text-lg font-bold">{plan.beauty.makeup.look}</div>
            {plan.beauty.makeup.palette.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.beauty.makeup.palette.map((p) => (
                  <span key={p} className="chip">
                    {p}
                  </span>
                ))}
              </div>
            )}
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {plan.beauty.makeup.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {!!plan.beauty.grooming?.length && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                {plan.beauty.grooming.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {(plan.tips.length > 0 || plan.gaps.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {plan.tips.length > 0 && (
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Sparkles size={16} className="text-accent" /> Советы стилиста
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {plan.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.gaps.length > 0 && <GapsCard gaps={plan.gaps} />}
        </div>
      )}
    </div>
  );
}

function GapsCard({ gaps }: { gaps: string[] }) {
  const nav = useNavigate();
  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <ShoppingBag size={16} className="text-accent-2" /> Чего не хватило
      </div>
      <div className="flex flex-col gap-1.5">
        {gaps.map((g, i) => (
          <button key={i} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-left text-sm hover:bg-surface-3" onClick={() => nav("/shop", { state: { query: g } })}>
            {g}
            <span className="shrink-0 text-xs font-bold text-accent">найти →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionCard({ plan, option, index, items }: { plan: OutfitPlan; option: OutfitOption; index: number; items: WardrobeItem[] }) {
  const profile = useProfile();
  const [view, setView] = useState<"flat" | "3d">("flat");
  const [saving, setSaving] = useState(false);
  const avatar = useRef<AvatarHandle>(null);
  const setFitting = useUI((s) => s.setFitting);
  const nav = useNavigate();
  const chosen = plan.chosen === index;
  return (
    <div className={clsx("card flex flex-col overflow-hidden", chosen && "ring-2 ring-accent")}>
      <div className="relative">
        {view === "flat" ? (
          <OutfitCollage items={items} className="m-3 min-h-64" />
        ) : (
          profile && <Avatar3D ref={avatar} profile={profile} items={items} className="h-96 w-full" autoRotate />
        )}
        <div className="absolute top-5 right-5 flex gap-1">
          <button className={clsx("btn-icon glass h-8 w-8", view === "flat" && "text-accent")} onClick={() => setView("flat")} title="Коллаж">
            <ImageIcon size={15} />
          </button>
          <button className={clsx("btn-icon glass h-8 w-8", view === "3d" && "text-accent")} onClick={() => setView("3d")} title="3D на аватаре">
            <Box size={15} />
          </button>
        </div>
        {option.score != null && (
          <span className="glass absolute top-5 left-5 rounded-full px-2.5 py-1 text-xs font-bold">{option.score}% совпадение</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
        <div>
          <div className="text-xs font-bold text-muted uppercase">Вариант {index + 1}</div>
          <div className="text-lg leading-tight font-bold">{option.title}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {items.map((i) => (
            <span key={i.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">
              {i.name}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted">{option.reasoning}</p>
        {option.warnings.map((w, i) => (
          <div key={i} className="flex gap-2 rounded-2xl bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
          </div>
        ))}
        {option.carry.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Backpack size={14} className="text-muted" />
            {option.carry.map((c) => (
              <span key={c} className="chip py-1">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto grid grid-cols-3 gap-2 pt-1">
          <button
            className="btn-ghost px-2 text-xs"
            onClick={() => {
              setFitting(option.itemIds);
              nav("/fitting");
            }}
          >
            <PersonStanding size={15} /> Примерить
          </button>
          <button className="btn-ghost px-2 text-xs" onClick={() => setSaving(true)}>
            <Bookmark size={15} /> Сохранить
          </button>
          <button
            className={clsx("px-2 text-xs", chosen ? "btn-ghost chip-on" : "btn-primary")}
            onClick={async () => {
              await db.plans.update(plan.id, { chosen: index });
              plan.chosen = index;
              if (plan.date <= new Date().toISOString().slice(0, 10)) await markWorn(option.itemIds, plan.date);
              toast(chosen ? "Этот образ уже выбран" : "Выбрано! Образ будет ждать вас на главной", "ok");
            }}
          >
            <CheckCircle2 size={15} /> {chosen ? "Выбран" : "Надену"}
          </button>
        </div>
      </div>
      <SaveLookModal
        open={saving}
        onClose={() => setSaving(false)}
        itemIds={option.itemIds}
        snapshot={() => avatar.current?.snapshot() ?? undefined}
        defaults={{
          name: option.title,
          occasion: plan.occasion,
          hair: plan.beauty?.hair.style,
          makeup: plan.beauty?.makeup.look,
          source: plan.source,
        }}
      />
    </div>
  );
}
