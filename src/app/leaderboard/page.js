import Link from 'next/link';
import { ArrowLeft, Construction, Gamepad2, Trophy, Users } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

// Placeholder standings - real ones need accounts, which do not exist yet.
const SAMPLE_STANDINGS = [
  { id: 1, name: 'Alice', gamesPlayed: 15, wins: 12, winRate: 80, totalScore: 245 },
  { id: 2, name: 'Bob', gamesPlayed: 12, wins: 8, winRate: 67, totalScore: 198 },
  { id: 3, name: 'Charlie', gamesPlayed: 18, wins: 10, winRate: 56, totalScore: 187 },
  { id: 4, name: 'Diana', gamesPlayed: 9, wins: 7, winRate: 78, totalScore: 156 },
  { id: 5, name: 'Eve', gamesPlayed: 14, wins: 6, winRate: 43, totalScore: 134 }
];

const RANK_STYLES = ['bg-amber', 'bg-sunken', 'bg-coral-soft'];

function Rank({ index }) {
  return (
    <span className={`w-9 h-9 rounded-lg border-2 border-line flex items-center justify-center
                      font-extrabold text-sm ${RANK_STYLES[index] || 'bg-surface'}`}>
      {index + 1}
    </span>
  );
}

export default function Leaderboard() {
  return (
    <div className="min-h-screen">
      <SiteHeader current="/leaderboard" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <span className="w-12 h-12 rounded-xl bg-amber border-2 border-line flex items-center justify-center">
            <Trophy className="w-6 h-6 text-[var(--on-amber)]" strokeWidth={2.5} />
          </span>
          <h1 className="text-4xl lg:text-5xl">Hall of Fame</h1>
        </div>
        <p className="text-ink-soft mb-4 max-w-2xl">
          Standings across every game, once there are accounts to hang them on.
        </p>
        <span className="chip chip-coral mb-8">
          <Construction className="w-4 h-4" strokeWidth={2.5} />
          Example data - not real results
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card p-5">
            <Gamepad2 className="w-5 h-5 text-ink-soft mb-2" strokeWidth={2.5} />
            <div className="text-3xl font-extrabold">127</div>
            <div className="text-sm text-ink-soft font-semibold">Games played</div>
          </div>
          <div className="card p-5">
            <Users className="w-5 h-5 text-ink-soft mb-2" strokeWidth={2.5} />
            <div className="text-3xl font-extrabold">45</div>
            <div className="text-sm text-ink-soft font-semibold">Players</div>
          </div>
          <div className="card p-5">
            <Trophy className="w-5 h-5 text-ink-soft mb-2" strokeWidth={2.5} />
            <div className="text-3xl font-extrabold">2</div>
            <div className="text-sm text-ink-soft font-semibold">Games available</div>
          </div>
        </div>

        <div className="card overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sunken border-b-2 border-line text-left">
                  <th className="py-3 px-4 font-extrabold">Rank</th>
                  <th className="py-3 px-4 font-extrabold">Player</th>
                  <th className="py-3 px-4 font-extrabold text-center">Played</th>
                  <th className="py-3 px-4 font-extrabold text-center">Wins</th>
                  <th className="py-3 px-4 font-extrabold text-center">Win rate</th>
                  <th className="py-3 px-4 font-extrabold text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_STANDINGS.map((player, index) => (
                  <tr key={player.id} className="border-b-2 border-line last:border-b-0">
                    <td className="py-3 px-4"><Rank index={index} /></td>
                    <td className="py-3 px-4 font-bold whitespace-nowrap">{player.name}</td>
                    <td className="py-3 px-4 text-center text-ink-soft font-semibold">{player.gamesPlayed}</td>
                    <td className="py-3 px-4 text-center text-ink-soft font-semibold">{player.wins}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-semibold w-9 text-right">{player.winRate}%</span>
                        <span className="w-16 h-2.5 bg-sunken border-2 border-line rounded-full overflow-hidden">
                          <span className="block h-full bg-leaf" style={{ width: `${player.winRate}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold">{player.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5 mb-8 flex gap-4 items-start">
          <Construction className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2.5} />
          <div>
            <h2 className="text-base mb-1">Not wired up yet</h2>
            <p className="text-sm text-ink-soft">
              Scores are already stored per game session. Turning that into a
              lasting leaderboard needs player accounts, so results survive
              beyond a single room.
            </p>
          </div>
        </div>

        <Link href="/" className="btn btn-quiet">
          <ArrowLeft className="w-4 h-4" strokeWidth={3} />
          Back to games
        </Link>
      </div>
    </div>
  );
}
