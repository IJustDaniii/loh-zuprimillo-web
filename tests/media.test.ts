import { describe, expect, it } from "vitest";
import { isImageMedia } from "../src/lib/media";

describe("media presentation helpers", () => {
  it("treats uploaded images, GIFs and avatars as expandable images", () => {
    expect(isImageMedia("IMAGE")).toBe(true);
    expect(isImageMedia("GIF")).toBe(true);
    expect(isImageMedia("AVATAR")).toBe(true);
  });

  it("keeps non-image media in their own player/card", () => {
    expect(isImageMedia("VIDEO")).toBe(false);
    expect(isImageMedia("AUDIO")).toBe(false);
    expect(isImageMedia("DOCUMENT")).toBe(false);
  });
});
