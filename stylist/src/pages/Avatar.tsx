import { useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, ImagePlus, Palette, ScanFace, Sparkles, Trash2, UserRound } from "lucide-react";
import { localColorType } from "@shared/colorType";
import type { BodyMeasurements, ColorPalette, Profile } from "@shared/types";
import { api } from "../api";
import { Avatar3D } from "../components/avatar/Avatar3D";
import { AiBadge, ColorDot, Field, PageHeader, Spinner } from "../components/ui";
import { db, saveProfile, setKV, useFaceScan, useItems, useProfile } from "../db";
import { scanBody, type BodyScanResult } from "../lib/bodyScan";
import { scanFace, type FaceScan } from "../lib/faceScan";
import { fileToDataUrl, resizeImage } from "../lib/image";
import { errorText, toast, useUI } from "../store";

const LABELS: Partial<Record<keyof BodyMeasurements, string>> = {
  shoulders: "Ширина плеч",
  chest: "Грудь",
  underbust: "Под грудью",
  waist: "Талия",
  hips: "Бёдра",
  inseam: "Длина ноги",
  thigh: "Обхват бедра",
  calf: "Икра",
  neck: "Шея",
  armLength: "Длина руки",
  footLength: "Стопа",
};

export default function AvatarPage() {
  const profile = useProfile();
  const face = useFaceScan();
  const items = useItems();
  const fitting = useUI((s) => s.fitting);
  if (!profile || face === undefined) return null;
  const worn = (items ?? []).filter((i) => fitting.includes(i.id));
  return (
    <div>
      <PageHeader title="Мой аватар" subtitle="Селфи даёт лицо и цветотип, два фото в полный рост — точные мерки. Все фото обрабатываются прямо на устройстве." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <FaceStep profile={profile} face={face} />
          <BodyStep profile={profile} />
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="card overflow-hidden">
            <Avatar3D profile={profile} items={worn} className="h-[560px] w-full" />
            <div className="flex flex-wrap gap-1.5 border-t border-line p-4 text-xs">
              <span className={clsx("chip", face && "chip-on")}>{face ? "✓ лицо из селфи" : "лицо не отсканировано"}</span>
              <span className={clsx("chip", profile.palette && "chip-on")}>{profile.palette ? `✓ ${profile.palette.subtype}` : "цветотип не определён"}</span>
              <span className="chip">рост {profile.body.height} см</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoButtons({ onFile, capture }: { onFile: (f: File) => void; capture?: "user" | "environment" }) {
  const gal = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={pick} />
      <input ref={cam} type="file" accept="image/*" capture={capture} className="hidden" onChange={pick} />
      <button className="btn-ghost" onClick={() => cam.current?.click()}>
        <Camera size={16} /> Снять
      </button>
      <button className="btn-ghost" onClick={() => gal.current?.click()}>
        <ImagePlus size={16} /> Из галереи
      </button>
    </div>
  );
}

function FaceStep({ profile, face }: { profile: Profile; face: FaceScan | null }) {
  const ai = useUI((s) => s.health?.ai);
  const [busy, setBusy] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [scan, setScan] = useState<FaceScan | null>(null);
  const [palette, setPalette] = useState<ColorPalette | null>(profile.palette ?? null);

  const run = async (f: File) => {
    setBusy("Загружаю модель лица…");
    try {
      const img = await resizeImage(await fileToDataUrl(f), 1600, "image/jpeg", 0.92);
      setSelfie(img);
      setBusy("Строю 3D-сетку лица…");
      const s = await scanFace(img);
      setScan(s);
      setPalette(localColorType(s.colors));
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  const save = async () => {
    if (!scan) return;
    await setKV("faceScan", scan);
    await saveProfile({
      ...profile,
      appearance: { ...profile.appearance, skinTone: scan.colors.skin, hairColor: scan.colors.hair, eyeColor: scan.colors.eyes },
    });
    toast("Лицо сохранено — аватар обновлён", "ok");
    setScan(null);
  };

  const aiPalette = async () => {
    if (!selfie) return toast("Сначала загрузите селфи", "error");
    setBusy("Claude определяет цветотип…");
    try {
      setPalette(await api.colorType(await resizeImage(selfie, 1024), scan?.colors ?? face?.colors));
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  const savePalette = async () => {
    if (!palette) return;
    await saveProfile({
      ...profile,
      palette,
      appearance: { ...profile.appearance, colorType: palette.season, undertone: palette.undertone },
      style: { ...profile.style, favoriteColors: [...new Set([...profile.style.favoriteColors, ...palette.best.slice(0, 4).map((c) => c.name)])] },
    });
    toast("Цветотип сохранён — стилист будет подбирать цвета под него", "ok");
  };

  const shown = scan ?? face;
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ScanFace className="text-accent" />
        <h2 className="text-lg font-bold">1. Селфи → лицо и цветотип</h2>
      </div>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Строго анфас, телефон на уровне глаз, лицо целиком в кадре.</li>
        <li>Дневной свет у окна, без вспышки, фильтров и макияжа — для точного цветотипа.</li>
        <li>Волосы убраны со лба, очки сняты.</li>
      </ul>
      <PhotoButtons onFile={run} capture="user" />
      {busy && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Spinner /> {busy}
        </div>
      )}
      {shown && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
          <img src={shown.texture} alt="" className="w-40 rounded-2xl object-cover" />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["Кожа", shown.colors.skin],
                  ["Волосы", shown.colors.hair],
                  ["Глаза", shown.colors.eyes],
                  ["Губы", shown.colors.lips],
                ] as const
              ).map(([l, c]) => (
                <span key={l} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
                  <ColorDot hex={c} size={18} /> {l}
                </span>
              ))}
            </div>
            {shown.warnings.map((w) => (
              <p key={w} className="text-xs text-warn">
                {w}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {scan && (
                <button className="btn-primary" onClick={save}>
                  <Check size={16} /> Сохранить лицо на аватар
                </button>
              )}
              {!scan && face && (
                <button
                  className="btn-ghost text-bad"
                  onClick={async () => {
                    await db.kv.delete("faceScan");
                    toast("Скан лица удалён");
                  }}
                >
                  <Trash2 size={16} /> Удалить скан лица
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {palette && (
        <div className="mt-6 rounded-3xl bg-surface-2 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Palette size={18} className="text-accent-2" />
            <span className="text-lg font-bold first-letter:uppercase">{palette.subtype}</span>
            <AiBadge source={palette.source} />
          </div>
          <p className="text-sm text-muted">{palette.summary}</p>
          <PaletteRow title="Ваши цвета" colors={palette.best} />
          <PaletteRow title="База" colors={palette.neutrals} />
          <PaletteRow title="Лучше не у лица" colors={palette.avoid} muted />
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <div className="label">Металлы</div>
              {palette.metals}
            </div>
            <div>
              <div className="label">Макияж</div>
              {palette.makeup.join("; ")}
            </div>
            <div>
              <div className="label">Окрашивание</div>
              {palette.hair.join("; ")}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={savePalette}>
              <Check size={16} /> Сохранить цветотип
            </button>
            {ai && selfie && palette.source === "local" && (
              <button className="btn-ghost" onClick={aiPalette} disabled={!!busy}>
                <Sparkles size={16} /> Точный анализ с Claude
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PaletteRow({ title, colors, muted }: { title: string; colors: { name: string; hex: string }[]; muted?: boolean }) {
  return (
    <div className="mt-3">
      <div className="label">{title}</div>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <span key={c.name + c.hex} className={clsx("flex flex-col items-center gap-1 text-[11px]", muted && "opacity-70")}>
            <span className="h-10 w-10 rounded-2xl border border-black/10" style={{ background: c.hex }} />
            <span className="max-w-16 text-center leading-tight">{c.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BodyStep({ profile }: { profile: Profile }) {
  const [front, setFront] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [height, setHeight] = useState(profile.body.height);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<BodyScanResult | null>(null);

  const load = async (f: File, set: (s: string) => void) => set(await resizeImage(await fileToDataUrl(f), 1600, "image/jpeg", 0.9));

  const run = async () => {
    if (!front) return;
    setBusy("Начинаю…");
    try {
      setRes(await scanBody(front, side ?? undefined, height, profile.gender, setBusy));
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(null);
  };

  const apply = async () => {
    if (!res) return;
    const body = { ...profile.body, height, ...Object.fromEntries(Object.entries(res.measurements).filter(([, v]) => v != null)) };
    await saveProfile({ ...profile, body });
    toast("Мерки применены — аватар перестроен", "ok");
  };

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <UserRound className="text-accent" />
        <h2 className="text-lg font-bold">2. Два фото в полный рост → мерки</h2>
      </div>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Облегающая одежда (леггинсы, топ) или бельё, волосы собраны.</li>
        <li>Камера на уровне пояса, в 2,5–3 м, в кадре от макушки до пяток; попросите помочь или поставьте таймер.</li>
        <li><b>Анфас:</b> стоя прямо, ноги на ширине плеч, руки разведены в стороны на 20–30 см.</li>
        <li><b>Профиль:</b> боком к камере, руки опущены вдоль тела.</li>
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["Анфас", front, setFront],
            ["Профиль (для обхватов)", side, setSide],
          ] as const
        ).map(([label, val, set]) => (
          <div key={label} className="rounded-3xl bg-surface-2 p-3">
            <div className="mb-2 text-sm font-bold">{label}</div>
            {val ? <img src={val} alt="" className="mb-2 h-56 w-full rounded-2xl object-contain" /> : <div className="checker mb-2 flex h-56 items-center justify-center rounded-2xl text-xs text-muted">нет фото</div>}
            <PhotoButtons onFile={(f) => load(f, set)} capture="environment" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Ваш рост, см (масштаб)">
          <input className="input w-32" type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
        </Field>
        <button className="btn-primary" onClick={run} disabled={!front || !!busy}>
          {busy ? <Spinner /> : <Sparkles size={16} />} {busy ?? "Снять мерки"}
        </button>
      </div>

      {res && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            <img src={res.overlays.front} alt="" className="h-72 rounded-2xl" />
            {res.overlays.side && <img src={res.overlays.side} alt="" className="h-72 rounded-2xl" />}
          </div>
          <span className={clsx("chip", res.confidence === "high" ? "chip-on" : "")}>
            Точность: {res.confidence === "high" ? "высокая" : res.confidence === "medium" ? "средняя" : "низкая"}
          </span>
          {res.notes.map((n) => (
            <p key={n} className="text-xs text-warn">
              {n}
            </p>
          ))}
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Мерка</th>
                  <th className="px-3 py-2 text-right">Сейчас</th>
                  <th className="px-3 py-2 text-right">По фото</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(LABELS) as (keyof BodyMeasurements)[])
                  .filter((k) => res.measurements[k] != null)
                  .map((k) => (
                    <tr key={k} className="border-t border-line">
                      <td className="px-3 py-1.5">{LABELS[k]}</td>
                      <td className="px-3 py-1.5 text-right text-muted">{profile.body[k] ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-bold">{res.measurements[k]}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Проверьте цифры: если есть сантиметровая лента, 2–3 контрольных замера (грудь, талия, бёдра) сделают аватар ещё точнее — их можно поправить в профиле.</p>
          <button className="btn-primary" onClick={apply}>
            <Check size={16} /> Применить мерки к аватару
          </button>
        </div>
      )}
    </section>
  );
}
