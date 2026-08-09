'use client';

// TEMPORARY render check - deleted after review.
import TicTacToeGame from '@/components/TicTacToeGame';

const room = { id: 'r1', room_code: 'PLAY42', game_type: 'tic-tac-toe', max_players: 2, status: 'playing' };

const players = [
  { id: 'p1', name: 'Victor', player_order: 1, is_spectator: false },
  { id: 'p2', name: 'Kolade', player_order: 2, is_spectator: false }
];

const session = {
  id: 's1',
  first_player_id: 'p1',
  current_round: 1,
  status: 'playing',
  round_data: { round_seq: 3 }
};

export default function UiPreview() {
  return (
    <TicTacToeGame room={room} players={players} currentPlayer={players[0]} gameSession={session} />
  );
}
 