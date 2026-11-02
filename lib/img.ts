const CLOUD = "oxhcnerh";

export const img = (url: string, w = 500) =>
  `https://res.cloudinary.com/${CLOUD}/image/fetch/f_auto,q_auto,w_${w}/${url}`;
// JPG version for link previews (WhatsApp/Discord don't always like webp)
export const ogImg = (url: string) =>
  `https://res.cloudinary.com/${CLOUD}/image/fetch/f_jpg,q_auto,w_900,c_limit/${url}`;
