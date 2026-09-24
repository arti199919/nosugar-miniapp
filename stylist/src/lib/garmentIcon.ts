// Векторные силуэты вещей — заглушки для карточек без фото и демо-гардероба.
import type { Category, GarmentShape } from "@shared/types";
import { shade } from "@shared/color";

const P = {
  tee: "M30 18 L42 12 Q50 18 58 12 L70 18 L86 32 L76 42 L68 36 L68 88 L32 88 L32 36 L24 42 L14 32 Z",
  tank: "M36 12 L42 12 Q50 24 58 12 L64 12 L66 34 L68 88 L32 88 L34 34 Z",
  shirt: "M30 16 L42 10 L50 20 L58 10 L70 16 L84 30 L86 70 L76 70 L72 38 L70 90 L30 90 L28 38 L24 70 L14 70 L16 30 Z",
  sweater: "M30 16 Q50 24 70 16 L86 30 L88 80 L78 82 L72 40 L72 88 L28 88 L28 40 L22 82 L12 80 L14 30 Z",
  trousers: "M30 10 L70 10 L74 92 L58 92 L50 34 L42 92 L26 92 Z",
  jeans: "M30 10 L70 10 L72 92 L57 92 L50 36 L43 92 L28 92 Z",
  skirt: "M36 14 L64 14 L80 84 L20 84 Z",
  shorts: "M28 20 L72 20 L76 64 L56 66 L50 40 L44 66 L24 64 Z",
  dress: "M38 8 L44 8 Q50 16 56 8 L62 8 L62 30 L60 38 L78 92 L22 92 L40 38 L38 30 Z",
  jumpsuit: "M38 8 L44 8 Q50 16 56 8 L62 8 L64 44 L70 92 L55 92 L50 54 L45 92 L30 92 L36 44 Z",
  blazer: "M30 14 L42 10 L50 40 L58 10 L70 14 L86 28 L88 82 L76 82 L72 40 L72 92 L28 92 L28 40 L24 82 L12 82 L14 28 Z",
  coat: "M30 10 L42 8 L50 30 L58 8 L70 10 L86 26 L88 84 L76 84 L72 40 L76 96 L24 96 L28 40 L24 84 L12 84 L14 26 Z",
  sneaker: "M10 60 L14 44 Q30 44 40 36 L52 40 Q70 50 88 56 Q92 60 90 68 L10 68 Z",
  heel: "M14 44 Q20 40 26 46 Q50 62 86 62 Q92 64 88 70 L60 70 Q40 66 30 60 L26 80 L22 80 L22 58 Q16 54 14 44 Z",
  boot: "M30 10 L50 10 L52 56 Q70 60 86 64 Q90 70 86 76 L28 76 L30 60 Z",
  loafer: "M10 58 Q12 48 26 48 Q46 48 60 52 Q80 56 88 60 Q92 66 86 70 L12 70 Z",
  belt: "M8 44 L92 44 L92 56 L8 56 Z M60 40 L74 40 L74 60 L60 60 Z",
  beanie: "M20 70 Q20 22 50 20 Q80 22 80 70 Z M18 64 L82 64 L82 76 L18 76 Z",
  cap: "M22 62 Q22 28 50 26 Q78 28 78 62 Z M50 56 L96 62 L94 68 L50 66 Z",
  fedora: "M32 56 L36 30 Q50 22 64 30 L68 56 Z M8 58 Q50 50 92 58 Q50 70 8 58 Z",
  bag: "M20 40 L80 40 L86 88 L14 88 Z M36 40 Q36 18 50 18 Q64 18 64 40",
  scarf: "M26 14 L74 14 L74 30 L62 30 L66 90 L50 90 L48 30 L26 30 Z",
  necklace: "M20 20 Q50 80 80 20",
  glasses: "M12 46 a14 12 0 1 0 28 0 a14 12 0 1 0 -28 0 M60 46 a14 12 0 1 0 28 0 a14 12 0 1 0 -28 0 M40 44 Q50 38 60 44",
  hosiery: "M34 8 L66 8 L64 50 L60 92 L50 92 L50 50 L48 92 L38 92 L36 50 Z",
};

function pathFor(category: Category, shape: GarmentShape, subtype = ""): { d: string; stroke?: boolean } {
  const s = subtype.toLowerCase();
  switch (category) {
    case "tops":
      return { d: shape.sleeve === "none" ? P.tank : shape.sleeve === "long" ? P.sweater : P.tee };
    case "shirts":
      return { d: P.shirt };
    case "knitwear":
      return { d: /кардиган/.test(s) ? P.blazer : P.sweater };
    case "trousers":
      return { d: P.trousers };
    case "jeans":
      return { d: P.jeans };
    case "skirts":
      return { d: P.skirt };
    case "shorts":
      return { d: P.shorts };
    case "dresses":
      return { d: P.dress };
    case "jumpsuits":
      return { d: P.jumpsuit };
    case "blazers":
      return { d: P.blazer };
    case "outerwear":
      return { d: P.coat };
    case "shoes": {
      const t = shape.shoeType;
      if (t === "heels" || t === "sandals") return { d: P.heel };
      if (t === "boots" || t === "knee_boots" || t === "ankle_boots") return { d: P.boot };
      if (t === "loafers" || t === "flats") return { d: P.loafer };
      return { d: P.sneaker };
    }
    case "belts":
      return { d: P.belt };
    case "headwear":
      return { d: shape.hatType === "cap" ? P.cap : shape.hatType === "fedora" || shape.hatType === "panama" ? P.fedora : P.beanie };
    case "bags":
      return { d: P.bag };
    case "scarves":
      return { d: P.scarf };
    case "jewelry":
      return { d: P.necklace, stroke: true };
    case "accessories":
      return { d: P.glasses, stroke: true };
    case "hosiery":
      return { d: P.hosiery };
  }
}

export function garmentIcon(category: Category, colors: string[], shape: GarmentShape = {}, subtype?: string): string {
  const c = colors[0] ?? "#888";
  const c2 = colors[1] ?? shade(c, -0.25);
  const { d, stroke } = pathFor(category, shape, subtype);
  const svg = stroke
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${d}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c, 0.12)}"/><stop offset="1" stop-color="${shade(c, -0.12)}"/></linearGradient></defs><path d="${d}" fill="url(#g)" fill-rule="evenodd" stroke="${c2}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
