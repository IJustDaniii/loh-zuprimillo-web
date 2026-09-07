import type { Context } from "hono";
import type { ZodType } from "zod";
import type { AppEnv } from "../types";

export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function jsonBody<T>(
  c: Context<AppEnv>,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "El cuerpo JSON no es válido.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "Revisa los campos indicados.",
      parsed.error.flatten(),
    );
  return parsed.data;
}

export function securityHeaders(headers: Headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );
  headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org; media-src 'self' blob:; connect-src 'self' https://nominatim.openstreetmap.org; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
}

export function privateHeaders(headers: Headers) {
  securityHeaders(headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
}
