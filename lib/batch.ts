export interface Taggable {
  id: string;
  tags?: string[] | null;
}

const B = "__batch_";
const O = "__bo_";

export const makeBatchTags = (batchId: string, order: number) => [
  `${B}${batchId}__`,
  `${O}${order}__`,
];

const tagsOf = (w: Taggable) => (Array.isArray(w.tags) ? w.tags : []);

export const getBatchId = (w: Taggable): string | null => {
  const t = tagsOf(w).find((x) => x.startsWith(B) && x.endsWith("__"));
  return t ? t.slice(B.length, -2) : null;
};

export const getBatchOrder = (w: Taggable): number => {
  const t = tagsOf(w).find((x) => x.startsWith(O) && x.endsWith("__"));
  return t ? parseInt(t.slice(O.length, -2), 10) || 0 : 0;
};

export function groupBatches<T extends Taggable>(list: T[]): { cover: T; slides: T[] }[] {
  const out: { cover: T; slides: T[] }[] = [];
  const at = new Map<string, number>();
  for (const w of list) {
    const b = getBatchId(w);
    if (!b) {
      out.push({ cover: w, slides: [w] });
      continue;
    }
    const i = at.get(b);
    if (i === undefined) {
      at.set(b, out.length);
      out.push({ cover: w, slides: [w] });
    } else {
      out[i].slides.push(w);
    }
  }
  for (const g of out) {
    if (g.slides.length > 1) {
      g.slides.sort((a, b) => getBatchOrder(a) - getBatchOrder(b));
      g.cover = g.slides[0];
    }
  }
  return out;
}
