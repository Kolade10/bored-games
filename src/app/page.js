import Link from "next/link";

export default function Home() {
  const games = [
    {
      id: 'tic-tac-toe',
      title: 'Tic Tac Toe',
      description: 'Classic 3x3 grid game for two players. Take turns marking X or O to get three in a row!',
      players: '2 Players',
      difficulty: 'Easy',
      estimatedTime: '2-5 minutes',
      color: 'from-blue-500 to-purple-600',
      icon: '⚡',
      available: true
    },
    {
      id: 'name-place-thing',
      title: 'Name Place Animal Thing',
      description: 'Quick thinking game! Fill in categories starting with a random letter before time runs out.',
      players: '2-6 Players',
      difficulty: 'Medium',
      estimatedTime: '5-10 minutes',
      color: 'from-green-500 to-teal-600',
      icon: '🎯',
      available: true
    },
    {
      id: 'coming-soon-1',
      title: 'Word Chain',
      description: 'Connect words where each word starts with the last letter of the previous word.',
      players: '2-4 Players',
      difficulty: 'Medium',
      estimatedTime: '10-15 minutes',
      color: 'from-orange-500 to-red-600',
      icon: '🔗',
      available: false
    },
    {
      id: 'coming-soon-2',
      title: 'Drawing Guess',
      description: 'One player draws, others guess! Express your creativity and test your guessing skills.',
      players: '3-8 Players',
      difficulty: 'Easy',
      estimatedTime: '15-20 minutes',
      color: 'from-pink-500 to-rose-600',
      icon: '🎨',
      available: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-2">
                <span className="text-white text-2xl font-bold">🎮</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">BoredGame</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/about" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                About
              </Link>
              <Link href="/leaderboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                Leaderboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="text-center">
          <h2 className="text-4xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6">
            Ready to Play?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Choose from our collection of fun multiplayer games. Challenge your friends and test your skills!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm">{games.filter(g => g.available).length} games available</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span className="text-sm">{games.filter(g => !g.available).length} more coming soon</span>
            </div>
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {games.map((game) => (
            <div
              key={game.id}
              className={`relative overflow-hidden rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                game.available 
                  ? 'cursor-pointer' 
                  : 'opacity-75 cursor-not-allowed'
              }`}
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-90`}></div>
              
              {/* Content */}
              <div className="relative p-8 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{game.icon}</div>
                  {!game.available && (
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                      Coming Soon
                    </span>
                  )}
                </div>
                
                <h3 className="text-2xl font-bold mb-3">{game.title}</h3>
                <p className="text-white/90 mb-6 leading-relaxed">{game.description}</p>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-xs text-white/70 uppercase tracking-wide">Players</div>
                    <div className="font-semibold">{game.players}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/70 uppercase tracking-wide">Difficulty</div>
                    <div className="font-semibold">{game.difficulty}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/70 uppercase tracking-wide">Time</div>
                    <div className="font-semibold">{game.estimatedTime}</div>
                  </div>
                </div>
                
                {game.available ? (
                  <Link
                    href={`/games/${game.id}`}
                    className="block w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl py-3 px-6 text-center font-semibold transition-all duration-200 hover:scale-105"
                  >
                    Play Now →
                  </Link>
                ) : (
                  <div className="block w-full bg-white/10 border border-white/20 rounded-xl py-3 px-6 text-center font-semibold text-white/60">
                    Coming Soon
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-600 dark:text-slate-400">
            <p>&copy; 2025 BoredGame. Made with ❤️ for game lovers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
