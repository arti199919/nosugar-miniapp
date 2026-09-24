// Обмеры тела по фото: MediaPipe Pose (33 точки) + силуэт.
// Ширины снимаем с фото анфас, глубины — с фото в профиль, обхваты — по формуле эллипса (Рамануджан).
import type { BodyMeasurements, Gender } from "@shared/types";
import { getPoseLandmarker } from "./vision";
import { loadImage } from "./image";

export interface BodyScanResult {
  measurements: Partial<BodyMeasurements>;
  confidence: "high" | "medium" | "low";
  notes: string[];
  overlays: { front: string; side?: string };
}

interface Frame {
  W: number;
  H: number;
  mask: Uint8Array; // 1 — человек
  lm: { x: number; y: number; v: number }[]; // в пикселях
  img: HTMLImageElement;
}

const P = { nose: 0, mouthL: 9, mouthR: 10, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28, lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32 };

async function analyze(photo: string): Promise<Frame> {
  const img = await loadImage(photo);
  const pose = await getPoseLandmarker();
  const res = pose.detect(img);
  const lm0 = res.landmarks[0];
  const m = res.segmentationMasks?.[0];
  if (!lm0 || !m) {
    m?.close();
    throw new Error("Человек на фото не найден. Нужно фото в полный рост, от макушки до пяток.");
  }
  const f = m.getAsFloat32Array();
  const mask = new Uint8Array(f.length);
  for (let i = 0; i < f.length; i++) mask[i] = f[i] > 0.5 ? 1 : 0;
  const W = m.width;
  const H = m.height;
  m.close();
  return { W, H, mask, img, lm: lm0.map((p) => ({ x: p.x * W, y: p.y * H, v: p.visibility ?? 1 })) };
}

/** Непрерывный отрезок силуэта в строке y, содержащий x (или ближайший к нему). */
function run(fr: Frame, y: number, x: number): [number, number] | null {
  const yy = Math.round(Math.max(0, Math.min(fr.H - 1, y)));
  const row = yy * fr.W;
  let cx = Math.round(Math.max(0, Math.min(fr.W - 1, x)));
  if (!fr.mask[row + cx]) {
    let found = -1;
    for (let d = 1; d < fr.W * 0.06; d++) {
      if (cx - d >= 0 && fr.mask[row + cx - d]) {
        found = cx - d;
        break;
      }
      if (cx + d < fr.W && fr.mask[row + cx + d]) {
        found = cx + d;
        break;
      }
    }
    if (found < 0) return null;
    cx = found;
  }
  let a = cx;
  let b = cx;
  while (a > 0 && fr.mask[row + a - 1]) a--;
  while (b < fr.W - 1 && fr.mask[row + b + 1]) b++;
  return [a, b];
}

const width = (r: [number, number] | null) => (r ? r[1] - r[0] + 1 : 0);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function verticalExtent(fr: Frame): { top: number; bottom: number } {
  const nose = fr.lm[P.nose];
  const band = fr.W * 0.12;
  let top = 0;
  outer: for (let y = 0; y < fr.H; y++)
    for (let x = Math.max(0, Math.round(nose.x - band)); x < Math.min(fr.W, nose.x + band); x++)
      if (fr.mask[y * fr.W + x]) {
        top = y;
        break outer;
      }
  const feet = [P.lHeel, P.rHeel, P.lFoot, P.rFoot].map((i) => fr.lm[i].y);
  let bottom = Math.max(...feet);
  // уточняем по силуэту: последняя строка с пикселями человека
  for (let y = fr.H - 1; y > bottom; y--) {
    let any = false;
    for (let x = 0; x < fr.W; x += 2) if (fr.mask[y * fr.W + x]) ((any = true), (x = fr.W));
    if (any) {
      bottom = y;
      break;
    }
  }
  return { top, bottom };
}

/** Экстремум ширины/глубины силуэта в полосе по высоте. */
function bandExtreme(fr: Frame, y0: number, y1: number, xAt: (y: number) => number, mode: "max" | "min", runFn: (fr: Frame, y: number, x: number) => [number, number] | null = run): { w: number; y: number } {
  let best = mode === "max" ? 0 : Infinity;
  let by = y0;
  const step = Math.max(1, Math.round((y1 - y0) / 30));
  for (let y = y0; y <= y1; y += step) {
    const w = width(runFn(fr, y, xAt(y)));
    if (!w) continue;
    if (mode === "max" ? w > best : w < best) {
      best = w;
      by = y;
    }
  }
  return { w: best === Infinity ? 0 : best, y: by };
}

/** Отрезок силуэта без рук: если рука прилегает к телу, отрезаем её по линии плечо–локоть–запястье–кисть. */
function armClipper(fr: Frame, pxHeight: number) {
  const arms = [
    [P.lSh, P.lEl, P.lWr],
    [P.rSh, P.rEl, P.rWr],
  ].map(([a, b, c]) => {
    const pts = [fr.lm[a], fr.lm[b], fr.lm[c]];
    const w = fr.lm[c];
    const e = fr.lm[b];
    pts.push({ x: w.x + (w.x - e.x) * 0.5, y: w.y + (w.y - e.y) * 0.5, v: 1 }); // кисть
    return pts;
  });
  const half = pxHeight * 0.022;
  const armX = (pts: { x: number; y: number }[], y: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [p, q] = [pts[i], pts[i + 1]];
      if ((y - p.y) * (y - q.y) <= 0 && p.y !== q.y) return p.x + ((q.x - p.x) * (y - p.y)) / (q.y - p.y);
    }
    return null;
  };
  return (f: Frame, y: number, x: number, limit = Infinity): [number, number] | null => {
    const r = run(f, y, x);
    if (!r || width(r) <= limit) return r; // руки не слиплись с телом — отрезок и так чистый
    let [a, b] = r;
    for (const pts of arms) {
      const ax = armX(pts, y);
      if (ax == null) continue;
      if (ax < x && ax + half > a) a = Math.max(a, Math.round(ax + half));
      if (ax > x && ax - half < b) b = Math.min(b, Math.round(ax - half));
    }
    return b > a ? [a, b] : null;
  };
}

const ellipse = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
const r05 = (v: number) => Math.round(v * 2) / 2;

export async function scanBody(front: string, side: string | undefined, heightCm: number, gender: Gender, onStep?: (t: string) => void): Promise<BodyScanResult> {
  onStep?.("Загружаю модель позы…");
  const fr = await analyze(front);
  onStep?.("Снимаю мерки с фото анфас…");
  const notes: string[] = [];
  let confidence: BodyScanResult["confidence"] = "high";

  const { top, bottom } = verticalExtent(fr);
  const scale = heightCm / Math.max(1, bottom - top); // см на пиксель
  const lSh = fr.lm[P.lSh];
  const rSh = fr.lm[P.rSh];
  const lHip = fr.lm[P.lHip];
  const rHip = fr.lm[P.rHip];
  const sh = mid(lSh, rSh);
  const hp = mid(lHip, rHip);
  const torso = hp.y - sh.y;
  const cxAt = (y: number) => sh.x + ((hp.x - sh.x) * (y - sh.y)) / torso;

  if (Math.abs(lSh.y - rSh.y) > torso * 0.12) notes.push("Плечи на разной высоте — стойте ровно, лицом к камере.");

  const shoulderPx = dist(lSh, rSh) * 1.13;
  const clip = armClipper(fr, bottom - top);
  const chest = bandExtreme(fr, Math.round(sh.y + torso * 0.18), Math.round(sh.y + torso * 0.38), cxAt, "max", (f, y, x) => clip(f, y, x, shoulderPx * 0.92));
  if (chest.w > shoulderPx * 1.08) {
    notes.push("Руки прижаты к телу — для точной груди и талии разведите руки в стороны на 20–30 см.");
    confidence = "medium";
    chest.w = shoulderPx * 0.9;
  }
  const waist = bandExtreme(fr, Math.round(sh.y + torso * 0.5), Math.round(sh.y + torso * 0.85), cxAt, "min", (f, y, x) => clip(f, y, x, shoulderPx * 0.85));

  // промежность: идём вниз от таза по центру, пока силуэт не разойдётся на две ноги.
  // Если бёдра соприкасаются, просвет начинается ниже — тогда берём анатомическую оценку по коленям.
  const kneeY = (fr.lm[P.lKnee].y + fr.lm[P.rKnee].y) / 2;
  let gapY = Math.round(hp.y);
  for (let y = Math.round(hp.y); y < bottom; y++) {
    if (!fr.mask[y * fr.W + Math.round(cxAt(hp.y))]) {
      gapY = y;
      break;
    }
  }
  const anatY = hp.y + (kneeY - hp.y) * 0.2;
  const crotchY = Math.round(gapY > anatY + (kneeY - hp.y) * 0.06 ? anatY : gapY);
  const hips = bandExtreme(fr, Math.round(hp.y - torso * 0.08), Math.max(Math.round(hp.y - torso * 0.08) + 1, crotchY - 2), cxAt, "max", (f, y, x) => clip(f, y, x, waist.w * 1.5));

  const lKnee = fr.lm[P.lKnee];
  const lAnk = fr.lm[P.lAnk];
  const legX = (y: number) => lHip.x + ((lKnee.x - lHip.x) * (y - lHip.y)) / Math.max(1, lKnee.y - lHip.y);
  // одна нога: если бёдра соприкасаются, делим силуэт по центру
  const legRun = (f: Frame, y: number, x: number): [number, number] | null => {
    const r = clip(f, y, x, shoulderPx * 0.75);
    if (!r) return r;
    const c = cxAt(hp.y);
    const [a, b] = r;
    return x > c ? [Math.max(a, Math.round(c)), b] : [a, Math.min(b, Math.round(c))];
  };
  const thighW = bandExtreme(fr, Math.round(crotchY + (lKnee.y - crotchY) * 0.03), Math.round(crotchY + (lKnee.y - crotchY) * 0.15), legX, "max", legRun).w;
  const calfX = (y: number) => lKnee.x + ((lAnk.x - lKnee.x) * (y - lKnee.y)) / Math.max(1, lAnk.y - lKnee.y);
  const calf = bandExtreme(fr, Math.round(lKnee.y + (lAnk.y - lKnee.y) * 0.15), Math.round(lKnee.y + (lAnk.y - lKnee.y) * 0.55), calfX, "max");
  // шею по фото не меряем — её перекрывают волосы; считаем по пропорции к груди
  const armPx = (dist(lSh, fr.lm[P.lEl]) + dist(fr.lm[P.lEl], fr.lm[P.lWr]) + dist(rSh, fr.lm[P.rEl]) + dist(fr.lm[P.rEl], fr.lm[P.rWr])) / 2;

  // глубины из профиля
  const k = gender === "female" ? { chest: 0.78, waist: 0.74, hips: 0.8 } : { chest: 0.72, waist: 0.76, hips: 0.78 };
  let depth = { chest: chest.w * k.chest * scale, waist: waist.w * k.waist * scale, hips: hips.w * k.hips * scale };
  let footLength: number | undefined;
  let sideOverlay: string | undefined;
  if (side) {
    try {
      onStep?.("Снимаю глубину с фото в профиль…");
      const sf = await analyze(side);
      const se = verticalExtent(sf);
      const sScale = heightCm / Math.max(1, se.bottom - se.top);
      const ssh = mid(sf.lm[P.lSh], sf.lm[P.rSh]);
      const shp = mid(sf.lm[P.lHip], sf.lm[P.rHip]);
      const st = shp.y - ssh.y;
      const sxAt = (y: number) => ssh.x + ((shp.x - ssh.x) * (y - ssh.y)) / st;
      const rel = (y: number) => (y - sh.y) / torso; // та же относительная высота, что и на фото анфас
      const at = (r: number) => ssh.y + st * r;
      const dChest = bandExtreme(sf, Math.round(at(rel(chest.y) - 0.06)), Math.round(at(rel(chest.y) + 0.06)), sxAt, "max").w * sScale;
      const dWaist = width(run(sf, at(rel(waist.y)), sxAt(at(rel(waist.y))))) * sScale;
      const dHips = bandExtreme(sf, Math.round(at(rel(hips.y) - 0.05)), Math.round(at(rel(hips.y) + 0.05)), sxAt, "max").w * sScale;
      const sane = (d: number, w: number, lo: number, hi: number) => d > w * lo && d < w * hi;
      const fallback: string[] = [];
      const pick = (name: string, d: number, w: number, lo: number, hi: number, def: number) => (sane(d, w, lo, hi) ? d : (fallback.push(name), def));
      depth = {
        chest: pick("грудь", dChest, chest.w * scale, 0.55, 1.0, depth.chest),
        waist: pick("талия", dWaist, waist.w * scale, 0.5, 0.95, depth.waist),
        hips: pick("бёдра", dHips, hips.w * scale, 0.55, 1.0, depth.hips),
      };
      if (fallback.length) notes.push(`По фото в профиль не удалось надёжно снять глубину (${fallback.join(", ")}) — использованы типичные пропорции. Встаньте строго боком.`);
      const feet = [
        dist(sf.lm[P.lHeel], sf.lm[P.lFoot]),
        dist(sf.lm[P.rHeel], sf.lm[P.rFoot]),
      ];
      footLength = Math.max(...feet) * sScale * 1.2; // пятка и носок у MediaPipe — не крайние точки стопы
      sideOverlay = drawOverlay(sf, [
        { y: at(rel(chest.y)), x: sxAt(at(rel(chest.y))), label: "грудь" },
        { y: at(rel(waist.y)), x: sxAt(at(rel(waist.y))), label: "талия" },
        { y: at(rel(hips.y)), x: sxAt(at(rel(hips.y))), label: "бёдра" },
      ]);
    } catch (e) {
      notes.push(`Фото в профиль не распознано (${e instanceof Error ? e.message : e}) — глубина оценена по типичным пропорциям.`);
      confidence = confidence === "high" ? "medium" : confidence;
    }
  } else {
    notes.push("Без фото в профиль обхваты оценены по типичным пропорциям — добавьте его для точности.");
    confidence = confidence === "high" ? "medium" : confidence;
  }

  const clothes = 0.97; // поправка на облегающую одежду
  const measurements: Partial<BodyMeasurements> = {
    shoulders: r05(shoulderPx * scale),
    chest: r05(ellipse((chest.w * scale) / 2, depth.chest / 2) * clothes),
    waist: r05(ellipse((waist.w * scale) / 2, depth.waist / 2) * clothes),
    hips: r05(ellipse((hips.w * scale) / 2, depth.hips / 2) * clothes),
    inseam: r05((bottom - crotchY) * scale),
    thigh: thighW ? r05(Math.PI * thighW * scale * 0.98) : undefined,
    calf: calf.w ? r05(Math.PI * calf.w * scale * 0.95) : undefined,
    neck: undefined,
    armLength: r05(armPx * scale * 1.04),
    footLength: footLength ? r05(footLength) : undefined,
  };
  if (gender === "female" && measurements.chest) measurements.underbust = r05(measurements.chest * 0.85);
  if (measurements.chest) measurements.neck = r05(measurements.chest * (gender === "female" ? 0.375 : 0.39));

  // проверка позы
  const lWr = fr.lm[P.lWr];
  const rWr = fr.lm[P.rWr];
  if (Math.min(lWr.y, rWr.y) < sh.y + torso * 0.35) {
    notes.push("Руки подняты слишком высоко — опустите их вниз и разведите на 20–30 см от тела. Шея и грудь по этому фото не измерены.");
    confidence = "low";
    delete measurements.neck;
  }
  const stance = Math.abs(fr.lm[P.lAnk].x - fr.lm[P.rAnk].x) / Math.max(1, dist(lHip, rHip));
  if (stance > 2.2) {
    notes.push("Ноги расставлены слишком широко — встаньте, ноги на ширине плеч. Обхваты ног и длина ноги пропущены.");
    confidence = "low";
    delete measurements.calf;
    delete measurements.thigh;
    delete measurements.inseam;
  }

  // проверка правдоподобия: диапазоны в см (рост учитываем для длин)
  const H = heightCm;
  const range: Partial<Record<keyof BodyMeasurements, [number, number]>> = {
    shoulders: [28, 58],
    chest: [65, 160],
    underbust: [55, 140],
    waist: [48, 150],
    hips: [70, 165],
    inseam: [H * 0.38, H * 0.53],
    thigh: [35, 85],
    calf: [24, 55],
    neck: [25, 52],
    armLength: [H * 0.27, H * 0.42],
    footLength: [H * 0.12, H * 0.18],
  };
  const dropped: string[] = [];
  for (const [key, v] of Object.entries(measurements) as [keyof BodyMeasurements, number | undefined][]) {
    const r = range[key];
    if (v == null || !r) continue;
    if (v < r[0] || v > r[1]) {
      dropped.push(key);
      delete measurements[key];
    }
  }
  if (dropped.length) {
    notes.push(`Не удалось надёжно измерить: ${dropped.length} мерк${dropped.length === 1 ? "у" : "и"} — оставлены прежние значения. Проверьте позу и освещение.`);
    if (confidence === "high") confidence = "medium";
  }

  const overlays = {
    front: drawOverlay(fr, [
      { y: chest.y, x: cxAt(chest.y), label: "грудь" },
      { y: waist.y, x: cxAt(waist.y), label: "талия" },
      { y: hips.y, x: cxAt(hips.y), label: "бёдра" },
      { y: crotchY + (lKnee.y - crotchY) * 0.1, x: legX(crotchY + (lKnee.y - crotchY) * 0.1), label: "бедро" },
    ]),
    side: sideOverlay,
  };
  return { measurements, confidence, notes, overlays };
}

function drawOverlay(fr: Frame, lines: { y: number; x: number; label: string }[]): string {
  const k = Math.min(1, 720 / Math.max(fr.W, fr.H));
  const c = document.createElement("canvas");
  c.width = Math.round(fr.W * k);
  c.height = Math.round(fr.H * k);
  const g = c.getContext("2d")!;
  g.drawImage(fr.img, 0, 0, c.width, c.height);
  // силуэт
  const tint = document.createElement("canvas");
  tint.width = fr.W;
  tint.height = fr.H;
  const tg = tint.getContext("2d")!;
  const id = tg.createImageData(fr.W, fr.H);
  for (let i = 0; i < fr.mask.length; i++) if (fr.mask[i]) ((id.data[i * 4] = 199), (id.data[i * 4 + 1] = 166), (id.data[i * 4 + 2] = 255), (id.data[i * 4 + 3] = 70));
  tg.putImageData(id, 0, 0);
  g.drawImage(tint, 0, 0, c.width, c.height);
  g.lineWidth = 3;
  g.font = "bold 16px Manrope, sans-serif";
  for (const l of lines) {
    const r = run(fr, l.y, l.x);
    if (!r) continue;
    g.strokeStyle = "#f3b7c9";
    g.beginPath();
    g.moveTo(r[0] * k, l.y * k);
    g.lineTo(r[1] * k, l.y * k);
    g.stroke();
    g.fillStyle = "#fff";
    g.fillText(l.label, r[1] * k + 6, l.y * k + 5);
  }
  return c.toDataURL("image/jpeg", 0.85);
}
