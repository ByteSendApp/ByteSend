import crypto from "crypto";

export type GravatarRating = "g" | "pg" | "r" | "x";

export type GravatarDefaultImage =
  | "404"
  | "mp"
  | "identicon"
  | "monsterid"
  | "wavatar"
  | "retro"
  | "robohash"
  | "blank";

export interface GravatarOptions {
  size?: number;
  defaultImage?: GravatarDefaultImage;
  rating?: GravatarRating;
}

export function getGravatarUrl(
  email: string,
  options: GravatarOptions = {
    size: 80,
    defaultImage: "identicon",
    rating: "g",
  }
) {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(trimmedEmail).digest("hex");

  const baseUrl = "https://www.gravatar.com/avatar/";

  const queryParams = new URLSearchParams();

  if (options.size) {
    queryParams.set("s", options.size.toString());
  }
  if (options.defaultImage) {
    queryParams.set("d", options.defaultImage);
  }
  if (options.rating) {
    queryParams.set("r", options.rating);
  }

  const queryString = queryParams.toString();
  const finalUrl = queryString
    ? `${baseUrl}${hash}?${queryString}`
    : `${baseUrl}${hash}`;

  return finalUrl;
}
