import CharadesGame from '@/components/CharadesGame';

export const metadata = {
  title: 'Charades - BoredGame',
  description: 'One phone, passed around. Act it out, tilt down for correct, up to pass.'
};

// No room code and no lobby: charades is played on a single device that gets
// passed between teams, so it skips the multiplayer flow entirely.
export default function CharadesPage() {
  return <CharadesGame />;
}
