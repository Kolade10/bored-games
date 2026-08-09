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
        'Take turns claiming squares. Three in a row wins the round.',
        'Whoever goes first is drawn at random every round, and plays as X.',
        'Anyone joining a full room can watch.'
      ]}
    />
  );
}
