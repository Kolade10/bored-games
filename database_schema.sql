-- BoredGame Database Schema
-- Run these commands in your Supabase SQL Editor

-- Enable realtime for all tables
ALTER DATABASE postgres SET timezone TO 'UTC';

-- 1. Rooms table
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  game_type VARCHAR(50) NOT NULL, -- 'tic-tac-toe' or 'name-place-thing'
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  max_players INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Players table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  is_spectator BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  player_order INTEGER, -- For turn order in games
  UNIQUE(room_id, name) -- Unique name per room
);

-- 3. Game sessions table
CREATE TABLE game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  current_round INTEGER DEFAULT 1,
  max_rounds INTEGER DEFAULT 3,
  current_leader_id UUID REFERENCES players(id),
  first_player_id UUID REFERENCES players(id), -- For Tic Tac Toe: tracks who goes first
  last_winner_id UUID REFERENCES players(id), -- For Tic Tac Toe: tracks last game winner
  round_data JSONB, -- Store round-specific data (letter, timer, etc.)
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'playing', 'reviewing', 'finished'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- 4. Rounds table
CREATE TABLE rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  leader_id UUID REFERENCES players(id),
  letter VARCHAR(1), -- For name-place-thing game
  time_limit INTEGER DEFAULT 60, -- in seconds
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'stopped', 'completed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- 5. Player answers table (for name-place-thing)
CREATE TABLE player_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  answers JSONB NOT NULL, -- {name: "...", place: "...", animal: "...", thing: "..."}
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Scores table
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  score_breakdown JSONB -- Detailed scoring info
);

-- 7. Tic tac toe moves table
CREATE TABLE tic_tac_toe_moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- 0-8 for board positions
  symbol VARCHAR(1) NOT NULL, -- 'X' or 'O'
  move_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_rooms_room_code ON rooms(room_code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_last_activity ON rooms(last_activity);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_game_sessions_room_id ON game_sessions(room_id);
CREATE INDEX idx_rounds_session_id ON rounds(session_id);
CREATE INDEX idx_player_answers_round_id ON player_answers(round_id);
CREATE INDEX idx_scores_session_id ON scores(session_id);
CREATE INDEX idx_tic_tac_toe_moves_session_id ON tic_tac_toe_moves(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tic_tac_toe_moves ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now, can be restricted later)
CREATE POLICY "Allow all on rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all on game_sessions" ON game_sessions FOR ALL USING (true);
CREATE POLICY "Allow all on rounds" ON rounds FOR ALL USING (true);
CREATE POLICY "Allow all on player_answers" ON player_answers FOR ALL USING (true);
CREATE POLICY "Allow all on scores" ON scores FOR ALL USING (true);
CREATE POLICY "Allow all on tic_tac_toe_moves" ON tic_tac_toe_moves FOR ALL USING (true);

-- Enable realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE player_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE tic_tac_toe_moves;

-- Function to clean up inactive rooms (runs every hour)
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM rooms 
  WHERE last_activity < NOW() - INTERVAL '1 hour'
  AND status IN ('waiting', 'finished');
END;
$$ LANGUAGE plpgsql;

-- Function to update room last_activity
CREATE OR REPLACE FUNCTION update_room_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rooms 
  SET last_activity = NOW()
  WHERE id = COALESCE(NEW.room_id, OLD.room_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update room activity
CREATE TRIGGER update_room_activity_on_players
  AFTER INSERT OR UPDATE OR DELETE ON players
  FOR EACH ROW EXECUTE FUNCTION update_room_activity();

CREATE TRIGGER update_room_activity_on_game_sessions
  AFTER INSERT OR UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_room_activity();

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
