'use client';

import { useState, useEffect } from 'react';
import { supabase, generateRoomCode, getPlayerName, setPlayerName } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
    if (playerName.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }
    setPlayerName(playerName.trim());
    setShowNameInput(false);
    setError('');
    
    // Execute pending action
    if (pendingAction === 'create') {
      createRoom();
    } else if (pendingAction === 'join') {
      joinRoom();
    }
    setPendingAction(null);
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      setShowNameInput(true);
      setPendingAction('create');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const newRoomCode = generateRoomCode();
      
      // Create room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: newRoomCode,
          game_type: gameType,
          max_players: maxPlayers,
          status: 'waiting'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add player to room
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          name: playerName.trim(),
          player_order: 1
        });

      if (playerError) throw playerError;

      // Navigate to room lobby
      router.push(`/room/${newRoomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      setShowNameInput(true);
      setPendingAction('join');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      // Check if room exists and get room info
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select(`
          *,
          players (*)
        `)
        .eq('room_code', roomCode.toUpperCase())
        .single();

      if (roomError || !roomData) {
        throw new Error('Room not found');
      }

      // Check if room is full
      const currentPlayers = roomData.players.filter(p => !p.is_spectator);
      if (currentPlayers.length >= roomData.max_players) {
        // Join as spectator
        const { error: spectatorError } = await supabase
          .from('players')
          .insert({
            room_id: roomData.id,
            name: playerName.trim(),
            is_spectator: true
          });

        if (spectatorError) {
          if (spectatorError.code === '23505') { // Unique constraint violation
            throw new Error('A player with this name already exists in the room');
          }
          throw spectatorError;
        }
      } else {
        // Join as player
        const nextPlayerOrder = Math.max(...currentPlayers.map(p => p.player_order || 0), 0) + 1;
        
        const { error: playerError } = await supabase
          .from('players')
          .insert({
            room_id: roomData.id,
            name: playerName.trim(),
            player_order: nextPlayerOrder
          });

        if (playerError) {
          if (playerError.code === '23505') { // Unique constraint violation
            throw new Error('A player with this name already exists in the room');
          }
          throw playerError;
        }
      }

      // Navigate to room lobby
      router.push(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      setError(error.message || 'Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  if (showNameInput) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg max-w-md mx-auto">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          Enter Your Name
        </h3>
        <form onSubmit={handleNameSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerNameState(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg 
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              maxLength={50}
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                     text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          {gameTitle}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-2">
          Welcome, <span className="font-semibold text-blue-600 dark:text-blue-400">{playerName}</span>!
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500">
          {minPlayers === maxPlayers ? `${minPlayers} players` : `${minPlayers}-${maxPlayers} players`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Room */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create Room</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Start a new game and invite friends with a room code
          </p>
          <button
            onClick={createRoom}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 
                     disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                     text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
          >
            {isCreating ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creating...</span>
              </span>
            ) : (
              '🎮 Create Room'
            )}
          </button>
        </div>

        {/* Join Room */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Join Room</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Enter a room code to join an existing game
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code..."
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg 
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-center
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
              maxLength={6}
            />
            <button
              onClick={joinRoom}
              disabled={isJoining || !roomCode.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                       disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                       text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
            >
              {isJoining ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Joining...</span>
                </span>
              ) : (
                '🚪 Join Room'
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="text-red-700 dark:text-red-400 text-sm">{error}</div>
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={() => setShowNameInput(true)}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm"
        >
          Change name
        </button>
      </div>
    </div>
  );
}
