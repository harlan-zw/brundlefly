CREATE TABLE IF NOT EXISTS visitors (
  day TEXT NOT NULL,
  session TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (day, session),
  UNIQUE (day, ordinal)
);
CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  session TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  started INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS turns_day ON turns(day);
CREATE INDEX IF NOT EXISTS turns_session ON turns(day, session, started);
CREATE INDEX IF NOT EXISTS turns_ip ON turns(day, ip_hash);
