'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  supabase,
  getPlayerName,
  setPlayerName,
  getRoomPlayerId,
  setRoomPlayerId,
  clearRoomPlayerId
} from '@/lib/supabase';
import { joinRoomAsPlayer } from '@/lib/rooms';
import Link from 'next/link';
import {
  BookOpen, Check, CircleAlert, Copy, Crown, Dices, Eye, Hourglass, House,
  Loader, LogOut, Play, RotateCcw, UserPlus, Users
} from 'lucide-react';
import TicTacToeGame from '@/components/TicTacToeGame';
import NamePlaceThingGame from '@/components/NamePlaceThingGame';
import WordleGame from '@/components/WordleGame';
import TriviaGame from '@/components/TriviaGame';
import GuessMeGame from '@/components/GuessMeGame';
import RoomChat from '@/components/RoomChat';

const GAME_TITLES = {
  'tic-tac-toe': 'Tic Tac Toe',
  'name-place-thing': 'Name Place Animal Thing',
  'wordle': 'Word Duel',
  'trivia': 'Trivia',
  'guess-me': 'Guess Me'
};

// Trivia is worth playing alone - it is also just a question feed.
const MIN_PLAYERS_BY_GAME = {
  'tic-tac-toe': 2,
  'name-place-thing': 2,
  'wordle': 2,
  'trivia': 1,
  'guess-me': 2
};

const GAME_RULES = {
  'tic-tac-toe': [
    'Take turns claiming squares on the 3x3 grid.',
    'Three in a row wins - across, down or diagonally.',
    'All nine squares filled with no line is a draw.',
    'Every round a coin flip decides who goes first.'
  ],
  'name-place-thing': [
    'The round leader picks a letter that has not been used yet.',
    'Fill in a name, place, animal and thing starting with it.',
    'You get 60 seconds, or until everyone submits.',
    'Unique answers score more than ones others also picked.',
    'Leadership rotates each round.'
  ],
  'wordle': [
    'You each secretly set a real word for the other, 5 to 10 letters.',
    'You get one guess more than the word is long.',
    'Green means right letter, right place. Amber means right letter, wrong place.',
    'Solve it to win; if you both solve it, fewest guesses takes the round.'
  ],
  'trivia': [
    'The room owner picks the category, difficulty and seconds per question.',
    'Everyone gets the same ten questions in the same order.',
    'The answer shows once everyone has answered or the timer runs out.',
    'One point per correct answer.'
  ],
  'guess-me': [
    'Each round one of you answers about yourself, in secret.',
    'The other predicts what they picked.',
    'Roles swap every round so you both answer and guess equally.',
    'Correct predictions score 10, hard questions 15, and streaks multiply it.'
  ]
};

export default function RoomLobby() {
  const params = useParams();
  const roomCode = String(params.roomCode || '').toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadRoomData = useCallback(async () => {
    if (!roomCode) return;

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*, players (*), game_sessions (*)')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!roomData) {
        setError('Room not found. Double-check the code or ask for a new one.');
        setLoading(false);
        return;
      }

      const roomPlayers = roomData.players || [];
      setRoom(roomData);
      setPlayers(roomPlayers);

      // Identify by the stored player id first; fall back to the saved name so
      // players who joined before this was stored are still recognised.
      const storedId = getRoomPlayerId(roomCode);
      const savedName = getPlayerName();
      const me =
        roomPlayers.find(p => p.id === storedId) ||
        (savedName
          ? roomPlayers.find(p => p.name.toLowerCase() === savedName.toLowerCase())
          : null);

      if (me && me.id !== storedId) setRoomPlayerId(roomCode, me.id);
      setCurrentPlayer(me || null);
      setJoinName(prev => prev || savedName);

      const activeSession = roomData.game_sessions?.find(s => s.status !== 'finished');

      // Recover from a room left marked as playing with no live session.
      if (roomData.status === 'playing' && !activeSession) {
        await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomData.id);
        setRoom(prev => (prev ? { ...prev, status: 'waiting' } : prev));
      }

      setGameSession(activeSession || null);
      setError('');
    } catch (err) {
      console.error('Error loading room:', err);
      setError('Failed to load room. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`room-${room.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${room.id}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          setRoom(prev => ({ ...prev, ...payload.new }));
        } else {
          loadRoomData();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${room.id}`
      }, () => {
        // Players carry ordering/spectator state used elsewhere, so reload.
        loadRoomData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          loadRoomData();
          return;
        }
        const session = payload.new;
        if (!session) return;
        setGameSession(session.status === 'finished' ? null : session);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, loadRoomData]);

  const activePlayers = players
    .filter(p => !p.is_spectator)
    .sort((a, b) => (a.player_order || 0) - (b.player_order || 0));
  const spectators = players.filter(p => p.is_spectator);

  const minPlayers = MIN_PLAYERS_BY_GAME[room?.game_type] ?? 2;
  const hasEnoughPlayers = activePlayers.length >= minPlayers;
  const isRoomOwner = !!currentPlayer && activePlayers[0]?.id === currentPlayer.id;
  const noActiveGameSession = !gameSession || gameSession.status === 'finished';
  const canStartGame =
    hasEnoughPlayers &&
    room?.status === 'waiting' &&
    !!currentPlayer &&
    !currentPlayer.is_spectator &&
    isRoomOwner &&
    noActiveGameSession;

  const startGame = async () => {
    if (!room || !currentPlayer || !canStartGame || starting) return;

    setStarting(true);
    setError('');

    try {
      // Tic Tac Toe draws its opener at random, every round. Name Place Animal
      // Thing rotates leadership in join order, so it starts with player one.
      const firstPlayerId = room.game_type === 'tic-tac-toe'
        ? activePlayers[Math.floor(Math.random() * activePlayers.length)].id
        : activePlayers[0].id;

      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          room_id: room.id,
          current_leader_id: firstPlayerId,
          first_player_id: room.game_type === 'tic-tac-toe' ? firstPlayerId : null,
          max_rounds: room.game_type === 'name-place-thing' ? 999 : 1,
          status: 'playing'
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create game session: ${sessionError.message}`);
      }

      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', room.id);

      if (roomUpdateError) {
        throw new Error(`Failed to update room status: ${roomUpdateError.message}`);
      }

      setRoom(prev => ({ ...prev, status: 'playing' }));
      setGameSession(sessionData);
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const resetRoom = async () => {
    if (!room) return;

    try {
      await supabase
        .from('game_sessions')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('room_id', room.id)
        .neq('status', 'finished');

      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', room.id);

      await loadRoomData();
    } catch (err) {
      console.error('Error resetting room:', err);
      setError('Failed to reset room');
    }
  };

  const leaveRoom = async () => {
    if (!currentPlayer) {
      router.push('/');
      return;
    }

    try {
      await supabase.from('players').delete().eq('id', currentPlayer.id);
      clearRoomPlayerId(roomCode);
      router.push('/');
    } catch (err) {
      console.error('Error leaving room:', err);
      setError('Failed to leave room');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const name = joinName.trim();
    if (name.length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const me = await joinRoomAsPlayer(room, players, name);
      setPlayerName(name);
      setCurrentPlayer(me);
      await loadRoomData();
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied - the code is on screen anyway.
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center">
          <Loader className="w-8 h-8 mx-auto mb-3 animate-spin" strokeWidth={2.5} />
          <p className="font-bold">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-md">
          <span className="w-12 h-12 rounded-xl bg-coral border-2 border-line flex items-center justify-center mx-auto mb-4">
            <CircleAlert className="w-6 h-6 text-[var(--on-coral)]" strokeWidth={2.5} />
          </span>
          <h1 className="text-2xl mb-2">Can&apos;t open this room</h1>
          <p className="text-ink-soft mb-6">{error || 'Room not found'}</p>
          <Link href="/" className="btn btn-amber">
            <House className="w-4 h-4" strokeWidth={3} />
            Back to games
          </Link>
        </div>
      </div>
    );
  }

  // A live session takes over the screen for everyone in the room. Chat rides
  // along on top so players can talk mid-game.
  if (currentPlayer && gameSession && gameSession.status === 'playing') {
    const gameProps = { room, players, currentPlayer, gameSession };
    const game =
      room.game_type === 'tic-tac-toe' ? <TicTacToeGame {...gameProps} /> :
      room.game_type === 'name-place-thing' ? <NamePlaceThingGame {...gameProps} /> :
      room.game_type === 'wordle' ? <WordleGame {...gameProps} /> :
      room.game_type === 'trivia' ? <TriviaGame {...gameProps} /> :
      room.game_type === 'guess-me' ? <GuessMeGame {...gameProps} /> :
      null;

    if (game) {
      return (
        <>
          {game}
          <RoomChat room={room} currentPlayer={currentPlayer} />
        </>
      );
    }
  }

  const gameTitle = GAME_TITLES[room.game_type] || room.game_type;
  const isFull = activePlayers.length >= room.max_players;

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber border-2 border-line flex items-center justify-center">
              <Dices className="w-5 h-5 text-[var(--on-amber)]" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-extrabold tracking-tight hidden sm:inline">BoredGame</span>
          </Link>
          <span className="chip chip-teal">{gameTitle}</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Room code - the thing people came here to share */}
        <div className="card p-6 mb-6 text-center">
          <p className="text-sm font-bold text-ink-soft mb-3">Share this code to invite people</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="font-mono text-4xl sm:text-5xl font-extrabold tracking-[0.25em] pl-[0.25em]">
              {roomCode}
            </span>
            <button onClick={copyRoomCode} className="btn btn-quiet btn-sm" type="button">
              {copied
                ? <><Check className="w-4 h-4" strokeWidth={3} />Copied</>
                : <><Copy className="w-4 h-4" strokeWidth={3} />Copy</>}
            </button>
          </div>
        </div>

        {/* Join form for anyone opening the room without a seat */}
        {!currentPlayer && (
          <form onSubmit={handleJoin} className="card p-6 mb-6">
            <h2 className="text-xl mb-1">Join this room</h2>
            <p className="text-sm text-ink-soft mb-4">
              {isFull
                ? 'The room is full, so you will join as a spectator.'
                : 'Pick a name to take a seat.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                className="field"
              />
              <button
                type="submit"
                disabled={joining || joinName.trim().length < 2}
                className="btn btn-amber shrink-0"
              >
                {joining
                  ? <><Loader className="w-4 h-4 animate-spin" strokeWidth={3} />Joining</>
                  : <><UserPlus className="w-4 h-4" strokeWidth={3} />Join</>}
              </button>
            </div>
          </form>
        )}

        {/* Players */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl">Players</h2>
            <span className="chip">
              <Users className="w-4 h-4" strokeWidth={2.5} />
              {activePlayers.length}/{room.max_players}
            </span>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activePlayers.map((player, index) => (
              <li
                key={player.id}
                className={`panel p-4 flex items-center gap-3 ${
                  player.id === currentPlayer?.id ? 'bg-amber-soft' : ''
                }`}
              >
                <span className="w-10 h-10 rounded-lg bg-surface border-2 border-line shrink-0
                                 flex items-center justify-center font-extrabold">
                  {player.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {player.name}
                    {player.id === currentPlayer?.id && (
                      <span className="text-ink-soft font-semibold"> (you)</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft font-semibold flex items-center gap-1">
                    {index === 0
                      ? <><Crown className="w-3.5 h-3.5" strokeWidth={2.5} />Room owner</>
                      : `Player ${player.player_order}`}
                  </p>
                </div>
              </li>
            ))}

            {/* Only the seats still needed to start - a room that holds eight
                should not show seven empty rows when one player is enough. */}
            {Array.from({ length: Math.max(0, minPlayers - activePlayers.length) }).map((_, i) => (
              <li
                key={`empty-${i}`}
                className="panel p-4 flex items-center gap-3 border-dashed opacity-70"
              >
                <span className="w-10 h-10 rounded-lg border-2 border-dashed border-line shrink-0
                                 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-ink-soft" strokeWidth={2.5} />
                </span>
                <p className="text-sm font-bold text-ink-soft">Waiting for a player</p>
              </li>
            ))}
          </ul>

          {spectators.length > 0 && (
            <div className="mt-5 pt-5 border-t-2 border-line">
              <h3 className="text-sm mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" strokeWidth={2.5} />
                Watching ({spectators.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {spectators.map(spectator => (
                  <span key={spectator.id} className="chip">
                    {spectator.name}
                    {spectator.id === currentPlayer?.id && ' (you)'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="card p-6 mb-6">
          {error && (
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-coral">
              <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
              {error}
            </p>
          )}

          {canStartGame ? (
            <button onClick={startGame} disabled={starting} className="btn btn-leaf btn-lg w-full mb-4">
              {starting
                ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Starting...</>
                : <><Play className="w-5 h-5" strokeWidth={3} />Start game</>}
            </button>
          ) : (
            currentPlayer && noActiveGameSession && (
              <p className="panel p-4 mb-4 text-sm font-bold text-ink-soft flex items-center gap-2">
                <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                {!hasEnoughPlayers
                  ? `Waiting for players (${activePlayers.length}/${minPlayers})`
                  : currentPlayer.is_spectator
                    ? 'You are watching - the room owner starts the game'
                    : !isRoomOwner
                      ? `Waiting for ${activePlayers[0]?.name} to start`
                      : 'Ready when you are'}
              </p>
            )
          )}

          {gameSession && gameSession.status === 'playing' && !currentPlayer && (
            <p className="panel p-4 mb-4 text-sm font-bold flex items-center gap-2">
              <Play className="w-4 h-4 shrink-0" strokeWidth={2.5} />
              A game is in progress - join above to watch or play.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {currentPlayer && (
              <button onClick={leaveRoom} className="btn btn-quiet">
                <LogOut className="w-4 h-4" strokeWidth={3} />
                Leave room
              </button>
            )}
            <Link href="/" className="btn btn-quiet">
              <House className="w-4 h-4" strokeWidth={3} />
              All games
            </Link>
            {isRoomOwner && room.status === 'playing' && noActiveGameSession && (
              <button onClick={resetRoom} className="btn btn-coral">
                <RotateCcw className="w-4 h-4" strokeWidth={3} />
                Reset room
              </button>
            )}
          </div>
        </div>

        {/* Rules */}
        <div className="panel p-6">
          <h2 className="text-lg mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5" strokeWidth={2.5} />
            {gameTitle}
          </h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            {(GAME_RULES[room.game_type] || []).map(rule => (
              <li key={rule} className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-soft mt-2 shrink-0" />
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <RoomChat room={room} currentPlayer={currentPlayer} />
    </div>
  );
}
