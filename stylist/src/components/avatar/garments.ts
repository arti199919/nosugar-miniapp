// Построение 3D-одежды на параметрическом теле по карточкам вещей.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { inferShape, slotOf } from "@shared/catalog";
import type { Slot } from "@shared/catalog";
import type { GarmentLength, Pattern, WardrobeItem } from "@shared/types";
import type { BodyModel } from "./bodyModel";
import { torsoAt } from "./bodyModel";
import { armFrame, armGeometry, crotchCap, ellipsoid, enclosingSec, footLast, legGeometry, merge, shoulderCap, sweepY, torsoSec } from "./geometry";

export interface MeshSpec {
  key: string;
  geometry: THREE.BufferGeometry;
  colors: string[];
  pattern: Pattern;
  material?: string;
  opacity?: number;
  metal?: boolean;
  flatColor?: string; // однотонная деталь (подошва, фурнитура)
}

export interface OutfitBuild {
  meshes: MeshSpec[];
  hideFeet: boolean;
  hatType?: string;
  gloves?: string;
}

const hemFor = (body: BodyModel, len: GarmentLength | undefined, fallback: GarmentLength): number => {
  const L = body.levels;
  switch (len ?? fallback) {
    case "crop":
      return L.waist + 0.05;
    case "waist":
      return L.waist - 0.015;
    case "hip":
      return L.hip - 0.045;
    case "thigh":
      return L.crotch - 0.11;
    case "knee":
      return L.knee + 0.02;
    case "midi":
      return L.midCalf + 0.02;
    case "maxi":
      return L.ankle + 0.035;
    case "ankle":
      return L.ankle + 0.012;
  }
};

const sleeveEnd = { none: 0, short: 0.3, three_quarter: 0.64, long: 0.97 } as const;

const fitInfl = (fit?: string) => (fit === "oversize" ? 0.014 : fit === "slim" ? -0.003 : fit === "wide" ? 0.01 : 0);

export function buildOutfit(body: BodyModel, items: WardrobeItem[]): OutfitBuild {
  const L = body.levels;
  const bySlot = new Map<Slot, WardrobeItem>();
  for (const it of items) bySlot.set(slotOf(it.category), it);
  const meshes: MeshSpec[] = [];
  let hideFeet = false;
  let hatType: string | undefined;
  let gloves: string | undefined;

  const top = bySlot.get("top");
  const mid = bySlot.get("mid");
  const bottom = bySlot.get("bottom");
  const onepiece = bySlot.get("onepiece");
  const tucked = !!top && !!bottom && bottom.category !== "skirts" && (top.category === "shirts" || top.formality >= 3);
  const bottomInfl = tucked ? 0.012 : 0.006;
  const add = (it: WardrobeItem, key: string, geometry: THREE.BufferGeometry, extra: Partial<MeshSpec> = {}) =>
    meshes.push({ key: `${it.id}:${key}`, geometry, colors: it.colors, pattern: it.pattern, material: it.material, ...extra });

  // --- колготки / носки
  const hos = bySlot.get("hosiery");
  if (hos) {
    const s = (hos.subtype ?? "").toLowerCase();
    const yTop = /носк/.test(s) ? L.ankle + 0.07 : /гольф/.test(s) ? L.knee - 0.03 : L.crotch + 0.03;
    const sheer = !/носк|гольф/.test(s);
    for (const side of [1, -1] as const) add(hos, `leg${side}`, legGeometry(body, side, 0.01, yTop, 0.0015), { opacity: sheer ? 0.72 : 1 });
    if (sheer) add(hos, "pelvis", merge([sweepY(L.crotch - 0.03, L.hip, 8, torsoSec(body, 0.0015)), crotchCap(body, 0.0015)]), { opacity: 0.72 });
  }

  // --- низ
  const buildBottom = (it: WardrobeItem, infl: number) => {
    const shape = inferShape(it.category, it.subtype, it.shape);
    const s = (it.subtype ?? "").toLowerCase();
    const i = infl + fitInfl(shape.fit) * 0.5;
    if (it.category === "skirts") {
      const hem = hemFor(body, shape.length, "knee");
      const flare = /карандаш/.test(s) ? 0.015 : /плисс|солнц|а-сил/.test(s) ? 0.22 : shape.length === "maxi" ? 0.14 : 0.1;
      add(it, "skirt", sweepY(hem, L.waist + 0.02, 42, enclosingSec(body, i + 0.004, flare, L.hip)));
      return;
    }
    const hem = it.category === "shorts" ? hemFor(body, shape.length === "knee" ? "knee" : "thigh", "thigh") + 0.03 : hemFor(body, shape.length, "ankle");
    const widen = shape.fit === "wide" || /палаццо|широк|клёш|клеш/.test(s) ? 0.2 : shape.fit === "slim" || /скинни|леггин/.test(s) ? 0 : 0.035;
    const pelvis = sweepY(L.crotch - 0.03, L.waist + 0.02, 18, torsoSec(body, i));
    const legs = ([1, -1] as const).map((side) => legGeometry(body, side, hem, L.crotch + 0.035, i + (widen > 0.1 ? 0.01 : 0.004), widen));
    add(it, "bottom", merge([pelvis, crotchCap(body, i), ...legs]));
  };

  if (onepiece) {
    const shape = inferShape(onepiece.category, onepiece.subtype, onepiece.shape);
    const i = 0.009 + fitInfl(shape.fit);
    const sleeve = shape.sleeve ?? "none";
    const topY = sleeve === "none" ? L.chest + (L.shoulder - L.chest) * 0.55 : L.shoulder + 0.014;
    if (onepiece.category === "jumpsuits") {
      buildBottom(onepiece, i);
      add(onepiece, "bodice", sweepY(L.waist - 0.01, topY, 28, torsoSec(body, i)));
    } else {
      const hem = hemFor(body, shape.length, "knee");
      const s = (onepiece.subtype ?? "").toLowerCase();
      const flare = /футляр|карандаш/.test(s) ? 0.02 : shape.length === "maxi" ? 0.13 : 0.11;
      add(onepiece, "dress", sweepY(hem, topY, 60, enclosingSec(body, i, flare, L.hip)));
    }
    if (sleeve !== "none")
      for (const side of [1, -1] as const) add(onepiece, `sl${side}`, merge([armGeometry(body, side, -0.02, sleeveEnd[sleeve], i), shoulderCap(body, side, i)]));
    else for (const side of [1, -1] as const) add(onepiece, `strap${side}`, strap(body, side, topY, i));
  } else if (bottom) buildBottom(bottom, bottomInfl);

  // --- верх
  const buildUpper = (it: WardrobeItem, infl: number, layer: "top" | "mid") => {
    const shape = inferShape(it.category, it.subtype, it.shape);
    const s = (it.subtype ?? "").toLowerCase();
    const i = infl + fitInfl(shape.fit);
    const turtle = /водолаз|гольф/.test(s);
    const hem = tucked && layer === "top" ? L.hip - 0.02 : hemFor(body, shape.length, "hip") - (shape.fit === "oversize" ? 0.03 : 0);
    const neckY = turtle ? L.chin - 0.015 : L.neckBase - 0.004;
    const open = shape.open || /кардиган/.test(s);
    const gap = open ? (y: number) => (y > L.chest ? 0.22 + ((y - L.chest) / (L.shoulder - L.chest)) * 0.45 : 0.2) : undefined;
    const sec = hem < L.crotch + 0.02 ? enclosingSec(body, i, 0.05, L.hip) : torsoSec(body, i);
    const sleeve = shape.sleeve ?? "long";
    const parts = [sweepY(hem, neckY, 46, sec, { gap })];
    if (sleeve !== "none")
      for (const side of [1, -1] as const)
        parts.push(armGeometry(body, side, -0.03, sleeveEnd[sleeve], i + 0.002, shape.fit === "oversize" ? 0.02 : 0), shoulderCap(body, side, i + 0.002));
    add(it, layer, merge(parts));
    if (it.category === "shirts") add(it, "collar", collar(body, i + 0.006, 0.035), { colors: it.colors });
  };
  if (top && !onepiece) buildUpper(top, tucked ? 0.006 : 0.013, "top");
  if (mid) buildUpper(mid, onepiece || top ? 0.02 : 0.012, "mid");

  // --- ремень
  const belt = bySlot.get("belt");
  if (belt && (bottom || onepiece)) {
    const infl = (onepiece ? 0.012 : Math.max(bottomInfl, tucked ? 0.012 : 0.02)) + 0.004;
    const y = onepiece ? L.waist : L.waist - 0.015;
    add(belt, "belt", sweepY(y - 0.017, y + 0.017, 3, torsoSec(body, infl)), { pattern: "leather" });
    const s = torsoAt(body, y);
    const buckle = new RoundedBoxGeometry(0.045, 0.038, 0.01, 2, 0.004);
    buckle.translate(0, y, s.bf + infl + 0.004);
    add(belt, "buckle", buckle, { metal: true, flatColor: "#c9b27c" });
  }

  // --- жакет и верхняя одежда
  const buildLayer = (it: WardrobeItem, infl: number, kind: "blazer" | "outer") => {
    const shape = inferShape(it.category, it.subtype, it.shape);
    const i = infl + fitInfl(shape.fit);
    const hem = hemFor(body, shape.length, kind === "blazer" ? "hip" : "knee") - (kind === "blazer" ? 0.03 : 0);
    const open = shape.open ?? kind === "blazer";
    const gap = (y: number) => {
      const v = y > L.chest - 0.06 ? ((y - (L.chest - 0.06)) / (L.shoulder - L.chest + 0.06)) * (open ? 0.7 : 0.45) : 0;
      return (open ? 0.2 : 0.02) + v;
    };
    const flare = kind === "outer" ? 0.08 : 0.05;
    const sleeveInfl = (kind === "outer" ? 0.03 : 0.022) + (blazer && kind === "outer" ? 0.008 : 0) + fitInfl(shape.fit) * 0.5;
    const parts = [
      sweepY(hem, L.neckBase - 0.002, 56, enclosingSec(body, i, flare, L.hip), { gap }),
      ...([1, -1] as const).flatMap((side) => [
        armGeometry(body, side, -0.04, 0.99, sleeveInfl, 0.01),
        shoulderCap(body, side, sleeveInfl + 0.004),
      ]),
    ];
    add(it, kind, merge(parts));
    if (kind === "outer") add(it, "collar", collar(body, i + 0.01, 0.06, 0.4));
    else add(it, "lapel", lapels(body, i + 0.003), { flatColor: undefined });
  };
  const blazer = bySlot.get("blazer");
  if (blazer) buildLayer(blazer, 0.026, "blazer");
  const outer = bySlot.get("outer");
  if (outer) buildLayer(outer, blazer ? 0.042 : 0.034, "outer");

  // --- обувь
  const shoes = bySlot.get("shoes");
  if (shoes) {
    const shape = inferShape("shoes", shoes.subtype, shoes.shape);
    const type = shape.shoeType ?? "sneakers";
    const heel = Math.min(0.12, (shape.heelCm ?? 2) / 100);
    const f = body.foot;
    hideFeet = type !== "sandals";
    for (const side of [1, -1] as const) {
      const x = side * body.legX;
      const k = `${side}`;
      if (type === "sneakers") {
        add(shoes, `shoe${k}`, footLast({ len: f.len * 1.07, width: f.width * 1.18, height: 0.08, x, sole: 0.02 }));
        add(shoes, `sole${k}`, footLast({ len: f.len * 1.09, width: f.width * 1.24, height: 0.012, x, sole: 0.028 }), { flatColor: shoes.colors[1] ?? "#f4f1ec" });
      } else if (type === "sandals") {
        add(shoes, `sole${k}`, footLast({ len: f.len * 1.04, width: f.width * 1.08, height: 0.006, x, sole: 0.015, heelLift: heel }));
        for (const z of [0.02, 0.12]) {
          const t = new THREE.TorusGeometry(f.width * 0.5, 0.005, 6, 24, Math.PI);
          t.scale(1, 0.6, 1);
          t.translate(x, 0.02 + heel * (z < 0.1 ? 0.7 : 0.3), z);
          add(shoes, `strap${k}${z}`, t);
        }
      } else {
        const low = type === "loafers" || type === "flats";
        const bootish = type === "ankle_boots" || type === "boots" || type === "knee_boots";
        const lift = type === "heels" ? heel : bootish ? Math.min(heel, 0.07) : Math.min(heel, 0.03);
        add(
          shoes,
          `shoe${k}`,
          footLast({
            len: f.len * 1.04,
            width: f.width * (bootish ? 1.14 : 1.06),
            height: bootish ? 0.1 : low ? 0.058 : 0.05,
            x,
            sole: type === "heels" ? 0.008 : 0.016,
            heelLift: lift,
            toePoint: type === "heels" ? 1 : low ? 0.4 : 0.2,
          }),
        );
        if (lift > 0.02) {
          const r = type === "heels" && heel > 0.06 ? 0.007 : 0.016;
          const hg = new THREE.CylinderGeometry(r, r * 1.2, lift + 0.01, 12);
          hg.translate(x, (lift + 0.01) / 2, -f.len * 0.13);
          add(shoes, `heel${k}`, hg);
        }
        if (bootish) {
          // Широкие брюки носятся поверх сапог, узкие — заправляются
          const b = onepiece?.category === "jumpsuits" ? onepiece : bottom;
          const bShape = b ? inferShape(b.category, b.subtype, b.shape) : undefined;
          const longPants = b && b.category !== "skirts" && b.category !== "shorts" && ["ankle", "maxi", "midi"].includes(bShape?.length ?? "ankle");
          const tucked = !longPants || bShape?.fit === "slim" || /скинни|леггин/.test((b?.subtype ?? "").toLowerCase());
          const yTop = !tucked ? L.ankle + 0.08 : type === "knee_boots" ? L.knee - 0.02 : type === "boots" ? L.midCalf + 0.05 : L.ankle + 0.1;
          add(shoes, `shaft${k}`, legGeometry(body, side, L.ankle - 0.02, yTop, !tucked ? 0.007 : longPants ? 0.024 : 0.016, 0));
        }
      }
    }
  }

  // --- шарф
  const scarf = bySlot.get("scarf");
  if (scarf) {
    const infl = outer ? 0.05 : blazer ? 0.035 : 0.025;
    const ring = sweepY(L.neckBase - 0.015, L.neckBase + 0.06, 6, (y) => {
      const r = body.neck.r * 1.35 + infl + (L.neckBase + 0.06 - y) * 0.25;
      return { a: r * 1.15, bf: r * 1.1, bb: r };
    });
    const s = torsoAt(body, L.chest);
    const tail = new RoundedBoxGeometry(0.075, 0.34, 0.022, 2, 0.008);
    tail.rotateZ(0.08);
    tail.translate(0.035, L.chest - 0.03, s.bf + infl + 0.02);
    const tail2 = new RoundedBoxGeometry(0.07, 0.28, 0.02, 2, 0.008);
    tail2.rotateZ(-0.12);
    tail2.translate(-0.02, L.chest + 0.0, s.bf + infl + 0.03);
    add(scarf, "scarf", merge([ring, tail, tail2]));
  }

  // --- головной убор
  const hat = bySlot.get("headwear");
  if (hat) {
    const shape = inferShape("headwear", hat.subtype, hat.shape);
    hatType = shape.hatType ?? "beanie";
    const h = body.head;
    const top = h.cy + h.ry * 0.25;
    switch (hatType) {
      case "beanie": {
        const dome = ellipsoid(h.rx * 1.12, h.ry * 1.02, h.rz * 1.1, [0, h.cy + h.ry * 0.12, -0.004], 32, Math.PI * 0.56);
        const cuff = sweepY(h.cy - h.ry * 0.05, h.cy + h.ry * 0.25, 4, () => ({ a: h.rx * 1.16, bf: h.rz * 1.14, bb: h.rz * 1.14, cz: -0.004 }));
        add(hat, "hat", merge([dome, cuff]), { pattern: hat.pattern === "solid" ? "knit" : hat.pattern });
        break;
      }
      case "cap": {
        const dome = ellipsoid(h.rx * 1.08, h.ry * 0.95, h.rz * 1.06, [0, h.cy + h.ry * 0.18, -0.004], 32, Math.PI * 0.5);
        const visor = new THREE.CylinderGeometry(h.rx * 1.05, h.rx * 1.05, 0.006, 32, 1, false, -Math.PI * 0.45, Math.PI * 0.9);
        visor.scale(1, 1, 1.25);
        visor.translate(0, h.cy + h.ry * 0.2, h.rz * 0.35);
        add(hat, "hat", merge([dome, visor]));
        break;
      }
      case "beret": {
        const b = ellipsoid(h.rx * 1.35, h.ry * 0.45, h.rz * 1.3, [0.012, top + h.ry * 0.28, -0.01], 32);
        b.rotateZ(-0.12);
        add(hat, "hat", b);
        break;
      }
      default: {
        // fedora / panama / bucket
        const crownH = hatType === "fedora" ? h.ry * 0.9 : h.ry * 0.7;
        const crown = new THREE.CylinderGeometry(h.rx * (hatType === "bucket" ? 1.0 : 0.95), h.rx * 1.12, crownH, 32);
        crown.scale(1, 1, h.rz / h.rx);
        crown.translate(0, top + crownH * 0.35, -0.004);
        const brimR = hatType === "fedora" ? h.rx * 2.1 : hatType === "panama" ? h.rx * 2.4 : h.rx * 1.75;
        const brim = new THREE.CylinderGeometry(brimR, hatType === "bucket" ? brimR * 1.15 : brimR, hatType === "bucket" ? 0.04 : 0.008, 40, 1, true);
        brim.scale(1, 1, h.rz / h.rx);
        brim.translate(0, top - crownH * 0.12, -0.004);
        const brimDisk = new THREE.RingGeometry(h.rx * 1.05, brimR, 40);
        brimDisk.rotateX(-Math.PI / 2);
        brimDisk.scale(1, 1, h.rz / h.rx);
        brimDisk.translate(0, top - crownH * 0.12, -0.004);
        add(hat, "hat", merge([crown, hatType === "bucket" ? brim : brimDisk]));
        const band = new THREE.CylinderGeometry(h.rx * 1.13, h.rx * 1.13, 0.018, 32, 1, true);
        band.scale(1, 1, h.rz / h.rx);
        band.translate(0, top - crownH * 0.05, -0.004);
        add(hat, "band", band, { flatColor: "#1d1a1f" });
      }
    }
  }

  // --- сумка
  const bag = bySlot.get("bag");
  if (bag) {
    const s = (bag.subtype ?? "").toLowerCase();
    const hip = torsoAt(body, L.hip);
    const outerInfl = outer ? 0.04 : blazer ? 0.03 : 0.015;
    if (/рюкзак/.test(s)) {
      const chest = torsoAt(body, L.chest - 0.06);
      const pack = new RoundedBoxGeometry(0.28, 0.36, 0.12, 4, 0.03);
      pack.translate(0, L.chest - 0.1, -(chest.bb + outerInfl + 0.065));
      add(bag, "bag", pack);
      for (const side of [1, -1] as const) add(bag, `strap${side}`, bagStrap(body, [side * 0.07, L.shoulder + 0.01, 0], [side * 0.09, L.waist + 0.02, 0], outerInfl, true), { pattern: "solid" });
    } else if (/клатч/.test(s)) {
      const { start, dir } = armFrame(body, 1);
      const hand = start.clone().addScaledVector(dir, body.arm.len + 0.05);
      const c = new RoundedBoxGeometry(0.24, 0.12, 0.035, 3, 0.012);
      c.rotateZ(0.2);
      c.translate(hand.x + 0.01, hand.y + 0.03, 0.035);
      add(bag, "bag", c);
    } else {
      const big = /тоут|шопер|портфел/.test(s);
      const w = big ? 0.34 : 0.22;
      const hgt = big ? 0.3 : 0.16;
      const box = new RoundedBoxGeometry(w, hgt, big ? 0.1 : 0.065, 4, 0.02);
      const bx = -(hip.a + outerInfl + w * 0.32);
      const by = big ? L.hip + 0.02 : L.hip + 0.03;
      box.translate(bx, by, 0.03);
      add(bag, "bag", box);
      const from: [number, number, number] = big ? [-body.shoulderX * 0.85, L.shoulder + 0.012, 0] : [body.shoulderX * 0.7, L.shoulder + 0.012, 0];
      add(bag, "strap", bagStrap(body, from, [bx + (big ? 0.08 : 0.06), by + hgt / 2, 0.03], outerInfl, false), { pattern: "solid" });
    }
  }

  // --- украшения и аксессуары
  const jew = bySlot.get("jewelry");
  if (jew) {
    const s = (jew.subtype ?? "").toLowerCase();
    if (/серьг/.test(s)) {
      for (const side of [1, -1] as const) {
        const e = new THREE.SphereGeometry(0.008, 12, 10);
        e.translate(side * body.head.rx * 0.97, body.head.cy - body.head.ry * 0.3, 0.005);
        add(jew, `ear${side}`, e, { metal: true });
      }
    } else if (/браслет|кольц/.test(s)) {
      const { start, dir } = armFrame(body, -1);
      const w = start.clone().addScaledVector(dir, body.arm.len * 0.96);
      const t = new THREE.TorusGeometry(0.03, 0.005, 8, 24);
      t.rotateX(Math.PI / 2);
      t.rotateZ(-body.arm.angle);
      t.translate(w.x, w.y, w.z);
      add(jew, "bracelet", t, { metal: true });
    } else {
      const layered = blazer || outer || mid ? 0.03 : top || onepiece ? 0.016 : 0.004;
      const nb = L.neckBase;
      const front = (y: number) => torsoAt(body, y).bf + layered;
      const r = body.neck.r * 1.2 + layered;
      const drop = /колье/.test(s) ? 0.035 : 0.09;
      const curve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0, nb + 0.012, -r * 1.05),
          new THREE.Vector3(r * 1.2, nb + 0.002, -r * 0.2),
          new THREE.Vector3(r * 1.1, nb - drop * 0.45, front(nb - drop * 0.45) * 0.8),
          new THREE.Vector3(0, nb - drop, front(nb - drop) + 0.002),
          new THREE.Vector3(-r * 1.1, nb - drop * 0.45, front(nb - drop * 0.45) * 0.8),
          new THREE.Vector3(-r * 1.2, nb + 0.002, -r * 0.2),
        ],
        true,
      );
      add(jew, "necklace", new THREE.TubeGeometry(curve, 80, 0.0028, 6, true), { metal: true });
      const pend = new THREE.SphereGeometry(0.01, 12, 10);
      pend.translate(0, nb - drop - 0.012, front(nb - drop - 0.012) + 0.006);
      add(jew, "pendant", pend, { metal: true });
    }
  }
  const acc = bySlot.get("accessory");
  if (acc) {
    const s = (acc.subtype ?? acc.name).toLowerCase();
    const h = body.head;
    if (/очк/.test(s)) {
      const parts: THREE.BufferGeometry[] = [];
      for (const side of [1, -1] as const) {
        const lens = new THREE.TorusGeometry(0.02, 0.003, 8, 24);
        lens.translate(side * 0.028, h.cy + h.ry * 0.08, h.rz * 0.97);
        parts.push(lens);
        const lensFill = new THREE.CircleGeometry(0.019, 24);
        lensFill.translate(side * 0.028, h.cy + h.ry * 0.08, h.rz * 0.965);
        parts.push(lensFill);
      }
      const bridge = new THREE.CylinderGeometry(0.0025, 0.0025, 0.018, 6);
      bridge.rotateZ(Math.PI / 2);
      bridge.translate(0, h.cy + h.ry * 0.1, h.rz * 0.98);
      parts.push(bridge);
      add(acc, "glasses", merge(parts), { flatColor: acc.colors[0] ?? "#111" });
    } else if (/час/.test(s)) {
      const { start, dir } = armFrame(body, -1);
      const w = start.clone().addScaledVector(dir, body.arm.len * 0.93);
      const t = new THREE.TorusGeometry(0.029, 0.007, 8, 24);
      t.rotateX(Math.PI / 2);
      t.rotateZ(-body.arm.angle);
      t.translate(w.x, w.y, w.z);
      const face = new THREE.CylinderGeometry(0.016, 0.016, 0.008, 20);
      face.rotateX(Math.PI / 2);
      face.translate(w.x, w.y, w.z + 0.03);
      add(acc, "watch", merge([t, face]), { metal: true });
    } else if (/галстук/.test(s)) {
      const s0 = torsoAt(body, L.chest);
      const tie = new THREE.BufferGeometry();
      const z = s0.bf + 0.018;
      const yT = L.neckBase - 0.01;
      const yB = L.waist - 0.02;
      tie.setAttribute("position", new THREE.Float32BufferAttribute([0, yT, z, -0.02, yT - 0.04, z, 0.02, yT - 0.04, z, -0.045, yB + 0.03, z, 0.045, yB + 0.03, z, 0, yB, z], 3));
      tie.setAttribute("uv", new THREE.Float32BufferAttribute([0.5, 1, 0, 0.9, 1, 0.9, 0, 0.1, 1, 0.1, 0.5, 0], 2));
      tie.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
      tie.computeVertexNormals();
      add(acc, "tie", tie);
    } else if (/перчат/.test(s)) gloves = acc.colors[0];
  }

  return { meshes, hideFeet, hatType, gloves };
}

function collar(body: BodyModel, infl: number, h: number, flare = 0.25): THREE.BufferGeometry {
  const y0 = body.levels.neckBase - 0.012;
  return sweepY(
    y0,
    y0 + h,
    4,
    (y) => {
      const r = body.neck.r * 1.25 + infl + (y - y0) * flare;
      return { a: r * 1.08, bf: r * 1.02, bb: r * 1.08 };
    },
    { gap: () => 0.35, seg: 40 },
  );
}

function lapels(body: BodyModel, infl: number): THREE.BufferGeometry {
  const L = body.levels;
  const pts: number[] = [];
  const idx: number[] = [];
  const add = (side: number) => {
    const base = pts.length / 3;
    const yB = L.chest - 0.08;
    const yT = L.shoulder + 0.005;
    const sB = torsoAt(body, yB);
    const sT = torsoAt(body, yT);
    const sM = torsoAt(body, L.chest + 0.02);
    // треугольник лацкана поверх полочки
    pts.push(side * 0.012, yB, sB.bf + infl + 0.004);
    pts.push(side * (sM.a * 0.45), L.chest + 0.03, sM.bf * 0.9 + infl + 0.006);
    pts.push(side * (body.neck.r * 1.6), yT, sT.bf + infl + 0.01);
    pts.push(side * (sM.a * 0.2), L.chest + 0.05, sM.bf + infl + 0.012);
    idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
  };
  add(1);
  add(-1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pts.length / 3) * 2).fill(0.5), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function strap(body: BodyModel, side: 1 | -1, fromY: number, infl: number): THREE.BufferGeometry {
  const L = body.levels;
  const sF = torsoAt(body, fromY);
  const sS = torsoAt(body, L.shoulder);
  const x = side * body.shoulderX * 0.62;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x * 0.95, fromY - 0.005, sF.bf * 0.8 + infl),
    new THREE.Vector3(x, L.shoulder + 0.012, sS.bf * 0.4),
    new THREE.Vector3(x, L.shoulder + 0.014, -sS.bb * 0.3),
    new THREE.Vector3(x * 0.95, fromY, -sF.bb * 0.85 - infl),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.006, 6, false);
}

function bagStrap(body: BodyModel, from: [number, number, number], to: [number, number, number], infl: number, over: boolean): THREE.BufferGeometry {
  const L = body.levels;
  const pts: THREE.Vector3[] = [];
  const N = 10;
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const x = from[0] + (to[0] - from[0]) * u;
    const y = from[1] + (to[1] - from[1]) * u;
    const s = torsoAt(body, Math.min(y, L.shoulder));
    const zf = over ? -(s.bb + infl + 0.01) : s.bf * Math.sqrt(Math.max(0, 1 - (x / (s.a + 0.03)) ** 2)) + infl + 0.012;
    pts.push(new THREE.Vector3(x, y, k === 0 ? 0 : zf));
  }
  if (over) pts.unshift(new THREE.Vector3(from[0], from[1], torsoAt(body, L.shoulder).bf * 0.6));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.007, 6, false);
}

