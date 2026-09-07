import { describe, expect, it } from "vitest";
import {
  DEFAULT_D1_LIMIT_MB,
  DEFAULT_R2_LIMIT_MB,
  MAX_D1_LIMIT_MB,
  MAX_R2_LIMIT_MB,
  findOrphanR2Objects,
  listR2Objects,
  listR2Storage,
  meter,
  parseLimitMb,
  purgeMediaStorage,
} from "../worker/lib/storage";

describe("storage quota guards", () => {
  it("uses conservative defaults and refuses limits above the safe maximum", () => {
    expect(parseLimitMb("not-a-number", DEFAULT_R2_LIMIT_MB, MAX_R2_LIMIT_MB)).toBe(
      DEFAULT_R2_LIMIT_MB,
    );
    expect(parseLimitMb(MAX_R2_LIMIT_MB + 1, DEFAULT_R2_LIMIT_MB, MAX_R2_LIMIT_MB)).toBe(
      DEFAULT_R2_LIMIT_MB,
    );
    expect(parseLimitMb(MAX_D1_LIMIT_MB + 1, DEFAULT_D1_LIMIT_MB, MAX_D1_LIMIT_MB)).toBe(
      DEFAULT_D1_LIMIT_MB,
    );
  });

  it("reports remaining capacity and blocks exactly at the limit", () => {
    const result = meter(100, 1_000);
    expect(result.percent).toBe(10);
    expect(result.remainingBytes).toBe(900);
    expect(result.blocked).toBe(false);
    expect(meter(1_000, 1_000).blocked).toBe(true);
  });

  it("lists every R2 page and sums the real object sizes", async () => {
    const calls: Array<string | undefined> = [];
    const bucket = {
      list: async (options: { cursor?: string }) => {
        calls.push(options.cursor);
        if (!options.cursor)
          return {
            objects: [{ size: 12 }, { size: 8 }],
            truncated: true,
            cursor: "page-2",
          };
        return { objects: [{ size: 5 }], truncated: false };
      },
    } as unknown as R2Bucket;

    await expect(listR2Storage(bucket)).resolves.toEqual({
      bytes: 25,
      objects: 3,
    });
    expect(calls).toEqual([undefined, "page-2"]);
  });

  it("identifies bucket objects without a D1 media reference", () => {
    const objects = [
      { key: "kept/photo.jpg", size: 10 },
      { key: "orphan/upload.tmp", size: 7 },
    ];
    expect(findOrphanR2Objects(objects, new Set(["kept/photo.jpg"]))).toEqual([
      { key: "orphan/upload.tmp", size: 7 },
    ]);
  });

  it("lists object keys and sizes across all R2 pages", async () => {
    const bucket = {
      list: async (options: { cursor?: string }) =>
        options.cursor
          ? { objects: [{ key: "b", size: 2 }], truncated: false }
          : {
              objects: [{ key: "a", size: 1 }],
              truncated: true,
              cursor: "next",
            },
    } as unknown as R2Bucket;

    await expect(listR2Objects(bucket)).resolves.toEqual([
      { key: "a", size: 1 },
      { key: "b", size: 2 },
    ]);
  });

  it("deletes R2 media before deleting its D1 reference", async () => {
    const events: string[] = [];
    const bucket = {
      delete: async (key: string) => {
        events.push(`r2:${key}`);
      },
    } as unknown as R2Bucket;
    const db = {
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => ({ bytes: 20, objects: 2 }),
      }),
      batch: async () => {
        events.push("d1");
      },
    } as unknown as D1Database;

    await purgeMediaStorage(db, bucket, [
      { id: "media-1", r2Key: "dani/photo.jpg", byteSize: 10 },
    ]);
    expect(events).toEqual(["r2:dani/photo.jpg", "d1"]);
  });
});
