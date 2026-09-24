// Разбор фото «я в образе» на отдельные вещи: сегментация одежды нейросетью прямо в браузере
// (SegFormer, обученный на датасете ATR). Если модель недоступна — распознавание через Claude.
import type { Category } from "@shared/types";
import { api } from "../api";
import { applyMask, cropBox, removeBackground } from "./image";

export interface Garment {
  label: string;
  category: Category;
  image: string; // вырезанная вещь
}

const MODEL_ID = "Xenova/segformer_b2_clothes";

const LABEL_MAP: Record<string, { category: Category; label: string } | undefined> = {
  Hat: { category: "headwear", label: "Головной убор" },
  Sunglasses: { category: "accessories", label: "Солнцезащитные очки" },
  "Upper-clothes": { category: "tops", label: "Верх" },
  Skirt: { category: "skirts", label: "Юбка" },
  Pants: { category: "trousers", label: "Брюки" },
  Dress: { category: "dresses", label: "Платье" },
  Belt: { category: "belts", label: "Ремень" },
  Shoes: { category: "shoes", label: "Обувь" },
  Bag: { category: "bags", label: "Сумка" },
  Scarf: { category: "scarves", label: "Шарф" },
};

type Segmenter = (img: string) => Promise<{ label: string; score: number | null; mask: { width: number; height: number; data: Uint8Array } }[]>;
let segmenter: Promise<Segmenter> | null = null;

async function getSegmenter(onProgress?: (t: string) => void): Promise<Segmenter> {
  if (!segmenter) {
    segmenter = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const seg = await pipeline("image-segmentation", MODEL_ID, {
        progress_callback: (p: { status: string; progress?: number; file?: string }) => {
          if (p.status === "progress" && p.progress != null) onProgress?.(`Загрузка модели одежды ${Math.round(p.progress)}%`);
        },
      });
      return seg as unknown as Segmenter;
    })();
    segmenter.catch(() => (segmenter = null));
  }
  return segmenter;
}

export async function segmentOutfit(photo: string, onProgress?: (t: string) => void): Promise<{ garments: Garment[]; method: "segformer" | "claude" }> {
  try {
    onProgress?.("Загружаю модель распознавания одежды…");
    const seg = await getSegmenter(onProgress);
    onProgress?.("Нахожу вещи на фото…");
    const parts = await seg(photo);
    // объединяем левую и правую обувь
    const merged = new Map<string, { width: number; height: number; data: Uint8Array }>();
    for (const p of parts) {
      const key = p.label === "Left-shoe" || p.label === "Right-shoe" ? "Shoes" : p.label;
      if (!LABEL_MAP[key]) continue;
      const prev = merged.get(key);
      if (!prev) merged.set(key, { width: p.mask.width, height: p.mask.height, data: new Uint8Array(p.mask.data) });
      else for (let i = 0; i < prev.data.length; i++) prev.data[i] = Math.max(prev.data[i], p.mask.data[i]);
    }
    const garments: Garment[] = [];
    for (const [key, mask] of merged) {
      const area = mask.data.reduce((a, v) => a + (v > 127 ? 1 : 0), 0) / mask.data.length;
      if (area < 0.004) continue; // шум
      const meta = LABEL_MAP[key]!;
      onProgress?.(`Вырезаю: ${meta.label.toLowerCase()}…`);
      garments.push({ ...meta, image: await applyMask(photo, mask) });
    }
    if (garments.length) return { garments, method: "segformer" };
    throw new Error("Одежда не найдена");
  } catch (e) {
    console.warn("SegFormer недоступен, пробую Claude", e);
  }
  onProgress?.("Распознаю вещи с помощью ИИ…");
  const { items } = await api.detect(photo);
  const garments: Garment[] = [];
  for (const it of items) {
    onProgress?.(`Вырезаю: ${it.label.toLowerCase()}…`);
    const crop = await cropBox(photo, it.box);
    const { image } = await removeBackground(crop, onProgress);
    garments.push({ label: it.label, category: it.category, image });
  }
  return { garments, method: "claude" };
}
