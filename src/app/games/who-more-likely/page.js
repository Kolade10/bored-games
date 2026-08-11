import { Laugh } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function WhoMoreLikely() {
  return (
    <GameLanding
      gameType="who-more-likely"
      title="Who's More Likely?"
      tagline="You both pick who is more likely, in secret. Then you find out if you agree."
      Icon={Laugh}
      accent="amber"
      difficulty="Easy"
      estimatedTime="5-15 min"
      minPlayers={2}
      maxPlayers={2}
      rules={[
        'A scenario appears, like "who is more likely to fall asleep during a film?".',
        'You both privately pick one of you. Neither sees the other choice first.',
        'Both answers are revealed at once. Naming the same person is an agreement.',
        'Agreements score 10, and streaks add a bonus at 3, 5, 7 and 10 in a row.',
        'Games of 10 rounds or more finish on a double-points round.'
      ]}
    />
  );
}
