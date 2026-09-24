import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BodyModel } from "./bodyModel";
import { armRadiusAt, legAt, torsoAt } from "./bodyModel";

export interface Sec {
  a: number;
  bf: number;
  bb: number;
  cx?: number;
  cz?: number;
}

/**
 * Протягивание эллиптического сечения вдоль Y.
 * gap(y) — половина угла выреза спереди (для расстёгнутых жакетов, V-выреза).
 */
export function sweepY(
  y0: number,
  y1: number,
  rows: number,
  sec: (y: number) => Sec,
  opts: { seg?: number; gap?: (y: number) => number; vScale?: number; theta0?: number; thetaLen?: number } = {},
): THREE.BufferGeometry {
  const seg = opts.seg ?? 56;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows;
    const s = sec(y);
    const g = opts.gap ? opts.gap(y) : 0;
    const th0 = opts.theta0 ?? g;
    const thL = opts.thetaLen ?? Math.PI * 2 - 2 * g;
    for (let c = 0; c <= seg; c++) {
      const th = th0 + (thL * c) / seg;
      const sn = Math.sin(th);
      const cs = Math.cos(th);
      pos.push((s.cx ?? 0) + s.a * sn, y, (s.cz ?? 0) + (cs >= 0 ? s.bf : s.bb) * cs);
      uv.push(c / seg, y * (opts.vScale ?? 3));
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < seg; c++) {
      const a = r * (seg + 1) + c;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Труба вдоль отрезка (руки, рукава). */
export function sweepLine(
  start: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  t0: number,
  t1: number,
  radius: (t: number) => number,
  rows = 16,
  seg = 28,
): THREE.BufferGeometry {
  const zAxis = new THREE.Vector3(0, 0, 1);
  const b1 = new THREE.Vector3().crossVectors(dir, zAxis).normalize();
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = t0 + ((t1 - t0) * r) / rows;
    const c0 = start.clone().addScaledVector(dir, t * len);
    const rad = radius(t);
    for (let c = 0; c <= seg; c++) {
      const ph = (c / seg) * Math.PI * 2;
      const p = c0.clone().addScaledVector(b1, Math.cos(ph) * rad).addScaledVector(zAxis, Math.sin(ph) * rad);
      pos.push(p.x, p.y, p.z);
      uv.push(c / seg, t * len * 3);
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < seg; c++) {
      const a = r * (seg + 1) + c;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Колодка стопы/обуви вдоль Z. */
export function footLast(opts: {
  len: number;
  width: number;
  height: number;
  x: number;
  heelLift?: number; // подъём пятки (каблук), м
  toePoint?: number; // 0 — круглый нос, 1 — острый
  sole?: number;
  rows?: number;
  seg?: number;
}): THREE.BufferGeometry {
  const { len, width, height, x } = opts;
  const rows = opts.rows ?? 22;
  const seg = opts.seg ?? 28;
  const z0 = -len * 0.2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const u = r / rows; // 0 пятка → 1 носок
    const z = z0 + u * len;
    // ширина: пятка уже, плюсна шире, носок сужается
    let w = width * (0.62 + 0.38 * Math.sin(Math.min(1, u * 1.35) * Math.PI * 0.5));
    if (u > 0.72) w *= 1 - ((u - 0.72) / 0.28) ** (opts.toePoint ? 1.2 : 2.2) * (opts.toePoint ? 0.92 : 0.7);
    if (u < 0.08) w *= 0.75 + u * 3;
    let h = height * (u < 0.55 ? 1 - u * 0.25 : 0.86 - (u - 0.55) * 1.35);
    h = Math.max(height * 0.2, h);
    if (u < 0.06) h *= 0.8 + u * 3.3;
    const lift = opts.heelLift ? opts.heelLift * Math.max(0, 1 - u / 0.68) : 0;
    const sole = opts.sole ?? 0;
    for (let c = 0; c <= seg; c++) {
      const th = (c / seg) * Math.PI * 2;
      const sx = Math.cos(th) * w * 0.5;
      const sy = Math.sin(th);
      const yy = sy >= 0 ? sy * h : sy * sole * 0.5;
      pos.push(x + sx, yy + lift + sole * 0.5, z);
      uv.push(c / seg, u * 2);
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < seg; c++) {
      const a = r * (seg + 1) + c;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // закрываем торцы шапками
  return merge([geo, endCap(pos, 0, seg), endCap(pos, rows * (seg + 1), seg)]);
}

function endCap(pos: number[], start: number, seg: number): THREE.BufferGeometry {
  let cx = 0,
    cy = 0,
    cz = 0;
  for (let c = 0; c <= seg; c++) {
    cx += pos[(start + c) * 3];
    cy += pos[(start + c) * 3 + 1];
    cz += pos[(start + c) * 3 + 2];
  }
  cx /= seg + 1;
  cy /= seg + 1;
  cz /= seg + 1;
  const p: number[] = [];
  const uv: number[] = [];
  for (let c = 0; c < seg; c++) {
    const i = (start + c) * 3;
    const j = (start + c + 1) * 3;
    p.push(cx, cy, cz, pos[i], pos[i + 1], pos[i + 2], pos[j], pos[j + 1], pos[j + 2]);
    uv.push(0.5, 0.5, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ---------- сечения тела с «надувом» ----------

export function torsoSec(body: BodyModel, infl: number): (y: number) => Sec {
  return (y) => {
    const s = torsoAt(body, y);
    return { a: s.a + infl, bf: s.bf + infl, bb: s.bb + infl };
  };
}

/** Сечение, охватывающее обе ноги (юбки, пальто, платья ниже промежности). */
export function enclosingSec(body: BodyModel, infl: number, flare: number, yTop: number): (y: number) => Sec {
  const top = torsoAt(body, body.levels.crotch + 0.02);
  return (y) => {
    if (y >= body.levels.crotch + 0.02) {
      const s = torsoAt(body, y);
      return { a: s.a + infl, bf: s.bf + infl, bb: s.bb + infl };
    }
    const d = Math.max(0, Math.min(yTop, body.levels.crotch) - y);
    const lr = legAt(body, Math.max(y, body.levels.knee));
    const a = Math.max(top.a, body.legX + lr) + infl + d * flare;
    const b = Math.max(top.bf, lr) + infl + d * flare * 0.8;
    return { a, bf: b, bb: Math.max(top.bb, lr) + infl + d * flare * 0.8 };
  };
}

export function armFrame(body: BodyModel, side: 1 | -1) {
  const start = new THREE.Vector3(side * body.shoulderX, body.levels.shoulder - 0.045, -0.005);
  const dir = new THREE.Vector3(side * Math.sin(body.arm.angle), -Math.cos(body.arm.angle), 0).normalize();
  return { start, dir };
}

export function armGeometry(body: BodyModel, side: 1 | -1, t0: number, t1: number, infl: number, looseness = 0): THREE.BufferGeometry {
  const { start, dir } = armFrame(body, side);
  return sweepLine(start, dir, body.arm.len, t0, t1, (t) => armRadiusAt(body, t) + infl + looseness * t, 18, 28);
}

/** «Плечевая шапочка» рукава — закрывает стык руки и туловища. */
export function shoulderCap(body: BodyModel, side: 1 | -1, infl: number): THREE.BufferGeometry {
  const { start } = armFrame(body, side);
  const r = body.arm.r[0].r * 1.12 + infl;
  return ellipsoid(r * 1.05, r, r * 1.02, [start.x - side * 0.004, start.y + 0.008, start.z], 24, Math.PI);
}

/** Закрывает промежность у брюк/колготок. */
export function crotchCap(body: BodyModel, infl: number): THREE.BufferGeometry {
  const s = body.torso[0];
  return ellipsoid(s.a + infl, 0.05, (s.bf + s.bb) / 2 + infl, [0, body.levels.crotch - 0.012, -0.01], 24, Math.PI);
}

export function legGeometry(body: BodyModel, side: 1 | -1, y0: number, y1: number, infl: number, widen = 0): THREE.BufferGeometry {
  const knee = body.levels.knee;
  return sweepY(
    y0,
    y1,
    30,
    (y) => {
      const r = legAt(body, y) + infl + (y < knee ? (knee - y) * widen : 0);
      return { a: r, bf: r, bb: r, cx: side * body.legX };
    },
    { seg: 32 },
  );
}

/** Слияние индексированных частей с сохранением сглаженных нормалей каждой части. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    return g;
  });
  return mergeGeometries(prepared) ?? prepared[0];
}

export function ellipsoid(rx: number, ry: number, rz: number, pos: [number, number, number], seg = 32, thetaLen = Math.PI) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75), 0, Math.PI * 2, 0, thetaLen);
  g.scale(rx, ry, rz);
  g.translate(...pos);
  return g;
}
