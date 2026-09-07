import { Hono } from "hono";
import auth from "./routes/auth";
import media from "./routes/media";
import posts from "./routes/posts";
import community from "./routes/community";
import admin from "./routes/admin";
import { AppError, privateHeaders, securityHeaders } from "./lib/http";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  await next();
  securityHeaders(c.res.headers);
  if (c.req.path.startsWith("/api/")) privateHeaders(c.res.headers);
});

app.route("/api/auth", auth);
app.route("/api/media", media);
app.route("/api/posts", posts);
app.route("/api", community);
app.route("/api/admin", admin);

app.get("/robots.txt", (c) =>
  c.text("User-agent: *\nDisallow: /\n", 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  }),
);
app.all("/api/*", (c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada." } }, 404),
);

app.onError((error, c) => {
  const known = error instanceof AppError;
  if (!known)
    console.error("Unhandled request error", {
      path: c.req.path,
      method: c.req.method,
      name: error.name,
    });
  const status = known ? error.status : 500;
  const response = c.json(
    {
      error: {
        code: known ? error.code : "INTERNAL_ERROR",
        message: known ? error.message : "Algo falló en el servidor.",
        ...(known && error.details ? { details: error.details } : {}),
      },
    },
    status as any,
  );
  privateHeaders(response.headers);
  return response;
});

app.all("*", async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  const headers = new Headers(response.headers);
  securityHeaders(headers);
  if (headers.get("Content-Type")?.includes("text/html"))
    headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

export default app;
