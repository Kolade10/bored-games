import Link from 'next/link';

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-75 transition-opacity">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-2">
                <span className="text-white text-xl font-bold">🎮</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">BoredGame</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">About</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white text-center mb-8">
            About BoredGame
          </h2>
          
          <div className="prose prose-lg max-w-none text-slate-700 dark:text-slate-300">
            <p className="text-xl leading-relaxed mb-6">
              Welcome to BoredGame - your ultimate destination for fun, engaging multiplayer games! 
              We believe that the best games are the ones you play with friends, and we're here to 
              bring those classic experiences to the digital world.
            </p>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Mission</h3>
            <p className="mb-6">
              To create simple, fun, and accessible games that bring people together. Whether you're 
              looking to pass time, challenge your friends, or test your quick thinking skills, 
              BoredGame has something for everyone.
            </p>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Current Games</h3>
            <ul className="list-disc list-inside space-y-2 mb-6">
              <li><strong>Tic Tac Toe:</strong> The classic 3x3 grid strategy game for two players</li>
              <li><strong>Name Place Animal Thing:</strong> A fast-paced word game that tests your vocabulary and quick thinking</li>
            </ul>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Coming Soon</h3>
            <ul className="list-disc list-inside space-y-2 mb-6">
              <li><strong>Word Chain:</strong> Connect words where each starts with the last letter of the previous</li>
              <li><strong>Drawing Guess:</strong> Express creativity through drawing and test your guessing skills</li>
              <li>And many more exciting games!</li>
            </ul>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Technology</h3>
            <p className="mb-6">
              Built with modern web technologies including Next.js, React, and Tailwind CSS for a 
              smooth, responsive gaming experience across all devices. We're also planning to integrate 
              Supabase for real-time multiplayer functionality and user accounts.
            </p>
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
