-- BoredGame - Supabase migration 2
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Everything here is idempotent, so it is safe to run more than once, and safe
-- to run on a database that was created from database_schema.sql.

-- ---------------------------------------------------------------------------
-- 1. Columns used by Tic Tac Toe round handling
--    (already present if you created the schema after database_migration.sql)
-- ---------------------------------------------------------------------------
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS first_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS last_winner_id  UUID REFERENCES players(id);

-- ---------------------------------------------------------------------------
-- 2. REPLICA IDENTITY FULL
--    Postgres only ships the primary key of a deleted row by default, so a
--    realtime subscription filtered on e.g. session_id never matches a DELETE
--    and clients miss the event. Symptoms: the board does not clear for the
--    other player after "New Round", and players who leave stay in the list.
-- ---------------------------------------------------------------------------
ALTER TABLE rooms             REPLICA IDENTITY FULL;
ALTER TABLE players           REPLICA IDENTITY FULL;
ALTER TABLE game_sessions     REPLICA IDENTITY FULL;
ALTER TABLE rounds            REPLICA IDENTITY FULL;
ALTER TABLE player_answers    REPLICA IDENTITY FULL;
ALTER TABLE scores            REPLICA IDENTITY FULL;
ALTER TABLE tic_tac_toe_moves REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 3. Uniqueness constraints that make the games safe against races
--    Several clients act on the same state at once; these turn "two clients
--    both wrote" into a rejected insert the app already handles.
-- ---------------------------------------------------------------------------

-- One score row per player per round (stops totals from being multiplied when
-- more than one client finishes a round at the same moment). Required for the
-- upsert the app uses.
DELETE FROM scores a USING scores b
  WHERE a.ctid < b.ctid
    AND a.session_id = b.session_id
    AND a.player_id  = b.player_id
    AND a.round_number = b.round_number;

CREATE UNIQUE INDEX IF NOT EXISTS scores_session_player_round_key
  ON scores (session_id, player_id, round_number);

-- One answer row per player per round.
DELETE FROM player_answers a USING player_answers b
  WHERE a.ctid < b.ctid
    AND a.round_id  = b.round_id
    AND a.player_id = b.player_id;

CREATE UNIQUE INDEX IF NOT EXISTS player_answers_round_player_key
  ON player_answers (round_id, player_id);

-- One round row per round number in a session.
DELETE FROM rounds a USING rounds b
  WHERE a.ctid < b.ctid
    AND a.session_id   = b.session_id
    AND a.round_number = b.round_number;

CREATE UNIQUE INDEX IF NOT EXISTS rounds_session_round_number_key
  ON rounds (session_id, round_number);

-- A Tic Tac Toe square can only be claimed once, and move order cannot repeat.
DELETE FROM tic_tac_toe_moves a USING tic_tac_toe_moves b
  WHERE a.ctid < b.ctid
    AND a.session_id = b.session_id
    AND a.position   = b.position;

CREATE UNIQUE INDEX IF NOT EXISTS ttt_moves_session_position_key
  ON tic_tac_toe_moves (session_id, position);

CREATE UNIQUE INDEX IF NOT EXISTS ttt_moves_session_order_key
  ON tic_tac_toe_moves (session_id, move_order);

-- ---------------------------------------------------------------------------
-- 4. Realtime publication - make sure every table the app subscribes to is in
--    it (no-ops with a notice if the table is already published).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rooms', 'players', 'game_sessions', 'rounds',
    'player_answers', 'scores', 'tic_tac_toe_moves'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Housekeeping: let cleanup also reap abandoned rooms that are still marked
--    as playing, so stale rooms do not pile up forever.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM rooms
  WHERE last_activity < NOW() - INTERVAL '6 hours';
END;
$$ LANGUAGE plpgsql;
