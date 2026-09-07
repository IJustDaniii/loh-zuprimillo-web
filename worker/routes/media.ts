import { Hono } from "hono";
import { AppError, privateHeaders } from "../lib/http";
import {
  D1_UPLOAD_RESERVE_BYTES,
  getStorageLimits,
  listR2Storage,
  readD1StorageBytes,
  releaseR2Storage,
  reserveR2Storage,
} from "../lib/storage";
import { requireAuth, requireCsrf } from "../middleware/auth";
import type { AppEnv } from "../types";

const media = new Hono<AppEnv>();
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function kindFor(mime: string) {
  if (mime === "image/gif") return "GIF";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

media.use("*", requireAuth);
media.post("/", requireCsrf, async (c) => {
  const uploadsEnabled = await c.env.DB.prepare(
    "SELECT value_json FROM app_settings WHERE key='uploads_enabled'",
  ).first<{ value_json: string }>();
  if (uploadsEnabled?.value_json === "false")
    throw new AppError(403, "UPLOADS_DISABLED", "Las subidas están pausadas.");
  const max = await c.env.DB.prepare(
    "SELECT value_json FROM app_settings WHERE key='max_upload_mb'",
  ).first<{ value_json: string }>();
  const maxBytes = Math.min(250, Number(max?.value_json ?? 100)) * 1024 * 1024;
  const announcedSize = Number(c.req.header("Content-Length") ?? 0);
  if (announcedSize > maxBytes + 1_000_000)
    throw new AppError(
      413,
      "FILE_TOO_LARGE",
      `El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    );
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new AppError(422, "FILE_REQUIRED", "Selecciona un archivo.");
  if (file.size > maxBytes)
    throw new AppError(
      413,
      "FILE_TOO_LARGE",
      `El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    );
  if (!allowedTypes.has(file.type))
    throw new AppError(
      415,
      "FILE_TYPE_BLOCKED",
      "Ese tipo de archivo no está permitido.",
    );
  const id = crypto.randomUUID();
  const key = `${c.get("member").id}/${new Date().toISOString().slice(0, 10)}/${id}`;
  const buffer = await file.arrayBuffer();
  if (!matchesSignature(file.type, new Uint8Array(buffer)))
    throw new AppError(
      415,
      "FILE_SIGNATURE_INVALID",
      "El contenido del archivo no coincide con su tipo declarado.",
    );
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const limits = await getStorageLimits(c.env.DB);
  const d1Bytes = await readD1StorageBytes(c.env.DB);
  if (d1Bytes + D1_UPLOAD_RESERVE_BYTES > limits.d1LimitBytes)
    throw new AppError(
      413,
      "D1_STORAGE_LIMIT",
      "La base de datos esta en su limite preventivo. Dani debe liberar espacio antes de subir mas archivos.",
    );
  const r2Usage = await listR2Storage(c.env.MEDIA);
  const reserved = await reserveR2Storage(
    c.env.DB,
    file.size,
    limits.r2LimitBytes,
    r2Usage.bytes,
    r2Usage.objects,
  );
  if (!reserved)
    throw new AppError(
      413,
      "R2_STORAGE_LIMIT",
      "El almacenamiento de archivos esta lleno. Dani debe liberar espacio antes de subir mas archivos.",
    );
  try {
    await c.env.MEDIA.put(key, buffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { ownerId: c.get("member").id, mediaId: id },
    });
    await c.env.DB.prepare(
      "INSERT INTO media (id,owner_id,r2_key,kind,mime_type,original_name,byte_size,sha256) VALUES (?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        c.get("member").id,
        key,
        kindFor(file.type),
        file.type,
        file.name.slice(0, 255),
        file.size,
        sha,
      )
      .run();
  } catch (error) {
    await c.env.MEDIA.delete(key);
    await releaseR2Storage(c.env.DB, file.size);
    throw error;
  }
  return c.json(
    {
      media: {
        id,
        kind: kindFor(file.type),
        mimeType: file.type,
        originalName: file.name,
        byteSize: file.size,
        url: `/api/media/${id}`,
      },
    },
    201,
  );
});

function matchesSignature(mime: string, bytes: Uint8Array) {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (mime === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (mime === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (mime === "image/gif")
    return String.fromCharCode(...bytes.slice(0, 3)) === "GIF";
  if (mime === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  if (mime === "application/pdf")
    return String.fromCharCode(...bytes.slice(0, 4)) === "%PDF";
  if (mime === "application/zip" || mime.includes("wordprocessingml"))
    return starts(0x50, 0x4b);
  if (mime === "video/mp4" || mime === "audio/mp4")
    return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  if (mime === "video/webm") return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (mime === "audio/ogg")
    return String.fromCharCode(...bytes.slice(0, 4)) === "OggS";
  if (mime === "audio/wav")
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF";
  if (mime === "audio/mpeg")
    return (
      String.fromCharCode(...bytes.slice(0, 3)) === "ID3" ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  return mime === "text/plain";
}

media.get("/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id=?")
    .bind(c.req.param("id"))
    .first<any>();
  if (!row)
    throw new AppError(404, "MEDIA_NOT_FOUND", "Archivo no encontrado.");
  if (
    !row.post_id &&
    !row.comment_id &&
    row.kind !== "AVATAR" &&
    row.kind !== "REACTION" &&
    row.owner_id !== c.get("member").id &&
    c.get("member").role !== "ADMIN"
  ) {
    throw new AppError(
      403,
      "MEDIA_FORBIDDEN",
      "Este archivo todavía no está publicado.",
    );
  }
  const object = await c.env.MEDIA.get(row.r2_key, {
    range: c.req.raw.headers,
  });
  if (!object)
    throw new AppError(
      404,
      "MEDIA_OBJECT_MISSING",
      "El archivo no está disponible en almacenamiento.",
    );
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  privateHeaders(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
  );
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; media-src 'self'; sandbox",
  );
  headers.set("ETag", object.httpEtag);
  const ranged = object as R2ObjectBody & {
    range?: { offset: number; length: number };
  };
  if (c.req.header("Range") && ranged.range) {
    headers.set(
      "Content-Range",
      `bytes ${ranged.range.offset}-${ranged.range.offset + ranged.range.length - 1}/${object.size}`,
    );
    headers.set("Content-Length", String(ranged.range.length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
});

export default media;
