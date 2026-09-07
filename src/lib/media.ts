import type { MediaKind } from "../../shared/contracts";

const IMAGE_MEDIA_KINDS: ReadonlySet<MediaKind> = new Set([
  "IMAGE",
  "GIF",
  "AVATAR",
]);

export function isImageMedia(kind: MediaKind): boolean {
  return IMAGE_MEDIA_KINDS.has(kind);
}
