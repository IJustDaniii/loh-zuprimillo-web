CREATE TABLE storage_usage (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  r2_bytes INTEGER NOT NULL DEFAULT 0 CHECK (r2_bytes >= 0),
  r2_objects INTEGER NOT NULL DEFAULT 0 CHECK (r2_objects >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO storage_usage (id, r2_bytes, r2_objects)
SELECT 1, COALESCE(SUM(byte_size), 0), COUNT(*) FROM media;

INSERT INTO app_settings (key, value_json, description) VALUES
  ('r2_storage_limit_mb', '8192', 'Tope preventivo de R2 en MB (máximo seguro: 9216 MB)'),
  ('d1_storage_limit_mb', '400', 'Tope preventivo de D1 en MB (máximo seguro: 450 MB)')
ON CONFLICT(key) DO NOTHING;
