const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "oxhcnerh";

export const PREVIEW_TAG = "__pv__";

type ImgSrc = string | { image_url: string; tags?: string[] | null };

const isCld = (u: string) =>
  u.includes("res.cloudinary.com") && u.includes("/image/upload/");

// Only used for old wallpapers that were uploaded before the Cloudinary switch
export const previewOf = (w: { image_url: string; tags?: string[] | null }) =>
  Array.isArray(w.tags) && w.tags.includes(PREVIEW_TAG)
    ? w.image_url.replace(/\/([^/?#]+)$/, "/p_$1.jpg")
    : w.image_url;

export const img = (src: ImgSrc, w = 500) => {
  const url = typeof src === "string" ? src : src.image_url;
  // New wallpapers already live on Cloudinary: just add the resize
  if (isCld(url))
    return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${w}/`);
  // Old wallpapers still on Supabase: Cloudinary fetches and resizes them
  const base = typeof src === "string" ? src : previewOf(src);
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/f_auto,q_auto,w_${w}/${base}`;
};

// JPG version for link previews (WhatsApp/Discord don't always like webp)
export const ogImg = (url: string) =>
  isCld(url)
    ? url.replace("/image/upload/", "/image/upload/f_jpg,q_auto,w_900,c_limit/")
    : `https://res.cloudinary.com/${CLOUD}/image/fetch/f_jpg,q_auto,w_900,c_limit/${url}`;
