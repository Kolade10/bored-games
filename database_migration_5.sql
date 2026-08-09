-- BoredGame - Supabase migration 5: let players and rooms actually be deleted
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.
--
-- Four foreign keys in the original schema point at players(id) with no ON
-- DELETE action, which silently blocks two things that are supposed to work:
--
--   1. "Leave room" fails for anyone who has led a round or started a game.
--      Deleting that player row raises 23503 and the button appears to do
--      nothing.
--   2. cleanup_inactive_rooms() can never delete a room that has played a
--      round, because deleting the room cascades to its players and that
--      delete is then refused. This is why old rooms pile up forever.
--
-- SET NULL rather than CASCADE: losing a leader should not delete the round
-- and everyone's answers along with it. The app already treats these as
-- optional and falls back to the first active player.

ALTER TABLE rounds
  DROP CONSTRAINT IF EXISTS rounds_leader_id_fkey,
  ADD CONSTRAINT rounds_leader_id_fkey
    FOREIGN KEY (leader_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_current_leader_id_fkey,
  ADD CONSTRAINT game_sessions_current_leader_id_fkey
    FOREIGN KEY (current_leader_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_first_player_id_fkey,
  ADD CONSTRAINT game_sessions_first_player_id_fkey
    FOREIGN KEY (first_player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_last_winner_id_fkey,
  ADD CONSTRAINT game_sessions_last_winner_id_fkey
    FOREIGN KEY (last_winner_id) REFERENCES players(id) ON DELETE SET NULL;

-- Optional: clear out the rooms that could never be reaped while the
-- constraints above were blocking deletion. Uncomment to run it.
-- DELETE FROM rooms WHERE last_activity < NOW() - INTERVAL '1 day';
