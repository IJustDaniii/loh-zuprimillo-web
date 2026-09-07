import { describe, expect, it } from "vitest";
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "../worker/lib/crypto";

describe("password hashing", () => {
  it("verifica la contraseña correcta y rechaza otra", async () => {
    const password = await hashPassword("una contraseña larga");
    expect(
      await verifyPassword(
        "una contraseña larga",
        password.salt,
        password.hash,
      ),
    ).toBe(true);
    expect(
      await verifyPassword("otra contraseña", password.salt, password.hash),
    ).toBe(false);
  }, 20_000);

  it("genera tokens distintos con entropía suficiente", () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("produce huellas deterministas sin revelar la entrada", async () => {
    expect(await sha256("secreto")).toBe(await sha256("secreto"));
    expect(await sha256("secreto")).not.toContain("secreto");
  });
});
