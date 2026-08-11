-- BoredGame - Supabase migration 7: Guess Me
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- The whole game rests on the guesser not seeing the answer before they commit,
-- so `answer` is revoked from the browser exactly like the Wordle and Trivia
-- answers. It is released by guessme_submit_guess() once a guess is locked in,
-- and scoring happens server-side so the points cannot be edited on the way.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guessme_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  question JSONB NOT NULL,          -- snapshot, so edits to the bank never change a played game
  answerer_id UUID REFERENCES players(id) ON DELETE SET NULL,
  guesser_id UUID REFERENCES players(id) ON DELETE SET NULL,
  answer TEXT,                      -- revoked from anon
  answered_at TIMESTAMP WITH TIME ZONE,
  guess TEXT,
  guessed_at TIMESTAMP WITH TIME ZONE,
  is_match BOOLEAN,
  closeness TEXT,
  points INTEGER DEFAULT 0,
  -- Open-ended rounds pause here until the answerer says whether it counts.
  needs_adjudication BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_guessme_rounds_session
  ON guessme_rounds (session_id, round_number);

-- ---------------------------------------------------------------------------
-- 2. RLS + realtime
-- ---------------------------------------------------------------------------
ALTER TABLE guessme_rounds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='guessme_rounds' AND policyname='Allow all on guessme_rounds') THEN
    CREATE POLICY "Allow all on guessme_rounds" ON guessme_rounds FOR ALL USING (true);
  END IF;
END $$;

ALTER TABLE guessme_rounds REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'guessme_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE guessme_rounds;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Hide the answer
--     `answered_at` stays readable so the guesser's screen can say "they have
--     answered, your turn" without leaking what was chosen.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON guessme_rounds FROM anon, authenticated;
GRANT SELECT (id, session_id, round_number, question_id, question, answerer_id,
              guesser_id, answered_at, guess, guessed_at, is_match, closeness,
              points, needs_adjudication, resolved, created_at)
  ON guessme_rounds TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON guessme_rounds TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Playing a round
-- ---------------------------------------------------------------------------

-- The answerer locks in what is true about them.
CREATE OR REPLACE FUNCTION guessme_submit_answer(
  p_session_id UUID,
  p_round_number INTEGER,
  p_player_id UUID,
  p_answer TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_answerer UUID;
  v_answered TIMESTAMPTZ;
BEGIN
  SELECT answerer_id, answered_at INTO v_answerer, v_answered
  FROM guessme_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_answerer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Round not found.');
  END IF;
  IF v_answerer <> p_player_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'It is not your turn to answer.');
  END IF;
  IF v_answered IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already answered.');
  END IF;
  IF p_answer IS NULL OR btrim(p_answer) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick something first.');
  END IF;

  UPDATE guessme_rounds
  SET answer = btrim(p_answer), answered_at = NOW()
  WHERE session_id = p_session_id AND round_number = p_round_number;

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;

-- The guesser predicts, and this is where the answer is finally released.
CREATE OR REPLACE FUNCTION guessme_submit_guess(
  p_session_id UUID,
  p_round_number INTEGER,
  p_player_id UUID,
  p_guess TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_streak INTEGER;
  v_guesser UUID;
  v_answer TEXT;
  v_guessed TIMESTAMPTZ;
  v_question JSONB;
  v_type TEXT;
  v_difficulty TEXT;
  v_base INTEGER;
  v_points INTEGER := 0;
  v_match BOOLEAN := FALSE;
  v_closeness TEXT := 'far';
  v_span NUMERIC;
  v_delta NUMERIC;
  v_needs_adjudication BOOLEAN := FALSE;
BEGIN
  SELECT guesser_id, answer, guessed_at, question
  INTO v_guesser, v_answer, v_guessed, v_question
  FROM guessme_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_guesser IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Round not found.');
  END IF;
  IF v_guesser <> p_player_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'It is not your turn to guess.');
  END IF;
  IF v_answer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Your partner has not answered yet.');
  END IF;
  IF v_guessed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already guessed.');
  END IF;

  -- Streak is counted here rather than taken from the caller, so a tampered
  -- client cannot claim a twenty-game run and multiply its own score.
  WITH prior AS (
    SELECT is_match, ROW_NUMBER() OVER (ORDER BY round_number DESC) AS rn
    FROM guessme_rounds
    WHERE session_id = p_session_id AND guesser_id = p_player_id
      AND resolved = TRUE AND round_number < p_round_number
  )
  SELECT COALESCE(
    (SELECT MIN(rn) - 1 FROM prior WHERE is_match IS NOT TRUE),
    (SELECT count(*) FROM prior)
  ) INTO p_streak;

  v_type := v_question->>'type';
  v_difficulty := v_question->>'difficulty';
  v_base := CASE WHEN v_difficulty = 'hard' THEN 15 ELSE 10 END;

  IF v_type IN ('number', 'slider') THEN
    v_span := CASE
      WHEN v_type = 'slider' THEN 100
      ELSE GREATEST(1, COALESCE((v_question->>'max')::NUMERIC, 100)
                     - COALESCE((v_question->>'min')::NUMERIC, 0))
    END;
    v_delta := abs(COALESCE(p_guess::NUMERIC, 0) - COALESCE(v_answer::NUMERIC, 0));

    IF v_delta = 0 THEN
      v_match := TRUE; v_closeness := 'exact';
      v_points := (v_base + 5) * GREATEST(1, p_streak + 1);
    ELSIF v_delta <= v_span * 0.05 THEN
      v_closeness := 'very-close'; v_points := 7;
    ELSIF v_delta <= v_span * 0.15 THEN
      v_closeness := 'close'; v_points := 5;
    END IF;

  ELSIF v_type = 'open_ended' THEN
    -- Only the answerer can say whether "Tokyo" counts as "Japan".
    IF lower(btrim(p_guess)) = lower(btrim(v_answer)) THEN
      v_match := TRUE; v_closeness := 'exact';
      v_points := v_base * GREATEST(1, p_streak + 1);
    ELSE
      v_needs_adjudication := TRUE;
    END IF;

  ELSE
    IF lower(btrim(p_guess)) = lower(btrim(v_answer)) THEN
      v_match := TRUE; v_closeness := 'exact';
      v_points := v_base * GREATEST(1, p_streak + 1);
    END IF;
  END IF;

  UPDATE guessme_rounds
  SET guess = btrim(p_guess),
      guessed_at = NOW(),
      is_match = CASE WHEN v_needs_adjudication THEN NULL ELSE v_match END,
      closeness = v_closeness,
      points = v_points,
      needs_adjudication = v_needs_adjudication,
      resolved = NOT v_needs_adjudication
  WHERE session_id = p_session_id AND round_number = p_round_number;

  RETURN jsonb_build_object(
    'ok', true,
    'answer', v_answer,
    'is_match', v_match,
    'closeness', v_closeness,
    'points', v_points,
    'needs_adjudication', v_needs_adjudication
  );
END;
$$ LANGUAGE plpgsql;

-- Open-ended rounds: the answerer decides whether the guess counts.
CREATE OR REPLACE FUNCTION guessme_adjudicate(
  p_session_id UUID,
  p_round_number INTEGER,
  p_player_id UUID,
  p_accepted BOOLEAN
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_streak INTEGER;
  v_answerer UUID;
  v_question JSONB;
  v_base INTEGER;
  v_points INTEGER := 0;
BEGIN
  SELECT answerer_id, question INTO v_answerer, v_question
  FROM guessme_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number
    AND needs_adjudication = TRUE;

  IF v_answerer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nothing to decide on this round.');
  END IF;
  IF v_answerer <> p_player_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the answerer can decide.');
  END IF;

  WITH prior AS (
    SELECT is_match, ROW_NUMBER() OVER (ORDER BY round_number DESC) AS rn
    FROM guessme_rounds
    WHERE session_id = p_session_id AND guesser_id = (
            SELECT guesser_id FROM guessme_rounds
            WHERE session_id = p_session_id AND round_number = p_round_number)
      AND resolved = TRUE AND round_number < p_round_number
  )
  SELECT COALESCE(
    (SELECT MIN(rn) - 1 FROM prior WHERE is_match IS NOT TRUE),
    (SELECT count(*) FROM prior)
  ) INTO p_streak;

  v_base := CASE WHEN v_question->>'difficulty' = 'hard' THEN 15 ELSE 10 END;
  IF p_accepted THEN
    v_points := v_base * GREATEST(1, p_streak + 1);
  END IF;

  UPDATE guessme_rounds
  SET is_match = p_accepted,
      closeness = CASE WHEN p_accepted THEN 'exact' ELSE 'far' END,
      points = v_points,
      needs_adjudication = FALSE,
      resolved = TRUE
  WHERE session_id = p_session_id AND round_number = p_round_number;

  RETURN jsonb_build_object('ok', true, 'is_match', p_accepted, 'points', v_points);
END;
$$ LANGUAGE plpgsql;

-- Answers for finished rounds, so the recap can show what was actually said.
CREATE OR REPLACE FUNCTION guessme_reveal(p_session_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('round_number', round_number, 'answer', answer)
                     ORDER BY round_number)
    FROM guessme_rounds
    WHERE session_id = p_session_id AND resolved = TRUE
  ), '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION guessme_submit_answer(UUID, INTEGER, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guessme_submit_guess(UUID, INTEGER, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guessme_adjudicate(UUID, INTEGER, UUID, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guessme_reveal(UUID) TO anon, authenticated;
