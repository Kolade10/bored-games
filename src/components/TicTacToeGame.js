'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function TicTacToeGame({ room, players, currentPlayer, gameSession }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [moves, setMoves] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'draw'
  const [winner, setWinner] = useState(null);

  const activePlayers = players.filter(p => !p.is_spectator).sort((a, b) => a.player_order - b.player_order);
  const currentPlayerTurn = activePlayers[currentTurn % 2];
  const isMyTurn = currentPlayer && !currentPlayer.is_spectator && currentPlayerTurn?.id === currentPlayer.id;

  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];

  useEffect(() => {
    loadGameData();
    const channel = setupRealtimeSubscriptions();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [gameSession.id]);

  const loadGameData = async () => {
    try {
      const { data: movesData, error } = await supabase
        .from('tic_tac_toe_moves')
        .select('*')
        .eq('session_id', gameSession.id)
        .order('move_order', { ascending: true });

      if (error) throw error;

      setMoves(movesData || []);
      
      // Reconstruct board from moves
      const newBoard = Array(9).fill(null);
      movesData?.forEach(move => {
        const symbol = move.player_id === activePlayers[0]?.id ? 'X' : 'O';
        newBoard[move.position] = symbol;
      });
      setBoard(newBoard);
      setCurrentTurn(movesData?.length || 0);

      // Check for winner
      const gameWinner = checkWinner(newBoard);
      if (gameWinner) {
        setWinner(gameWinner);
        setGameStatus('won');
      } else if (newBoard.every(square => square !== null)) {
        setGameStatus('draw');
      }
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`tic-tac-toe-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tic_tac_toe_moves',
        filter: `session_id=eq.${gameSession.id}`
      }, (payload) => {
        console.log('TicTacToe move detected:', payload);
        loadGameData();
      })
      .subscribe((status) => {
        console.log('TicTacToe subscription status:', status);
      });

    return channel;
  };

  const checkWinner = (squares) => {
    for (let combination of winningCombinations) {
      const [a, b, c] = combination;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const makeMove = async (position) => {
    if (!isMyTurn || board[position] || gameStatus !== 'playing') {
      console.log('Move blocked:', { isMyTurn, position, boardValue: board[position], gameStatus });
      return;
    }

    try {
      const symbol = currentPlayer.id === activePlayers[0]?.id ? 'X' : 'O';
      
      console.log('Making move:', { position, symbol, playerId: currentPlayer.id, sessionId: gameSession.id });

      // Optimistic update
      const newBoard = [...board];
      newBoard[position] = symbol;
      setBoard(newBoard);
      setCurrentTurn(prev => prev + 1);

      const { data, error } = await supabase
        .from('tic_tac_toe_moves')
        .insert({
          session_id: gameSession.id,
          player_id: currentPlayer.id,
          position: position,
          symbol: symbol,
          move_order: currentTurn + 1
        })
        .select();

      if (error) {
        console.error('Error making move:', error);
        // Revert optimistic update on error
        loadGameData();
      } else {
        console.log('Move successful:', data);
      }

    } catch (error) {
      console.error('Error making move:', error);
      // Revert optimistic update on error
      loadGameData();
    }
  };

  const newGame = async () => {
    try {
      // Delete existing moves
      await supabase
        .from('tic_tac_toe_moves')
        .delete()
        .eq('session_id', gameSession.id);

      // Reset local state
      setBoard(Array(9).fill(null));
      setMoves([]);
      setCurrentTurn(0);
      setGameStatus('playing');
      setWinner(null);
    } catch (error) {
      console.error('Error starting new game:', error);
    }
  };

  const endGame = async () => {
    try {
      await supabase
        .from('game_sessions')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', gameSession.id);

      await supabase
        .from('rooms')
        .update({ status: 'waiting' })
        .eq('id', room.id);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  const renderSquare = (index) => {
    const isWinningSquare = winner && winningCombinations.some(combo => 
      combo.includes(index) && combo.every(pos => board[pos] === winner)
    );

    return (
      <button
        key={index}
        className={`
          aspect-square bg-white rounded-xl border-4 transition-all duration-200 
          text-4xl font-bold flex items-center justify-center shadow-lg
          ${board[index] ? 'cursor-not-allowed' : isMyTurn ? 'cursor-pointer hover:bg-slate-50 hover:border-blue-300 border-slate-200' : 'cursor-not-allowed border-slate-200'}
          ${board[index] === 'X' ? 'text-blue-600' : 'text-red-500'}
          ${isWinningSquare ? 'bg-yellow-100 border-yellow-400' : ''}
          ${!isMyTurn && !board[index] ? 'opacity-50' : ''}
        `}
        onClick={() => makeMove(index)}
        disabled={board[index] || !isMyTurn || gameStatus !== 'playing'}
      >
        {board[index]}
      </button>
    );
  };

  const getStatusMessage = () => {
    if (gameStatus === 'won') {
      const winnerPlayer = activePlayers.find(p => 
        (p.id === activePlayers[0]?.id && winner === 'X') || 
        (p.id === activePlayers[1]?.id && winner === 'O')
      );
      return `🎉 ${winnerPlayer?.name} Wins!`;
    } else if (gameStatus === 'draw') {
      return "🤝 It's a Draw!";
    } else {
      return `${currentPlayerTurn?.name}'s Turn (${currentPlayerTurn?.id === activePlayers[0]?.id ? 'X' : 'O'})`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-2">
                <span className="text-white text-xl font-bold">🎮</span>
              </div>
              <div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">Room {room.room_code}</span>
                <div className="text-sm text-slate-600 dark:text-slate-400">Tic Tac Toe</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
          {/* Game Status */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {getStatusMessage()}
            </h2>
            <div className="flex items-center justify-center space-x-4">
              {activePlayers.map((player, index) => (
                <div key={player.id} className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                  currentPlayerTurn?.id === player.id && gameStatus === 'playing'
                    ? index === 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className="text-xl font-bold">{index === 0 ? 'X' : 'O'}</span>
                  <span className="text-sm font-medium">{player.name}</span>
                  {player.id === currentPlayer?.id && <span className="text-xs">(You)</span>}
                </div>
              ))}
            </div>
            {!currentPlayer?.is_spectator && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {isMyTurn ? "It's your turn!" : "Waiting for opponent..."}
              </div>
            )}
          </div>

          {/* Game Board */}
          <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
            {Array(9).fill(null).map((_, index) => renderSquare(index))}
          </div>

          {/* Game Controls */}
          {gameStatus !== 'playing' && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              {!currentPlayer?.is_spectator && (
                <button
                  onClick={newGame}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 
                           text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  🔄 New Round
                </button>
              )}
              <button
                onClick={endGame}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                         text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
              >
                🏁 End Game
              </button>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/"
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 
                       text-slate-800 dark:text-white font-bold py-3 px-6 rounded-xl transition-all 
                       duration-200 hover:scale-105 shadow-lg"
            >
              🏠 Back to Home
            </Link>
          </div>

          {/* Spectators */}
          {players.filter(p => p.is_spectator).length > 0 && (
            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Spectators:</h3>
              <div className="flex flex-wrap gap-2">
                {players.filter(p => p.is_spectator).map(spectator => (
                  <span key={spectator.id} className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded">
                    {spectator.name}
                    {spectator.id === currentPlayer?.id && ' (You)'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
