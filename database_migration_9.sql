-- BoredGame - Supabase migration 9: charades game state
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- Charades is played on one device and never needed a room, so its scores only
-- ever lived in React state - a refresh, a phone locking, or a stray back
-- gesture in the middle of a party lost the whole game. This keeps the game
-- safe until it is finished.
--
-- The whole game is one JSON blob rather than a table per concept. Nothing else
-- reads it, it is written as a unit every few seconds, and keeping it in one
-- row means a resume is a single fetch.

CREATE TABLE IF NOT EXISTS charades_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state JSONB NOT NULL,
  finished BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charades_games_updated
  ON charades_games (updated_at);

ALTER TABLE charades_games ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'charades_games' AND policyname = 'Allow all on charades_games'
  ) THEN
    CREATE POLICY "Allow all on charades_games" ON charades_games FOR ALL USING (true);
  END IF;
END $$;

-- Keep updated_at honest without the client having to remember to set it.
CREATE OR REPLACE FUNCTION touch_charades_game()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charades_games_touch ON charades_games;
CREATE TRIGGER charades_games_touch
  BEFORE UPDATE ON charades_games
  FOR EACH ROW EXECUTE FUNCTION touch_charades_game();

-- Games people walked away from should not pile up forever. Finished games are
-- kept a week so scores can still be looked at the next day.
CREATE OR REPLACE FUNCTION cleanup_charades_games()
RETURNS void AS $$
BEGIN
  DELETE FROM charades_games
  WHERE (finished = FALSE AND updated_at < NOW() - INTERVAL '12 hours')
     OR (finished = TRUE  AND updated_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;
