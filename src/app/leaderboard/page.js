import Link from 'next/link';

export default function Leaderboard() {
  // Mock data for demonstration
  const mockLeaderboard = [
    { id: 1, name: 'Alice', gamesPlayed: 15, wins: 12, winRate: 80, totalScore: 245 },
    { id: 2, name: 'Bob', gamesPlayed: 12, wins: 8, winRate: 67, totalScore: 198 },
    { id: 3, name: 'Charlie', gamesPlayed: 18, wins: 10, winRate: 56, totalScore: 187 },
    { id: 4, name: 'Diana', gamesPlayed: 9, wins: 7, winRate: 78, totalScore: 156 },
    { id: 5, name: 'Eve', gamesPlayed: 14, wins: 6, winRate: 43, totalScore: 134 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-75 transition-opacity">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-2">
                <span className="text-white text-xl font-bold">🎮</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">BoredGame</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leaderboard</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              🏆 Hall of Fame
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Top players across all games - coming soon with user accounts!
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white text-center">
              <div className="text-3xl font-bold">127</div>
              <div className="text-sm opacity-75">Total Games Played</div>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white text-center">
              <div className="text-3xl font-bold">45</div>
              <div className="text-sm opacity-75">Active Players</div>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white text-center">
              <div className="text-3xl font-bold">2</div>
              <div className="text-sm opacity-75">Games Available</div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-6 text-slate-900 dark:text-white font-bold">Rank</th>
                  <th className="text-left py-4 px-6 text-slate-900 dark:text-white font-bold">Player</th>
                  <th className="text-center py-4 px-6 text-slate-900 dark:text-white font-bold">Games Played</th>
                  <th className="text-center py-4 px-6 text-slate-900 dark:text-white font-bold">Wins</th>
                  <th className="text-center py-4 px-6 text-slate-900 dark:text-white font-bold">Win Rate</th>
                  <th className="text-center py-4 px-6 text-slate-900 dark:text-white font-bold">Total Score</th>
                </tr>
              </thead>
              <tbody>
                {mockLeaderboard.map((player, index) => (
                  <tr key={player.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {player.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center text-slate-700 dark:text-slate-300">{player.gamesPlayed}</td>
                    <td className="py-4 px-6 text-center text-slate-700 dark:text-slate-300">{player.wins}</td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-slate-700 dark:text-slate-300">{player.winRate}%</span>
                        <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                            style={{ width: `${player.winRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="font-bold text-slate-900 dark:text-white">{player.totalScore}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Coming Soon Notice */}
          <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚧</span>
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-200">Coming Soon</h3>
                <p className="text-amber-700 dark:text-amber-300 text-sm">
                  Real leaderboards with user accounts and persistent statistics will be available once we integrate Supabase authentication and database functionality.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                       text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Back to Games
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
