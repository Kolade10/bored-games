'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Circle, CircleAlert, Crown, Eye, Flag, Frown, Grid3x3, Handshake, Hourglass,
  House, PartyPopper, Play, RotateCcw, Trophy, X
} from 'lucide-react';

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6] // Diagonals
];

const checkWinner = (squares) => {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { symbol: squares[a], line: [a, b, c] };
    }
  }
  return null;
};

export default function TicTacToeGame({ room, players, currentPlayer, gameSession }) {
  const [moves, setMoves] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  // X is whoever the session says goes first; O is the other player.
  const orderedPlayers = useMemo(() => {
    const firstPlayerId = gameSession?.first_player_id;
    const index = activePlayers.findIndex(p => p.id === firstPlayerId);
    if (index <= 0) return activePlayers;
    return [
      activePlayers[index],
      ...activePlayers.slice(0, index),
      ...activePlayers.slice(index + 1)
    ];
  }, [activePlayers, gameSession?.first_player_id]);

  const symbolOf = useCallback(
    (playerId) => (playerId === orderedPlayers[0]?.id ? 'X' : 'O'),
    [orderedPlayers]
  );
  const playerForSymbol = (symbol) =>
    symbol === 'X' ? orderedPlayers[0] : orderedPlayers[1];

  // The board is derived from the persisted moves, using the symbol that was
  // stored with each move rather than re-deriving it from the current ordering.
  const board = useMemo(() => {
    const squares = Array(9).fill(null);
    moves.forEach(move => {
      squares[move.position] = move.symbol;
    });
    return squares;
  }, [moves]);

  const winner = useMemo(() => checkWinner(board), [board]);
  const gameStatus = winner
    ? 'won'
    : board.every(square => square !== null)
      ? 'draw'
      : 'playing';

  const currentPlayerTurn = orderedPlayers[moves.length % 2];
  const isMyTurn =
    !!currentPlayer &&
    !currentPlayer.is_spectator &&
    gameStatus === 'playing' &&
    currentPlayerTurn?.id === currentPlayer.id;

  // One client writes the result so the room does not fire N identical updates.
  const isScorekeeper = activePlayers[0]?.id === currentPlayer?.id;

  const loadMoves = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('tic_tac_toe_moves')
      .select('*')
      .eq('session_id', gameSession.id)
      .order('move_order', { ascending: true });

    if (loadError) {
      console.error('Error loading moves:', loadError);
      setError('Lost sync with the game. Retrying...');
      return;
    }

    setError('');
    setMoves(data || []);
  }, [gameSession.id]);

  useEffect(() => {
    loadMoves();

    const channel = supabase
      .channel(`tic-tac-toe-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tic_tac_toe_moves',
        filter: `session_id=eq.${gameSession.id}`
      }, loadMoves)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${gameSession.id}`
      }, loadMoves)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession.id, loadMoves]);

  // Reload when a new round resets who goes first.
  useEffect(() => {
    loadMoves();
  }, [gameSession.first_player_id, loadMoves]);

  // Record the winner so the next game can start with them.
  useEffect(() => {
    if (gameStatus !== 'won' || !isScorekeeper) return;

    const winnerId = playerForSymbol(winner.symbol)?.id;
    if (!winnerId || gameSession.last_winner_id === winnerId) return;

    supabase
      .from('game_sessions')
      .update({ last_winner_id: winnerId })
      .eq('id', gameSession.id)
      .then(({ error: updateError }) => {
        if (updateError) console.error('Error recording winner:', updateError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus, winner, isScorekeeper, gameSession.id, gameSession.last_winner_id]);

  const makeMove = async (position) => {
    if (!isMyTurn || board[position] || busy) return;

    setBusy(true);
    const move = {
      session_id: gameSession.id,
      player_id: currentPlayer.id,
      position,
      symbol: symbolOf(currentPlayer.id),
      move_order: moves.length + 1
    };

    // Optimistic update so the square fills immediately.
    setMoves(prev => [...prev, move]);

    const { error: insertError } = await supabase.from('tic_tac_toe_moves').insert(move);

    if (insertError) {
      // Someone else got there first, or the square was taken - resync.
      console.error('Error making move:', insertError);
      await loadMoves();
    }
    setBusy(false);
  };

  const newGame = async () => {
    if (!currentPlayer || currentPlayer.is_spectator || busy) return;

    setBusy(true);
    try {
      const { error: deleteError } = await supabase
        .from('tic_tac_toe_moves')
        .delete()
        .eq('session_id', gameSession.id);

      if (deleteError) throw deleteError;

      // Who opens is drawn fresh every round, regardless of the last result.
      const nextFirstPlayerId =
        activePlayers[Math.floor(Math.random() * activePlayers.length)]?.id;

      // round_data changes every round so the UPDATE always reaches the other
      // client, which is what tells them to clear their board.
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({
          first_player_id: nextFirstPlayerId,
          current_leader_id: nextFirstPlayerId,
          round_data: { round_seq: (gameSession.round_data?.round_seq || 0) + 1 }
        })
        .eq('id', gameSession.id);

      if (updateError) throw updateError;

      setMoves([]);
      setError('');
    } catch (err) {
      console.error('Error starting new game:', err);
      setError('Could not start a new round. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const endGame = async () => {
    try {
      await supabase
        .from('game_sessions')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', gameSession.id);

      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', room.id);
    } catch (err) {
      console.error('Error ending game:', err);
      setError('Could not end the game. Please try again.');
    }
  };


  // X and O are drawn as icons rather than letters so the board reads as marks.
  const Mark = ({ symbol, className }) =>
    symbol === 'X'
      ? <X className={className} strokeWidth={3} />
      : <Circle className={className} strokeWidth={3} />;

  const status = () => {
    if (gameStatus === 'won') {
      const winnerPlayer = playerForSymbol(winner.symbol);
      if (currentPlayer && !currentPlayer.is_spectator) {
        return winnerPlayer?.id === currentPlayer.id
          ? { Icon: PartyPopper, text: 'You win!', tone: 'chip-leaf' }
          : { Icon: Frown, text: 'You lose', tone: 'chip-coral' };
      }
      return { Icon: Trophy, text: `${winnerPlayer?.name} wins`, tone: 'chip-amber' };
    }
    if (gameStatus === 'draw') {
      return { Icon: Handshake, text: "It's a draw", tone: 'chip' };
    }
    return {
      Icon: isMyTurn ? Play : Hourglass,
      text: isMyTurn ? 'Your turn' : `${currentPlayerTurn?.name}'s turn`,
      tone: isMyTurn ? 'chip-teal' : 'chip'
    };
  };

  const renderSquare = (index) => {
    const isWinningSquare = winner?.line.includes(index);
    const isPlayable = isMyTurn && !board[index];
    const mark = board[index];

    return (
      <button
        key={index}
        onClick={() => makeMove(index)}
        disabled={!isPlayable}
        aria-label={mark ? `Square ${index + 1}, ${mark}` : `Play square ${index + 1}`}
        className={`tile aspect-square ${isPlayable ? 'tile-active cursor-pointer' : 'cursor-default'}
                    ${isWinningSquare ? 'bg-amber' : ''}`}
      >
        {mark && (
          <Mark
            symbol={mark}
            className={`w-2/5 h-2/5 ${mark === 'X' ? 'text-teal' : 'text-coral'}
                        ${isWinningSquare ? 'text-[var(--on-amber)]' : ''}`}
          />
        )}
      </button>
    );
  };

  const spectators = players.filter(p => p.is_spectator);
  const current = status();

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-teal border-2 border-line flex items-center justify-center shrink-0">
              <Grid3x3 className="w-5 h-5 text-[var(--on-teal)]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-tight truncate">Tic Tac Toe</p>
              <p className="text-xs text-ink-soft font-bold font-mono">{room.room_code}</p>
            </div>
          </div>
          <Link href="/" className="btn btn-quiet btn-sm">
            <House className="w-4 h-4" strokeWidth={3} />
            <span className="hidden sm:inline">Leave</span>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Who is who */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {orderedPlayers.map((player, index) => {
            const symbol = index === 0 ? 'X' : 'O';
            const isTurn = currentPlayerTurn?.id === player.id && gameStatus === 'playing';
            return (
              <div
                key={player.id}
                className={`card p-4 flex items-center gap-3 ${isTurn ? 'bg-amber-soft' : ''}`}
              >
                <span className={`w-10 h-10 rounded-lg border-2 border-line flex items-center justify-center
                                  shrink-0 ${symbol === 'X' ? 'bg-teal' : 'bg-coral'}`}>
                  <Mark
                    symbol={symbol}
                    className={`w-5 h-5 ${symbol === 'X' ? 'text-[var(--on-teal)]' : 'text-[var(--on-coral)]'}`}
                  />
                </span>
                <div className="min-w-0">
                  <p className="font-bold truncate leading-tight">{player.name}</p>
                  <p className="text-xs text-ink-soft font-semibold">
                    {player.id === currentPlayer?.id ? 'You' : 'Opponent'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status */}
        <div className="flex justify-center mb-5">
          <span className={`${current.tone} flex items-center gap-[8px] text-base px-4 py-2`}>
            <current.Icon className="w-5 h-5" strokeWidth={2.5} />
            {current.text}
          </span>
        </div>

        {error && (
          <p className="mb-5 flex items-center justify-center gap-2 text-sm font-bold text-coral">
            <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}

        {/* Board */}
        <div className="card p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {board.map((_, index) => renderSquare(index))}
          </div>
        </div>

        {/* Controls */}
        {gameStatus !== 'playing' && currentPlayer && !currentPlayer.is_spectator && (
          <div className="card p-5 mb-6">
            {gameStatus === 'won' && (
              <p className="text-sm text-ink-soft font-semibold mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                {playerForSymbol(winner.symbol)?.name} goes first next round
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={newGame} disabled={busy} className="btn btn-leaf grow">
                <RotateCcw className="w-4 h-4" strokeWidth={3} />
                Play again
              </button>
              <button onClick={endGame} className="btn btn-quiet grow">
                <Flag className="w-4 h-4" strokeWidth={3} />
                Back to lobby
              </button>
            </div>
          </div>
        )}

        {spectators.length > 0 && (
          <div className="panel p-4">
            <h2 className="text-sm mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4" strokeWidth={2.5} />
              Watching ({spectators.length})
            </h2>
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
    </div>
  );
}
