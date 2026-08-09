import { PencilLine } from 'lucide-react';
import GameLanding from '@/components/GameLanding';

export default function NamePlaceAnimalThing() {
  return (
    <GameLanding
      gameType="name-place-thing"
      title="Name Place Animal Thing"
      tagline="One letter, four categories, sixty seconds. Obvious answers score less."
      Icon={PencilLine}
      accent="amber"
      difficulty="Medium"
      estimatedTime="5-10 min"
      minPlayers={2}
      maxPlayers={6}
      rules={[
        'The round leader picks a letter that has not been used yet.',
        'Everyone fills in a name, place, animal and thing starting with it.',
        'The round ends after 60 seconds, once everyone submits, or when the leader stops it.',
        'Unique answers score 15, shared ones score 10. Leadership rotates each round.'
      ]}
    />
  );
}
