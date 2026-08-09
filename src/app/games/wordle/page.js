import { Swords } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function WordDuel() {
  return (
    <GameLanding
      gameType="wordle"
      title="Word Duel"
      tagline="Wordle, except you each pick the word the other has to crack."
      Icon={Swords}
      accent="leaf"
      difficulty="Medium"
      estimatedTime="3-8 min"
      minPlayers={2}
      maxPlayers={2}
      rules={[
        'You each secretly set a word for the other, 5 to 10 letters.',
        'Words have to be real - the dictionary is checked before it is locked in.',
        'You get one guess more than the word is long, so a 7-letter word gives 8 tries.',
        'Green is the right letter in the right place, amber is right letter wrong place.',
        'Solve it to win. If you both solve it, fewest guesses takes the round.'
      ]}
    />
  );
}
