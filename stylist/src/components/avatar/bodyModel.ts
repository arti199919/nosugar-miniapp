// Параметрическая модель тела: из мерок (см) строим сечения туловища, ног и рук.
// Все размеры в метрах, ось Y вверх, стопы на y=0.
import type { BodyMeasurements, Gender } from "@shared/types";

export interface Section {
  y: number;
  a: number; // полуширина (по X)
  bf: number; // глубина вперёд (по +Z)
  bb: number; // глубина назад (по -Z)
  cz?: number; // смещение центра по Z
}

export interface BodyModel {
  H: number;
  gender: Gender;
  levels: {
    crown: number;
    chin: number;
    neckBase: number;
    shoulder: number;
    chest: number;
    underbust: number;
    waist: number;
    hip: number;
    crotch: number;
    thighMid: number;
    knee: number;
    calf: number;
    midCalf: number;
    ankle: number;
  };
  torso: Section[]; // снизу вверх: от промежности до шеи
  legX: number; // центр ноги по X
  leg: { y: number; r: number }[]; // снизу вверх: от щиколотки до верха бедра
  shoulderX: number;
  arm: { len: number; angle: number; r: { t: number; r: number }[] };
  head: { cy: number; rx: number; ry: number; rz: number };
  neck: { r: number; y0: number; y1: number };
  foot: { len: number; width: number; height: number };
}

/** Полуось эллипса по обхвату и соотношению глубина/ширина. */
function halfWidth(circ: number, k: number) {
  return circ / (2 * Math.PI * Math.sqrt((1 + k * k) / 2));
}

export function buildBody(b: BodyMeasurements, gender: Gender): BodyModel {
  const cm = (v: number) => v / 100;
  const H = cm(b.height);
  const female = gender === "female";
  const inseam = cm(b.inseam || b.height * 0.46);
  const L = {
    crown: H,
    chin: H * 0.868,
    neckBase: H * 0.835,
    shoulder: H * 0.815,
    chest: H * 0.725,
    underbust: H * 0.69,
    waist: H * (female ? 0.625 : 0.605),
    hip: H * 0.515,
    crotch: inseam,
    thighMid: inseam - (inseam - H * 0.285) * 0.45,
    knee: H * 0.285,
    calf: H * 0.2,
    midCalf: H * 0.15,
    ankle: H * 0.045,
  };

  const chestA = halfWidth(cm(b.chest), female ? 0.78 : 0.72);
  const underA = halfWidth(cm(b.underbust ?? b.chest * (female ? 0.85 : 0.94)), 0.72);
  const waistA = halfWidth(cm(b.waist), 0.74);
  const hipA = halfWidth(cm(b.hips), 0.72);
  const shoulderHalf = cm(b.shoulders) / 2;
  const neckR = cm(b.neck) / (2 * Math.PI);

  // Грудь у женщин — дополнительная глубина спереди
  const bustExtra = female ? Math.max(0.01, (cm(b.chest) - cm(b.underbust ?? b.chest * 0.85)) * 0.32) : 0.006;

  const torso: Section[] = [
    { y: L.crotch - 0.01, a: hipA * 0.86, bf: hipA * 0.62, bb: hipA * 0.66 },
    { y: L.crotch + (L.hip - L.crotch) * 0.5, a: hipA * 0.97, bf: hipA * 0.68, bb: hipA * 0.78 },
    { y: L.hip, a: hipA, bf: hipA * 0.66, bb: hipA * 0.8 },
    { y: L.hip + (L.waist - L.hip) * 0.5, a: (hipA + waistA) / 2, bf: waistA * 0.74, bb: waistA * 0.74 },
    { y: L.waist, a: waistA, bf: waistA * 0.72, bb: waistA * 0.68 },
    { y: L.underbust, a: underA, bf: underA * 0.7, bb: underA * 0.68 },
    { y: L.chest, a: chestA * 0.98, bf: chestA * 0.62 + bustExtra, bb: chestA * 0.6 },
    { y: L.chest + (L.shoulder - L.chest) * 0.55, a: Math.max(chestA, shoulderHalf * 0.86), bf: chestA * 0.55, bb: chestA * 0.58 },
    { y: L.shoulder - 0.012, a: shoulderHalf * 0.93, bf: chestA * 0.42, bb: chestA * 0.46 },
    { y: L.shoulder + 0.012, a: shoulderHalf * 0.62, bf: neckR * 1.5, bb: neckR * 1.6 },
    { y: L.neckBase, a: neckR * 1.25, bf: neckR * 1.15, bb: neckR * 1.2 },
  ];

  const thighR = cm(b.thigh) / (2 * Math.PI);
  const calfR = cm(b.calf) / (2 * Math.PI);
  const kneeR = (thighR * 0.62 + calfR) / 2;
  const ankleR = calfR * 0.58;
  const legX = Math.max(hipA * 0.48, thighR * 0.98);
  const leg = [
    { y: 0.012, r: ankleR * 1.05 },
    { y: L.ankle, r: ankleR },
    { y: L.midCalf, r: calfR * 0.82 },
    { y: L.calf, r: calfR },
    { y: L.knee - 0.02, r: kneeR },
    { y: L.knee + 0.04, r: kneeR * 1.05 },
    { y: L.thighMid, r: thighR * 0.86 },
    { y: L.crotch - 0.02, r: thighR },
    { y: L.crotch + 0.04, r: thighR * 1.02 },
  ];

  const armLen = cm(b.armLength || b.height * 0.34);
  const upperR = Math.max(0.035, thighR * 0.52);
  return {
    H,
    gender,
    levels: L,
    torso,
    legX,
    leg,
    shoulderX: shoulderHalf * 0.9,
    arm: {
      len: armLen,
      angle: 0.17,
      r: [
        { t: 0, r: upperR * 1.08 },
        { t: 0.18, r: upperR },
        { t: 0.45, r: upperR * 0.78 },
        { t: 0.55, r: upperR * 0.72 },
        { t: 0.75, r: upperR * 0.66 },
        { t: 1, r: upperR * 0.5 },
      ],
    },
    head: { cy: L.chin + (H - L.chin) * 0.52, rx: H * 0.052, ry: H * 0.07, rz: H * 0.06 },
    neck: { r: neckR, y0: L.shoulder - 0.02, y1: L.chin + 0.01 },
    foot: { len: cm(b.footLength || 25), width: cm(b.footLength || 25) * 0.38, height: 0.06 },
  };
}

/** Интерполяция сечения туловища на высоте y (сглаженно). */
export function torsoAt(body: BodyModel, y: number): Section {
  const t = body.torso;
  if (y <= t[0].y) return t[0];
  if (y >= t[t.length - 1].y) return t[t.length - 1];
  let i = 0;
  while (i < t.length - 2 && t[i + 1].y < y) i++;
  const p0 = t[Math.max(0, i - 1)];
  const p1 = t[i];
  const p2 = t[i + 1];
  const p3 = t[Math.min(t.length - 1, i + 2)];
  const u = (y - p1.y) / (p2.y - p1.y);
  const cr = (k: keyof Omit<Section, "y" | "cz">) => catmull(p0[k], p1[k], p2[k], p3[k], u);
  return { y, a: cr("a"), bf: cr("bf"), bb: cr("bb") };
}

export function legAt(body: BodyModel, y: number): number {
  const l = body.leg;
  if (y <= l[0].y) return l[0].r;
  if (y >= l[l.length - 1].y) return l[l.length - 1].r;
  let i = 0;
  while (i < l.length - 2 && l[i + 1].y < y) i++;
  const u = (y - l[i].y) / (l[i + 1].y - l[i].y);
  return catmull(l[Math.max(0, i - 1)].r, l[i].r, l[i + 1].r, l[Math.min(l.length - 1, i + 2)].r, u);
}

export function armRadiusAt(body: BodyModel, t: number): number {
  const r = body.arm.r;
  let i = 0;
  while (i < r.length - 2 && r[i + 1].t < t) i++;
  const u = Math.min(1, Math.max(0, (t - r[i].t) / (r[i + 1].t - r[i].t)));
  return r[i].r + (r[i + 1].r - r[i].r) * (u * u * (3 - 2 * u));
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
