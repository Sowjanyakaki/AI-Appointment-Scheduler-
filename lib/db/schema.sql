CREATE TABLE IF NOT EXISTS booking_sessions (
  id TEXT PRIMARY KEY,
  intent TEXT,
  topic TEXT,
  time_preference TEXT,
  offered_slots TEXT,
  state TEXT NOT NULL DEFAULT 'GREETING',
  chosen_slot TEXT,
  booking_code TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secure_links (
  token TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_contacts (
  token TEXT PRIMARY KEY REFERENCES secure_links(token),
  phone TEXT,
  email TEXT,
  account_number TEXT,
  submitted_at TEXT NOT NULL
);
