-- BoredGame - Supabase migration 8: Who's More Likely?
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- The whole point of the game is the simultaneous reveal, so `chosen_player_id`
-- is revoked from the browser. Clients can see *that* someone has locked in
-- (picked_at) but not what they chose, until the round resolves.
--
-- Agreement is stored as a player id, not as "Me"/"Partner" wording. If Victor
-- picks himself and Kolade also picks Victor, both named the same person and
-- that is a match - which comparing button labels could never get right.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wml_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  question JSONB NOT NULL,
  double_points BOOLEAN DEFAULT FALSE,
  matched BOOLEAN,
  points INTEGER DEFAULT 0,
  streak_after INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS wml_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  chosen_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  picked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, round_number, player_id)
);

CREATE INDEX IF NOT EXISTS idx_wml_rounds_session ON wml_rounds (session_id, round_number);
CREATE INDEX IF NOT EXISTS idx_wml_picks_session ON wml_picks (session_id, round_number);

-- ---------------------------------------------------------------------------
-- 2. RLS + realtime
-- ---------------------------------------------------------------------------
ALTER TABLE wml_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE wml_picks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wml_rounds' AND policyname='Allow all on wml_rounds') THEN
    CREATE POLICY "Allow all on wml_rounds" ON wml_rounds FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wml_picks' AND policyname='Allow all on wml_picks') THEN
    CREATE POLICY "Allow all on wml_picks" ON wml_picks FOR ALL USING (true);
  END IF;
END $$;

ALTER TABLE wml_rounds REPLICA IDENTITY FULL;
ALTER TABLE wml_picks REPLICA IDENTITY FULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wml_rounds', 'wml_picks'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Hide the picks until the reveal
-- ---------------------------------------------------------------------------
REVOKE SELECT ON wml_picks FROM anon, authenticated;
GRANT SELECT (id, session_id, round_number, player_id, picked_at)
  ON wml_picks TO anon, authenticated;
GRANT INSERT, DELETE ON wml_picks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wml_rounds TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Playing a round
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wml_submit_pick(
  p_session_id UUID,
  p_round_number INTEGER,
  p_player_id UUID,
  p_chosen_player_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved BOOLEAN;
  v_double BOOLEAN;
  v_players INTEGER;
  v_picks INTEGER;
  v_distinct INTEGER;
  v_matched BOOLEAN;
  v_streak INTEGER;
  v_points INTEGER := 0;
  v_bonus INTEGER := 0;
BEGIN
  SELECT resolved, double_points INTO v_resolved, v_double
  FROM wml_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_resolved IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Round not found.');
  END IF;
  IF v_resolved THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That round is already done.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM wml_picks
    WHERE session_id = p_session_id AND round_number = p_round_number
      AND player_id = p_player_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already picked.');
  END IF;

  INSERT INTO wml_picks (session_id, round_number, player_id, chosen_player_id)
  VALUES (p_session_id, p_round_number, p_player_id, p_chosen_player_id);

  SELECT count(*) INTO v_players
  FROM players p
  JOIN game_sessions gs ON gs.room_id = p.room_id
  WHERE gs.id = p_session_id AND COALESCE(p.is_spectator, FALSE) = FALSE;

  SELECT count(*), count(DISTINCT chosen_player_id) INTO v_picks, v_distinct
  FROM wml_picks
  WHERE session_id = p_session_id AND round_number = p_round_number;

  -- Still waiting on the other one; say nothing about what was chosen.
  IF v_picks < v_players THEN
    RETURN jsonb_build_object('ok', true, 'waiting', true);
  END IF;

  -- Everyone in. Agreement means every pick names the same person.
  v_matched := v_distinct = 1;

  -- Shared streak, counted from the rounds already played rather than trusted
  -- from a client.
  WITH prior AS (
    SELECT matched, ROW_NUMBER() OVER (ORDER BY round_number DESC) AS rn
    FROM wml_rounds
    WHERE session_id = p_session_id AND resolved = TRUE
      AND round_number < p_round_number
  )
  SELECT COALESCE(
    (SELECT MIN(rn) - 1 FROM prior WHERE matched IS NOT TRUE),
    (SELECT count(*) FROM prior)
  ) INTO v_streak;

  IF v_matched THEN
    v_streak := v_streak + 1;
    v_bonus := CASE v_streak
                 WHEN 3 THEN 5 WHEN 5 THEN 10 WHEN 7 THEN 15 WHEN 10 THEN 25
                 ELSE 0 END;
    v_points := (10 * CASE WHEN v_double THEN 2 ELSE 1 END) + v_bonus;
  ELSE
    v_streak := 0;
  END IF;

  UPDATE wml_rounds
  SET matched = v_matched, points = v_points, streak_after = v_streak, resolved = TRUE
  WHERE session_id = p_session_id AND round_number = p_round_number;

  RETURN jsonb_build_object(
    'ok', true, 'waiting', false, 'matched', v_matched,
    'points', v_points, 'bonus', v_bonus, 'streak', v_streak
  );
END;
$$ LANGUAGE plpgsql;

-- Picks for rounds that are already settled, so the reveal can name who chose
-- whom. Refuses while a round is still open.
CREATE OR REPLACE FUNCTION wml_reveal(p_session_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'round_number', p.round_number,
             'player_id', p.player_id,
             'chosen_player_id', p.chosen_player_id) ORDER BY p.round_number)
    FROM wml_picks p
    JOIN wml_rounds r
      ON r.session_id = p.session_id AND r.round_number = p.round_number
    WHERE p.session_id = p_session_id AND r.resolved = TRUE
  ), '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION wml_submit_pick(UUID, INTEGER, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wml_reveal(UUID) TO anon, authenticated;
