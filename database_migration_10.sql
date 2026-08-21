-- BoredGame - Supabase migration 10: Undercover
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- Three things must stay out of the browser or the game has no point at all:
-- the two words, who the undercover is, and everyone's votes until the last
-- one is in. All three are revoked columns, and every read that needs them goes
-- through a function that hands back only what the asking player is entitled
-- to see.
--
-- Note on how far that goes: the app has no accounts, so a player id is the
-- only thing identifying anyone. Revoking the columns stops the table being
-- read wholesale, which is what casual peeking looks like. It is not proof
-- against someone deliberately calling the function with a friend's player id.
-- Closing that properly needs real auth - see the security note in
-- SETUP_INSTRUCTIONS.md.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- The pair bank lives here rather than only in the app bundle. If the client
-- chose the pair, whoever pressed start would know both words, and any player
-- could read the chosen pair id and look both words up. The server picks, and
-- this table is not readable from a browser at all.
CREATE TABLE IF NOT EXISTS undercover_pairs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  sub TEXT,
  difficulty TEXT NOT NULL,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS undercover_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  pair_id TEXT NOT NULL,
  civilian_word TEXT NOT NULL,      -- revoked
  undercover_word TEXT NOT NULL,    -- revoked
  undercover_id UUID REFERENCES players(id) ON DELETE SET NULL,  -- revoked
  category TEXT,
  difficulty TEXT,
  turn_order JSONB NOT NULL DEFAULT '[]'::JSONB,
  clue_rounds INTEGER NOT NULL DEFAULT 1,
  -- clues -> voting -> revote -> reveal -> final_guess -> done
  phase TEXT NOT NULL DEFAULT 'clues',
  vote_round INTEGER NOT NULL DEFAULT 1,
  tied_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  eliminated_id UUID REFERENCES players(id) ON DELETE SET NULL,
  caught BOOLEAN,
  final_guess TEXT,
  final_guess_correct BOOLEAN,
  winning_side TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS undercover_clues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  clue_round INTEGER NOT NULL DEFAULT 1,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  clue TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, round_number, clue_round, player_id)
);

CREATE TABLE IF NOT EXISTS undercover_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  vote_round INTEGER NOT NULL DEFAULT 1,
  voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id UUID REFERENCES players(id) ON DELETE SET NULL,  -- revoked
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, round_number, vote_round, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_uc_rounds_session ON undercover_rounds (session_id, round_number);
CREATE INDEX IF NOT EXISTS idx_uc_clues_session ON undercover_clues (session_id, round_number);
CREATE INDEX IF NOT EXISTS idx_uc_votes_session ON undercover_votes (session_id, round_number);

-- ---------------------------------------------------------------------------
-- 2. RLS + realtime
-- ---------------------------------------------------------------------------
ALTER TABLE undercover_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE undercover_clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE undercover_votes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['undercover_rounds', 'undercover_clues', 'undercover_votes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'Allow all on ' || t
    ) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true)', 'Allow all on ' || t, t);
    END IF;
    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Hide the secrets
-- ---------------------------------------------------------------------------
-- Nothing in the pair bank is ever needed by a browser.
REVOKE ALL ON undercover_pairs FROM anon, authenticated;

REVOKE SELECT ON undercover_rounds FROM anon, authenticated;
GRANT SELECT (id, session_id, round_number, category, difficulty,
              turn_order, clue_rounds, phase, vote_round, tied_ids,
              eliminated_id, caught, final_guess, final_guess_correct,
              winning_side, resolved, created_at)
  ON undercover_rounds TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON undercover_rounds TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON undercover_clues TO anon, authenticated;

-- voter_id stays readable so the table can see who still owes a vote.
REVOKE SELECT ON undercover_votes FROM anon, authenticated;
GRANT SELECT (id, session_id, round_number, vote_round, voter_id, created_at)
  ON undercover_votes TO anon, authenticated;
GRANT INSERT, DELETE ON undercover_votes TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Dealing a round
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION undercover_deal(
  p_session_id UUID,
  p_round_number INTEGER,
  p_categories TEXT[],
  p_difficulty TEXT,
  p_clue_rounds INTEGER
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_players UUID[];
  v_pair undercover_pairs%ROWTYPE;
  v_civilian TEXT;
  v_undercover TEXT;
  v_undercover_id UUID;
  v_last UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM undercover_rounds
    WHERE session_id = p_session_id AND round_number = p_round_number
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That round has already been dealt.');
  END IF;

  -- Speaking order is drawn here rather than on a client, so nobody can
  -- arrange to speak last every round.
  SELECT array_agg(p.id ORDER BY random()) INTO v_players
  FROM players p
  JOIN game_sessions gs ON gs.room_id = p.room_id
  WHERE gs.id = p_session_id AND COALESCE(p.is_spectator, FALSE) = FALSE;

  IF v_players IS NULL OR array_length(v_players, 1) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Undercover needs at least 4 players.');
  END IF;

  -- A pair nobody in this game has had yet, matching the host's settings.
  -- Each fallback widens the net rather than leaving the round undealt.
  SELECT * INTO v_pair FROM undercover_pairs pr
  WHERE (p_categories IS NULL OR cardinality(p_categories) = 0 OR pr.category = ANY(p_categories))
    AND (p_difficulty IS NULL OR p_difficulty = 'mixed' OR pr.difficulty = p_difficulty)
    AND NOT EXISTS (
      SELECT 1 FROM undercover_rounds r
      WHERE r.session_id = p_session_id AND r.pair_id = pr.id
    )
  ORDER BY random() LIMIT 1;

  IF v_pair.id IS NULL THEN
    SELECT * INTO v_pair FROM undercover_pairs pr
    WHERE (p_categories IS NULL OR cardinality(p_categories) = 0 OR pr.category = ANY(p_categories))
      AND NOT EXISTS (
        SELECT 1 FROM undercover_rounds r
        WHERE r.session_id = p_session_id AND r.pair_id = pr.id
      )
    ORDER BY random() LIMIT 1;
  END IF;
  IF v_pair.id IS NULL THEN
    SELECT * INTO v_pair FROM undercover_pairs ORDER BY random() LIMIT 1;
  END IF;
  IF v_pair.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No word pairs installed.');
  END IF;

  -- Randomise which half of the pair is the civilian word, so the undercover
  -- cannot work out the civilian word just by knowing the pair.
  IF random() < 0.5 THEN
    v_civilian := v_pair.word_a; v_undercover := v_pair.word_b;
  ELSE
    v_civilian := v_pair.word_b; v_undercover := v_pair.word_a;
  END IF;

  -- Spread the role: whoever has been undercover least often so far, never the
  -- same player twice running if there is any alternative.
  SELECT undercover_id INTO v_last FROM undercover_rounds
  WHERE session_id = p_session_id AND round_number < p_round_number
  ORDER BY round_number DESC LIMIT 1;

  WITH counts AS (
    SELECT pid AS player_id,
           (SELECT count(*) FROM undercover_rounds r
             WHERE r.session_id = p_session_id AND r.undercover_id = pid) AS times
    FROM unnest(v_players) AS pid
  ), ranked AS (
    SELECT player_id, times,
           (v_last IS NOT NULL AND player_id = v_last) AS was_last
    FROM counts
  )
  SELECT player_id INTO v_undercover_id
  FROM ranked ORDER BY times ASC, was_last ASC, random() LIMIT 1;

  INSERT INTO undercover_rounds (
    session_id, round_number, pair_id, civilian_word, undercover_word,
    undercover_id, category, difficulty, turn_order, clue_rounds
  ) VALUES (
    p_session_id, p_round_number, v_pair.id, v_civilian, v_undercover,
    v_undercover_id, v_pair.category, v_pair.difficulty,
    to_jsonb(v_players), GREATEST(1, p_clue_rounds)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;

-- The only way a player learns their own word. Never returns anyone else's.
CREATE OR REPLACE FUNCTION undercover_my_role(
  p_session_id UUID,
  p_round_number INTEGER,
  p_player_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_civilian TEXT;
  v_undercover TEXT;
  v_undercover_id UUID;
BEGIN
  SELECT civilian_word, undercover_word, undercover_id
  INTO v_civilian, v_undercover, v_undercover_id
  FROM undercover_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_civilian IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Round not found.');
  END IF;

  IF p_player_id = v_undercover_id THEN
    RETURN jsonb_build_object('ok', true, 'is_undercover', true, 'word', v_undercover);
  END IF;
  RETURN jsonb_build_object('ok', true, 'is_undercover', false, 'word', v_civilian);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 5. Voting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION undercover_vote(
  p_session_id UUID,
  p_round_number INTEGER,
  p_voter_id UUID,
  p_target_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase TEXT;
  v_vote_round INTEGER;
  v_tied JSONB;
  v_eligible INTEGER;
  v_cast INTEGER;
BEGIN
  SELECT phase, vote_round, tied_ids INTO v_phase, v_vote_round, v_tied
  FROM undercover_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_phase IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Round not found.');
  END IF;
  IF v_phase NOT IN ('voting', 'revote') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'It is not time to vote.');
  END IF;
  IF p_voter_id = p_target_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot vote for yourself.');
  END IF;
  IF v_phase = 'revote' AND NOT (v_tied ? p_target_id::TEXT) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the tied players can be voted for.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM undercover_votes
    WHERE session_id = p_session_id AND round_number = p_round_number
      AND vote_round = v_vote_round AND voter_id = p_voter_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already voted.');
  END IF;

  INSERT INTO undercover_votes (session_id, round_number, vote_round, voter_id, target_id)
  VALUES (p_session_id, p_round_number, v_vote_round, p_voter_id, p_target_id);

  SELECT count(*) INTO v_eligible
  FROM players p
  JOIN game_sessions gs ON gs.room_id = p.room_id
  WHERE gs.id = p_session_id AND COALESCE(p.is_spectator, FALSE) = FALSE;

  SELECT count(*) INTO v_cast
  FROM undercover_votes
  WHERE session_id = p_session_id AND round_number = p_round_number
    AND vote_round = v_vote_round;

  RETURN jsonb_build_object('ok', true, 'waiting', v_cast < v_eligible);
END;
$$ LANGUAGE plpgsql;

-- Counts the votes once everyone is in, and either eliminates, calls a tie, or
-- (on a second tie) settles it at random.
CREATE OR REPLACE FUNCTION undercover_tally(
  p_session_id UUID,
  p_round_number INTEGER
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase TEXT;
  v_vote_round INTEGER;
  v_undercover UUID;
  v_eligible INTEGER;
  v_cast INTEGER;
  v_top INTEGER;
  v_tied UUID[];
  v_out UUID;
  v_caught BOOLEAN;
BEGIN
  SELECT phase, vote_round, undercover_id INTO v_phase, v_vote_round, v_undercover
  FROM undercover_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_phase IS NULL OR v_phase NOT IN ('voting', 'revote') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nothing to count.');
  END IF;

  SELECT count(*) INTO v_eligible
  FROM players p
  JOIN game_sessions gs ON gs.room_id = p.room_id
  WHERE gs.id = p_session_id AND COALESCE(p.is_spectator, FALSE) = FALSE;

  SELECT count(*) INTO v_cast
  FROM undercover_votes
  WHERE session_id = p_session_id AND round_number = p_round_number
    AND vote_round = v_vote_round;

  IF v_cast < v_eligible THEN
    RETURN jsonb_build_object('ok', false, 'waiting', true);
  END IF;

  SELECT max(c) INTO v_top FROM (
    SELECT count(*) AS c FROM undercover_votes
    WHERE session_id = p_session_id AND round_number = p_round_number
      AND vote_round = v_vote_round
    GROUP BY target_id
  ) t;

  SELECT array_agg(target_id) INTO v_tied FROM (
    SELECT target_id, count(*) AS c FROM undercover_votes
    WHERE session_id = p_session_id AND round_number = p_round_number
      AND vote_round = v_vote_round
    GROUP BY target_id
  ) t WHERE c = v_top;

  IF array_length(v_tied, 1) > 1 THEN
    IF v_vote_round = 1 THEN
      -- First tie: only the tied players can be voted for next time round.
      UPDATE undercover_rounds
      SET phase = 'revote', vote_round = 2, tied_ids = to_jsonb(v_tied)
      WHERE session_id = p_session_id AND round_number = p_round_number;
      RETURN jsonb_build_object('ok', true, 'tie', true, 'tied', to_jsonb(v_tied));
    END IF;
    -- Second tie: settle it rather than looping forever.
    v_out := v_tied[1 + floor(random() * array_length(v_tied, 1))::INT];
  ELSE
    v_out := v_tied[1];
  END IF;

  v_caught := v_out = v_undercover;

  UPDATE undercover_rounds
  SET eliminated_id = v_out,
      caught = v_caught,
      -- A caught undercover still gets one guess at the civilian word.
      phase = CASE WHEN v_caught THEN 'final_guess' ELSE 'reveal' END,
      winning_side = CASE WHEN v_caught THEN NULL ELSE 'undercover' END,
      resolved = NOT v_caught
  WHERE session_id = p_session_id AND round_number = p_round_number;

  RETURN jsonb_build_object('ok', true, 'tie', false,
                            'eliminated_id', v_out, 'caught', v_caught);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 6. The last chance, and the reveal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION undercover_final_guess(
  p_session_id UUID,
  p_player_id UUID,
  p_round_number INTEGER,
  p_guess TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_undercover UUID;
  v_civilian TEXT;
  v_phase TEXT;
  v_correct BOOLEAN;
BEGIN
  SELECT undercover_id, civilian_word, phase
  INTO v_undercover, v_civilian, v_phase
  FROM undercover_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_phase IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Round not found.');
  END IF;
  IF v_phase <> 'final_guess' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'There is no guess to make.');
  END IF;
  IF p_player_id <> v_undercover THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the undercover can guess.');
  END IF;

  v_correct := lower(btrim(COALESCE(p_guess, ''))) = lower(btrim(v_civilian));

  UPDATE undercover_rounds
  SET final_guess = btrim(p_guess),
      final_guess_correct = v_correct,
      winning_side = CASE WHEN v_correct THEN 'undercover' ELSE 'civilians' END,
      phase = 'reveal',
      resolved = TRUE
  WHERE session_id = p_session_id AND round_number = p_round_number;

  RETURN jsonb_build_object('ok', true, 'correct', v_correct, 'civilian_word', v_civilian);
END;
$$ LANGUAGE plpgsql;

-- Everything about a finished round: both words, who was undercover, and who
-- voted for whom. Refuses while the round is still live.
CREATE OR REPLACE FUNCTION undercover_reveal(
  p_session_id UUID,
  p_round_number INTEGER
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row undercover_rounds%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM undercover_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ready', false);
  END IF;
  IF NOT v_row.resolved THEN
    RETURN jsonb_build_object('ready', false);
  END IF;

  RETURN jsonb_build_object(
    'ready', true,
    'civilian_word', v_row.civilian_word,
    'undercover_word', v_row.undercover_word,
    'undercover_id', v_row.undercover_id,
    'eliminated_id', v_row.eliminated_id,
    'caught', v_row.caught,
    'final_guess', v_row.final_guess,
    'final_guess_correct', v_row.final_guess_correct,
    'winning_side', v_row.winning_side,
    'votes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'vote_round', vote_round, 'voter_id', voter_id, 'target_id', target_id)
             ORDER BY vote_round, created_at)
      FROM undercover_votes
      WHERE session_id = p_session_id AND round_number = p_round_number
    ), '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION undercover_deal(UUID, INTEGER, TEXT[], TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undercover_my_role(UUID, INTEGER, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undercover_vote(UUID, INTEGER, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undercover_tally(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undercover_final_guess(UUID, UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undercover_reveal(UUID, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. The pair bank
-- ---------------------------------------------------------------------------
INSERT INTO undercover_pairs (id, category, sub, difficulty, word_a, word_b) VALUES
  ('gen-001','general','animals','easy','Dog','Cat'),
  ('gen-002','general','animals','easy','Lion','Tiger'),
  ('gen-003','general','animals','easy','Fish','Bird'),
  ('gen-004','general','animals','medium','Goat','Sheep'),
  ('gen-005','general','animals','medium','Crocodile','Alligator'),
  ('gen-006','general','animals','medium','Rabbit','Hamster'),
  ('gen-007','general','animals','medium','Horse','Donkey'),
  ('gen-008','general','animals','hard','Frog','Toad'),
  ('gen-009','general','animals','hard','Turtle','Tortoise'),
  ('gen-010','general','animals','hard','Moth','Butterfly'),
  ('gen-011','general','animals','medium','Snake','Lizard'),
  ('gen-012','general','animals','easy','Elephant','Giraffe'),
  ('gen-013','general','food','easy','Pizza','Burger'),
  ('gen-014','general','food','medium','Coffee','Tea'),
  ('gen-015','general','food','medium','Bread','Cake'),
  ('gen-016','general','food','hard','Juice','Smoothie'),
  ('gen-017','general','food','medium','Rice','Pasta'),
  ('gen-018','general','food','hard','Soup','Stew'),
  ('gen-019','general','food','easy','Chocolate','Ice cream'),
  ('gen-020','general','food','medium','Sandwich','Wrap'),
  ('gen-021','general','food','hard','Biscuit','Cookie'),
  ('gen-022','general','food','medium','Milk','Yoghurt'),
  ('gen-023','general','food','easy','Apple','Orange'),
  ('gen-024','general','food','hard','Chips','Crisps'),
  ('gen-025','general','places','easy','Beach','Pool'),
  ('gen-026','general','places','medium','Hotel','Hostel'),
  ('gen-027','general','places','medium','School','University'),
  ('gen-028','general','places','hard','Market','Mall'),
  ('gen-029','general','places','medium','Hospital','Clinic'),
  ('gen-030','general','places','easy','Church','Mosque'),
  ('gen-031','general','places','medium','Airport','Train station'),
  ('gen-032','general','places','hard','Restaurant','Cafe'),
  ('gen-033','general','places','medium','Cinema','Theatre'),
  ('gen-034','general','places','easy','Mountain','Desert'),
  ('gen-035','general','places','hard','Garden','Park'),
  ('gen-036','general','places','medium','Library','Bookshop'),
  ('gen-037','general','objects','easy','Phone','Laptop'),
  ('gen-038','general','objects','medium','Chair','Stool'),
  ('gen-039','general','objects','hard','Cup','Mug'),
  ('gen-040','general','objects','medium','Bag','Suitcase'),
  ('gen-041','general','objects','easy','Umbrella','Raincoat'),
  ('gen-042','general','objects','medium','Clock','Watch'),
  ('gen-043','general','objects','hard','Sofa','Armchair'),
  ('gen-044','general','objects','medium','Pen','Pencil'),
  ('gen-045','general','objects','medium','Mirror','Window'),
  ('gen-046','general','objects','hard','Blanket','Duvet'),
  ('gen-047','general','objects','easy','Camera','Binoculars'),
  ('gen-048','general','objects','medium','Fan','Air conditioner'),
  ('gen-049','general','objects','hard','Broom','Mop'),
  ('gen-050','general','objects','medium','Candle','Torch'),
  ('gen-051','general','jobs','medium','Doctor','Nurse'),
  ('gen-052','general','jobs','medium','Teacher','Lecturer'),
  ('gen-053','general','jobs','easy','Chef','Waiter'),
  ('gen-054','general','jobs','hard','Lawyer','Judge'),
  ('gen-055','general','jobs','medium','Pilot','Driver'),
  ('gen-056','general','jobs','medium','Barber','Hairdresser'),
  ('gen-057','general','jobs','easy','Farmer','Fisherman'),
  ('gen-058','general','jobs','hard','Tailor','Designer'),
  ('gen-059','general','jobs','medium','Police officer','Security guard'),
  ('gen-060','general','jobs','medium','Singer','Dancer'),
  ('gen-061','general','activities','easy','Swimming','Running'),
  ('gen-062','general','activities','medium','Dancing','Singing'),
  ('gen-063','general','activities','hard','Walking','Jogging'),
  ('gen-064','general','activities','medium','Reading','Writing'),
  ('gen-065','general','activities','medium','Cooking','Baking'),
  ('gen-066','general','activities','hard','Napping','Sleeping'),
  ('gen-067','general','transport','easy','Car','Bicycle'),
  ('gen-068','general','transport','medium','Bus','Taxi'),
  ('gen-069','general','transport','hard','Ship','Boat'),
  ('gen-070','general','transport','medium','Train','Tram'),
  ('gen-071','general','transport','easy','Aeroplane','Helicopter'),
  ('gen-072','general','transport','hard','Lorry','Van'),
  ('gen-073','general','nature','easy','Rain','Snow'),
  ('gen-074','general','nature','medium','River','Lake'),
  ('gen-075','general','nature','hard','Fog','Mist'),
  ('gen-076','general','nature','medium','Sun','Moon'),
  ('gen-077','general','nature','hard','Hill','Mountain'),
  ('gen-078','general','nature','medium','Forest','Jungle'),
  ('ent-001','entertainment','formats','easy','Movie','TV show'),
  ('ent-002','entertainment','formats','medium','Series','Documentary'),
  ('ent-003','entertainment','formats','hard','Podcast','Radio show'),
  ('ent-004','entertainment','formats','medium','Cartoon','Anime'),
  ('ent-005','entertainment','formats','medium','Concert','Festival'),
  ('ent-006','entertainment',NULL,'hard','Trailer','Advert'),
  ('ent-007','entertainment','genres','easy','Comedy','Horror'),
  ('ent-008','entertainment','genres','medium','Romance','Drama'),
  ('ent-009','entertainment','genres','hard','Thriller','Mystery'),
  ('ent-010','entertainment','genres','medium','Action','Adventure'),
  ('ent-011','entertainment','music','easy','Guitar','Drums'),
  ('ent-012','entertainment','music','medium','Piano','Keyboard'),
  ('ent-013','entertainment','music','hard','Singer','Rapper'),
  ('ent-014','entertainment','music','medium','Album','Playlist'),
  ('ent-015','entertainment','music','medium','Choir','Band'),
  ('ent-016','entertainment','music','hard','Remix','Cover'),
  ('ent-017','entertainment','characters','easy','Superhero','Villain'),
  ('ent-018','entertainment','characters','medium','Wizard','Witch'),
  ('ent-019','entertainment','characters','medium','Ghost','Zombie'),
  ('ent-020','entertainment','characters','hard','Detective','Spy'),
  ('ent-021','entertainment','characters','easy','Pirate','Cowboy'),
  ('ent-022','entertainment','characters','medium','Robot','Alien'),
  ('ent-023','entertainment','people','medium','Actor','Director'),
  ('ent-024','entertainment','people','hard','Comedian','Presenter'),
  ('ent-025','entertainment','people','medium','Influencer','Blogger'),
  ('ent-026','entertainment','people','hard','Fan','Follower'),
  ('ent-027','entertainment','watching','easy','Cinema','Netflix'),
  ('ent-028','entertainment','watching','medium','Popcorn','Snacks'),
  ('ent-029','entertainment','watching','hard','Subtitles','Dubbing'),
  ('ent-030','entertainment','watching','medium','Sequel','Remake'),
  ('ent-031','entertainment','games','easy','Video game','Board game'),
  ('ent-032','entertainment','games','medium','Puzzle','Riddle'),
  ('ent-033','entertainment','games','hard','Chess','Draughts'),
  ('ent-034','entertainment','games','medium','Karaoke','Talent show'),
  ('ent-035','entertainment','events','medium','Award','Trophy'),
  ('ent-036','entertainment','events','hard','Premiere','Launch'),
  ('ent-037','entertainment','events','easy','Stage','Screen'),
  ('ent-038','entertainment','events','medium','Audience','Crowd'),
  ('spo-001','sports','sports','easy','Football','Basketball'),
  ('spo-002','sports','sports','medium','Tennis','Badminton'),
  ('spo-003','sports','sports','hard','Boxing','Wrestling'),
  ('spo-004','sports','sports','medium','Swimming','Diving'),
  ('spo-005','sports','sports','easy','Cricket','Baseball'),
  ('spo-006','sports','sports','medium','Volleyball','Handball'),
  ('spo-007','sports','sports','hard','Marathon','Sprint'),
  ('spo-008','sports','sports','medium','Cycling','Skating'),
  ('spo-009','sports','sports','hard','Table tennis','Squash'),
  ('spo-010','sports','sports','medium','Golf','Snooker'),
  ('spo-011','sports','football','easy','Goalkeeper','Striker'),
  ('spo-012','sports','football','medium','Referee','Linesman'),
  ('spo-013','sports','football','hard','Penalty','Free kick'),
  ('spo-014','sports','football','medium','Corner','Throw in'),
  ('spo-015','sports','football','hard','Yellow card','Red card'),
  ('spo-016','sports','football','medium','Half time','Full time'),
  ('spo-017','sports','venue','easy','Stadium','Pitch'),
  ('spo-018','sports','venue','medium','Dressing room','Dugout'),
  ('spo-019','sports','venue','hard','Gym','Training ground'),
  ('spo-020','sports','venue','medium','Track','Court'),
  ('spo-021','sports','people','easy','Coach','Captain'),
  ('spo-022','sports','people','medium','Fan','Supporter'),
  ('spo-023','sports','people','hard','Substitute','Reserve'),
  ('spo-024','sports','people','medium','Champion','Runner up'),
  ('spo-025','sports','prizes','easy','Medal','Trophy'),
  ('spo-026','sports','prizes','hard','League','Tournament'),
  ('spo-027','sports','prizes','medium','World Cup','Olympics'),
  ('spo-028','sports','prizes','hard','Draw','Tie'),
  ('spo-029','sports','kit','medium','Whistle','Buzzer'),
  ('spo-030','sports','kit','easy','Boots','Trainers'),
  ('spo-031','sports','kit','hard','Jersey','Kit'),
  ('spo-032','sports','kit','medium','Helmet','Gloves'),
  ('fun-001','funny','habits','easy','Snoring','Yawning'),
  ('fun-002','funny','habits','medium','Hiccups','Sneezing'),
  ('fun-003','funny','habits','hard','Giggling','Laughing'),
  ('fun-004','funny','habits','medium','Gossip','Rumour'),
  ('fun-005','funny','habits','easy','Nap','Bedtime'),
  ('fun-006','funny','habits','hard','Excuse','Lie'),
  ('fun-007','funny','modern','medium','Selfie','Group photo'),
  ('fun-008','funny','modern','hard','Voice note','Phone call'),
  ('fun-009','funny','modern','medium','Group chat','Comment section'),
  ('fun-010','funny','modern','easy','Alarm','Snooze'),
  ('fun-011','funny','modern','hard','Screenshot','Photo'),
  ('fun-012','funny','modern','medium','Notification','Reminder'),
  ('fun-013','funny','modern','hard','Typo','Autocorrect'),
  ('fun-014','funny','modern','medium','Wifi','Data'),
  ('fun-015','funny','annoyances','easy','Queue','Traffic'),
  ('fun-016','funny','annoyances','medium','Delay','Cancellation'),
  ('fun-017','funny','annoyances','hard','Interview','Interrogation'),
  ('fun-018','funny','annoyances','medium','Homework','Overtime'),
  ('fun-019','funny','annoyances','hard','Bill','Receipt'),
  ('fun-020','funny','annoyances','easy','Monday','Friday'),
  ('fun-021','funny','attempts','medium','Diet','Fasting'),
  ('fun-022','funny','attempts','hard','Gym membership','New year resolution'),
  ('fun-023','funny','attempts','medium','Nickname','Username'),
  ('fun-024','funny','attempts','easy','Prank','Surprise'),
  ('fun-025','funny','attempts','hard','Apology','Confession'),
  ('fun-026','funny','attempts','medium','Nap','Meditation'),
  ('fun-027','funny','gatherings','easy','Party','Meeting'),
  ('fun-028','funny','gatherings','hard','Reunion','Get together'),
  ('fun-029','funny','gatherings','medium','Birthday','Graduation'),
  ('fun-030','funny','gatherings','hard','Toast','Speech'),
  ('rel-001','relationships','dating','easy','Date','Hangout'),
  ('rel-002','relationships','dating','medium','Crush','Boyfriend'),
  ('rel-003','relationships','dating','hard','Talking stage','Situationship'),
  ('rel-004','relationships','dating','medium','Flirting','Teasing'),
  ('rel-005','relationships','dating','easy','First date','Blind date'),
  ('rel-006','relationships','dating','hard','Ex','Old friend'),
  ('rel-007','relationships','commitment','medium','Engagement','Wedding'),
  ('rel-008','relationships','commitment','hard','Proposal','Promise'),
  ('rel-009','relationships','commitment','medium','Marriage','Partnership'),
  ('rel-010','relationships','commitment','easy','Ring','Necklace'),
  ('rel-011','relationships','commitment','hard','Honeymoon','Holiday'),
  ('rel-012','relationships','commitment','medium','Anniversary','Birthday'),
  ('rel-013','relationships','affection','easy','Hug','Handshake'),
  ('rel-014','relationships','affection','hard','Compliment','Flattery'),
  ('rel-015','relationships','affection','medium','Gift','Surprise'),
  ('rel-016','relationships','affection','hard','Text','Letter'),
  ('rel-017','relationships','affection','medium','Flowers','Chocolate'),
  ('rel-018','relationships','affection','easy','Love','Friendship'),
  ('rel-019','relationships','conflict','medium','Argument','Debate'),
  ('rel-020','relationships','conflict','hard','Silent treatment','Cold shoulder'),
  ('rel-021','relationships','conflict','medium','Breakup','Fight'),
  ('rel-022','relationships','conflict','hard','Jealousy','Envy'),
  ('rel-023','relationships','conflict','easy','Apology','Explanation'),
  ('rel-024','relationships','conflict','medium','Trust','Loyalty'),
  ('rel-025','relationships','people','easy','Family','Friends'),
  ('rel-026','relationships','people','medium','In laws','Relatives'),
  ('rel-027','relationships','people','hard','Best friend','Close friend'),
  ('rel-028','relationships','people','medium','Neighbour','Colleague'),
  ('rel-029','relationships','people','hard','Roommate','Housemate'),
  ('rel-030','relationships','people','easy','Wedding','Reception'),
  ('nga-001','nigerian','food','medium','Jollof rice','Fried rice'),
  ('nga-002','nigerian','food','hard','Amala','Eba'),
  ('nga-003','nigerian','food','medium','Suya','Shawarma'),
  ('nga-004','nigerian','food','hard','Pounded yam','Fufu'),
  ('nga-005','nigerian','food','hard','Akara','Moi moi'),
  ('nga-006','nigerian','food','medium','Puff puff','Doughnut'),
  ('nga-007','nigerian','food','hard','Egusi','Okra'),
  ('nga-008','nigerian','food','medium','Ofada rice','White rice'),
  ('nga-009','nigerian','food','easy','Boli','Corn'),
  ('nga-010','nigerian','food','hard','Semo','Wheat'),
  ('nga-011','nigerian','food','medium','Pepper soup','Nkwobi'),
  ('nga-012','nigerian','food','hard','Zobo','Chapman'),
  ('nga-013','nigerian','food','medium','Chin chin','Plantain chips'),
  ('nga-014','nigerian','food','easy','Garri','Rice'),
  ('nga-015','nigerian','food','hard','Ewedu','Okra soup'),
  ('nga-016','nigerian','food','medium','Small chops','Finger food'),
  ('nga-017','nigerian','food','hard','Abacha','Ugba'),
  ('nga-018','nigerian','food','medium','Meat pie','Sausage roll'),
  ('nga-019','nigerian','food','easy','Suya','Asun'),
  ('nga-020','nigerian','food','hard','Banga','Ogbono'),
  ('nga-021','nigerian','food','medium','Malt','Soft drink'),
  ('nga-022','nigerian','food','hard','Agege bread','Butter bread'),
  ('nga-023','nigerian','music','hard','Wizkid','Davido'),
  ('nga-024','nigerian','music','hard','Burna Boy','Rema'),
  ('nga-025','nigerian','music','hard','Asake','Olamide'),
  ('nga-026','nigerian','music','hard','Tems','Tiwa Savage'),
  ('nga-027','nigerian','music','medium','Afrobeats','Highlife'),
  ('nga-028','nigerian','music','hard','Fuji','Juju'),
  ('nga-029','nigerian','music','medium','Shaku shaku','Zanku'),
  ('nga-030','nigerian','music','easy','Nollywood','Hollywood'),
  ('nga-031','nigerian','music','medium','Big Brother','Talent show'),
  ('nga-032','nigerian','music','hard','Concert','Album launch'),
  ('nga-033','nigerian','music','medium','DJ','Hypeman'),
  ('nga-034','nigerian','music','hard','Alte','Afrobeats'),
  ('nga-035','nigerian','places','medium','Lagos','Abuja'),
  ('nga-036','nigerian','places','medium','Ibadan','Benin City'),
  ('nga-037','nigerian','places','hard','Lekki','Ikeja'),
  ('nga-038','nigerian','places','hard','Victoria Island','Yaba'),
  ('nga-039','nigerian','places','medium','Kano','Kaduna'),
  ('nga-040','nigerian','places','easy','Port Harcourt','Calabar'),
  ('nga-041','nigerian','places','hard','Surulere','Ajah'),
  ('nga-042','nigerian','places','medium','Enugu','Owerri'),
  ('nga-043','nigerian','places','hard','Third Mainland Bridge','Carter Bridge'),
  ('nga-044','nigerian','places','medium','Balogun market','Computer Village'),
  ('nga-045','nigerian','places','easy','Village','City'),
  ('nga-046','nigerian','places','hard','Mainland','Island'),
  ('nga-047','nigerian','transport','hard','Danfo','Keke'),
  ('nga-048','nigerian','transport','medium','Okada','Keke'),
  ('nga-049','nigerian','transport','medium','Ferry','Speedboat'),
  ('nga-050','nigerian','transport','hard','BRT','Danfo'),
  ('nga-051','nigerian','transport','easy','Conductor','Driver'),
  ('nga-052','nigerian','transport','hard','Bolt','Uber'),
  ('nga-053','nigerian','transport','medium','Motor park','Bus stop'),
  ('nga-054','nigerian','transport','hard','Traffic','Go slow'),
  ('nga-055','nigerian','slang','medium','Sapa','Wahala'),
  ('nga-056','nigerian','slang','medium','Japa','Travel'),
  ('nga-057','nigerian','slang','hard','Gist','Rumour'),
  ('nga-058','nigerian','slang','hard','Omo','Abeg'),
  ('nga-059','nigerian','slang','medium','Shege','Suffer'),
  ('nga-060','nigerian','slang','hard','E choke','Gbas gbos'),
  ('nga-061','nigerian','slang','medium','Soft life','Enjoyment'),
  ('nga-062','nigerian','slang','hard','Vibes','Energy'),
  ('nga-063','nigerian','slang','medium','Runs','Hustle'),
  ('nga-064','nigerian','slang','hard','Gbedu','Banger'),
  ('nga-065','nigerian','life','medium','Generator','NEPA'),
  ('nga-066','nigerian','life','hard','Lagos traffic','Road construction'),
  ('nga-067','nigerian','life','medium','NYSC','University'),
  ('nga-068','nigerian','life','hard','Buka','Restaurant'),
  ('nga-069','nigerian','life','medium','Wedding','Naming ceremony'),
  ('nga-070','nigerian','life','hard','Owambe','Party'),
  ('nga-071','nigerian','life','medium','Aso ebi','Uniform'),
  ('nga-072','nigerian','life','hard','ASUU strike','Holiday'),
  ('nga-073','nigerian','life','easy','Pure water','Bottled water'),
  ('nga-074','nigerian','life','medium','POS','ATM'),
  ('nga-075','nigerian','life','hard','Recharge card','Data bundle'),
  ('nga-076','nigerian','life','medium','Landlord','Agent'),
  ('nga-077','nigerian','life','hard','Church service','Vigil'),
  ('nga-078','nigerian','life','medium','Village trip','Road trip'),
  ('nga-079','nigerian','life','hard','Nigerian mum','Aunty'),
  ('nga-080','nigerian','life','medium','Family meeting','Village meeting'),
  ('nga-081','nigerian','life','hard','Prepaid meter','Estimated bill'),
  ('nga-082','nigerian','life','easy','Rainy season','Harmattan'),
  ('nga-083','nigerian','life','medium','Fuel queue','Bank queue'),
  ('nga-084','nigerian','life','hard','Area boy','Agbero'),
  ('nga-085','nigerian','life','medium','Tailor','Fashion designer'),
  ('nga-086','nigerian','life','hard','Christmas','New Year'),
  ('nga-087','nigerian','life','medium','Super Eagles','Premier League'),
  ('nga-088','nigerian','life','hard','Bet9ja','Lottery'),
  ('nga-089','nigerian','life','easy','Ankara','Lace'),
  ('nga-090','nigerian','life','hard','Landlady','Caretaker')
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category, sub = EXCLUDED.sub, difficulty = EXCLUDED.difficulty,
  word_a = EXCLUDED.word_a, word_b = EXCLUDED.word_b;

