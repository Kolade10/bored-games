'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, getPlayerName } from '@/lib/supabase';
import Link from 'next/link';
import TicTacToeGame from '@/components/TicTacToeGame';
import NamePlaceThingGame from '@/components/NamePlaceThingGame';

export default function RoomLobby() {
  const { roomCode } = useParams();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomCode) return;

    const playerName = getPlayerName();
    if (!playerName) {
      router.push('/');
      return;
    }

    loadRoomData();
  }, [roomCode]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = setupRealtimeSubscriptions();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [room?.id]);

  const loadRoomData = async () => {
    try {
      // Get room data
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select(`
          *,
          players (*),
          game_sessions (*)
        `)
        .eq('room_code', roomCode)
        .single();

      if (roomError || !roomData) {
        setError('Room not found');
        return;
      }

      setRoom(roomData);
      setPlayers(roomData.players || []);
      
      // Find current player
      const playerName = getPlayerName();
      const currentP = roomData.players.find(p => p.name === playerName);
      setCurrentPlayer(currentP);

      // Get active game session
      const activeSession = roomData.game_sessions?.find(s => s.status !== 'finished');
      
      // If room is marked as playing but no active session exists, reset room status
      if (roomData.status === 'playing' && !activeSession) {
        await supabase
          .from('rooms')
          .update({ status: 'waiting' })
          .eq('id', roomData.id);
        
        // Update local room state
        setRoom(prev => ({ ...prev, status: 'waiting' }));
      }
      
      setGameSession(activeSession);

      setLoading(false);
    } catch (error) {
      console.error('Error loading room:', error);
      setError('Failed to load room');
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Create a single channel for all subscriptions
    const roomChannel = supabase
      .channel(`room-${roomCode}-all`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `room_code=eq.${roomCode}`
      }, (payload) => {
        console.log('Room change detected:', payload);
        // Update room state directly instead of full reload
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
        filter: `room_id=eq.${room?.id}`
      }, (payload) => {
        console.log('Player change detected:', payload);
        loadRoomData(); // Players need full reload to get relationships
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${room?.id}`
      }, (payload) => {
        console.log('Game session change detected:', payload);
        // Update game session state directly
        if (payload.eventType === 'INSERT' && payload.new) {
          setGameSession(payload.new);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setGameSession(payload.new);
        } else if (payload.eventType === 'DELETE') {
          setGameSession(null);
        } else {
          loadRoomData();
        }
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return roomChannel;
  };

  const startGame = async () => {
    if (!room || !currentPlayer) {
      console.error('Cannot start game: missing room or current player', { room, currentPlayer });
      setError('Cannot start game: missing room or player data');
      return;
    }

    if (!canStartGame) {
      console.error('Cannot start game: conditions not met');
      setError('Cannot start game: conditions not met');
      return;
    }

    console.log('Starting game...', { 
      roomId: room.id, 
      currentPlayerId: currentPlayer.id,
      activePlayers: activePlayers.length,
      gameType: room.game_type
    });

    try {
      // Clear any previous errors
      setError('');

      // Find the first player to be the leader
      const firstPlayer = players.find(p => !p.is_spectator && p.player_order === 1);
      if (!firstPlayer) {
        throw new Error('No first player found');
      }

      // Create new game session
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          room_id: room.id,
          current_leader_id: firstPlayer.id,
          max_rounds: room.game_type === 'name-place-thing' ? 999 : 1, // Infinite rounds for name-place-thing
          status: 'playing'
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating game session:', sessionError);
        throw new Error(`Failed to create game session: ${sessionError.message}`);
      }

      console.log('Game session created:', sessionData);

      // Update room status
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', room.id);

      if (roomUpdateError) {
        console.error('Error updating room status:', roomUpdateError);
        throw new Error(`Failed to update room status: ${roomUpdateError.message}`);
      }

      console.log('Room status updated to playing');

      // The real-time subscriptions should handle the state updates
      // But let's also manually update the local state for immediate feedback
      setRoom(prev => ({ ...prev, status: 'playing' }));
      setGameSession(sessionData);

    } catch (error) {
      console.error('Error starting game:', error);
      setError(`Failed to start game: ${error.message}`);
    }
  };

  const resetRoom = async () => {
    if (!room) return;

    try {
      // End any active game sessions
      await supabase
        .from('game_sessions')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('room_id', room.id)
        .neq('status', 'finished');

      // Reset room status
      await supabase
        .from('rooms')
        .update({ status: 'waiting' })
        .eq('id', room.id);

      // Reload room data
      await loadRoomData();
    } catch (error) {
      console.error('Error resetting room:', error);
      setError('Failed to reset room');
    }
  };

  const leaveRoom = async () => {
    if (!currentPlayer) return;

    try {
      await supabase
        .from('players')
        .delete()
        .eq('id', currentPlayer.id);

      router.push('/');
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    // You could add a toast notification here
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Room Error</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <Link
            href="/"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                     text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // If there's an active game session, show the game
  if (gameSession && gameSession.status === 'playing') {
    if (room.game_type === 'tic-tac-toe') {
      return (
        <TicTacToeGame 
          room={room}
          players={players}
          currentPlayer={currentPlayer}
          gameSession={gameSession}
        />
      );
    } else if (room.game_type === 'name-place-thing') {
      return (
        <NamePlaceThingGame 
          room={room}
          players={players}
          currentPlayer={currentPlayer}
          gameSession={gameSession}
        />
      );
    }
  }

  // Show lobby
  const activePlayers = players.filter(p => !p.is_spectator);
  const spectators = players.filter(p => p.is_spectator);
  
  // More robust canStartGame logic
  const minPlayers = room.game_type === 'tic-tac-toe' ? 2 : 2;
  const hasEnoughPlayers = activePlayers.length >= minPlayers;
  const isRoomWaiting = room.status === 'waiting';
  const isCurrentPlayerActive = currentPlayer && !currentPlayer.is_spectator;
  const noActiveGameSession = !gameSession || gameSession.status === 'finished';
  
  const canStartGame = hasEnoughPlayers && 
                      isRoomWaiting && 
                      isCurrentPlayerActive &&
                      noActiveGameSession;

  // Debug logging
  console.log('Debug Room Lobby:', {
    activePlayers: activePlayers.length,
    minPlayers,
    hasEnoughPlayers,
    gameType: room.game_type,
    roomStatus: room.status,
    isRoomWaiting,
    currentPlayer: currentPlayer,
    isCurrentPlayerActive,
    gameSession: gameSession,
    gameSessionStatus: gameSession?.status,
    noActiveGameSession,
    canStartGame,
  });

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
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Room {roomCode}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {room.game_type === 'tic-tac-toe' ? 'Tic Tac Toe' : 'Name Place Animal Thing'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
          {/* Room Info */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-3 bg-blue-50 dark:bg-blue-900/20 px-6 py-3 rounded-2xl mb-4">
              <span className="text-2xl">🏠</span>
              <div>
                <div className="font-mono text-2xl font-bold text-blue-600 dark:text-blue-400">{roomCode}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Room Code</div>
              </div>
              <button
                onClick={copyRoomCode}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                title="Copy room code"
              >
                📋
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Share this code with friends to invite them to play!
            </p>
          </div>

          {/* Players List */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Players ({activePlayers.length}/{room.max_players})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {activePlayers.map((player, index) => (
                <div
                  key={player.id}
                  className={`p-4 rounded-xl border-2 ${
                    player.id === currentPlayer?.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {player.name}
                        {player.id === currentPlayer?.id && ' (You)'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Player {player.player_order}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {spectators.length > 0 && (
              <>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Spectators ({spectators.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {spectators.map((spectator) => (
                    <div
                      key={spectator.id}
                      className={`p-3 rounded-lg border ${
                        spectator.id === currentPlayer?.id
                          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">👁️</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {spectator.name}
                          {spectator.id === currentPlayer?.id && ' (You)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Game Controls */}
          <div className="text-center space-y-4">
            {/* Enhanced Debug Info */}
            <div className="text-xs text-slate-500 p-3 bg-slate-100 dark:bg-slate-700 rounded">
              <div>Players: {activePlayers.length}/{room.max_players} (Min: {minPlayers})</div>
              <div>Room Status: {room.status} (Waiting: {isRoomWaiting.toString()})</div>
              <div>Game Session: {gameSession ? `${gameSession.status}` : 'None'} (No Active: {noActiveGameSession.toString()})</div>
              <div>Current Player: {currentPlayer?.name} (Active: {isCurrentPlayerActive.toString()})</div>
              <div>Can Start: {canStartGame.toString()}</div>
            </div>
            
            {canStartGame && (
              <button
                onClick={startGame}
                disabled={!canStartGame}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 
                         disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                         text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
              >
                🎮 Start Game
              </button>
            )}

            {!canStartGame && room.status === 'waiting' && noActiveGameSession && (
              <div className="text-slate-600 dark:text-slate-400">
                {!hasEnoughPlayers 
                  ? `Waiting for ${minPlayers} players to start... (${activePlayers.length}/${minPlayers})`
                  : !isCurrentPlayerActive 
                    ? 'Only players can start the game'
                    : 'Ready to start!'
                }
              </div>
            )}

            {gameSession && (
              <div className="text-blue-600 dark:text-blue-400 font-medium">
                Game session active (Status: {gameSession.status})
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={leaveRoom}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg 
                         transition-all duration-200 hover:scale-105"
              >
                🚪 Leave Room
              </button>
              <Link
                href="/"
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 
                         text-slate-800 dark:text-white font-bold py-3 px-6 rounded-lg transition-all 
                         duration-200 hover:scale-105 text-center"
              >
                🏠 Back to Home
              </Link>
            </div>

            {/* Reset Room Button for debugging */}
            {(room.status === 'playing' && noActiveGameSession) && (
              <div className="mt-4">
                <button
                  onClick={resetRoom}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg text-sm"
                >
                  🔄 Reset Room (Fix Stuck State)
                </button>
              </div>
            )}
          </div>

          {/* Game Rules */}
          <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-700 rounded-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              {room.game_type === 'tic-tac-toe' ? 'Tic Tac Toe Rules:' : 'Name Place Animal Thing Rules:'}
            </h3>
            {room.game_type === 'tic-tac-toe' ? (
              <ul className="text-slate-700 dark:text-slate-300 space-y-2 text-sm">
                <li>• Players take turns placing X&apos;s and O&apos;s on the 3x3 grid</li>
                <li>• First player to get 3 in a row (horizontal, vertical, or diagonal) wins!</li>
                <li>• If all 9 squares are filled with no winner, it&apos;s a draw</li>
              </ul>
            ) : (
              <ul className="text-slate-700 dark:text-slate-300 space-y-2 text-sm">
                <li>• Round leader picks a letter (can&apos;t reuse letters from previous rounds)</li>
                <li>• Fill in Name, Place, Animal, and Thing starting with that letter</li>
                <li>• You have 60 seconds unless the leader stops the round early</li>
                <li>• Unique answers get 10 points, duplicate answers get 5 points</li>
                <li>• Leadership rotates each round - player with most points after 3 rounds wins!</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
