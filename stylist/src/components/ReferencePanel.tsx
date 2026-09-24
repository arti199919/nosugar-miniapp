import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Bookmark, ImagePlus, PersonStanding, Search, Sparkles } from "lucide-react";
import type { WardrobeItem } from "@shared/types";
import { useItems, useProfile } from "../db";
import { fileToDataUrl, resizeImage } from "../lib/image";
import { matchReference, type ReferenceMatch } from "../lib/reference";
import { SaveLookModal } from "../pages/Fitting";
import { errorText, toast, useUI } from "../store";
import { Avatar3D } from "./avatar/Avatar3D";
import { ItemThumb } from "./items";
import { AiBadge, Spinner } from "./ui";

const QUALITY = {
  exact: { label: "то же самое", cls: "text-ok" },
  close: { label: "очень похоже", cls: "text-ok" },
  substitute: { label: "замена", cls: "text-warn" },
  none: { label: "нет в гардеробе", cls: "text-bad" },
};

export function ReferencePanel() {
  const profile = useProfile();
  const items = useItems();
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<ReferenceMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const setFitting = useUI((s) => s.setFitting);
  const nav = useNavigate();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const outfit = (res?.pieces ?? []).map((p) => byId.get(p.matchId)).filter((x): x is WardrobeItem => !!x);

  const run = async (f: File) => {
    if (!profile || !items) return;
    try {
      const img = await resizeImage(await fileToDataUrl(f), 1400);
      setPhoto(img);
      setRes(null);
      setBusy("Анализирую образ…");
      setRes(await matchReference(img, profile, items, setBusy));
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  if (!profile || !items) return null;
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <p className="mb-4 text-sm text-muted">
          Загрузите фото образа, который нравится: Pinterest, журнал, стритстайл, скриншот из соцсетей. Я разберу его на вещи и соберу максимально похожий образ из вашего гардероба, а недостающее предложу найти в магазинах.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) run(f);
          }}
        />
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={!!busy || !items.length}>
          {busy ? <Spinner /> : <ImagePlus size={16} />} {busy ?? "Загрузить фото-пример"}
        </button>
        {!items.length && <p className="mt-2 text-xs text-warn">Сначала добавьте вещи в гардероб.</p>}
      </div>

      {photo && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="card overflow-hidden">
            <div className="px-4 pt-4 text-xs font-bold text-muted uppercase">Референс</div>
            <img src={photo} alt="" className="max-h-[520px] w-full object-contain p-4" />
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 pt-4 text-xs font-bold text-muted uppercase">Из вашего гардероба</div>
            {res ? <Avatar3D profile={profile} items={outfit} className="h-[520px] w-full" /> : <div className="flex h-[520px] items-center justify-center text-muted">{busy ? <Spinner size={24} /> : null}</div>}
          </div>
          <div className="card space-y-3 p-5">
            {res ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <AiBadge source={res.source} />
                  <span className="chip chip-on">сходство {res.score}%</span>
                </div>
                <p className="text-sm text-muted">{res.description}</p>
                <div className="space-y-2">
                  {res.pieces.map((p, i) => {
                    const it = byId.get(p.matchId);
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                        {it ? <ItemThumb item={it} className="h-12 w-12 shrink-0" /> : <span className="checker h-12 w-12 shrink-0 rounded-2xl" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{p.piece}</div>
                          <div className="truncate text-xs text-muted">{it ? it.name : p.comment}</div>
                          <div className={clsx("text-[11px] font-bold", QUALITY[p.matchQuality].cls)}>{QUALITY[p.matchQuality].label}</div>
                        </div>
                        {p.shopQuery && (
                          <button className="btn-icon h-8 w-8 shrink-0" title={`Найти: ${p.shopQuery}`} onClick={() => nav("/shop", { state: { query: p.shopQuery } })}>
                            <Search size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {res.tips.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                      <Sparkles size={14} className="text-accent" /> Как повторить
                    </div>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {res.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    className="btn-ghost text-xs"
                    disabled={!outfit.length}
                    onClick={() => {
                      setFitting(outfit.map((i) => i.id));
                      nav("/fitting");
                    }}
                  >
                    <PersonStanding size={15} /> Примерить
                  </button>
                  <button className="btn-primary text-xs" disabled={!outfit.length} onClick={() => setSaving(true)}>
                    <Bookmark size={15} /> Сохранить
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">{busy}</div>
            )}
          </div>
        </div>
      )}
      <SaveLookModal open={saving} onClose={() => setSaving(false)} itemIds={outfit.map((i) => i.id)} defaults={{ name: "Как на фото", occasion: "по референсу", source: res?.source }} />
    </div>
  );
}
