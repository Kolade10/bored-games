import { Heart } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function GuessMe() {
  return (
    <GameLanding
      gameType="guess-me"
      title="Guess Me"
      tagline="How well do you actually know each other? One answers, one predicts."
      Icon={Heart}
      accent="coral"
      difficulty="Easy"
      estimatedTime="5-20 min"
      minPlayers={2}
      maxPlayers={2}
      rules={[
        'Each round one of you answers a question about yourself, in secret.',
        'The other tries to predict exactly what they picked.',
        'Roles swap every round, so you both answer and guess equally.',
        'Correct predictions score 10, harder questions 15, and streaks multiply it.',
        'Pick 5, 10, 15 or 20 rounds, and which categories you want.'
      ]}
    />
  );
}
