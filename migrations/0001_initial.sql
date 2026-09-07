PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER','ADMIN')),
  status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','ACTIVE','SUSPENDED')),
  password_hash TEXT,
  password_salt TEXT,
  bio TEXT NOT NULL DEFAULT '',
  avatar_media_id TEXT,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX invitations_user_idx ON invitations(user_id, created_at DESC);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Dispositivo sin nombre',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX sessions_token_idx ON sessions(token_hash);
CREATE INDEX sessions_user_idx ON sessions(user_id, created_at DESC);

CREATE TABLE auth_attempts (
  key_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL DEFAULT (datetime('now')),
  locked_until TEXT
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX locations_coords_idx ON locations(latitude, longitude);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  happened_at TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  external_url TEXT,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  context TEXT NOT NULL DEFAULT '',
  aftermath TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'MEMBERS' CHECK (visibility = 'MEMBERS'),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX posts_feed_idx ON posts(deleted_at, happened_at DESC, created_at DESC);
CREATE INDEX posts_author_idx ON posts(author_id, deleted_at, created_at DESC);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('IMAGE','VIDEO','AUDIO','GIF','DOCUMENT','AVATAR','REACTION')),
  mime_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL,
  post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX media_post_idx ON media(post_id);

CREATE TABLE post_people (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#ff5c35',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  label TEXT NOT NULL,
  emoji TEXT,
  image_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE post_reactions (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_id TEXT NOT NULL REFERENCES reactions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id, reaction_id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX comments_post_idx ON comments(post_id, created_at);
CREATE TABLE comment_reactions (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_id TEXT NOT NULL REFERENCES reactions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, user_id, reaction_id)
);

CREATE TABLE lore_entries (
  id TEXT PRIMARY KEY,
  proposer_id TEXT NOT NULL REFERENCES users(id),
  reviewer_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  happened_at TEXT,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX lore_status_idx ON lore_entries(status, happened_at DESC);

CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  closes_at TEXT,
  is_multiple INTEGER NOT NULL DEFAULT 0 CHECK (is_multiple IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE poll_votes (
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (option_id, user_id)
);

CREATE TABLE battles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  left_post_id TEXT NOT NULL REFERENCES posts(id),
  right_post_id TEXT NOT NULL REFERENCES posts(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE battle_votes (
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chosen_post_id TEXT NOT NULL REFERENCES posts(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (battle_id, user_id)
);

CREATE TABLE trivia_questions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('WHO_SAID','WHICH_YEAR')),
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  source_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE trivia_answers (
  question_id TEXT NOT NULL REFERENCES trivia_questions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (question_id, user_id)
);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  xp_reward INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  awarded_by TEXT REFERENCES users(id),
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE awards (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🏅',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (year, title)
);
CREATE TABLE award_winners (
  award_id TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (award_id, user_id)
);

CREATE TABLE xp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX xp_user_idx ON xp_events(user_id, created_at DESC);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '/',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX notifications_user_idx ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX audit_created_idx ON audit_log(created_at DESC);

INSERT INTO users (id, handle, display_name, role) VALUES
  ('usr_dani', 'dani', 'Dani', 'ADMIN'),
  ('usr_adri', 'adri', 'Adri', 'MEMBER'),
  ('usr_gonzalo', 'gonzalo', 'Gonzalo', 'MEMBER'),
  ('usr_carlos', 'carlos', 'Carlos', 'MEMBER'),
  ('usr_patri', 'patri', 'Patri', 'MEMBER'),
  ('usr_agustin', 'agustin', 'Agustín', 'MEMBER'),
  ('usr_iker', 'iker', 'Iker', 'MEMBER'),
  ('usr_javi_o', 'javi-o', 'Javi O.', 'MEMBER'),
  ('usr_alvaro', 'alvaro', 'Álvaro', 'MEMBER'),
  ('usr_rafa', 'rafa', 'Rafa', 'MEMBER');

INSERT INTO reactions (id, slug, label, emoji, sort_order) VALUES
  ('rea_like', 'like', 'Me renta', '🫡', 10),
  ('rea_cine', 'cine', 'Cine', '🎬', 20),
  ('rea_turbio', 'turbio', 'Turbio', '🫣', 30),
  ('rea_factos', 'factos', 'Factos', '📠', 40);

INSERT INTO tags (id, slug, label, color) VALUES
  ('tag_lore', 'lore', 'Lore', '#ff5c35'),
  ('tag_viaje', 'viaje', 'Viaje', '#169873'),
  ('tag_noche', 'noche', 'Noche', '#7950f2'),
  ('tag_archivo', 'archivo', 'Archivo histórico', '#2673dd');

INSERT INTO achievements (id, slug, title, description, icon, xp_reward) VALUES
  ('ach_first_post', 'primer-documento', 'Notario del caos', 'Publicó su primera pieza del archivo.', '✍️', 25),
  ('ach_first_comment', 'primer-comentario', 'Fiscal de barra', 'Dejó su primer comentario.', '⚖️', 10),
  ('ach_cartographer', 'cartografo', 'Cartógrafo del lore', 'Publicó un recuerdo con ubicación.', '🗺️', 40);

INSERT INTO app_settings (key, value_json, description) VALUES
  ('site_name', '"LOH ZUPRIMILLO\u0027"', 'Nombre visible de la red'),
  ('accent_color', '"#ff5c35"', 'Color de acento CSS'),
  ('uploads_enabled', 'true', 'Permite nuevas subidas'),
  ('max_upload_mb', '50', 'Límite por archivo'),
  ('motd', '"Diez personas. Cero contexto."', 'Mensaje del día');
