import { describe, expect, it } from "vitest";
import {
  claimInviteSchema,
  createPostSchema,
  parsePage,
} from "../shared/schemas";

const validPost = {
  title: "La noche del cono",
  body: "Existe documentación.",
  happenedAt: "2025-08-12T22:30:00.000Z",
  mediaIds: [],
  peopleIds: [],
  tagIds: [],
};

describe("createPostSchema", () => {
  it("acepta una publicación de texto con título y fecha", () => {
    expect(createPostSchema.parse(validPost).title).toBe("La noche del cono");
  });

  it("rechaza una publicación sin texto, enlace ni archivo", () => {
    const result = createPostSchema.safeParse({ ...validPost, body: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza coordenadas fuera del planeta", () => {
    const result = createPostSchema.safeParse({
      ...validPost,
      location: {
        label: "Marte",
        address: "",
        latitude: 120,
        longitude: 5,
      },
    });
    expect(result.success).toBe(false);
  });

  it("limita las relaciones para evitar cuerpos descontrolados", () => {
    const result = createPostSchema.safeParse({
      ...validPost,
      peopleIds: Array.from({ length: 21 }, (_, i) => `usr_${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza protocolos ejecutables en enlaces", () => {
    expect(
      createPostSchema.safeParse({
        ...validPost,
        body: "",
        externalUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("claimInviteSchema", () => {
  it("exige una contraseña de al menos diez caracteres", () => {
    expect(
      claimInviteSchema.safeParse({ code: "x".repeat(30), password: "corta" })
        .success,
    ).toBe(false);
  });
});

describe("parsePage", () => {
  it("usa la primera página ante valores hostiles", () => {
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("1 OR 1=1")).toBe(1);
  });

  it("limita páginas absurdamente altas", () => {
    expect(parsePage("99999999")).toBe(10_000);
  });
});
