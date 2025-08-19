-- Migration to add first_player_id and last_winner_id to game_sessions table
-- Run this in your Supabase SQL Editor

ALTER TABLE game_sessions 
ADD COLUMN first_player_id UUID REFERENCES players(id),
ADD COLUMN last_winner_id UUID REFERENCES players(id);

-- Add comments for documentation
COMMENT ON COLUMN game_sessions.first_player_id IS 'For Tic Tac Toe: tracks who goes first in this game session';
COMMENT ON COLUMN game_sessions.last_winner_id IS 'For Tic Tac Toe: tracks last game winner to determine next starter';
