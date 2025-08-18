'use client';

import RoomManager from '@/components/RoomManager';
import Link from 'next/link';

export default function NamePlaceAnimalThing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-75 transition-opacity">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-2">
                <span className="text-white text-xl font-bold">🎮</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">BoredGame</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Name Place Animal Thing</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <RoomManager 
          gameType="name-place-thing"
          gameTitle="Name Place Animal Thing"
          minPlayers={2}
          maxPlayers={6}
        />
      </div>
    </div>
  );
}
