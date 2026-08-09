-- BoredGame - Supabase migration 4: head-to-head Wordle
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- The secret words never reach the browser. Clients can read who set a word and
-- how long it is, but the `word` column itself is revoked from the anon role,
-- and guesses are graded by a SECURITY DEFINER function that reads the word
-- server-side and returns only the colour pattern. Without that, either player
-- could read their answer straight out of the network tab.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wordle_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  setter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  solver_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  word TEXT NOT NULL CHECK (word ~ '^[a-z]{5,10}$'),
  word_length INTEGER GENERATED ALWAYS AS (char_length(word)) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, solver_id)
);

CREATE TABLE IF NOT EXISTS wordle_guesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guess TEXT NOT NULL,
  pattern TEXT NOT NULL,          -- g = right spot, y = wrong spot, b = absent
  guess_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, player_id, guess_number)
);

CREATE INDEX IF NOT EXISTS idx_wordle_words_session ON wordle_words (session_id);
CREATE INDEX IF NOT EXISTS idx_wordle_guesses_session ON wordle_guesses (session_id, player_id);

-- ---------------------------------------------------------------------------
-- 2. RLS + realtime, matching the rest of the schema
-- ---------------------------------------------------------------------------
ALTER TABLE wordle_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordle_guesses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wordle_words' AND policyname='Allow all on wordle_words') THEN
    CREATE POLICY "Allow all on wordle_words" ON wordle_words FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wordle_guesses' AND policyname='Allow all on wordle_guesses') THEN
    CREATE POLICY "Allow all on wordle_guesses" ON wordle_guesses FOR ALL USING (true);
  END IF;
END $$;

ALTER TABLE wordle_words REPLICA IDENTITY FULL;
ALTER TABLE wordle_guesses REPLICA IDENTITY FULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wordle_words', 'wordle_guesses'] LOOP
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
--    Column-level privilege: everything about a word row is readable except
--    the word itself. Selecting `word` from the client now fails outright.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON wordle_words FROM anon, authenticated;
GRANT SELECT (id, session_id, setter_id, solver_id, word_length, created_at)
  ON wordle_words TO anon, authenticated;
GRANT INSERT, DELETE ON wordle_words TO anon, authenticated;
-- Guesses stay fully readable: your opponent's patterns are for the word you
-- set them, so there is nothing there you do not already know.
GRANT SELECT, INSERT, DELETE ON wordle_guesses TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Grading
-- ---------------------------------------------------------------------------

-- Standard Wordle two-pass scoring, which is what makes repeated letters work:
-- exact matches are claimed first, then misplaced letters draw from whatever
-- copies of that letter are left over.
CREATE OR REPLACE FUNCTION wordle_pattern(p_target TEXT, p_guess TEXT)
RETURNS TEXT AS $$
DECLARE
  v_len INTEGER := char_length(p_target);
  v_result TEXT[];
  v_remaining JSONB := '{}'::JSONB;
  v_ch TEXT;
  i INTEGER;
BEGIN
  v_result := array_fill('b'::TEXT, ARRAY[v_len]);

  FOR i IN 1..v_len LOOP
    IF substr(p_guess, i, 1) = substr(p_target, i, 1) THEN
      v_result[i] := 'g';
    ELSE
      v_ch := substr(p_target, i, 1);
      v_remaining := jsonb_set(
        v_remaining, ARRAY[v_ch],
        to_jsonb(COALESCE((v_remaining->>v_ch)::INTEGER, 0) + 1), true
      );
    END IF;
  END LOOP;

  FOR i IN 1..v_len LOOP
    IF v_result[i] = 'b' THEN
      v_ch := substr(p_guess, i, 1);
      IF COALESCE((v_remaining->>v_ch)::INTEGER, 0) > 0 THEN
        v_result[i] := 'y';
        v_remaining := jsonb_set(
          v_remaining, ARRAY[v_ch],
          to_jsonb((v_remaining->>v_ch)::INTEGER - 1), true
        );
      END IF;
    END IF;
  END LOOP;

  RETURN array_to_string(v_result, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grades a guess without ever handing the word to the caller. Also enforces
-- the guess limit server-side, so a tampered client cannot buy extra tries.
CREATE OR REPLACE FUNCTION wordle_submit_guess(
  p_session_id UUID,
  p_player_id UUID,
  p_guess TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
-- Locals are v_ prefixed: an unprefixed `pattern` is ambiguous against
-- wordle_guesses.pattern and makes every submission error out.
DECLARE
  v_target TEXT;
  v_target_len INTEGER;
  v_max_guesses INTEGER;
  v_used INTEGER;
  v_clean TEXT := lower(trim(p_guess));
  v_pattern TEXT;
  v_solved BOOLEAN;
BEGIN
  SELECT word, char_length(word) INTO v_target, v_target_len
  FROM wordle_words
  WHERE session_id = p_session_id AND solver_id = p_player_id;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No word has been set for you yet.');
  END IF;

  v_max_guesses := v_target_len + 1;

  SELECT count(*) INTO v_used
  FROM wordle_guesses
  WHERE session_id = p_session_id AND player_id = p_player_id;

  IF v_used >= v_max_guesses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No guesses left.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM wordle_guesses g
    WHERE g.session_id = p_session_id AND g.player_id = p_player_id
      AND g.pattern = repeat('g', v_target_len)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already solved it.');
  END IF;

  IF v_clean !~ ('^[a-z]{' || v_target_len || '}$') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Guess must be %s letters.', v_target_len));
  END IF;

  v_pattern := wordle_pattern(v_target, v_clean);
  v_solved := v_pattern = repeat('g', v_target_len);

  INSERT INTO wordle_guesses (session_id, player_id, guess, pattern, guess_number)
  VALUES (p_session_id, p_player_id, v_clean, v_pattern, v_used + 1);

  RETURN jsonb_build_object(
    'ok', true,
    'pattern', v_pattern,
    'solved', v_solved,
    'guesses_used', v_used + 1,
    'max_guesses', v_max_guesses
  );
END;
$$ LANGUAGE plpgsql;

-- Reveals both words, but only once both players are done - so neither side
-- can call this early to peek at their own answer.
CREATE OR REPLACE FUNCTION wordle_reveal(p_session_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  word_count INTEGER;
  unfinished INTEGER;
BEGIN
  SELECT count(*) INTO word_count FROM wordle_words WHERE session_id = p_session_id;
  IF word_count < 2 THEN
    RETURN jsonb_build_object('ready', false);
  END IF;

  SELECT count(*) INTO unfinished
  FROM wordle_words w
  WHERE w.session_id = p_session_id
    AND NOT (
      EXISTS (
        SELECT 1 FROM wordle_guesses g
        WHERE g.session_id = w.session_id AND g.player_id = w.solver_id
          AND g.pattern = repeat('g', w.word_length)
      )
      OR (
        SELECT count(*) FROM wordle_guesses g2
        WHERE g2.session_id = w.session_id AND g2.player_id = w.solver_id
      ) >= w.word_length + 1
    );

  IF unfinished > 0 THEN
    RETURN jsonb_build_object('ready', false);
  END IF;

  RETURN jsonb_build_object(
    'ready', true,
    'words', (
      SELECT jsonb_agg(jsonb_build_object('solver_id', solver_id, 'word', word))
      FROM wordle_words WHERE session_id = p_session_id
    )
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION wordle_submit_guess(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wordle_reveal(UUID) TO anon, authenticated;
