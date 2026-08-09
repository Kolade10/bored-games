-- BoredGame - Supabase migration 3: room chat
-- Run this in your Supabase SQL Editor (paste the contents, not the filename).
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- Chat messages
--
-- player_name is stored on the row rather than joined from players. Player
-- rows are deleted when someone leaves a room, and chat history should survive
-- that - so the author's name is snapshotted and player_id is allowed to go
-- null instead of cascading the message away.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name VARCHAR(50) NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id
  ON chat_messages (room_id, created_at);

-- Same open policy as the rest of the tables (see the security note in
-- SETUP_INSTRUCTIONS.md - this is a hobby-project posture, not a hardened one).
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages' AND policyname = 'Allow all on chat_messages'
  ) THEN
    CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true);
  END IF;
END $$;

-- Filtered realtime DELETE events need the full old row (see migration 2).
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

-- Chatting counts as activity, so a room being used does not get reaped.
DROP TRIGGER IF EXISTS update_room_activity_on_chat ON chat_messages;
CREATE TRIGGER update_room_activity_on_chat
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_room_activity();
