export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT,
  email TEXT,
  linkedin_url TEXT,
  signature TEXT,
  budget_limit REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  linkedin_url TEXT,
  status TEXT DEFAULT 'pending',
  instructions TEXT,
  examples TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  linkedin_post_url TEXT,
  category TEXT,
  author TEXT,
  template_text TEXT,
  example_text TEXT,
  image_url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  publication_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contenus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  url TEXT,
  type TEXT,
  pdf_path TEXT,
  content_raw TEXT,
  summary TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT,
  description TEXT,
  model TEXT DEFAULT 'anthropic/claude-sonnet-4',
  status TEXT DEFAULT 'Idée',
  v1 TEXT,
  v2 TEXT,
  v3 TEXT,
  selected_version TEXT,
  final_version TEXT,
  optimization_instructions TEXT,
  publication_date TEXT,
  image_path TEXT,
  media_json TEXT,
  first_comment TEXT,
  first_comment_posted INTEGER DEFAULT 0,
  linkedin_post_url TEXT,
  linkedin_post_id TEXT,
  style_id INTEGER REFERENCES styles(id),
  template_id INTEGER REFERENCES templates(id),
  contenu_id INTEGER REFERENCES contenus(id),
  likes INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  publish_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id),
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publish_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id),
  action TEXT NOT NULL,
  status TEXT,
  response_body TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS posts_updated_at
  AFTER UPDATE ON posts
  FOR EACH ROW
BEGIN
  UPDATE posts SET updated_at = datetime('now') WHERE id = OLD.id;
END;
`;
