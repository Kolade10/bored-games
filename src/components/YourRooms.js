'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, getJoinedRoomCodes, clearRoomPlayerId, getRoomPlayerId } from '@/lib/supabase';
import { ArrowRight, BrainCircuit, Eye, Grid3x3, Heart, KeyRound, Laugh, PencilLine, Play, Swords, Users, X } from 'lucide-react';

const GAMES = {
  'tic-tac-toe': { title: 'Tic Tac Toe', Icon: Grid3x3 },
  'name-place-thing': { title: 'Name Place Animal Thing', Icon: PencilLine },
  'wordle': { title: 'Word Duel', Icon: Swords },
  'trivia': { title: 'Trivia', Icon: BrainCircuit },
  'guess-me': { title: 'Guess Me', Icon: Heart },
  'who-more-likely': { title: "Who's More Likely?", Icon: Laugh },
  'undercover': { title: 'Undercover', Icon: Eye },
  'password': { title: 'Password', Icon: KeyRound }
};

/**
 * Rooms this browser still has a seat in. The room codes come from local
 * storage, but everything shown is confirmed against the database first -
 * rooms that were deleted, or that we were removed from, are forgotten.
 */
export default function YourRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const codes = getJoinedRoomCodes();
    if (codes.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*, players (*)')
      .in('room_code', codes);

    if (error) {
      console.error('Error loading your rooms:', error);
      setLoading(false);
      return;
    }

    const found = data || [];

    // Forget codes whose room is gone, or where our seat no longer exists.
    const live = [];
    codes.forEach(code => {
      const room = found.find(r => r.room_code === code);
      const stillSeated =
        room && room.players?.some(p => p.id === getRoomPlayerId(code));

      if (stillSeated) {
        live.push(room);
      } else {
        clearRoomPlayerId(code);
      }
    });

    live.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
    setRooms(live);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const forget = (code) => {
    clearRoomPlayerId(code);
    setRooms(prev => prev.filter(room => room.room_code !== code));
  };

  if (loading || rooms.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      <h2 className="text-xl mb-4">Your rooms</h2>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map(room => {
          const game = GAMES[room.game_type] || { title: room.game_type, Icon: Play };
          const seat = room.players?.find(p => p.id === getRoomPlayerId(room.room_code));
          const playerCount = room.players?.filter(p => !p.is_spectator).length || 0;
          const playing = room.status === 'playing';

          return (
            <li key={room.id} className="card p-4 flex items-center gap-4">
              <span className="w-11 h-11 rounded-xl bg-sunken border-2 border-line
                               flex items-center justify-center shrink-0">
                <game.Icon className="w-5 h-5" strokeWidth={2.5} />
              </span>

              <div className="min-w-0 grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-extrabold tracking-wider">{room.room_code}</span>
                  <span className={`chip text-[0.7rem] py-0.5 ${playing ? 'chip-leaf' : 'chip-amber'}`}>
                    {playing ? 'In progress' : 'Waiting'}
                  </span>
                  {seat?.is_spectator && (
                    <span className="chip text-[0.7rem] py-0.5">
                      <Eye className="w-3 h-3" strokeWidth={2.5} />
                      Watching
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-soft font-semibold truncate">
                  {game.title}
                </p>
                <p className="text-xs text-ink-soft font-bold flex items-center gap-1 mt-0.5">
                  <Users className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {playerCount}/{room.max_players}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/room/${room.room_code}`} className="btn btn-teal btn-sm">
                  Open
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={3} />
                </Link>
                <button
                  type="button"
                  onClick={() => forget(room.room_code)}
                  className="btn btn-quiet btn-sm p-2"
                  aria-label={`Forget room ${room.room_code}`}
                  title="Remove from this list"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={3} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
