import { describe, expect, it } from "vitest";
import {
  DEFAULT_D1_LIMIT_MB,
  DEFAULT_R2_LIMIT_MB,
  MAX_D1_LIMIT_MB,
  MAX_R2_LIMIT_MB,
  meter,
  parseLimitMb,
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
});
