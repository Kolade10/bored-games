import { Eye } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function Undercover() {
  return (
    <GameLanding
      gameType="undercover"
      title="Undercover"
      tagline="Everyone gets the same word. One of you does not. Find them."
      Icon={Eye}
      accent="coral"
      difficulty="Medium"
      estimatedTime="10-25 min"
      minPlayers={4}
      maxPlayers={10}
      rules={[
        'Everyone joins from their own phone and gets a secret word.',
        'One player secretly gets a different but related word.',
        'Take turns giving a one-word clue about your word.',
        'Then everyone votes in secret for who they think does not belong.',
        'Catch the undercover and they still get one guess at your word to steal the win.'
      ]}
    />
  );
}
