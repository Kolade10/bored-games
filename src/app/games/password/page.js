import { KeyRound } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function Password() {
  return (
    <GameLanding
      gameType="password"
      title="Password"
      tagline="Describe the word without saying it - and without any of the obvious clues."
      Icon={KeyRound}
      accent="teal"
      difficulty="Medium"
      estimatedTime="10-20 min"
      minPlayers={4}
      maxPlayers={16}
      rules={[
        'Everyone is split into teams. One person per turn sees a secret word.',
        'Describe it out loud while your team shouts guesses.',
        'Each word comes with forbidden clues - the obvious ones are banned.',
        'Answer on the first clue for 5 points, the second for 3, after that 1.',
        'Stuck on a word? Pass it - but it is gone for everyone.'
      ]}
    />
  );
}
