CREATE TABLE IF NOT EXISTS public.rooms (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{6}$'),
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated TIMESTAMPTZ NOT NULL DEFAULT now()
);
