import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, CameraOff, ImagePlus, Radio, ScanFace } from "lucide-react";
import type { PhotoRating } from "@shared/types";
import { api } from "../api";
import { Field, PageHeader, Spinner } from "../components/ui";
import { useProfile } from "../db";
import { todayISO } from "../lib/dates";
import { useWeather } from "../lib/hooks";
import { captureVideo, fileToDataUrl, resizeImage } from "../lib/image";
import { errorText, toast, useUI } from "../store";

const LIVE_INTERVAL = 15000;

export default function Mirror() {
  const profile = useProfile();
  const ai = useUI((s) => s.health?.ai);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [photo, setPhoto] = useState<string | null>(null);
  const [rating, setRating] = useState<PhotoRating | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [history, setHistory] = useState<{ photo: string; rating: PhotoRating }[]>([]);
  const { weather } = useWeather(todayISO());

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
    setLive(false);
  };
  useEffect(() => stop, []);

  const start = async (mode = facing) => {
    try {
      stop();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setCamOn(true);
      setPhoto(null);
    } catch (e) {
      toast(`Камера недоступна: ${errorText(e)}`, "error");
    }
  };

  const rate = async (img: string) => {
    if (!profile) return;
    if (!ai) return toast("Оценка фото работает через Claude — добавьте ANTHROPIC_API_KEY на сервер", "error");
    setBusy(true);
    try {
      const r = await api.rate({
        image: img,
        profile,
        occasion: occasion || undefined,
        weather: weather ? `${weather.description}, ${Math.round(weather.tMin)}…${Math.round(weather.tMax)}°C` : undefined,
      });
      setRating(r);
      setHistory((h) => [{ photo: img, rating: r }, ...h].slice(0, 8));
    } catch (e) {
      toast(errorText(e), "error");
      setLive(false);
    }
    setBusy(false);
  };

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    return captureVideo(v, facing === "user");
  };

  // Живой режим: периодически снимаем кадр и оцениваем
  useEffect(() => {
    if (!live || !camOn) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      const img = snap();
      if (img) await rate(img);
    };
    tick();
    const t = setInterval(tick, LIVE_INTERVAL);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, camOn]);

  return (
    <div>
      <PageHeader title="Зеркало" subtitle="Встаньте перед камерой или загрузите фото — стилист оценит образ и подскажет, что поправить прямо сейчас." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card overflow-hidden">
          <div className="relative aspect-[3/4] max-h-[72vh] w-full bg-black">
            <video ref={videoRef} playsInline muted className={clsx("absolute inset-0 h-full w-full object-cover", facing === "user" && "-scale-x-100", (!camOn || photo) && "invisible")} />
            {photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full object-contain" />}
            {!camOn && !photo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white/70">
                <ScanFace size={44} />
                <p className="max-w-xs text-sm">Лучше всего — фото в полный рост при дневном свете, телефон на уровне груди.</p>
              </div>
            )}
            {live && (
              <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-bold text-white">
                <Radio size={12} className="animate-pulse" /> LIVE · каждые {LIVE_INTERVAL / 1000} с
              </span>
            )}
            {busy && (
              <span className="glass absolute top-3 right-3 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold">
                <Spinner size={12} /> Смотрю…
              </span>
            )}
            {rating && (camOn || photo) && <ScoreBadge score={rating.score} className="absolute right-3 bottom-3" />}
          </div>
          <div className="space-y-3 p-4">
            <Field label="Куда собираетесь?">
              <input className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Офис, свидание, прогулка…" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {camOn ? (
                <>
                  <button className="btn-primary flex-1" disabled={busy} onClick={() => { const img = snap(); if (img) { setPhoto(img); rate(img); } }}>
                    <Camera size={16} /> Оценить кадр
                  </button>
                  <button className={clsx("btn-ghost", live && "chip-on")} onClick={() => setLive(!live)} disabled={!ai}>
                    <Radio size={16} /> Live
                  </button>
                  <button className="btn-ghost" onClick={() => { const f = facing === "user" ? "environment" : "user"; setFacing(f); start(f); }}>
                    ⟲
                  </button>
                  <button className="btn-ghost" onClick={stop}>
                    <CameraOff size={16} />
                  </button>
                </>
              ) : (
                <button className="btn-primary flex-1" onClick={() => start()}>
                  <Camera size={16} /> Включить камеру
                </button>
              )}
              <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={16} /> Фото
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const img = await resizeImage(await fileToDataUrl(f), 1280);
                  stop();
                  setPhoto(img);
                  rate(img);
                }}
              />
            </div>
            {!ai && <p className="text-xs text-warn">Оценка работает через Claude: добавьте ANTHROPIC_API_KEY в .env сервера.</p>}
          </div>
        </div>

        <div className="space-y-4">
          {rating ? (
            <RatingView rating={rating} />
          ) : (
            <div className="card p-6 text-sm text-muted">
              <div className="mb-2 text-lg font-bold text-fg">Как это работает</div>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Claude смотрит на посадку, пропорции, сочетание цветов, уместность поводу и погоде, детали.</li>
                <li>Режим <b>Live</b> каждые 15 секунд оценивает кадр — переодевайтесь и смотрите, как меняется оценка.</li>
                <li>Оцениваются одежда и стайлинг, а не внешность.</li>
                <li>Фото не сохраняются — только отправляются на анализ.</li>
              </ul>
            </div>
          )}
          {history.length > 1 && (
            <div className="card p-4">
              <div className="mb-2 text-sm font-bold">История примерок</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map((h, i) => (
                  <button key={i} className="relative shrink-0" onClick={() => (setRating(h.rating), setPhoto(h.photo))}>
                    <img src={h.photo} alt="" className="h-24 w-18 rounded-2xl object-cover" />
                    <span className="glass absolute right-1 bottom-1 rounded-full px-1.5 text-xs font-bold">{h.rating.score.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, score / 10));
  const color = score >= 8 ? "var(--ok)" : score >= 6 ? "var(--accent)" : "var(--warn)";
  return (
    <div className={clsx("glass flex h-20 w-20 items-center justify-center rounded-full", className)}>
      <svg viewBox="0 0 36 36" className="absolute h-20 w-20 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 97.4} 97.4`} />
      </svg>
      <span className="text-2xl font-extrabold">{score.toFixed(1)}</span>
    </div>
  );
}

function RatingView({ rating }: { rating: PhotoRating }) {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-4">
        <ScoreBadge score={rating.score} className="relative shrink-0" />
        <div className="text-lg leading-snug font-bold">{rating.verdict}</div>
      </div>
      <div className="space-y-2.5">
        {rating.breakdown.map((b) => (
          <div key={b.aspect}>
            <div className="flex justify-between text-sm">
              <span className="font-semibold">{b.aspect}</span>
              <span className="font-bold">{b.score}/10</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${b.score * 10}%`, background: "linear-gradient(90deg, var(--accent-2), var(--accent))" }} />
            </div>
            <div className="mt-1 text-xs text-muted">{b.comment}</div>
          </div>
        ))}
      </div>
      {rating.strengths.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-bold text-ok">Что отлично</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {rating.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {rating.improvements.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-bold text-accent">Быстрые правки</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {rating.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {rating.detectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rating.detectedItems.map((d) => (
            <span key={d} className="chip py-1">
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
