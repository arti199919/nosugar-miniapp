// Скан лица по селфи: 3D-сетка лица (478 точек MediaPipe) с текстурой из фото + цвета кожи, волос, глаз, губ.
import Delaunator from "delaunator";
import { rgbToHex } from "@shared/color";
import { getFaceLandmarker } from "./vision";
import { loadImage } from "./image";

export interface FaceScan {
  texture: string; // вырезанное лицо, JPEG
  points: number[]; // xyz, единица = ширина лица (от скулы до скулы), центр — между ушами
  uvs: number[];
  indices: number[];
  alpha: number[]; // прозрачность у края лица для мягкого перехода
  colors: { skin: string; hair: string; eyes: string; lips: string };
  warnings: string[];
  createdAt: number;
}

const L = { rightCheek: 234, leftCheek: 454, rightEyeOuter: 33, leftEyeOuter: 263, nose: 1, forehead: 10, chin: 152, rightIris: 468, leftIris: 473 };

export async function scanFace(photo: string): Promise<FaceScan> {
  const img = await loadImage(photo);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const landmarker = await getFaceLandmarker();
  const res = landmarker.detect(img);
  const lm = res.faceLandmarks[0];
  if (!lm) throw new Error("Лицо не найдено. Нужно фронтальное селфи при хорошем свете, лицо целиком в кадре.");

  const px = lm.map((p) => ({ x: p.x * W, y: p.y * H, z: p.z * W }));
  const warnings: string[] = [];

  // поворот головы в плоскости кадра (наклон) — выравниваем по глазам
  const eR = px[L.rightEyeOuter];
  const eL = px[L.leftEyeOuter];
  const roll = Math.atan2(eL.y - eR.y, eL.x - eR.x);
  const cR = px[L.rightCheek];
  const cL = px[L.leftCheek];
  const cx = (cR.x + cL.x) / 2;
  const cy = (cR.y + cL.y) / 2;
  const cz = (cR.z + cL.z) / 2;
  const faceW = Math.hypot(cL.x - cR.x, cL.y - cR.y);
  const cos = Math.cos(-roll);
  const sin = Math.sin(-roll);
  const norm = px.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: (dx * cos - dy * sin) / faceW, y: -(dx * sin + dy * cos) / faceW, z: -(p.z - cz) / faceW };
  });
  if (Math.abs(norm[L.nose].x) > 0.07) warnings.push("Голова повёрнута — для точной копии сделайте селфи строго анфас.");
  if (Math.abs(roll) > 0.15) warnings.push("Наклон головы выровнен автоматически.");
  if (faceW < 180) warnings.push("Лицо мелковато в кадре — поднесите камеру ближе для детальной текстуры.");

  // текстура: кадрируем лицо с запасом
  const xs = px.map((p) => p.x);
  const ys = px.map((p) => p.y);
  const pad = faceW * 0.12;
  const bx = Math.max(0, Math.min(...xs) - pad);
  const by = Math.max(0, Math.min(...ys) - pad);
  const bw = Math.min(W, Math.max(...xs) + pad) - bx;
  const bh = Math.min(H, Math.max(...ys) + pad) - by;
  const k = Math.min(1, 1024 / Math.max(bw, bh));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bw * k);
  cv.height = Math.round(bh * k);
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, bx, by, bw, bh, 0, 0, cv.width, cv.height);
  const texture = cv.toDataURL("image/jpeg", 0.9);

  // триангуляция по 468 точкам сетки (без зрачков)
  const mesh = px.slice(0, 468);
  const del = Delaunator.from(mesh.map((p) => [p.x, p.y]));
  const tri = Array.from(del.triangles);
  // уберём вытянутые треугольники по краю
  const maxEdge = faceW * 0.16;
  const indices: number[] = [];
  for (let t = 0; t < tri.length; t += 3) {
    const [a, b, c2] = [tri[t], tri[t + 1], tri[t + 2]];
    const e = (i: number, j: number) => Math.hypot(mesh[i].x - mesh[j].x, mesh[i].y - mesh[j].y);
    if (Math.max(e(a, b), e(b, c2), e(a, c2)) > maxEdge) continue;
    // ориентация против часовой стрелки при взгляде спереди (y вверх)
    indices.push(a, c2, b);
  }

  // мягкий край: расстояние (в рёбрах) от контура
  const hull = new Set(Array.from(del.hull));
  const neighbors = new Map<number, Set<number>>();
  for (let t = 0; t < indices.length; t += 3)
    for (const [i, j] of [
      [indices[t], indices[t + 1]],
      [indices[t + 1], indices[t + 2]],
      [indices[t], indices[t + 2]],
    ]) {
      if (!neighbors.has(i)) neighbors.set(i, new Set());
      if (!neighbors.has(j)) neighbors.set(j, new Set());
      neighbors.get(i)!.add(j);
      neighbors.get(j)!.add(i);
    }
  const dist = new Array(mesh.length).fill(99);
  const queue = [...hull];
  hull.forEach((h) => (dist[h] = 0));
  while (queue.length) {
    const v = queue.shift()!;
    for (const n of neighbors.get(v) ?? []) if (dist[n] > dist[v] + 1) ((dist[n] = dist[v] + 1), queue.push(n));
  }
  const alpha = dist.map((d) => (d === 0 ? 0 : d === 1 ? 0.55 : d === 2 ? 0.9 : 1));

  const points: number[] = [];
  const uvs: number[] = [];
  mesh.forEach((p, i) => {
    points.push(norm[i].x, norm[i].y, norm[i].z);
    uvs.push((p.x - bx) / bw, 1 - (p.y - by) / bh);
  });

  // цвета
  const full = document.createElement("canvas");
  full.width = W;
  full.height = H;
  const fg = full.getContext("2d", { willReadFrequently: true })!;
  fg.drawImage(img, 0, 0);
  const patch = (x: number, y: number, r: number, trim = 0.2) => samplePatch(fg, x, y, r, W, H, trim);
  const skin = median([patch(px[50].x, px[50].y, faceW * 0.05), patch(px[280].x, px[280].y, faceW * 0.05), patch(px[151].x, px[151].y, faceW * 0.04)]);
  const lips = median([patch(px[0].x, px[0].y + faceW * 0.015, faceW * 0.02), patch(px[17].x, px[17].y - faceW * 0.02, faceW * 0.02)]);
  const irisR = lm.length > 473 ? Math.hypot(px[469].x - px[468].x, px[469].y - px[468].y) : faceW * 0.03;
  const eyes =
    lm.length > 473
      ? median([ringSample(fg, px[L.rightIris].x, px[L.rightIris].y, irisR, W, H), ringSample(fg, px[L.leftIris].x, px[L.leftIris].y, irisR, W, H)])
      : "#5b5046";
  const faceH = Math.hypot(px[L.chin].x - px[L.forehead].x, px[L.chin].y - px[L.forehead].y);
  const hairPts = [
    [px[L.forehead].x, px[L.forehead].y - faceH * 0.2],
    [cR.x - faceW * 0.1, cR.y - faceH * 0.25],
    [cL.x + faceW * 0.1, cL.y - faceH * 0.25],
  ];
  const hair = median(hairPts.filter(([, y]) => y > 0).map(([x, y]) => patch(x, y, faceW * 0.05, 0.3)));

  return { texture, points, uvs, indices, alpha, colors: { skin, hair: hair || "#4a3426", eyes, lips }, warnings, createdAt: Date.now() };
}

function samplePatch(g: CanvasRenderingContext2D, x: number, y: number, r: number, W: number, H: number, trim: number): string {
  const x0 = Math.max(0, Math.round(x - r));
  const y0 = Math.max(0, Math.round(y - r));
  const w = Math.max(1, Math.min(W - x0, Math.round(r * 2)));
  const h = Math.max(1, Math.min(H - y0, Math.round(r * 2)));
  const d = g.getImageData(x0, y0, w, h).data;
  const px: [number, number, number][] = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  return trimmedMean(px, trim);
}

function ringSample(g: CanvasRenderingContext2D, x: number, y: number, r: number, W: number, H: number): string {
  const x0 = Math.max(0, Math.round(x - r));
  const y0 = Math.max(0, Math.round(y - r));
  const s = Math.max(2, Math.round(r * 2));
  const d = g.getImageData(x0, y0, Math.min(s, W - x0), Math.min(s, H - y0));
  const px: [number, number, number][] = [];
  for (let yy = 0; yy < d.height; yy++)
    for (let xx = 0; xx < d.width; xx++) {
      const dd = Math.hypot(x0 + xx - x, y0 + yy - y) / r;
      if (dd < 0.45 || dd > 0.95) continue; // без зрачка и белка
      const i = (yy * d.width + xx) * 4;
      px.push([d.data[i], d.data[i + 1], d.data[i + 2]]);
    }
  return trimmedMean(px, 0.3);
}

function trimmedMean(px: [number, number, number][], trim: number): string {
  if (!px.length) return "#808080";
  const lum = (p: [number, number, number]) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const sorted = [...px].sort((a, b) => lum(a) - lum(b));
  const cut = Math.floor(sorted.length * trim);
  const kept = sorted.slice(cut, sorted.length - cut || undefined);
  const avg = [0, 1, 2].map((ch) => kept.reduce((a, p) => a + p[ch], 0) / kept.length);
  return rgbToHex(avg[0], avg[1], avg[2]);
}

function median(hexes: string[]): string {
  if (!hexes.length) return "";
  if (hexes.length < 3) return hexes[0];
  const rgb = hexes.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const med = [0, 1, 2].map((ch) => rgb.map((c) => c[ch]).sort((a, b) => a - b)[rgb.length >> 1]);
  return rgbToHex(med[0], med[1], med[2]);
}
