import { Grid3x3 } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function TicTacToe() {
  return (
    <GameLanding
      gameType="tic-tac-toe"
      title="Tic Tac Toe"
      tagline="Three in a row. Simple to learn, surprisingly hard to let go of."
      Icon={Grid3x3}
      accent="teal"
      difficulty="Easy"
      estimatedTime="2-5 min"
      minPlayers={2}
      maxPlayers={2}
      rules={[
        'Create a room and share the code with your opponent.',
        'The first player is picked at random and plays as X.',
        'Take turns claiming squares. Three in a row wins the round.',
        'The winner goes first in the next round. Anyone extra can watch.'
      ]}
    />
  );
}
