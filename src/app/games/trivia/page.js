import { BrainCircuit } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function Trivia() {
  return (
    <GameLanding
      gameType="trivia"
      title="Trivia"
      tagline="Ten general knowledge questions. Play against friends, or on your own."
      Icon={BrainCircuit}
      accent="teal"
      difficulty="Any"
      estimatedTime="3-10 min"
      minPlayers={1}
      maxPlayers={8}
      rules={[
        'The room owner picks a category, a difficulty, and 5, 10, 15 or 30 seconds per question.',
        'Everyone gets the same ten questions in the same order.',
        'The answer is revealed once everyone has answered or the timer runs out.',
        'One point per correct answer - most points at the end wins.',
        'You can start a room on your own if you just want the questions.'
      ]}
    />
  );
}
