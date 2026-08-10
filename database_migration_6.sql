-- BoredGame - Supabase migration 6: trivia
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- Questions come from opentdb.com. The owner fetches them once and they are
-- stored here, so every player in the room answers exactly the same set in the
-- same order.
--
-- As with Word Duel, the answer is kept away from the browser: SELECT on
-- correct_answer is revoked, and it is only handed back once you have locked in
-- your own answer or the timer has run out.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trivia_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,              -- all four answers, pre-shuffled
  correct_answer TEXT NOT NULL,        -- revoked from anon
  category TEXT,
  difficulty TEXT,
  time_limit INTEGER NOT NULL DEFAULT 15,
  started_at TIMESTAMP WITH TIME ZONE, -- set when this question goes live
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, question_number)
);

CREATE TABLE IF NOT EXISTS trivia_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, question_number, player_id)
);

CREATE INDEX IF NOT EXISTS idx_trivia_questions_session ON trivia_questions (session_id, question_number);
CREATE INDEX IF NOT EXISTS idx_trivia_answers_session ON trivia_answers (session_id, question_number);

-- ---------------------------------------------------------------------------
-- 2. RLS + realtime
-- ---------------------------------------------------------------------------
ALTER TABLE trivia_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trivia_questions' AND policyname='Allow all on trivia_questions') THEN
    CREATE POLICY "Allow all on trivia_questions" ON trivia_questions FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trivia_answers' AND policyname='Allow all on trivia_answers') THEN
    CREATE POLICY "Allow all on trivia_answers" ON trivia_answers FOR ALL USING (true);
  END IF;
END $$;

ALTER TABLE trivia_questions REPLICA IDENTITY FULL;
ALTER TABLE trivia_answers REPLICA IDENTITY FULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trivia_questions', 'trivia_answers'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Hide the answers
-- ---------------------------------------------------------------------------
REVOKE SELECT ON trivia_questions FROM anon, authenticated;
GRANT SELECT (id, session_id, question_number, question, options, category,
              difficulty, time_limit, started_at, created_at)
  ON trivia_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON trivia_questions TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON trivia_answers TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Answering and revealing
-- ---------------------------------------------------------------------------

-- True once the timer has run out, or once every non-spectating player in the
-- room has locked an answer in. Either way the answer is safe to show.
CREATE OR REPLACE FUNCTION trivia_question_closed(p_session_id UUID, p_question_number INTEGER)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started TIMESTAMPTZ;
  v_limit INTEGER;
  v_players INTEGER;
  v_answers INTEGER;
BEGIN
  SELECT started_at, time_limit INTO v_started, v_limit
  FROM trivia_questions
  WHERE session_id = p_session_id AND question_number = p_question_number;

  IF v_started IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOW() >= v_started + (v_limit || ' seconds')::INTERVAL THEN
    RETURN TRUE;
  END IF;

  SELECT count(*) INTO v_players
  FROM players p
  JOIN game_sessions gs ON gs.room_id = p.room_id
  WHERE gs.id = p_session_id AND COALESCE(p.is_spectator, FALSE) = FALSE;

  SELECT count(*) INTO v_answers
  FROM trivia_answers
  WHERE session_id = p_session_id AND question_number = p_question_number;

  RETURN v_players > 0 AND v_answers >= v_players;
END;
$$ LANGUAGE plpgsql;

-- Records an answer and tells the player straight away whether they got it,
-- because their choice is locked the moment they tap it.
CREATE OR REPLACE FUNCTION trivia_submit_answer(
  p_session_id UUID,
  p_player_id UUID,
  p_question_number INTEGER,
  p_answer TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct TEXT;
  v_started TIMESTAMPTZ;
  v_limit INTEGER;
  v_is_correct BOOLEAN;
BEGIN
  SELECT correct_answer, started_at, time_limit
  INTO v_correct, v_started, v_limit
  FROM trivia_questions
  WHERE session_id = p_session_id AND question_number = p_question_number;

  IF v_correct IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That question does not exist.');
  END IF;

  IF v_started IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That question has not started yet.');
  END IF;

  IF NOW() > v_started + ((v_limit + 2) || ' seconds')::INTERVAL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Time is up for that question.',
                              'correct_answer', v_correct);
  END IF;

  IF EXISTS (
    SELECT 1 FROM trivia_answers a
    WHERE a.session_id = p_session_id
      AND a.question_number = p_question_number
      AND a.player_id = p_player_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already answered.',
                              'correct_answer', v_correct);
  END IF;

  v_is_correct := p_answer = v_correct;

  INSERT INTO trivia_answers (session_id, question_number, player_id, answer, is_correct)
  VALUES (p_session_id, p_question_number, p_player_id, p_answer, v_is_correct);

  RETURN jsonb_build_object(
    'ok', true,
    'is_correct', v_is_correct,
    'correct_answer', v_correct
  );
END;
$$ LANGUAGE plpgsql;

-- For players who ran out of time without answering.
CREATE OR REPLACE FUNCTION trivia_reveal(p_session_id UUID, p_question_number INTEGER)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT trivia_question_closed(p_session_id, p_question_number) THEN
    RETURN jsonb_build_object('ready', false);
  END IF;

  RETURN jsonb_build_object(
    'ready', true,
    'correct_answer', (
      SELECT correct_answer FROM trivia_questions
      WHERE session_id = p_session_id AND question_number = p_question_number
    )
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION trivia_question_closed(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION trivia_submit_answer(UUID, UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION trivia_reveal(UUID, INTEGER) TO anon, authenticated;
