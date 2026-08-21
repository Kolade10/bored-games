-- BoredGame - Supabase migration 11: Password
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- Only the clue giver may see the word. Everyone else - including their own
-- teammates, who are sitting right there guessing - must not. So the word bank
-- is not readable from a browser at all, and the live word is handed out by a
-- function that checks you are the clue giver for that turn.
--
-- The same caveat as the other hidden-information games applies: with no
-- accounts, a player id is the only identity there is. This stops the words
-- being read out of the table or the network tab, not a player deliberately
-- calling the function as their own teammate.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_words (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  sub TEXT,
  difficulty TEXT NOT NULL,
  word TEXT NOT NULL,
  forbidden TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS password_turns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  clue_giver_id UUID REFERENCES players(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  seconds INTEGER NOT NULL DEFAULT 60,
  scoring TEXT NOT NULL DEFAULT 'risk',
  points INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, turn_number)
);

CREATE TABLE IF NOT EXISTS password_plays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  play_order INTEGER NOT NULL,
  word_id TEXT NOT NULL REFERENCES password_words(id),  -- revoked
  -- live -> correct | passed | timeout
  result TEXT NOT NULL DEFAULT 'live',
  points INTEGER NOT NULL DEFAULT 0,
  clue_step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, turn_number, play_order)
);

CREATE INDEX IF NOT EXISTS idx_pw_turns_session ON password_turns (session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_pw_plays_session ON password_plays (session_id, turn_number);

-- ---------------------------------------------------------------------------
-- 2. RLS + realtime
-- ---------------------------------------------------------------------------
ALTER TABLE password_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_plays ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['password_turns', 'password_plays'] LOOP
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
-- 3. Hide the words
--     Everything about a play is public except which word it was, so the
--     scoreboard can move in real time without giving the answer away. Past
--     words are released with the turn result.
-- ---------------------------------------------------------------------------
REVOKE ALL ON password_words FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON password_turns TO anon, authenticated;

REVOKE SELECT ON password_plays FROM anon, authenticated;
GRANT SELECT (id, session_id, turn_number, play_order, result, points, clue_step, created_at)
  ON password_plays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON password_plays TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Playing a turn
-- ---------------------------------------------------------------------------

-- Deals the next word to the clue giver, resolving the current one first.
-- p_result is 'correct', 'passed' or NULL when the turn is just starting.
CREATE OR REPLACE FUNCTION password_next_word(
  p_session_id UUID,
  p_turn_number INTEGER,
  p_player_id UUID,
  p_result TEXT DEFAULT NULL,
  p_clue_step INTEGER DEFAULT 0
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turn password_turns%ROWTYPE;
  v_live password_plays%ROWTYPE;
  v_points INTEGER := 0;
  v_next password_words%ROWTYPE;
  v_order INTEGER;
  v_categories TEXT[];
  v_difficulty TEXT;
  v_settings JSONB;
BEGIN
  SELECT * INTO v_turn FROM password_turns
  WHERE session_id = p_session_id AND turn_number = p_turn_number;

  IF v_turn.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turn not found.');
  END IF;
  IF v_turn.clue_giver_id <> p_player_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the clue giver can do that.');
  END IF;
  IF v_turn.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That turn is over.');
  END IF;
  -- The clock is the referee: no scoring after it runs out.
  IF v_turn.started_at IS NOT NULL
     AND NOW() > v_turn.started_at + ((v_turn.seconds + 2) || ' seconds')::INTERVAL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Time is up.', 'expired', true);
  END IF;

  SELECT * INTO v_live FROM password_plays
  WHERE session_id = p_session_id AND turn_number = p_turn_number AND result = 'live'
  ORDER BY play_order DESC LIMIT 1;

  IF v_live.id IS NOT NULL AND p_result IN ('correct', 'passed') THEN
    IF p_result = 'correct' THEN
      v_points := CASE
        WHEN v_turn.scoring = 'classic' THEN 1
        WHEN p_clue_step <= 0 THEN 5
        WHEN p_clue_step = 1 THEN 3
        ELSE 1
      END;
    END IF;

    UPDATE password_plays
    SET result = p_result, points = v_points, clue_step = GREATEST(0, p_clue_step)
    WHERE id = v_live.id;

    UPDATE password_turns
    SET points = points + v_points,
        correct_count = correct_count + CASE WHEN p_result = 'correct' THEN 1 ELSE 0 END,
        passed_count = passed_count + CASE WHEN p_result = 'passed' THEN 1 ELSE 0 END
    WHERE id = v_turn.id;
  END IF;

  -- Settings live on the session; the words themselves never leave the server
  -- except through this function.
  SELECT round_data INTO v_settings FROM game_sessions WHERE id = p_session_id;
  v_categories := CASE
    WHEN v_settings ? 'categories' AND jsonb_array_length(v_settings->'categories') > 0
    THEN ARRAY(SELECT jsonb_array_elements_text(v_settings->'categories'))
    ELSE NULL END;
  v_difficulty := COALESCE(v_settings->>'difficulty', 'mixed');

  -- A word nobody in this game has had yet. Passed words are burned too, so a
  -- word skipped by one team cannot come back for another.
  SELECT * INTO v_next FROM password_words w
  WHERE (v_categories IS NULL OR w.category = ANY(v_categories))
    AND (v_difficulty = 'mixed' OR w.difficulty = v_difficulty)
    AND NOT EXISTS (
      SELECT 1 FROM password_plays pl
      WHERE pl.session_id = p_session_id AND pl.word_id = w.id
    )
  ORDER BY random() LIMIT 1;

  IF v_next.id IS NULL THEN
    SELECT * INTO v_next FROM password_words w
    WHERE (v_categories IS NULL OR w.category = ANY(v_categories))
      AND NOT EXISTS (
        SELECT 1 FROM password_plays pl
        WHERE pl.session_id = p_session_id AND pl.word_id = w.id
      )
    ORDER BY random() LIMIT 1;
  END IF;
  IF v_next.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'exhausted', true,
                              'awarded', v_points);
  END IF;

  SELECT COALESCE(max(play_order), 0) + 1 INTO v_order FROM password_plays
  WHERE session_id = p_session_id AND turn_number = p_turn_number;

  INSERT INTO password_plays (session_id, turn_number, play_order, word_id)
  VALUES (p_session_id, p_turn_number, v_order, v_next.id);

  RETURN jsonb_build_object(
    'ok', true,
    'awarded', v_points,
    'word', v_next.word,
    'forbidden', to_jsonb(v_next.forbidden),
    'category', v_next.category,
    'difficulty', v_next.difficulty
  );
END;
$$ LANGUAGE plpgsql;

-- Re-reads the live word, for a clue giver who reloaded mid-turn.
CREATE OR REPLACE FUNCTION password_current_word(
  p_session_id UUID,
  p_turn_number INTEGER,
  p_player_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giver UUID;
  v_word password_words%ROWTYPE;
BEGIN
  SELECT clue_giver_id INTO v_giver FROM password_turns
  WHERE session_id = p_session_id AND turn_number = p_turn_number;

  IF v_giver IS NULL OR v_giver <> p_player_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the clue giver can see the word.');
  END IF;

  SELECT w.* INTO v_word
  FROM password_plays pl JOIN password_words w ON w.id = pl.word_id
  WHERE pl.session_id = p_session_id AND pl.turn_number = p_turn_number AND pl.result = 'live'
  ORDER BY pl.play_order DESC LIMIT 1;

  IF v_word.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'word', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'word', v_word.word,
                            'forbidden', to_jsonb(v_word.forbidden));
END;
$$ LANGUAGE plpgsql;

-- Closes the turn and releases what the words actually were.
CREATE OR REPLACE FUNCTION password_end_turn(
  p_session_id UUID,
  p_turn_number INTEGER
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE password_plays
  SET result = 'timeout'
  WHERE session_id = p_session_id AND turn_number = p_turn_number AND result = 'live';

  UPDATE password_turns
  SET ended_at = COALESCE(ended_at, NOW())
  WHERE session_id = p_session_id AND turn_number = p_turn_number;

  RETURN jsonb_build_object(
    'ok', true,
    'words', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'play_order', pl.play_order, 'word', w.word,
               'result', pl.result, 'points', pl.points) ORDER BY pl.play_order)
      FROM password_plays pl JOIN password_words w ON w.id = pl.word_id
      WHERE pl.session_id = p_session_id AND pl.turn_number = p_turn_number
    ), '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql;

-- The words from a turn that is already over, for the recap and for anyone who
-- reloads after it. A turn still running gives nothing away.
CREATE OR REPLACE FUNCTION password_turn_words(
  p_session_id UUID,
  p_turn_number INTEGER
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ended TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT ended_at INTO v_ended FROM password_turns
  WHERE session_id = p_session_id AND turn_number = p_turn_number;

  IF v_ended IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That turn is still running.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'words', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'play_order', pl.play_order, 'word', w.word,
               'result', pl.result, 'points', pl.points) ORDER BY pl.play_order)
      FROM password_plays pl JOIN password_words w ON w.id = pl.word_id
      WHERE pl.session_id = p_session_id AND pl.turn_number = p_turn_number
    ), '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION password_next_word(UUID, INTEGER, UUID, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION password_turn_words(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION password_current_word(UUID, INTEGER, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION password_end_turn(UUID, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The word bank
-- ---------------------------------------------------------------------------
INSERT INTO password_words (id, category, sub, difficulty, word, forbidden) VALUES
  ('gen-001','general','animals','easy','Elephant',ARRAY['trunk','big','grey','safari']),
  ('gen-002','general','animals','easy','Lion',ARRAY['king','jungle','roar','mane']),
  ('gen-003','general','animals','easy','Dog',ARRAY['bark','pet','puppy','loyal']),
  ('gen-004','general','animals','easy','Chicken',ARRAY['egg','bird','farm','fry']),
  ('gen-005','general','animals','easy','Snake',ARRAY['bite','slither','poison','long']),
  ('gen-006','general','animals','medium','Giraffe',ARRAY['neck','tall','spots','zoo']),
  ('gen-007','general','animals','medium','Crocodile',ARRAY['teeth','river','reptile','bite']),
  ('gen-008','general','animals','medium','Butterfly',ARRAY['wings','colour','fly','caterpillar']),
  ('gen-009','general','animals','medium','Goat',ARRAY['meat','horns','milk','farm']),
  ('gen-010','general','animals','hard','Chameleon',ARRAY['colour','change','lizard','blend']),
  ('gen-011','general','animals','hard','Owl',ARRAY['night','wise','bird','hoot']),
  ('gen-012','general','objects','easy','Umbrella',ARRAY['rain','open','wet','cover']),
  ('gen-013','general','objects','easy','Mirror',ARRAY['reflect','glass','face','look']),
  ('gen-014','general','objects','easy','Broom',ARRAY['sweep','floor','clean','dust']),
  ('gen-015','general','objects','easy','Bucket',ARRAY['water','carry','plastic','fill']),
  ('gen-016','general','objects','easy','Ladder',ARRAY['climb','high','steps','reach']),
  ('gen-017','general','objects','medium','Fan',ARRAY['cool','blow','air','hot']),
  ('gen-018','general','objects','medium','Padlock',ARRAY['key','lock','secure','gate']),
  ('gen-019','general','objects','medium','Kettle',ARRAY['boil','water','tea','hot']),
  ('gen-020','general','objects','medium','Torch',ARRAY['light','dark','battery','shine']),
  ('gen-021','general','objects','hard','Wheelbarrow',ARRAY['push','carry','wheel','garden']),
  ('gen-022','general','objects','hard','Stapler',ARRAY['paper','office','pin','attach']),
  ('gen-023','general','places','easy','Hospital',ARRAY['doctor','sick','nurse','ill']),
  ('gen-024','general','places','easy','Airport',ARRAY['plane','fly','travel','luggage']),
  ('gen-025','general','places','easy','Church',ARRAY['pray','god','service','sunday']),
  ('gen-026','general','places','easy','School',ARRAY['teacher','learn','student','class']),
  ('gen-027','general','places','medium','Barbershop',ARRAY['hair','cut','clipper','shave']),
  ('gen-028','general','places','medium','Petrol station',ARRAY['fuel','car','pump','tank']),
  ('gen-029','general','places','medium','Library',ARRAY['book','quiet','read','borrow']),
  ('gen-030','general','places','hard','Courtroom',ARRAY['judge','law','case','guilty']),
  ('gen-031','general','places','hard','Prison',ARRAY['jail','lock','criminal','cell']),
  ('gen-032','general','jobs','easy','Doctor',ARRAY['hospital','sick','treat','patient']),
  ('gen-033','general','jobs','easy','Teacher',ARRAY['school','class','student','teach']),
  ('gen-034','general','jobs','easy','Driver',ARRAY['car','drive','road','steering']),
  ('gen-035','general','jobs','medium','Tailor',ARRAY['sew','clothes','measure','cloth']),
  ('gen-036','general','jobs','medium','Mechanic',ARRAY['car','fix','engine','garage']),
  ('gen-037','general','jobs','medium','Photographer',ARRAY['camera','picture','shoot','photo']),
  ('gen-038','general','jobs','medium','Security guard',ARRAY['gate','watch','protect','uniform']),
  ('gen-039','general','jobs','hard','Accountant',ARRAY['money','numbers','book','audit']),
  ('gen-040','general','jobs','hard','Journalist',ARRAY['news','write','report','paper']),
  ('gen-041','general','transport','easy','Aeroplane',ARRAY['fly','sky','airport','wings']),
  ('gen-042','general','transport','easy','Bicycle',ARRAY['ride','pedal','two','wheels']),
  ('gen-043','general','transport','medium','Helicopter',ARRAY['fly','blades','hover','sky']),
  ('gen-044','general','transport','medium','Ambulance',ARRAY['siren','hospital','emergency','sick']),
  ('gen-045','general','transport','hard','Submarine',ARRAY['water','under','sea','dive']),
  ('gen-046','general','activities','easy','Jogging',ARRAY['run','slow','exercise','morning']),
  ('gen-047','general','activities','easy','Dancing',ARRAY['music','move','party','steps']),
  ('gen-048','general','activities','medium','Getting a haircut',ARRAY['barber','hair','cut','salon']),
  ('gen-049','general','activities','medium','Washing clothes',ARRAY['soap','clothes','water','laundry']),
  ('gen-050','general','activities','medium','Traffic',ARRAY['car','road','slow','jam']),
  ('gen-051','general','concepts','hard','Procrastination',ARRAY['later','delay','lazy','postpone']),
  ('gen-052','general','concepts','hard','Being late',ARRAY['time','late','rush','delay']),
  ('gen-053','general','concepts','hard','Missing your flight',ARRAY['plane','airport','late','miss']),
  ('gen-054','general','concepts','hard','Getting caught lying',ARRAY['lie','caught','truth','liar']),
  ('gen-055','general','concepts','hard','Awkward silence',ARRAY['quiet','awkward','talk','pause']),
  ('foo-001','food','foods','easy','Pizza',ARRAY['cheese','italian','slice','round']),
  ('foo-002','food','foods','easy','Bread',ARRAY['bake','loaf','butter','slice']),
  ('foo-003','food','foods','easy','Egg',ARRAY['chicken','fry','boil','yolk']),
  ('foo-004','food','foods','easy','Rice',ARRAY['grain','white','cook','boil']),
  ('foo-005','food','foods','medium','Spaghetti',ARRAY['pasta','italian','long','sauce']),
  ('foo-006','food','foods','medium','Sandwich',ARRAY['bread','filling','lunch','slice']),
  ('foo-007','food','foods','medium','Salad',ARRAY['vegetable','green','healthy','leaf']),
  ('foo-008','food','foods','hard','Barbecue',ARRAY['grill','meat','fire','smoke']),
  ('foo-009','food','desserts','easy','Ice cream',ARRAY['cold','sweet','cone','melt']),
  ('foo-010','food','desserts','easy','Cake',ARRAY['birthday','sweet','bake','candle']),
  ('foo-011','food','desserts','medium','Doughnut',ARRAY['ring','sweet','hole','fry']),
  ('foo-012','food','desserts','hard','Melting ice cream',ARRAY['cold','melt','drip','sun']),
  ('foo-013','food','drinks','easy','Tea',ARRAY['hot','cup','drink','leaf']),
  ('foo-014','food','drinks','easy','Coffee',ARRAY['hot','caffeine','morning','bean']),
  ('foo-015','food','drinks','medium','Smoothie',ARRAY['blend','fruit','drink','thick']),
  ('foo-016','food','drinks','hard','Burning your tongue',ARRAY['hot','tongue','burn','drink']),
  ('foo-017','food','cooking','easy','Frying',ARRAY['oil','pan','heat','cook']),
  ('foo-018','food','cooking','medium','Chopping onions',ARRAY['onion','cry','knife','cut']),
  ('foo-019','food','cooking','medium','Boiling water',ARRAY['water','heat','bubble','hot']),
  ('foo-020','food','cooking','medium','Burning the food',ARRAY['burn','smoke','black','cook']),
  ('foo-021','food','cooking','hard','Tasting for salt',ARRAY['salt','taste','season','tongue']),
  ('foo-022','food','cooking','hard','Following a recipe',ARRAY['recipe','steps','cook','book']),
  ('foo-023','food','restaurant','easy','Waiter',ARRAY['restaurant','order','serve','table']),
  ('foo-024','food','restaurant','medium','Asking for the bill',ARRAY['bill','pay','money','waiter']),
  ('foo-025','food','restaurant','medium','Ordering takeaway',ARRAY['order','deliver','phone','food']),
  ('foo-026','food','restaurant','hard','Sending food back',ARRAY['wrong','return','complain','waiter']),
  ('foo-027','food','restaurant','hard','Splitting the bill',ARRAY['bill','share','money','pay']),
  ('foo-028','food','ingredients','medium','Pepper',ARRAY['hot','spice','season','red']),
  ('foo-029','food','ingredients','medium','Sugar',ARRAY['sweet','white','tea','spoon']),
  ('foo-030','food','ingredients','hard','Too much salt',ARRAY['salt','taste','too','much']),
  ('ent-001','entertainment','characters','easy','Superhero',ARRAY['cape','power','save','comic']),
  ('ent-002','entertainment','characters','easy','Ghost',ARRAY['scary','white','haunt','dead']),
  ('ent-003','entertainment','characters','easy','Pirate',ARRAY['ship','treasure','sea','eye']),
  ('ent-004','entertainment','characters','medium','Wizard',ARRAY['magic','wand','spell','hat']),
  ('ent-005','entertainment','characters','medium','Detective',ARRAY['clue','solve','crime','case']),
  ('ent-006','entertainment','characters','hard','Villain',ARRAY['bad','evil','hero','enemy']),
  ('ent-007','entertainment','movies','easy','Cinema',ARRAY['film','screen','popcorn','watch']),
  ('ent-008','entertainment','movies','easy','Popcorn',ARRAY['cinema','corn','snack','pop']),
  ('ent-009','entertainment','movies','medium','Horror film',ARRAY['scary','fear','blood','scream']),
  ('ent-010','entertainment','movies','medium','Trailer',ARRAY['preview','film','short','clip']),
  ('ent-011','entertainment','movies','hard','Plot twist',ARRAY['story','surprise','end','turn']),
  ('ent-012','entertainment','movies','hard','Spoiling the ending',ARRAY['spoil','end','tell','film']),
  ('ent-013','entertainment','tv','easy','News presenter',ARRAY['news','read','tv','report']),
  ('ent-014','entertainment','tv','medium','Reality show',ARRAY['real','house','drama','tv']),
  ('ent-015','entertainment','tv','medium','Cooking show',ARRAY['cook','chef','tv','food']),
  ('ent-016','entertainment','tv','hard','Binge watching',ARRAY['watch','episode','series','all']),
  ('ent-017','entertainment','music','easy','Guitar',ARRAY['string','play','music','strum']),
  ('ent-018','entertainment','music','easy','Drums',ARRAY['beat','stick','hit','music']),
  ('ent-019','entertainment','music','medium','Karaoke',ARRAY['sing','mic','screen','song']),
  ('ent-020','entertainment','music','medium','Concert',ARRAY['live','stage','crowd','music']),
  ('ent-021','entertainment','music','hard','Forgetting the lyrics',ARRAY['words','song','forget','sing']),
  ('ent-022','entertainment','music','hard','A song stuck in your head',ARRAY['song','head','repeat','stuck']),
  ('ent-023','entertainment','modern','easy','Selfie',ARRAY['photo','phone','face','camera']),
  ('ent-024','entertainment','modern','medium','Going viral',ARRAY['internet','share','famous','views']),
  ('ent-025','entertainment','modern','hard','Reading the comments',ARRAY['comment','post','read','internet']),
  ('spo-001','sports','football','easy','Football',ARRAY['kick','goal','ball','pitch']),
  ('spo-002','sports','football','easy','Goalkeeper',ARRAY['goal','save','gloves','post']),
  ('spo-003','sports','football','easy','Penalty',ARRAY['kick','spot','goal','foul']),
  ('spo-004','sports','football','medium','Referee',ARRAY['whistle','card','rules','match']),
  ('spo-005','sports','football','medium','Red card',ARRAY['send','off','foul','referee']),
  ('spo-006','sports','football','hard','Offside',ARRAY['rule','line','flag','position']),
  ('spo-007','sports','football','hard','Missing a penalty',ARRAY['miss','kick','goal','penalty']),
  ('spo-008','sports','other','easy','Basketball',ARRAY['hoop','dribble','ball','net']),
  ('spo-009','sports','other','medium','Slam dunk',ARRAY['basket','jump','hoop','ball']),
  ('spo-010','sports','other','easy','Boxing',ARRAY['punch','gloves','ring','fight']),
  ('spo-011','sports','other','medium','Knockout',ARRAY['punch','down','boxing','out']),
  ('spo-012','sports','other','easy','Swimming',ARRAY['water','pool','stroke','race']),
  ('spo-013','sports','other','medium','Tennis',ARRAY['racket','net','serve','court']),
  ('spo-014','sports','athletics','medium','Marathon',ARRAY['run','long','distance','race']),
  ('spo-015','sports','athletics','medium','Relay race',ARRAY['baton','team','run','pass']),
  ('spo-016','sports','athletics','hard','False start',ARRAY['gun','early','run','start']),
  ('spo-017','sports','prizes','easy','Trophy',ARRAY['win','cup','prize','lift']),
  ('spo-018','sports','prizes','easy','Medal',ARRAY['gold','neck','win','hang']),
  ('spo-019','sports','general','medium','Half time',ARRAY['break','match','middle','rest']),
  ('spo-020','sports','general','medium','Substitute',ARRAY['bench','swap','player','come']),
  ('spo-021','sports','general','hard','Losing on penalties',ARRAY['penalty','lose','shootout','miss']),
  ('spo-022','sports','general','hard','Supporting a bad team',ARRAY['team','lose','fan','support']),
  ('spo-023','sports','general','medium','Stadium',ARRAY['crowd','match','seats','big']),
  ('spo-024','sports','general','hard','Commentator',ARRAY['talk','match','describe','radio']),
  ('fun-001','funny','situations','easy','Sneezing',ARRAY['nose','achoo','cold','blow']),
  ('fun-002','funny','situations','easy','Snoring',ARRAY['sleep','noise','nose','loud']),
  ('fun-003','funny','situations','easy','Yawning',ARRAY['tired','mouth','sleep','open']),
  ('fun-004','funny','situations','medium','Hiccups',ARRAY['sound','breath','stop','water']),
  ('fun-005','funny','situations','medium','Tripping in public',ARRAY['fall','trip','people','embarrass']),
  ('fun-006','funny','situations','hard','Laughing at the wrong time',ARRAY['laugh','wrong','serious','time']),
  ('fun-007','funny','everyday','easy','Losing your keys',ARRAY['key','lost','find','search']),
  ('fun-008','funny','everyday','easy','Oversleeping',ARRAY['sleep','late','alarm','morning']),
  ('fun-009','funny','everyday','medium','Hitting snooze',ARRAY['alarm','sleep','button','morning']),
  ('fun-010','funny','everyday','medium','Running out of data',ARRAY['internet','data','finish','phone']),
  ('fun-011','funny','everyday','medium','Low battery',ARRAY['phone','charge','battery','die']),
  ('fun-012','funny','everyday','hard','Pretending to be busy',ARRAY['busy','pretend','work','look']),
  ('fun-013','funny','awkward','hard','Forgetting a name',ARRAY['name','forget','remember','person']),
  ('fun-014','funny','awkward','hard','Waving at the wrong person',ARRAY['wave','wrong','person','hand']),
  ('fun-015','funny','awkward','hard','Replying to the wrong chat',ARRAY['message','wrong','send','chat']),
  ('fun-016','funny','awkward','hard','Being left on read',ARRAY['message','read','reply','ignore']),
  ('fun-017','funny','behaviour','medium','Talking to yourself',ARRAY['talk','alone','self','voice']),
  ('fun-018','funny','behaviour','medium','Arguing with a machine',ARRAY['machine','shout','broken','argue']),
  ('fun-019','funny','behaviour','hard','Overreacting to a small injury',ARRAY['pain','small','cry','hurt']),
  ('fun-020','funny','behaviour','hard','Pretending you understood',ARRAY['understand','pretend','nod','confused']),
  ('fun-021','funny','behaviour','easy','Dancing badly',ARRAY['dance','bad','move','music']),
  ('fun-022','funny','behaviour','medium','Chasing a mosquito',ARRAY['mosquito','hit','night','buzz']),
  ('fun-023','funny','struggles','hard','Untangling earphones',ARRAY['earphone','knot','wire','tangle']),
  ('fun-024','funny','struggles','hard','Opening a stubborn jar',ARRAY['jar','open','tight','lid']),
  ('fun-025','funny','struggles','medium','Carrying too much at once',ARRAY['carry','many','hands','drop']),
  ('rel-001','relationships','dating','easy','First date',ARRAY['date','first','nervous','meet']),
  ('rel-002','relationships','dating','easy','Holding hands',ARRAY['hand','hold','couple','touch']),
  ('rel-003','relationships','dating','easy','Giving flowers',ARRAY['flower','give','rose','gift']),
  ('rel-004','relationships','dating','medium','Blind date',ARRAY['date','stranger','blind','meet']),
  ('rel-005','relationships','dating','medium','Being stood up',ARRAY['wait','date','nobody','come']),
  ('rel-006','relationships','dating','hard','The talking stage',ARRAY['talk','stage','dating','before']),
  ('rel-007','relationships','commitment','easy','Wedding',ARRAY['marry','ring','bride','church']),
  ('rel-008','relationships','commitment','easy','Engagement ring',ARRAY['ring','propose','finger','marry']),
  ('rel-009','relationships','commitment','medium','Proposal',ARRAY['knee','ring','marry','ask']),
  ('rel-010','relationships','commitment','medium','Honeymoon',ARRAY['trip','after','wedding','couple']),
  ('rel-011','relationships','commitment','hard','Meeting the in-laws',ARRAY['family','parents','meet','partner']),
  ('rel-012','relationships','affection','easy','Hug',ARRAY['arms','hold','squeeze','warm']),
  ('rel-013','relationships','affection','medium','Anniversary',ARRAY['year','celebrate','date','remember']),
  ('rel-014','relationships','affection','medium','Surprise gift',ARRAY['gift','surprise','give','wrap']),
  ('rel-015','relationships','affection','hard','A long goodbye',ARRAY['leave','goodbye','long','wave']),
  ('rel-016','relationships','conflict','medium','Argument',ARRAY['fight','shout','disagree','angry']),
  ('rel-017','relationships','conflict','medium','Apologising',ARRAY['sorry','apologise','forgive','wrong']),
  ('rel-018','relationships','conflict','hard','The silent treatment',ARRAY['quiet','ignore','angry','silence']),
  ('rel-019','relationships','conflict','hard','Saying you are fine',ARRAY['fine','okay','not','angry']),
  ('rel-020','relationships','conflict','hard','Bringing up the past',ARRAY['past','old','remember','argument']),
  ('rel-021','relationships','friendship','easy','Best friend',ARRAY['friend','best','close','mate']),
  ('rel-022','relationships','friendship','medium','Group chat',ARRAY['chat','group','message','friends']),
  ('rel-023','relationships','friendship','medium','Cancelling plans',ARRAY['cancel','plan','stay','excuse']),
  ('rel-024','relationships','friendship','hard','The friend who is always late',ARRAY['late','friend','wait','always']),
  ('rel-025','relationships','friendship','hard','Third wheeling',ARRAY['couple','three','alone','extra']),
  ('nga-001','nigerian','food','easy','Jollof rice',ARRAY['rice','party','tomato','nigerian']),
  ('nga-002','nigerian','food','easy','Fried rice',ARRAY['rice','fry','green','party']),
  ('nga-003','nigerian','food','easy','Amala',ARRAY['yam','black','swallow','ewedu']),
  ('nga-004','nigerian','food','easy','Eba',ARRAY['garri','swallow','soup','yellow']),
  ('nga-005','nigerian','food','medium','Egusi',ARRAY['melon','soup','seed','swallow']),
  ('nga-006','nigerian','food','easy','Pounded yam',ARRAY['yam','pound','swallow','mortar']),
  ('nga-007','nigerian','food','medium','Akara',ARRAY['bean','fry','ball','pap']),
  ('nga-008','nigerian','food','medium','Moi moi',ARRAY['bean','steam','leaf','wrap']),
  ('nga-009','nigerian','food','easy','Suya',ARRAY['meat','pepper','stick','roast']),
  ('nga-010','nigerian','food','medium','Pepper soup',ARRAY['pepper','soup','hot','goat']),
  ('nga-011','nigerian','food','medium','Ofada rice',ARRAY['rice','local','sauce','green']),
  ('nga-012','nigerian','food','easy','Puff puff',ARRAY['fry','dough','round','sweet']),
  ('nga-013','nigerian','food','medium','Chin chin',ARRAY['fry','crunchy','snack','flour']),
  ('nga-014','nigerian','food','easy','Plantain',ARRAY['fry','dodo','banana','yellow']),
  ('nga-015','nigerian','food','medium','Boli',ARRAY['plantain','roast','fire','street']),
  ('nga-016','nigerian','food','medium','Zobo',ARRAY['drink','red','hibiscus','cold']),
  ('nga-017','nigerian','food','hard','Small chops',ARRAY['snack','party','puff','tray']),
  ('nga-018','nigerian','food','hard','Party jollof',ARRAY['jollof','party','smoke','rice']),
  ('nga-019','nigerian','food','medium','Garri',ARRAY['soak','cassava','drink','eba']),
  ('nga-020','nigerian','food','hard','Nkwobi',ARRAY['cow','foot','spicy','bowl']),
  ('nga-021','nigerian','food','medium','Agege bread',ARRAY['bread','soft','lagos','loaf']),
  ('nga-022','nigerian','food','hard','Ewedu',ARRAY['soup','green','slimy','amala']),
  ('nga-023','nigerian','music','medium','Wizkid',ARRAY['singer','afrobeats','star','music']),
  ('nga-024','nigerian','music','medium','Davido',ARRAY['singer','afrobeats','music','omo']),
  ('nga-025','nigerian','music','medium','Burna Boy',ARRAY['singer','grammy','music','afrobeats']),
  ('nga-026','nigerian','music','medium','Rema',ARRAY['singer','calm','young','music']),
  ('nga-027','nigerian','music','medium','Asake',ARRAY['singer','amapiano','music','new']),
  ('nga-028','nigerian','music','medium','Olamide',ARRAY['rapper','indigenous','music','badoo']),
  ('nga-029','nigerian','music','medium','Tems',ARRAY['singer','female','voice','music']),
  ('nga-030','nigerian','music','medium','Tiwa Savage',ARRAY['singer','female','queen','music']),
  ('nga-031','nigerian','music','hard','Phyno',ARRAY['rapper','igbo','music','indigenous']),
  ('nga-032','nigerian','music','hard','Yemi Alade',ARRAY['singer','female','johnny','music']),
  ('nga-033','nigerian','music','easy','Afrobeats',ARRAY['music','dance','nigeria','sound']),
  ('nga-034','nigerian','music','medium','Shaku shaku',ARRAY['dance','street','move','leg']),
  ('nga-035','nigerian','music','medium','Zanku',ARRAY['dance','leg','work','move']),
  ('nga-036','nigerian','music','hard','Spraying money',ARRAY['money','party','throw','dance']),
  ('nga-037','nigerian','slang','easy','Omo',ARRAY['word','slang','exclaim','shock']),
  ('nga-038','nigerian','slang','easy','Abeg',ARRAY['please','beg','slang','ask']),
  ('nga-039','nigerian','slang','easy','Wahala',ARRAY['trouble','problem','slang','palava']),
  ('nga-040','nigerian','slang','medium','Sapa',ARRAY['broke','money','hunger','slang']),
  ('nga-041','nigerian','slang','medium','Japa',ARRAY['travel','leave','abroad','run']),
  ('nga-042','nigerian','slang','medium','Gist',ARRAY['talk','story','gossip','news']),
  ('nga-043','nigerian','slang','hard','E choke',ARRAY['too','much','slang','shock']),
  ('nga-044','nigerian','slang','easy','No wahala',ARRAY['problem','fine','okay','trouble']),
  ('nga-045','nigerian','slang','medium','Shege',ARRAY['suffer','hard','slang','pepper']),
  ('nga-046','nigerian','slang','hard','Soft life',ARRAY['easy','enjoy','comfort','life']),
  ('nga-047','nigerian','slang','hard','Gbas gbos',ARRAY['fight','argue','back','forth']),
  ('nga-048','nigerian','places','easy','Lagos',ARRAY['city','traffic','state','island']),
  ('nga-049','nigerian','places','easy','Abuja',ARRAY['capital','city','federal','state']),
  ('nga-050','nigerian','places','medium','Ibadan',ARRAY['city','oyo','brown','roof']),
  ('nga-051','nigerian','places','medium','Kano',ARRAY['city','north','state','kanuri']),
  ('nga-052','nigerian','places','medium','Benin City',ARRAY['city','edo','state','oba']),
  ('nga-053','nigerian','places','medium','Port Harcourt',ARRAY['city','rivers','oil','garden']),
  ('nga-054','nigerian','places','medium','Enugu',ARRAY['city','coal','state','east']),
  ('nga-055','nigerian','places','medium','Lekki',ARRAY['lagos','island','toll','estate']),
  ('nga-056','nigerian','places','medium','Ikeja',ARRAY['lagos','mainland','airport','state']),
  ('nga-057','nigerian','places','hard','Yaba',ARRAY['lagos','market','tech','mainland']),
  ('nga-058','nigerian','places','hard','Victoria Island',ARRAY['lagos','island','rich','office']),
  ('nga-059','nigerian','places','hard','Third Mainland Bridge',ARRAY['bridge','lagos','long','traffic']),
  ('nga-060','nigerian','places','hard','Balogun market',ARRAY['market','lagos','cloth','crowd']),
  ('nga-061','nigerian','transport','easy','Danfo',ARRAY['bus','yellow','lagos','transport']),
  ('nga-062','nigerian','transport','easy','Okada',ARRAY['bike','motorcycle','ride','transport']),
  ('nga-063','nigerian','transport','easy','Keke',ARRAY['tricycle','three','napep','ride']),
  ('nga-064','nigerian','transport','medium','BRT',ARRAY['bus','red','lane','lagos']),
  ('nga-065','nigerian','transport','easy','Conductor',ARRAY['bus','money','shout','danfo']),
  ('nga-066','nigerian','transport','hard','Roadside taxi',ARRAY['car','taxi','road','drop']),
  ('nga-067','nigerian','transport','hard','Fuel queue',ARRAY['fuel','line','wait','petrol']),
  ('nga-068','nigerian','life','easy','Lagos traffic',ARRAY['traffic','lagos','jam','hold']),
  ('nga-069','nigerian','life','easy','Generator',ARRAY['light','power','noise','fuel']),
  ('nga-070','nigerian','life','easy','NEPA',ARRAY['light','power','electricity','take']),
  ('nga-071','nigerian','life','easy','Power outage',ARRAY['light','off','dark','power']),
  ('nga-072','nigerian','life','medium','Nigerian wedding',ARRAY['wedding','party','aso','marry']),
  ('nga-073','nigerian','life','medium','Family meeting',ARRAY['family','meeting','elders','talk']),
  ('nga-074','nigerian','life','medium','NYSC',ARRAY['service','youth','khaki','camp']),
  ('nga-075','nigerian','life','medium','ASUU strike',ARRAY['strike','school','lecturer','university']),
  ('nga-076','nigerian','life','medium','Sunday rice',ARRAY['rice','sunday','church','jollof']),
  ('nga-077','nigerian','life','medium','Market bargaining',ARRAY['price','market','reduce','seller']),
  ('nga-078','nigerian','life','medium','Nigerian mum',ARRAY['mother','mum','slipper','shout']),
  ('nga-079','nigerian','life','medium','Danfo conductor',ARRAY['bus','money','shout','change']),
  ('nga-080','nigerian','life','medium','Owambe',ARRAY['party','dance','aso','celebrate']),
  ('nga-081','nigerian','life','medium','Aso ebi',ARRAY['cloth','party','same','wear']),
  ('nga-082','nigerian','life','hard','Waiting for light',ARRAY['light','power','wait','nepa']),
  ('nga-083','nigerian','life','hard','Village trip',ARRAY['village','travel','christmas','home']),
  ('nga-084','nigerian','life','hard','Naming ceremony',ARRAY['baby','name','ceremony','eight']),
  ('nga-085','nigerian','life','medium','Pure water',ARRAY['water','sachet','cold','drink']),
  ('nga-086','nigerian','life','medium','POS',ARRAY['money','withdraw','agent','card']),
  ('nga-087','nigerian','life','hard','Recharge card',ARRAY['airtime','scratch','load','credit']),
  ('nga-088','nigerian','life','hard','Landlord wahala',ARRAY['rent','house','landlord','pay']),
  ('nga-089','nigerian','life','hard','Detty December',ARRAY['december','party','lagos','enjoy']),
  ('nga-090','nigerian','life','hard','Harmattan',ARRAY['dry','dust','cold','season']),
  ('nga-091','nigerian','life','medium','Super Eagles',ARRAY['football','team','nigeria','green']),
  ('nga-092','nigerian','life','hard','Church vigil',ARRAY['church','night','pray','all'])
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category, sub = EXCLUDED.sub, difficulty = EXCLUDED.difficulty,
  word = EXCLUDED.word, forbidden = EXCLUDED.forbidden;

