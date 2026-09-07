import { z } from "zod";

const cleanText = (max: number) => z.string().trim().max(max);
const optionalIdArray = z.array(z.string().min(1).max(80)).max(20).default([]);
const safeExternalUrl = z
  .union([z.url().max(2_000), z.literal("")])
  .refine(
    (value) => !value || ["http:", "https:"].includes(new URL(value).protocol),
    "Solo se permiten enlaces http o https.",
  );

export const loginSchema = z.object({
  handle: z.string().trim().min(1).max(40),
  password: z.string().min(10).max(200),
  deviceName: cleanText(80).optional(),
});

export const claimInviteSchema = z.object({
  code: z.string().trim().min(20).max(200),
  password: z.string().min(10).max(200),
  deviceName: cleanText(80).optional(),
});

const postFields = {
  title: cleanText(160).min(1),
  body: cleanText(10_000).default(""),
  description: cleanText(2_000).default(""),
  happenedAt: z.string().datetime({ offset: true }),
  externalUrl: safeExternalUrl.optional(),
  context: cleanText(2_000).default(""),
  aftermath: cleanText(2_000).default(""),
  mediaIds: optionalIdArray,
  peopleIds: optionalIdArray,
  tagIds: optionalIdArray,
  location: z
    .object({
      label: cleanText(160).min(1),
      address: cleanText(500).default(""),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
};

export const createPostSchema = z
  .object(postFields)
  .superRefine((value, ctx) => {
    if (!value.body && !value.externalUrl && value.mediaIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Añade texto, enlace o al menos un archivo.",
        path: ["body"],
      });
    }
  });

export const updatePostSchema = z
  .object(postFields)
  .omit({ mediaIds: true })
  .partial();

export const commentSchema = z
  .object({
    body: cleanText(4_000).default(""),
    parentId: z.string().max(80).nullable().optional(),
    mediaIds: z.array(z.string().min(1).max(80)).max(4).default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.body && value.mediaIds.length === 0)
      ctx.addIssue({ code: "custom", message: "El comentario está vacío." });
  });

export const loreSchema = z.object({
  title: cleanText(180).min(1),
  summary: cleanText(500).min(1),
  body: cleanText(20_000).min(1),
  happenedAt: z
    .union([z.string().datetime({ offset: true }), z.literal("")])
    .optional(),
  postId: z.string().max(80).nullable().optional(),
});

export const pollSchema = z.object({
  question: cleanText(300).min(1),
  options: z.array(cleanText(120).min(1)).min(2).max(10),
  closesAt: z
    .union([z.string().datetime({ offset: true }), z.literal("")])
    .optional(),
  isMultiple: z.boolean().default(false),
});

export const invitationSchema = z.object({
  userId: z.string().min(1).max(80),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const profileSchema = z.object({ bio: cleanText(500) });

export const adminEntitySchema = z.object({
  entity: z.enum(["tags", "reactions", "achievements", "awards", "trivia"]),
  values: z.record(z.string(), z.unknown()),
});

export function parsePage(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}
