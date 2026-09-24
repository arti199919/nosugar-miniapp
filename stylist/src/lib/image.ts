import { rgbToHex } from "@shared/color";

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    img.src = src;
  });
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

/** Уменьшить изображение до max по большей стороне. */
export async function resizeImage(src: string, max = 1280, type: "image/jpeg" | "image/webp" | "image/png" = "image/jpeg", quality = 0.86) {
  const img = await loadImage(src);
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = canvasOf(img.naturalWidth * k, img.naturalHeight * k);
  const g = ctx2d(c);
  if (type === "image/jpeg") {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, quality);
}

/** Обрезать прозрачные поля. */
export function trimTransparent(c: HTMLCanvasElement, pad = 12): HTMLCanvasElement {
  const g = ctx2d(c);
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 <= x0 || y1 <= y0) return c;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
  ctx2d(out).drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export const canvasToCutout = (c: HTMLCanvasElement) => {
  const trimmed = trimTransparent(c);
  const k = Math.min(1, 768 / Math.max(trimmed.width, trimmed.height));
  const out = canvasOf(trimmed.width * k, trimmed.height * k);
  ctx2d(out).drawImage(trimmed, 0, 0, out.width, out.height);
  const webp = out.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : out.toDataURL("image/png");
};

/** Вырезать область (доли 0..1). */
export async function cropBox(src: string, box: { x: number; y: number; w: number; h: number }, pad = 0.03): Promise<string> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const x = Math.max(0, (box.x - pad) * W);
  const y = Math.max(0, (box.y - pad) * H);
  const w = Math.min(W - x, (box.w + pad * 2) * W);
  const h = Math.min(H - y, (box.h + pad * 2) * H);
  const c = canvasOf(w, h);
  ctx2d(c).drawImage(img, x, y, w, h, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.9);
}

/** Применить маску (1 канал, 0..255) к изображению и вырезать вещь. */
export async function applyMask(src: string, mask: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }): Promise<string> {
  const img = await loadImage(src);
  const c = canvasOf(mask.width, mask.height);
  const g = ctx2d(c);
  g.drawImage(img, 0, 0, c.width, c.height);
  const id = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < mask.width * mask.height; i++) id.data[i * 4 + 3] = mask.data[i];
  g.putImageData(id, 0, 0);
  // лёгкое сглаживание края
  const soft = canvasOf(c.width, c.height);
  const sg = ctx2d(soft);
  sg.filter = "blur(0.6px)";
  sg.drawImage(c, 0, 0);
  return canvasToCutout(soft);
}

/**
 * Простое удаление однотонного фона (заливка от краёв по цвету).
 * Используется, если нейросеть недоступна: хорошо работает для вещи на полу/кровати/стене.
 */
export async function floodRemoveBackground(src: string, tolerance = 38): Promise<string> {
  const img = await loadImage(src);
  const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = canvasOf(img.naturalWidth * k, img.naturalHeight * k);
  const g = ctx2d(c);
  g.drawImage(img, 0, 0, c.width, c.height);
  const id = g.getImageData(0, 0, c.width, c.height);
  const { data, width, height } = id;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * width + x;
    if (!seen[p]) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  // эталон — медиана цвета по краю
  const edge = stack.map((p) => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  const med = [0, 1, 2].map((ch) => edge.map((e) => e[ch]).sort((a, b) => a - b)[edge.length >> 1]);
  const tol2 = tolerance * tolerance * 3;
  const close = (p: number) => {
    const dr = data[p * 4] - med[0];
    const dg = data[p * 4 + 1] - med[1];
    const db = data[p * 4 + 2] - med[2];
    return dr * dr + dg * dg + db * db < tol2;
  };
  const bg = new Uint8Array(width * height);
  while (stack.length) {
    const p = stack.pop()!;
    if (!close(p)) continue;
    bg[p] = 1;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  for (let p = 0; p < width * height; p++) if (bg[p]) data[p * 4 + 3] = 0;
  g.putImageData(id, 0, 0);
  return canvasToCutout(c);
}

let imglyFailed = false;

/** Удаление фона нейросетью в браузере (@imgly/background-removal) с запасным вариантом. */
export async function removeBackground(src: string, onProgress?: (text: string) => void): Promise<{ image: string; method: "ai" | "flood" }> {
  if (!imglyFailed) {
    try {
      onProgress?.("Загружаю нейросеть для вырезания фона…");
      const { removeBackground: rb } = await import("@imgly/background-removal");
      const blob = await rb(src, {
        output: { format: "image/png" },
        progress: (key: string, cur: number, total: number) => {
          if (key.startsWith("fetch")) onProgress?.(`Загрузка модели ${Math.round((cur / Math.max(total, 1)) * 100)}%`);
          else onProgress?.("Вырезаю фон…");
        },
      });
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      const c = canvasOf(img.naturalWidth, img.naturalHeight);
      ctx2d(c).drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return { image: canvasToCutout(c), method: "ai" };
    } catch (e) {
      console.warn("background-removal недоступен, использую простой метод", e);
      imglyFailed = true;
    }
  }
  onProgress?.("Вырезаю фон (упрощённый режим)…");
  return { image: await floodRemoveBackground(src), method: "flood" };
}

/** Основные цвета вещи (игнорируя прозрачный фон) — простой k-means. */
export async function dominantColors(src: string, k = 3): Promise<string[]> {
  const img = await loadImage(src);
  const s = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = canvasOf(img.naturalWidth * s, img.naturalHeight * s);
  const g = ctx2d(c);
  g.drawImage(img, 0, 0, c.width, c.height);
  const { data } = g.getImageData(0, 0, c.width, c.height);
  const px: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return ["#808080"];
  let cents = Array.from({ length: k }, (_, i) => px[Math.floor(((i + 0.5) / k) * px.length)]);
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 8; it++) {
    assign = px.map((p) => {
      let best = 0;
      let bd = Infinity;
      cents.forEach((cc, j) => {
        const d = (p[0] - cc[0]) ** 2 + (p[1] - cc[1]) ** 2 + (p[2] - cc[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      return best;
    });
    cents = cents.map((cc, j) => {
      const mem = px.filter((_, i) => assign[i] === j);
      if (!mem.length) return cc;
      return [0, 1, 2].map((ch) => mem.reduce((a, m) => a + m[ch], 0) / mem.length) as [number, number, number];
    });
  }
  const counts = cents.map((_, j) => assign.filter((a) => a === j).length);
  return cents
    .map((cc, j) => ({ hex: rgbToHex(...cc), n: counts[j] }))
    .filter((x) => x.n / px.length > 0.08)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.hex);
}

/** Кадр с видео → data URL. */
export function captureVideo(video: HTMLVideoElement, mirror = true): string {
  const c = canvasOf(video.videoWidth, video.videoHeight);
  const g = ctx2d(c);
  if (mirror) {
    g.translate(c.width, 0);
    g.scale(-1, 1);
  }
  g.drawImage(video, 0, 0);
  const k = Math.min(1, 1280 / Math.max(c.width, c.height));
  if (k === 1) return c.toDataURL("image/jpeg", 0.85);
  const out = canvasOf(c.width * k, c.height * k);
  ctx2d(out).drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.85);
}
