import { Clock, Gauge, Users } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import RoomManager from '@/components/RoomManager';

const ACCENT_BG = {
  teal: 'bg-teal',
  amber: 'bg-amber',
  leaf: 'bg-leaf',
  coral: 'bg-coral'
};

const ACCENT_TEXT = {
  teal: 'text-[var(--on-teal)]',
  amber: 'text-[var(--on-amber)]',
  leaf: 'text-[var(--on-leaf)]',
  coral: 'text-[var(--on-coral)]'
};

/**
 * Shared shell for a game's create/join screen: what the game is on the left,
 * the room controls on the right.
 */
export default function GameLanding({
  gameType,
  title,
  tagline,
  Icon,
  accent = 'teal',
  difficulty,
  estimatedTime,
  minPlayers,
  maxPlayers,
  rules
}) {
  const playerLabel = minPlayers === maxPlayers
    ? `${minPlayers} players`
    : `${minPlayers}-${maxPlayers} players`;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* What this game is */}
          <div>
            <div className="flex items-center gap-4 mb-5">
              <span className={`w-14 h-14 rounded-xl ${ACCENT_BG[accent]} border-2 border-line
                                flex items-center justify-center shadow-[4px_4px_0_var(--shadow)] shrink-0`}>
                <Icon className={`w-7 h-7 ${ACCENT_TEXT[accent]}`} strokeWidth={2.5} />
              </span>
              <h1 className="text-3xl lg:text-4xl">{title}</h1>
            </div>

            <p className="text-lg text-ink-soft mb-5">{tagline}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="chip"><Users className="w-4 h-4" strokeWidth={2.5} />{playerLabel}</span>
              <span className="chip"><Gauge className="w-4 h-4" strokeWidth={2.5} />{difficulty}</span>
              <span className="chip"><Clock className="w-4 h-4" strokeWidth={2.5} />{estimatedTime}</span>
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">How it works</h2>
              <ol className="space-y-3">
                {rules.map((rule, index) => (
                  <li key={rule} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-md bg-sunken border-2 border-line shrink-0
                                     flex items-center justify-center text-xs font-extrabold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-ink-soft pt-0.5">{rule}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Create or join */}
          <RoomManager
            gameType={gameType}
            gameTitle={title}
            minPlayers={minPlayers}
            maxPlayers={maxPlayers}
          />
        </div>
      </div>
    </div>
  );
}
