const CLOUD = "oxhcnerh";

export const PREVIEW_TAG = "__pv__";

type ImgSrc = string | { image_url: string; tags?: string[] | null };

// Small preview copy saved next to the original (p_<file>.jpg)
export const previewOf = (w: { image_url: string; tags?: string[] | null }) =>
  Array.isArray(w.tags) && w.tags.includes(PREVIEW_TAG)
    ? w.image_url.replace(/\/([^/?#]+)$/, "/p_$1.jpg")
    : w.image_url;

export const img = (src: ImgSrc, w = 500) => {
  const url = typeof src === "string" ? src : previewOf(src);
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/f_auto,q_auto,w_${w}/${url}`;
};

// JPG version for link previews (WhatsApp/Discord don't always like webp)
export const ogImg = (url: string) =>
  `https://res.cloudinary.com/${CLOUD}/image/fetch/f_jpg,q_auto,w_900,c_limit/${url}`;
