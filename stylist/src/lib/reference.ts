// «Хочу как на фото»: разбор референса и подбор похожих вещей из гардероба.
import { CATEGORIES, slotOf, toBrief } from "@shared/catalog";
import { colorName } from "@shared/color";
import { deltaE } from "@shared/colorType";
import type { Profile, WardrobeItem } from "@shared/types";
import { api, type ReferenceResult } from "../api";
import { useUI } from "../store";
import { dominantColors, resizeImage } from "./image";
import { segmentOutfit } from "./segment";

export type ReferenceMatch = ReferenceResult & { source: "ai" | "local" };

export async function matchReference(photo: string, profile: Profile, items: WardrobeItem[], onStep?: (t: string) => void): Promise<ReferenceMatch> {
  const active = items.filter((i) => i.status === "active");
  if (useUI.getState().health?.ai) {
    try {
      onStep?.("Claude разбирает образ на фото…");
      const r = await api.reference({ image: await resizeImage(photo, 1280), profile, items: active.map(toBrief) });
      return { ...r, source: "ai" };
    } catch (e) {
      useUI.getState().toast(`ИИ недоступен, подбираю локально: ${e instanceof Error ? e.message : e}`, "error");
    }
  }
  const { garments } = await segmentOutfit(photo, onStep);
  const pieces: ReferenceResult["pieces"] = [];
  const used = new Set<string>();
  for (const g of garments) {
    onStep?.(`Ищу похожее: ${g.label.toLowerCase()}…`);
    const color = (await dominantColors(g.image, 2))[0] ?? "#808080";
    const slot = slotOf(g.category);
    const cands = active.filter((i) => !used.has(i.id) && (slotOf(i.category) === slot || (slot === "bottom" && slotOf(i.category) === "bottom")));
    let best: WardrobeItem | undefined;
    let bestD = Infinity;
    for (const c of cands) {
      const d = deltaE(color, c.colors[0]) - (c.category === g.category ? 6 : 0);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    const name = `${colorName(color)} ${CATEGORIES[g.category].label.toLowerCase()}`;
    if (best) used.add(best.id);
    pieces.push({
      piece: `${g.label} (${colorName(color)})`,
      category: g.category,
      matchId: best?.id ?? "",
      matchQuality: !best ? "none" : bestD < 12 ? "exact" : bestD < 25 ? "close" : "substitute",
      comment: best ? `Ближе всего по цвету и типу: ${best.name}` : "Такой вещи в гардеробе нет",
      shopQuery: !best || bestD >= 25 ? name : "",
    });
  }
  const matched = pieces.filter((p) => p.matchQuality !== "none").length;
  return {
    description: "Подбор по цветам и типам вещей, найденных на фото нейросетью (без ИИ-описания стиля).",
    pieces,
    tips: ["Повторите пропорции референса: длину верха, посадку брюк и высоту талии.", "Обувь и сумка задают настроение — подберите их по цвету, как на фото."],
    score: pieces.length ? Math.round((matched / pieces.length) * 80) : 0,
    source: "local",
  };
}
