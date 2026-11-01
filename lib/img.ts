const CLOUD = "oxhcnerh";

export const img = (url: string, w = 500) =>
  `https://res.cloudinary.com/${CLOUD}/image/fetch/f_auto,q_auto,w_${w}/${url}`;
