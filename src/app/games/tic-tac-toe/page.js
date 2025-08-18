'use client';

import RoomManager from '@/components/RoomManager';
import Link from 'next/link';

export default function TicTacToe() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tic Tac Toe</h1>
          </div>
        </div>
      </header>

      {/* Game Container */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <RoomManager 
          gameType="tic-tac-toe"
          gameTitle="Tic Tac Toe"
          minPlayers={2}
          maxPlayers={2}
        />
      </div>
    </div>
  );
}
