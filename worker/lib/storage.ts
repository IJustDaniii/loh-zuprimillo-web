const BYTES_PER_MB = 1024 * 1024;

export const DEFAULT_R2_LIMIT_MB = 8 * 1024;
export const DEFAULT_D1_LIMIT_MB = 400;
export const MAX_R2_LIMIT_MB = 9 * 1024;
export const MAX_D1_LIMIT_MB = 450;
export const D1_UPLOAD_RESERVE_BYTES = 16 * BYTES_PER_MB;

export type StorageMeter = {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  percent: number;
  blocked: boolean;
};

export type StorageUsage = {
  r2: StorageMeter & { objects: number };
  d1: StorageMeter;
};

export function parseLimitMb(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum)
    return fallback;
  return parsed;
}

export function bytesFromMb(mb: number): number {
  return mb * BYTES_PER_MB;
}

export function meter(usedBytes: number, limitBytes: number): StorageMeter {
  const used = Math.max(0, Number(usedBytes) || 0);
  const limit = Math.max(1, Number(limitBytes) || 1);
  const remaining = Math.max(0, limit - used);
  return {
    usedBytes: used,
    limitBytes: limit,
    remainingBytes: remaining,
    percent: Math.min(100, Math.round((used / limit) * 1000) / 10),
    blocked: used >= limit,
  };
}

async function readLimits(db: D1Database) {
  const rows = await db
    .prepare(
      "SELECT key,value_json FROM app_settings WHERE key IN ('r2_storage_limit_mb','d1_storage_limit_mb')",
    )
    .all<{ key: string; value_json: string }>();
  const values = new Map(
    rows.results.map((row) => {
      try {
        return [row.key, JSON.parse(row.value_json)] as const;
      } catch {
        return [row.key, null] as const;
      }
    }),
  );
  const r2LimitMb = parseLimitMb(
    values.get("r2_storage_limit_mb"),
    DEFAULT_R2_LIMIT_MB,
    MAX_R2_LIMIT_MB,
  );
  const d1LimitMb = parseLimitMb(
    values.get("d1_storage_limit_mb"),
    DEFAULT_D1_LIMIT_MB,
    MAX_D1_LIMIT_MB,
  );
  return {
    r2LimitBytes: bytesFromMb(r2LimitMb),
    d1LimitBytes: bytesFromMb(d1LimitMb),
  };
}

async function ensureStorageUsage(db: D1Database) {
  try {
    const existing = await db
      .prepare(
        "SELECT COALESCE(r2_bytes,0) bytes,COALESCE(r2_objects,0) objects FROM storage_usage WHERE id=1",
      )
      .first<{ bytes: number; objects: number }>();
    if (existing) return existing;
  } catch {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS storage_usage (id INTEGER PRIMARY KEY CHECK (id = 1), r2_bytes INTEGER NOT NULL DEFAULT 0 CHECK (r2_bytes >= 0), r2_objects INTEGER NOT NULL DEFAULT 0 CHECK (r2_objects >= 0), updated_at TEXT NOT NULL DEFAULT (datetime('now')))"
    );
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO storage_usage (id,r2_bytes,r2_objects) SELECT 1,COALESCE(SUM(byte_size),0),COUNT(*) FROM media",
    )
    .run();
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO app_settings (key,value_json,description) VALUES ('r2_storage_limit_mb','8192','Tope preventivo de R2 en MB (maximo seguro: 9216 MB)')",
      )
      .bind(),
    db
      .prepare(
        "INSERT OR IGNORE INTO app_settings (key,value_json,description) VALUES ('d1_storage_limit_mb','400','Tope preventivo de D1 en MB (maximo seguro: 450 MB)')",
      )
      .bind(),
  ]);
  const seeded = await db
    .prepare(
      "SELECT COALESCE(r2_bytes,0) bytes,COALESCE(r2_objects,0) objects FROM storage_usage WHERE id=1",
    )
    .first<{ bytes: number; objects: number }>();
  if (!seeded) throw new Error("Storage usage counter could not be initialized");
  return seeded;
}

export async function readD1StorageBytes(db: D1Database): Promise<number> {
  const result = await db.prepare("SELECT 1").run();
  return Math.max(0, Number(result.meta.size_after) || 0);
}

export async function getStorageUsage(db: D1Database): Promise<StorageUsage> {
  const r2 = await ensureStorageUsage(db);
  const [limits, d1Bytes] = await Promise.all([
    readLimits(db),
    readD1StorageBytes(db),
  ]);
  return {
    r2: {
      ...meter(Number(r2?.bytes ?? 0), limits.r2LimitBytes),
      objects: Number(r2?.objects ?? 0),
    },
    d1: meter(d1Bytes, limits.d1LimitBytes),
  };
}

export async function reserveR2Storage(
  db: D1Database,
  bytes: number,
  limitBytes: number,
): Promise<boolean> {
  await ensureStorageUsage(db);
  const result = await db
    .prepare(
      `UPDATE storage_usage
       SET r2_bytes=r2_bytes+?,r2_objects=r2_objects+1,updated_at=datetime('now')
       WHERE id=1 AND r2_bytes+?<=?`,
    )
    .bind(bytes, bytes, limitBytes)
    .run();
  return Number(result.meta.changes) > 0;
}

export async function releaseR2Storage(
  db: D1Database,
  bytes: number,
): Promise<void> {
  await ensureStorageUsage(db);
  await db
    .prepare(
      `UPDATE storage_usage
       SET r2_bytes=MAX(0,r2_bytes-?),r2_objects=MAX(0,r2_objects-1),updated_at=datetime('now')
       WHERE id=1`,
    )
    .bind(bytes)
    .run();
}

export async function getStorageLimits(db: D1Database) {
  const usage = await getStorageUsage(db);
  return {
    r2LimitBytes: usage.r2.limitBytes,
    d1LimitBytes: usage.d1.limitBytes,
  };
}
