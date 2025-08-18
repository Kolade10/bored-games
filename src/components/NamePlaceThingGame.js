'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function NamePlaceThingGame({ room, players, currentPlayer, gameSession }) {
  const [currentRound, setCurrentRound] = useState(null);
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'letter_selection', 'playing', 'reviewing', 'finished'
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedLetter, setSelectedLetter] = useState('');
  const [usedLetters, setUsedLetters] = useState([]);
  const [playerAnswers, setPlayerAnswers] = useState({});
  const [currentAnswers, setCurrentAnswers] = useState({
    name: '',
    place: '',
    animal: '',
    thing: ''
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [scores, setScores] = useState({});
  const [roundScores, setRoundScores] = useState({});
  const [scoreBreakdowns, setScoreBreakdowns] = useState({});
  const [isTransitioning, setIsTransitioning] = useState(false);

  const activePlayers = players.filter(p => !p.is_spectator).sort((a, b) => a.player_order - b.player_order);
  
  // Determine current leader - use round leader if round exists, otherwise use game session leader
  const currentLeader = currentRound 
    ? activePlayers.find(p => p.id === currentRound.leader_id)
    : activePlayers.find(p => p.id === gameSession.current_leader_id);
    
  // Debug logging
  console.log('NamePlaceThingGame Debug:', {
    currentRound,
    gameSession: { id: gameSession.id, current_leader_id: gameSession.current_leader_id, current_round: gameSession.current_round },
    activePlayers: activePlayers.map(p => ({ id: p.id, name: p.name, player_order: p.player_order })),
    currentLeader,
    currentPlayer
  });
    
  const isCurrentLeader = currentPlayer && !currentPlayer.is_spectator && currentLeader?.id === currentPlayer.id;
  const canPlay = currentPlayer && !currentPlayer.is_spectator;

  const categories = [
    { id: 'name', label: 'Name', placeholder: 'e.g., Alice, Bob' },
    { id: 'place', label: 'Place', placeholder: 'e.g., Amsterdam, Boston' },
    { id: 'animal', label: 'Animal', placeholder: 'e.g., Ant, Bear' },
    { id: 'thing', label: 'Thing', placeholder: 'e.g., Apple, Book' }
  ];

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    loadGameData();
    const channel = setupRealtimeSubscriptions();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [gameSession.id]);

  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      stopRound();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, gameState]);

  const loadGameData = async () => {
    try {
      // Don't load data if we're transitioning to prevent race conditions
      if (isTransitioning) {
        console.log('Skipping loadGameData during transition');
        return;
      }
      
      console.log('Loading game data for round:', gameSession.current_round);
      
      // Load current round
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('session_id', gameSession.id)
        .eq('round_number', gameSession.current_round)
        .single();

      console.log('Round data loaded:', roundData);

      if (roundData) {
        setCurrentRound(roundData);
        setSelectedLetter(roundData.letter || '');
        
        if (roundData.status === 'active' && roundData.letter) {
          setGameState('playing');
          // Calculate time left
          const startTime = new Date(roundData.started_at);
          const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
          const remaining = Math.max(0, (roundData.time_limit || 60) - elapsed);
          setTimeLeft(remaining);
        } else if (roundData.status === 'completed') {
          setGameState('reviewing');
        } else {
          // Round exists but no letter selected yet
          setGameState('letter_selection');
        }
      } else {
        // No round yet, leader needs to select letter
        setCurrentRound(null);
        setSelectedLetter('');
        setGameState('letter_selection');
        setTimeLeft(60);
      }

      // Load used letters from ALL previous rounds (excluding current active round)
      const { data: allRounds } = await supabase
        .from('rounds')
        .select('letter, round_number, status')
        .eq('session_id', gameSession.id)
        .neq('letter', null);

      // Filter to get letters from completed rounds or rounds before current
      const usedLettersFromRounds = allRounds
        ?.filter(round => 
          round.round_number < gameSession.current_round || 
          (round.round_number === gameSession.current_round && round.status === 'completed')
        )
        .map(round => round.letter)
        .filter(Boolean) || [];

      setUsedLetters(usedLettersFromRounds);

      // Load player answers for current round
      if (roundData && roundData.round_number === gameSession.current_round) {
        const { data: answersData } = await supabase
          .from('player_answers')
          .select('*')
          .eq('round_id', roundData.id);

        const answersMap = {};
        answersData?.forEach(answer => {
          answersMap[answer.player_id] = answer.answers;
        });
        setPlayerAnswers(answersMap);

        // Check if current player has submitted for THIS SPECIFIC ROUND
        if (currentPlayer && answersMap[currentPlayer.id]) {
          console.log('Player has submitted for round', roundData.round_number);
          setHasSubmitted(true);
          setCurrentAnswers(answersMap[currentPlayer.id]);
        } else {
          // No answers yet for this round
          console.log('Player has not submitted for round', roundData.round_number);
          setHasSubmitted(false);
          setCurrentAnswers({ name: '', place: '', animal: '', thing: '' });
        }
      } else {
        // No round data or wrong round, clear all answer states
        console.log('No round data for current round, clearing states');
        setPlayerAnswers({});
        setHasSubmitted(false);
        setCurrentAnswers({ name: '', place: '', animal: '', thing: '' });
      }

      // Load scores
      const { data: scoresData } = await supabase
        .from('scores')
        .select('*')
        .eq('session_id', gameSession.id);

      const totalScores = {};
      const currentRoundScores = {};
      const currentRoundBreakdowns = {};
      
      scoresData?.forEach(score => {
        if (!totalScores[score.player_id]) {
          totalScores[score.player_id] = 0;
        }
        totalScores[score.player_id] += score.round_score;
        
        if (score.round_number === gameSession.current_round) {
          currentRoundScores[score.player_id] = score.round_score;
          if (score.score_breakdown) {
            currentRoundBreakdowns[score.player_id] = score.score_breakdown;
          }
        }
      });
      
      setScores(totalScores);
      setRoundScores(currentRoundScores);
      setScoreBreakdowns(currentRoundBreakdowns);

    } catch (error) {
      console.error('Error loading game data:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`name-place-thing-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `session_id=eq.${gameSession.id}`
      }, (payload) => {
        console.log('Round change detected:', payload);
        // Only load data if not transitioning and if it's actually a new round
        if (!isTransitioning) {
          setTimeout(() => loadGameData(), 500); // Small delay to ensure state is ready
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_answers'
      }, (payload) => {
        console.log('Player answer change detected:', payload);
        if (!isTransitioning) {
          loadGameData();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scores'
      }, (payload) => {
        console.log('Score change detected:', payload);
        if (!isTransitioning) {
          loadGameData();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${gameSession.id}`
      }, (payload) => {
        console.log('Game session change detected:', payload);
        // Only reload if the current_round changed and we're not transitioning
        if (!isTransitioning && payload.new && payload.old && 
            payload.new.current_round !== payload.old.current_round) {
          setTimeout(() => loadGameData(), 1000); // Longer delay for round changes
        }
      })
      .subscribe((status) => {
        console.log('NamePlaceThingGame subscription status:', status);
      });

    return channel;
  };

  const selectLetter = async (letter) => {
    if (!isCurrentLeader || usedLetters.includes(letter)) return;

    try {
      const { data: roundData, error } = await supabase
        .from('rounds')
        .insert({
          session_id: gameSession.id,
          round_number: gameSession.current_round,
          leader_id: currentPlayer.id,
          letter: letter,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRound(roundData);
      setSelectedLetter(letter);
      setGameState('playing');
      setTimeLeft(60);
    } catch (error) {
      console.error('Error selecting letter:', error);
    }
  };

  const submitAnswers = async () => {
    if (!canPlay || !currentRound || hasSubmitted) return;

    try {
      await supabase
        .from('player_answers')
        .insert({
          round_id: currentRound.id,
          player_id: currentPlayer.id,
          answers: currentAnswers
        });

      setHasSubmitted(true);
    } catch (error) {
      console.error('Error submitting answers:', error);
    }
  };

  const stopRound = async () => {
    if (!currentRound) return;

    try {
      await supabase
        .from('rounds')
        .update({ 
          status: 'completed', 
          ended_at: new Date().toISOString() 
        })
        .eq('id', currentRound.id);

      // Calculate scores
      await calculateScores();

    } catch (error) {
      console.error('Error stopping round:', error);
    }
  };

  const calculateScores = async () => {
    if (!currentRound) return;

    try {
      // Get all answers for this round
      const { data: allAnswers } = await supabase
        .from('player_answers')
        .select('*')
        .eq('round_id', currentRound.id);

      if (!allAnswers || allAnswers.length === 0) return;

      // Calculate scores for each player with detailed breakdown
      const playerScores = {};
      const scoreBreakdowns = {};
      
      allAnswers.forEach(playerAnswer => {
        playerScores[playerAnswer.player_id] = 0;
        scoreBreakdowns[playerAnswer.player_id] = {};
        
        categories.forEach(category => {
          const answer = playerAnswer.answers[category.id]?.trim().toLowerCase();
          if (!answer) {
            scoreBreakdowns[playerAnswer.player_id][category.id] = { answer: '', points: 0, reason: 'No answer' };
            return;
          }

          // Check if answer starts with the correct letter
          if (answer.charAt(0).toLowerCase() !== selectedLetter.toLowerCase()) {
            scoreBreakdowns[playerAnswer.player_id][category.id] = { 
              answer: playerAnswer.answers[category.id]?.trim() || '', 
              points: 0, 
              reason: 'Wrong letter' 
            };
            return;
          }

          // Count how many players gave the same answer
          const sameAnswers = allAnswers.filter(otherAnswer => 
            otherAnswer.answers[category.id]?.trim().toLowerCase() === answer
          );

          // Award points: 10 for unique, 5 for duplicate
          const points = sameAnswers.length === 1 ? 10 : 5;
          const reason = sameAnswers.length === 1 ? 'Unique' : `Shared with ${sameAnswers.length - 1} other${sameAnswers.length > 2 ? 's' : ''}`;
          
          playerScores[playerAnswer.player_id] += points;
          scoreBreakdowns[playerAnswer.player_id][category.id] = {
            answer: playerAnswer.answers[category.id]?.trim() || '',
            points,
            reason
          };
        });
      });

      // Save scores to database
      for (const [playerId, score] of Object.entries(playerScores)) {
        await supabase
          .from('scores')
          .insert({
            session_id: gameSession.id,
            player_id: playerId,
            round_number: gameSession.current_round,
            round_score: score,
            total_score: score, // Will be calculated properly when loading
            score_breakdown: scoreBreakdowns[playerId] // Save detailed breakdown
          });
      }

    } catch (error) {
      console.error('Error calculating scores:', error);
    }
  };

  const nextRound = async () => {
    try {
      // Set transition flag to prevent loadGameData from interfering
      setIsTransitioning(true);
      
      // Reset local state for new round FIRST
      setCurrentRound(null);
      setHasSubmitted(false);
      setCurrentAnswers({ name: '', place: '', animal: '', thing: '' });
      setPlayerAnswers({});
      setRoundScores({});
      setScoreBreakdowns({});
      setSelectedLetter('');
      setGameState('letter_selection');
      setTimeLeft(60);
      
      // Always go to next round (infinite rounds)
      const nextRoundNumber = gameSession.current_round + 1;
      const nextLeader = activePlayers[(nextRoundNumber - 1) % activePlayers.length];

      console.log('Starting next round:', {
        nextRoundNumber,
        nextLeader: nextLeader.name,
        activePlayers: activePlayers.map(p => p.name)
      });

      await supabase
        .from('game_sessions')
        .update({ 
          current_round: nextRoundNumber,
          current_leader_id: nextLeader.id
        })
        .eq('id', gameSession.id);

      // Allow data loading again after a brief delay
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error proceeding to next round:', error);
      setIsTransitioning(false);
    }
  };

  const endGame = async () => {
    try {
      // Show final results first without updating the session status yet
      setGameState('finished');
      
      // Don't update the session status to 'finished' immediately
      // This prevents the room lobby from auto-redirecting
      
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  const backToLobby = async () => {
    try {
      // Now actually finish the game session and return to lobby
      await supabase
        .from('game_sessions')
        .update({ 
          status: 'finished',
          ended_at: new Date().toISOString()
        })
        .eq('id', gameSession.id);

      await supabase
        .from('rooms')
        .update({ status: 'waiting' })
        .eq('id', room.id);
    } catch (error) {
      console.error('Error returning to lobby:', error);
    }
  };

  // Check if game is finished
  if (gameSession.status === 'finished') {
    const sortedPlayers = activePlayers.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800">
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Game Finished!</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Room {room.room_code}</p>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 text-center">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
              🎉 Final Results!
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {sortedPlayers.slice(0, 3).map((player, index) => (
                <div key={player.id} className={`p-6 rounded-2xl ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                  index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600 text-white' :
                  'bg-gradient-to-r from-amber-600 to-amber-800 text-white'
                }`}>
                  <div className="text-3xl mb-2">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="font-bold text-lg">{player.name}</div>
                  <div className="text-sm opacity-90">Score: {scores[player.id] || 0}</div>
                </div>
              ))}
            </div>

            <Link
              href="/"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                       text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
            >
              🏠 Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-2">
                <span className="text-white text-xl font-bold">🎮</span>
              </div>
              <div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">Room {room.room_code}</span>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Round {gameSession.current_round} • Leader: {currentLeader?.name || 'Loading...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Letter Selection */}
        {gameState === 'letter_selection' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                {isCurrentLeader ? 'Choose a Letter' : `Waiting for ${currentLeader?.name || 'the leader'} to choose a letter...`}
              </h2>
              {usedLetters.length > 0 && (
                <p className="text-slate-600 dark:text-slate-400">
                  Used letters: {usedLetters.join(', ')}
                </p>
              )}
            </div>

            {isCurrentLeader && (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3 max-w-4xl mx-auto">
                {alphabet.map(letter => (
                  <button
                    key={letter}
                    onClick={() => selectLetter(letter)}
                    disabled={usedLetters.includes(letter)}
                    className={`
                      aspect-square text-xl font-bold rounded-xl transition-all duration-200
                      ${usedLetters.includes(letter)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white cursor-pointer hover:scale-105 shadow-lg'
                      }
                    `}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playing Phase */}
        {gameState === 'playing' && (
          <div className="space-y-8">
            {/* Game Header */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg text-center">
              <div className="text-6xl font-bold text-green-600 mb-4">{selectedLetter}</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Time Left: {timeLeft}s
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-4">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeLeft / 60) * 100}%` }}
                ></div>
              </div>
              {isCurrentLeader && (
                <button
                  onClick={stopRound}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg"
                >
                  ⏹️ Stop Round
                </button>
              )}
            </div>

            {/* Answer Form */}
            {canPlay && !hasSubmitted && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Your Answers (starting with "{selectedLetter}")
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {categories.map(category => (
                    <div key={category.id}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {category.label}
                      </label>
                      <input
                        type="text"
                        value={currentAnswers[category.id]}
                        onChange={(e) => setCurrentAnswers(prev => ({
                          ...prev,
                          [category.id]: e.target.value
                        }))}
                        placeholder={category.placeholder}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                                 bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                                 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={submitAnswers}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 
                           text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
                >
                  Submit Answers
                </button>
              </div>
            )}

            {hasSubmitted && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg text-center">
                <div className="text-green-600 text-4xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Answers Submitted!
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Waiting for other players or time to run out...
                </p>
              </div>
            )}

            {/* Players Status */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Players Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePlayers.map(player => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {player.name}
                      {player.id === currentPlayer?.id && ' (You)'}
                    </span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      playerAnswers[player.id] 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {playerAnswers[player.id] ? 'Submitted' : 'Thinking...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Review Phase */}
        {gameState === 'reviewing' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-8">
              Round {gameSession.current_round} Results - Letter "{selectedLetter}"
            </h2>
            
            {/* Scores */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Round Scores</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePlayers.map(player => (
                  <div key={player.id} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-900 dark:text-white">{player.name}</span>
                      <div className="text-right">
                        <div className="font-bold text-green-600">+{roundScores[player.id] || 0}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Total: {scores[player.id] || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Answers with Point Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {activePlayers.map(player => (
                <div key={player.id} className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                    {player.name}'s Answers
                  </h3>
                  {categories.map(category => {
                    const breakdown = scoreBreakdowns[player.id]?.[category.id];
                    const answer = playerAnswers[player.id]?.[category.id] || 'No answer';
                    return (
                      <div key={category.id} className="mb-3 p-3 bg-white dark:bg-slate-600 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {category.label}:
                            </span>
                            <div className="text-slate-900 dark:text-white font-medium">
                              {answer}
                            </div>
                            {breakdown && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {breakdown.reason}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`font-bold ${(breakdown?.points || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {breakdown?.points || 0} pts
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="text-center space-y-4">
              <button
                onClick={nextRound}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 
                         text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
              >
                Next Round
              </button>
              
              {/* Only room creator (first player) can end game early */}
              {currentPlayer && activePlayers[0]?.id === currentPlayer.id && (
                <div>
                  <button
                    onClick={endGame}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg"
                  >
                    End Game Early
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final Results */}
        {gameState === 'finished' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-8">
              🏆 Final Results
            </h2>
            
            {/* Overall Winner */}
            {(() => {
              const winner = activePlayers.reduce((prev, current) => 
                (scores[current.id] || 0) > (scores[prev.id] || 0) ? current : prev
              );
              const winnerScore = scores[winner.id] || 0;
              const hasWinner = winnerScore > 0;
              
              return (
                <div className="text-center mb-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-yellow-200 dark:border-yellow-800">
                  <div className="text-6xl mb-4">🏆</div>
                  {hasWinner ? (
                    <>
                      <h3 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                        Winner: {winner.name}!
                      </h3>
                      <p className="text-lg text-yellow-700 dark:text-yellow-300">
                        Total Score: {winnerScore} points
                      </p>
                    </>
                  ) : (
                    <h3 className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                      No Winner - No points scored!
                    </h3>
                  )}
                </div>
              );
            })()}
            
            {/* Final Leaderboard */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 text-center">Final Leaderboard</h3>
              <div className="space-y-3">
                {activePlayers
                  .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                  .map((player, index) => (
                    <div key={player.id} className={`p-4 rounded-lg flex justify-between items-center ${
                      index === 0 
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/40 dark:to-yellow-800/40 border-2 border-yellow-300 dark:border-yellow-600'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40'
                        : 'bg-slate-50 dark:bg-slate-700'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{player.name}</span>
                        {player.id === currentPlayer?.id && <span className="text-sm text-slate-600 dark:text-slate-400">(You)</span>}
                      </div>
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {scores[player.id] || 0} pts
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Game Stats */}
            <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 text-center">Game Statistics</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{gameSession.current_round}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Rounds Played</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{usedLetters.length}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Letters Used</div>
                </div>
              </div>
              {usedLetters.length > 0 && (
                <div className="mt-4 text-center">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Letters Played:</div>
                  <div className="text-lg font-mono font-bold text-slate-900 dark:text-white">
                    {usedLetters.join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="text-center space-y-4">
              <button
                onClick={backToLobby}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                         text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
              >
                🏠 Back to Lobby
              </button>
              
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
