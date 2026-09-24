import * as THREE from "three";
import type { Pattern } from "@shared/types";
import { hexToHsl, shade } from "@shared/color";

const cache = new Map<string, THREE.CanvasTexture>();

/** Процедурная текстура ткани по узору и цветам вещи. */
export function fabricTexture(pattern: Pattern, colors: string[]): THREE.CanvasTexture | null {
  const c1 = colors[0] ?? "#888888";
  const c2 = colors[1] ?? (hexToHsl(c1).l > 0.55 ? shade(c1, -0.35) : shade(c1, 0.55));
  const key = `${pattern}:${c1}:${c2}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = c1;
  g.fillRect(0, 0, S, S);
  let repeat: [number, number] = [4, 4];
  const rnd = mulberry(key.length * 9301 + c1.charCodeAt(1));

  const noise = (amount: number, size = 1) => {
    for (let i = 0; i < (S * S) / (size * 6); i++) {
      g.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${amount * rnd()})` : `rgba(0,0,0,${amount * rnd()})`;
      g.fillRect(rnd() * S, rnd() * S, size, size);
    }
  };

  switch (pattern) {
    case "solid":
      noise(0.05);
      break;
    case "stripes":
      g.fillStyle = c2;
      for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 12);
      repeat = [1, 5];
      noise(0.04);
      break;
    case "check": {
      g.globalAlpha = 0.55;
      g.fillStyle = c2;
      for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 18, S);
      for (let y = 0; y < S; y += 64) g.fillRect(0, y, S, 18);
      g.globalAlpha = 0.35;
      g.fillStyle = shade(c1, -0.4);
      for (let x = 40; x < S; x += 64) g.fillRect(x, 0, 3, S);
      for (let y = 40; y < S; y += 64) g.fillRect(0, y, S, 3);
      g.globalAlpha = 1;
      repeat = [3, 3];
      break;
    }
    case "dots":
      g.fillStyle = c2;
      for (let y = 0; y < S; y += 32)
        for (let x = (y / 32) % 2 ? 16 : 0; x < S; x += 32) {
          g.beginPath();
          g.arc(x + 8, y + 8, 5, 0, Math.PI * 2);
          g.fill();
        }
      repeat = [5, 5];
      break;
    case "floral":
      for (let i = 0; i < 26; i++) {
        const x = rnd() * S;
        const y = rnd() * S;
        const r = 6 + rnd() * 10;
        g.fillStyle = i % 3 ? c2 : shade(c2, 0.3);
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.beginPath();
          g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, r * 0.45, a, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = shade(c1, -0.3);
        g.beginPath();
        g.arc(x, y, r * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      repeat = [3, 3];
      break;
    case "animal":
      for (let i = 0; i < 60; i++) {
        const x = rnd() * S;
        const y = rnd() * S;
        const r = 5 + rnd() * 9;
        g.strokeStyle = shade(c2, -0.5);
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.75, rnd() * 3, 0, Math.PI * 1.6);
        g.stroke();
        g.fillStyle = shade(c1, -0.15);
        g.beginPath();
        g.ellipse(x, y, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
        g.fill();
      }
      repeat = [3, 3];
      break;
    case "print":
      for (let i = 0; i < 18; i++) {
        g.fillStyle = [c2, shade(c1, 0.35), shade(c2, -0.3)][i % 3];
        g.save();
        g.translate(rnd() * S, rnd() * S);
        g.rotate(rnd() * 3);
        g.fillRect(-10, -4, 20 + rnd() * 20, 8 + rnd() * 10);
        g.restore();
      }
      repeat = [3, 3];
      break;
    case "denim":
      g.lineWidth = 1;
      for (let i = -S; i < S * 2; i += 3) {
        g.strokeStyle = rnd() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)";
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + S, S);
        g.stroke();
      }
      noise(0.08, 2);
      repeat = [5, 5];
      break;
    case "knit":
      for (let x = 0; x < S; x += 16) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.fillRect(x, 0, 3, S);
        for (let y = 0; y < S; y += 12) {
          g.strokeStyle = "rgba(255,255,255,0.12)";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + 3, y);
          g.lineTo(x + 9, y + 6);
          g.lineTo(x + 15, y);
          g.stroke();
        }
      }
      repeat = [6, 6];
      break;
    case "leather":
      noise(0.07, 2);
      break;
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

export function materialFor(pattern: Pattern, material = ""): { roughness: number; metalness: number; sheen: number } {
  const m = material.toLowerCase();
  if (pattern === "leather" || /кож|лак|латекс/.test(m)) return { roughness: 0.38, metalness: 0.05, sheen: 0 };
  if (/шёлк|шелк|атлас|сатин/.test(m)) return { roughness: 0.3, metalness: 0.02, sheen: 0.6 };
  if (/бархат|велюр/.test(m)) return { roughness: 0.9, metalness: 0, sheen: 1 };
  if (/металл|золот|серебр/.test(m)) return { roughness: 0.25, metalness: 0.8, sheen: 0 };
  if (pattern === "knit" || /шерст|кашемир|вязан|трикотаж/.test(m)) return { roughness: 0.95, metalness: 0, sheen: 0.5 };
  if (pattern === "denim") return { roughness: 0.85, metalness: 0, sheen: 0.2 };
  return { roughness: 0.78, metalness: 0, sheen: 0.3 };
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
