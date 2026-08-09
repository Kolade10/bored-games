'use client';

import { useState, useEffect } from 'react';
import {
  supabase,
  generateRoomCode,
  getPlayerName,
  setPlayerName,
  setRoomPlayerId
} from '@/lib/supabase';
import { joinRoomAsPlayer } from '@/lib/rooms';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleAlert, DoorOpen, Loader, Plus, UserPen } from 'lucide-react';

export default function RoomManager({ gameType, gameTitle, minPlayers, maxPlayers }) {
  const [playerName, setPlayerNameState] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const savedName = getPlayerName();
    if (savedName) {
      setPlayerNameState(savedName);
    } else {
      setShowNameInput(true);
    }
  }, []);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }
    setPlayerName(trimmed);
    setPlayerNameState(trimmed);
    setShowNameInput(false);
    setError('');

    // Execute pending action
    if (pendingAction === 'create') {
      createRoom(trimmed);
    } else if (pendingAction === 'join') {
      joinRoom(trimmed);
    }
    setPendingAction(null);
  };

  const createRoom = async (nameOverride) => {
    const name = (nameOverride || playerName).trim();
    if (!name) {
      setShowNameInput(true);
      setPendingAction('create');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Room codes are random, so a collision is possible - retry a few times.
      let roomData = null;
      let newRoomCode = '';
      for (let attempt = 0; attempt < 5 && !roomData; attempt++) {
        newRoomCode = generateRoomCode();
        const { data, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_code: newRoomCode,
            game_type: gameType,
            max_players: maxPlayers,
            status: 'waiting'
          })
          .select()
          .single();

        if (!roomError) {
          roomData = data;
        } else if (roomError.code !== '23505') {
          throw roomError;
        }
      }

      if (!roomData) {
        throw new Error('Could not allocate a room code. Please try again.');
      }

      // Add the creator as player 1 (the room owner)
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          name,
          player_order: 1
        })
        .select()
        .single();

      if (playerError) throw playerError;

      setRoomPlayerId(newRoomCode, playerData.id);
      router.push(`/room/${newRoomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      setError(error.message || 'Failed to create room. Please try again.');
      setIsCreating(false);
    }
  };

  const joinRoom = async (nameOverride) => {
    const name = (nameOverride || playerName).trim();
    if (!name) {
      setShowNameInput(true);
      setPendingAction('join');
      return;
    }

    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*, players (*)')
        .eq('room_code', code)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!roomData) throw new Error('Room not found. Check the code and try again.');

      if (roomData.game_type !== gameType) {
        throw new Error('That room is running a different game.');
      }

      // Joins as a spectator when the room is full, and reuses the existing
      // seat when someone reconnects with the same name.
      await joinRoomAsPlayer(roomData, roomData.players, name);
      router.push(`/room/${code}`);
    } catch (error) {
      console.error('Error joining room:', error);
      setError(error.message || 'Failed to join room. Please try again.');
      setIsJoining(false);
    }
  };

  if (showNameInput) {
    return (
      <div className="card p-7 max-w-md w-full mx-auto">
        <span className="w-12 h-12 rounded-xl bg-amber border-2 border-line flex items-center justify-center mb-4">
          <UserPen className="w-6 h-6 text-[var(--on-amber)]" strokeWidth={2.5} />
        </span>
        <h2 className="text-2xl mb-1">What should we call you?</h2>
        <p className="text-sm text-ink-soft mb-5">
          This is the name the other players will see. You can change it later.
        </p>

        <form onSubmit={handleNameSubmit} className="space-y-4">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerNameState(e.target.value)}
            placeholder="Your name"
            className="field"
            autoFocus
            maxLength={50}
          />
          {error && (
            <p className="flex items-center gap-2 text-sm font-bold text-coral">
              <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-amber w-full btn-lg">
            Continue
            <ArrowRight className="w-4 h-4" strokeWidth={3} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <div className="flex items-center justify-between gap-3 mb-6">
        <p className="text-sm text-ink-soft">
          Playing as <span className="font-extrabold text-ink">{playerName}</span>
        </p>
        <button
          onClick={() => setShowNameInput(true)}
          className="chip hover:bg-sunken"
          type="button"
        >
          <UserPen className="w-3.5 h-3.5" strokeWidth={2.5} />
          Change
        </button>
      </div>

      {/* Create */}
      <div className="panel p-5 mb-4">
        <h2 className="text-lg mb-1">Start a new room</h2>
        <p className="text-sm text-ink-soft mb-4">
          You get a code to share. Whoever joins first plays; the rest watch.
        </p>
        <button onClick={() => createRoom()} disabled={isCreating} className="btn btn-teal btn-lg w-full">
          {isCreating ? (
            <>
              <Loader className="w-4 h-4 animate-spin" strokeWidth={3} />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" strokeWidth={3} />
              Create room
            </>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <span className="h-0.5 bg-line grow rounded-full opacity-30" />
        <span className="text-xs font-extrabold uppercase tracking-widest text-ink-soft">or</span>
        <span className="h-0.5 bg-line grow rounded-full opacity-30" />
      </div>

      {/* Join */}
      <div className="panel p-5">
        <h2 className="text-lg mb-1">Join with a code</h2>
        <p className="text-sm text-ink-soft mb-4">
          Six characters, from whoever set the room up.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && roomCode.trim() && !isJoining) joinRoom();
            }}
            placeholder="ABC123"
            className="field text-center font-mono text-2xl tracking-[0.3em] uppercase"
            maxLength={6}
            inputMode="text"
            autoCapitalize="characters"
          />
          <button
            onClick={() => joinRoom()}
            disabled={isJoining || !roomCode.trim()}
            className="btn btn-amber btn-lg w-full"
          >
            {isJoining ? (
              <>
                <Loader className="w-4 h-4 animate-spin" strokeWidth={3} />
                Joining...
              </>
            ) : (
              <>
                <DoorOpen className="w-4 h-4" strokeWidth={3} />
                Join room
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-5 flex items-center gap-2 text-sm font-bold text-coral">
          <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
          {error}
        </p>
      )}
    </div>
  );
}
