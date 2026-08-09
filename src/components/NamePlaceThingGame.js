'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { batchValidateWords } from '@/lib/wordValidation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CircleAlert, CircleStop, Flag,
  Hourglass, House, Loader, PencilLine, Send, Timer, Trophy
} from 'lucide-react';

const CATEGORIES = [
  { id: 'name', label: 'Name', placeholder: 'e.g., Alice, Bob' },
  { id: 'place', label: 'Place', placeholder: 'e.g., Amsterdam, Boston' },
  { id: 'animal', label: 'Animal', placeholder: 'e.g., Ant, Bear' },
  { id: 'thing', label: 'Thing', placeholder: 'e.g., Apple, Book' }
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const EMPTY_ANSWERS = { name: '', place: '', animal: '', thing: '' };

const POINTS = {
  UNIQUE_VALID: 15,
  SHARED_VALID: 10,
  UNIQUE_UNVERIFIED: 5,
  SHARED_UNVERIFIED: 3
};

export default function NamePlaceThingGame({ room, players, currentPlayer, gameSession }) {
  const [round, setRound] = useState(null);
  const [answersByPlayer, setAnswersByPlayer] = useState({});
  const [myAnswers, setMyAnswers] = useState(EMPTY_ANSWERS);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [totalScores, setTotalScores] = useState({});
  const [roundScores, setRoundScores] = useState({});
  const [breakdowns, setBreakdowns] = useState({});
  const [playedLetters, setPlayedLetters] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [isScoring, setIsScoring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error

  const roundNumber = gameSession.current_round;
  const scoringRef = useRef(false);
  // Which round's answers are already loaded into the form, so background
  // refreshes never overwrite what the player is currently typing.
  const hydratedRoundRef = useRef(null);
  const currentPlayerId = currentPlayer?.id;

  // Autosave bookkeeping: only save what the player actually typed, and keep
  // the latest values reachable from effects that must flush immediately.
  const dirtyRef = useRef(false);
  const myAnswersRef = useRef(EMPTY_ANSWERS);
  const doneRef = useRef(false);
  const roundRef = useRef(null);
  myAnswersRef.current = myAnswers;
  doneRef.current = hasSubmitted;
  roundRef.current = round;

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const leader =
    activePlayers.find(p => p.id === (round?.leader_id || gameSession.current_leader_id)) ||
    activePlayers[0];
  const isLeader = !!currentPlayer && leader?.id === currentPlayer.id;
  const isRoomOwner = !!currentPlayer && activePlayers[0]?.id === currentPlayer.id;
  const canPlay = !!currentPlayer && !currentPlayer.is_spectator;

  const isFinished = !!gameSession.round_data?.finished;
  const phase = isFinished
    ? 'finished'
    : !round
      ? 'letter_selection'
      : round.status === 'active'
        ? 'playing'
        : 'reviewing';

  // Letters from earlier rounds cannot be picked again; the full list (this
  // round included) is what the end-of-game stats report.
  const usedLetters = playedLetters
    .filter(entry => entry.roundNumber < roundNumber)
    .map(entry => entry.letter);
  const allLetters = playedLetters.map(entry => entry.letter);

  const letter = round?.letter || '';
  const timeLimit = round?.time_limit || 60;
  const secondsLeft = round?.started_at
    ? Math.max(0, timeLimit - Math.floor((now - new Date(round.started_at).getTime()) / 1000))
    : timeLimit;

  const loadGameData = useCallback(async () => {
    try {
      const [roundResult, lettersResult, scoresResult] = await Promise.all([
        supabase
          .from('rounds')
          .select('*')
          .eq('session_id', gameSession.id)
          .eq('round_number', roundNumber)
          .maybeSingle(),
        supabase
          .from('rounds')
          .select('letter, round_number')
          .eq('session_id', gameSession.id)
          .not('letter', 'is', null),
        supabase
          .from('scores')
          .select('*')
          .eq('session_id', gameSession.id)
      ]);

      const roundData = roundResult.data || null;
      setRound(roundData);

      setPlayedLetters(
        (lettersResult.data || [])
          .sort((a, b) => a.round_number - b.round_number)
          .map(r => ({ letter: r.letter, roundNumber: r.round_number }))
      );

      const totals = {};
      const thisRound = {};
      const thisRoundBreakdowns = {};
      (scoresResult.data || []).forEach(score => {
        totals[score.player_id] = (totals[score.player_id] || 0) + score.round_score;
        if (score.round_number === roundNumber) {
          thisRound[score.player_id] = score.round_score;
          if (score.score_breakdown) {
            thisRoundBreakdowns[score.player_id] = score.score_breakdown;
          }
        }
      });
      setTotalScores(totals);
      setRoundScores(thisRound);
      setBreakdowns(thisRoundBreakdowns);

      if (!roundData) {
        setAnswersByPlayer({});
        setHasSubmitted(false);
        return;
      }

      const { data: answersData } = await supabase
        .from('player_answers')
        .select('*')
        .eq('round_id', roundData.id);

      const answersMap = {};
      (answersData || []).forEach(answer => {
        answersMap[answer.player_id] = answer.answers;
      });
      setAnswersByPlayer(answersMap);

      const mine = currentPlayerId ? answersMap[currentPlayerId] : null;
      setHasSubmitted(!!mine?.submitted);
      if (hydratedRoundRef.current !== roundData.id) {
        hydratedRoundRef.current = roundData.id;
        // `submitted` is metadata, not an answer - keep it out of the form.
        const { submitted, ...answers } = mine || {};
        setMyAnswers({ ...EMPTY_ANSWERS, ...answers });
      }
    } catch (err) {
      console.error('Error loading game data:', err);
      setError('Lost sync with the game. Retrying...');
    }
  }, [gameSession.id, roundNumber, currentPlayerId]);

  // A new round wipes the board clean before its data arrives.
  useEffect(() => {
    setRound(null);
    setAnswersByPlayer({});
    setMyAnswers(EMPTY_ANSWERS);
    setHasSubmitted(false);
    setError('');
    hydratedRoundRef.current = null;
  }, [roundNumber]);

  useEffect(() => {
    loadGameData();
  }, [loadGameData]);

  // Subscriptions call through a ref so a new round does not tear the channel
  // down and reopen it, which would drop events in the gap.
  const loadRef = useRef(loadGameData);
  useEffect(() => {
    loadRef.current = loadGameData;
  }, [loadGameData]);
  const reload = useCallback(() => loadRef.current(), []);

  // Session-level updates: rounds appearing, starting and finishing.
  useEffect(() => {
    const channel = supabase
      .channel(`npt-session-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `session_id=eq.${gameSession.id}`
      }, reload)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scores',
        filter: `session_id=eq.${gameSession.id}`
      }, reload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession.id, reload]);

  // Answers are scoped to a round, so this subscription follows the round id.
  useEffect(() => {
    if (!round?.id) return;

    const channel = supabase
      .channel(`npt-answers-${round.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_answers',
        filter: `round_id=eq.${round.id}`
      }, reload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [round?.id, reload]);

  // Clock for the countdown.
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  /**
   * Writes the current answers to the round. Called on a debounce while typing
   * so a round that ends early still scores whatever is in the boxes - pressing
   * "Done" is only a signal to the others, never what makes answers count.
   *
   * `submitted` rides along inside the answers JSON so no extra column is
   * needed; the scoring loop only ever reads the four category keys.
   */
  const saveAnswers = useCallback(async (answers, submitted) => {
    if (!canPlay || !roundRef.current) return false;

    const { error: writeError } = await supabase
      .from('player_answers')
      .upsert(
        {
          round_id: roundRef.current.id,
          player_id: currentPlayerId,
          answers: { ...answers, submitted }
        },
        { onConflict: 'round_id,player_id' }
      );

    if (writeError) {
      console.error('Error saving answers:', writeError);
      setSaveState('error');
      return false;
    }

    setSaveState('saved');
    setAnswersByPlayer(prev => ({
      ...prev,
      [currentPlayerId]: { ...answers, submitted }
    }));
    return true;
  }, [canPlay, currentPlayerId]);

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (phase !== 'playing' || !canPlay || !dirtyRef.current) return;

    setSaveState('saving');
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      saveAnswers(myAnswersRef.current, doneRef.current);
    }, 500);

    return () => clearTimeout(timer);
  }, [myAnswers, phase, canPlay, saveAnswers]);

  // The round just closed - push anything typed in the last moment straight
  // away rather than waiting out the debounce.
  useEffect(() => {
    if (phase === 'reviewing' && dirtyRef.current) {
      dirtyRef.current = false;
      saveAnswers(myAnswersRef.current, doneRef.current);
    }
  }, [phase, saveAnswers]);

  // "Done" is an explicit choice, not just having typed something - autosaved
  // rows must not make the round end the moment everyone starts typing.
  const submittedCount = activePlayers.filter(p => answersByPlayer[p.id]?.submitted).length;
  const everyoneSubmitted =
    activePlayers.length > 0 && submittedCount === activePlayers.length;

  const endRound = useCallback(async () => {
    if (!round || scoringRef.current) return;

    scoringRef.current = true;
    setIsScoring(true);

    try {
      // Flush our own pending edits first - whoever stops the round would
      // otherwise score themselves before their last keystrokes were saved.
      if (dirtyRef.current) {
        dirtyRef.current = false;
        await saveAnswers(myAnswersRef.current, doneRef.current);
      }

      // Only the client that actually flips the row to completed scores the
      // round, so scores are written exactly once no matter who triggers it.
      const { data: stopped, error: stopError } = await supabase
        .from('rounds')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', round.id)
        .eq('status', 'active')
        .select();

      if (stopError) throw stopError;

      if (stopped && stopped.length > 0) {
        // Other players see the round close and flush whatever they were still
        // typing. Give those writes a moment to arrive before reading answers,
        // otherwise the last second of someone's typing is scored as blank.
        await new Promise(resolve => setTimeout(resolve, 1200));
        await calculateScores(round);
      }

      await loadGameData();
    } catch (err) {
      console.error('Error ending round:', err);
      setError('Could not finish the round. Please try again.');
    } finally {
      scoringRef.current = false;
      setIsScoring(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, loadGameData, saveAnswers]);

  // The round ends when time runs out or everyone has answered. Every client
  // may fire it; the conditional update above keeps it to a single winner.
  useEffect(() => {
    if (phase !== 'playing' || !canPlay) return;
    if (secondsLeft > 0 && !everyoneSubmitted) return;
    endRound();
  }, [phase, canPlay, secondsLeft, everyoneSubmitted, endRound]);

  const calculateScores = async (activeRound) => {
    const { data: allAnswers, error: answersError } = await supabase
      .from('player_answers')
      .select('*')
      .eq('round_id', activeRound.id);

    if (answersError) throw answersError;
    if (!allAnswers || allAnswers.length === 0) return;

    const roundLetter = (activeRound.letter || '').toLowerCase();

    const wordsToValidate = [];
    allAnswers.forEach(playerAnswer => {
      CATEGORIES.forEach(category => {
        const answer = playerAnswer.answers?.[category.id]?.trim();
        if (answer) {
          wordsToValidate.push({
            word: answer,
            category: category.id,
            playerId: playerAnswer.player_id
          });
        }
      });
    });

    const validations = await batchValidateWords(
      wordsToValidate.map(({ word, category }) => ({ word, category }))
    );

    const validationByKey = new Map();
    wordsToValidate.forEach((wordInfo, index) => {
      validationByKey.set(`${wordInfo.playerId}-${wordInfo.category}`, validations[index]);
    });

    const playerScores = {};
    const playerBreakdowns = {};

    allAnswers.forEach(playerAnswer => {
      playerScores[playerAnswer.player_id] = 0;
      playerBreakdowns[playerAnswer.player_id] = {};

      CATEGORIES.forEach(category => {
        const answer = playerAnswer.answers?.[category.id]?.trim();
        const record = (points, reason, extra = {}) => {
          playerScores[playerAnswer.player_id] += points;
          playerBreakdowns[playerAnswer.player_id][category.id] = {
            answer: answer || '',
            points,
            reason,
            ...extra
          };
        };

        if (!answer) return record(0, 'No answer');

        if (answer.charAt(0).toLowerCase() !== roundLetter) {
          return record(0, `Does not start with "${activeRound.letter}"`);
        }

        const validation = validationByKey.get(`${playerAnswer.player_id}-${category.id}`);
        const status = validation?.status || 'unverified';

        if (status === 'not-found' || status === 'wrong-category') {
          return record(0, validation.reason, {
            isValidWord: !!validation.isValid,
            isCorrectCategory: false
          });
        }

        // How many players gave this same answer for this category.
        const duplicates = allAnswers.filter(other =>
          other.answers?.[category.id]?.trim().toLowerCase() === answer.toLowerCase()
        ).length;
        const isUnique = duplicates === 1;

        if (status === 'valid') {
          return record(
            isUnique ? POINTS.UNIQUE_VALID : POINTS.SHARED_VALID,
            isUnique
              ? 'Unique valid answer'
              : `Valid answer, shared with ${duplicates - 1} other${duplicates > 2 ? 's' : ''}`,
            {
              isValidWord: true,
              isCorrectCategory: true,
              definition: validation.definition
            }
          );
        }

        // 'unverified' - we could not check it, so award partial credit.
        return record(
          isUnique ? POINTS.UNIQUE_UNVERIFIED : POINTS.SHARED_UNVERIFIED,
          isUnique
            ? 'Accepted but unverified'
            : `Unverified, shared with ${duplicates - 1} other${duplicates > 2 ? 's' : ''}`,
          { isValidWord: false, isCorrectCategory: false }
        );
      });
    });

    const rows = Object.entries(playerScores).map(([playerId, score]) => ({
      session_id: gameSession.id,
      player_id: playerId,
      round_number: activeRound.round_number,
      round_score: score,
      total_score: score,
      score_breakdown: playerBreakdowns[playerId]
    }));

    const { error: upsertError } = await supabase
      .from('scores')
      .upsert(rows, { onConflict: 'session_id,player_id,round_number' });

    if (upsertError) {
      // Falls back to a plain insert if the unique index has not been applied.
      console.error('Error saving scores, retrying with insert:', upsertError);
      const { error: insertError } = await supabase.from('scores').insert(rows);
      if (insertError) throw insertError;
    }
  };

  const selectLetter = async (chosen) => {
    if (!isLeader || usedLetters.includes(chosen) || busy) return;

    setBusy(true);
    try {
      const { data, error: insertError } = await supabase
        .from('rounds')
        .insert({
          session_id: gameSession.id,
          round_number: roundNumber,
          leader_id: currentPlayer.id,
          letter: chosen,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setRound(data);
      setNow(Date.now());
    } catch (err) {
      console.error('Error selecting letter:', err);
      setError('Could not start the round. Please try again.');
      await loadGameData();
    } finally {
      setBusy(false);
    }
  };

  const markDone = async () => {
    if (!canPlay || !round || phase !== 'playing' || busy) return;

    setBusy(true);
    dirtyRef.current = false;
    setHasSubmitted(true);
    const ok = await saveAnswers(myAnswers, true);
    if (!ok) {
      setHasSubmitted(false);
      setError('Could not save your answers. Please try again.');
    }
    setBusy(false);
  };

  const nextRound = async () => {
    if (!isLeader || busy) return;

    setBusy(true);
    try {
      const nextRoundNumber = roundNumber + 1;
      const nextLeader = activePlayers[(nextRoundNumber - 1) % activePlayers.length];

      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({
          current_round: nextRoundNumber,
          current_leader_id: nextLeader.id
        })
        .eq('id', gameSession.id)
        .eq('current_round', roundNumber);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error proceeding to next round:', err);
      setError('Could not start the next round. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Ends the game for everyone by flagging the session, so all clients show the
  // final results instead of only the player who pressed the button.
  const endGame = async () => {
    if (!isRoomOwner || busy) return;

    setBusy(true);
    try {
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({ round_data: { ...(gameSession.round_data || {}), finished: true } })
        .eq('id', gameSession.id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error ending game:', err);
      setError('Could not end the game. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const backToLobby = async () => {
    if (!isRoomOwner || busy) return;

    setBusy(true);
    try {
      await supabase
        .from('game_sessions')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', gameSession.id);

      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', room.id);
    } catch (err) {
      console.error('Error returning to lobby:', err);
      setError('Could not return to the lobby. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const leaderboard = [...activePlayers].sort(
    (a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0)
  );


  const progress = timeLimit > 0 ? (secondsLeft / timeLimit) * 100 : 0;
  const timeIsShort = secondsLeft <= 10;

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-amber border-2 border-line flex items-center justify-center shrink-0">
              <PencilLine className="w-5 h-5 text-[var(--on-amber)]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-tight truncate">Round {roundNumber}</p>
              <p className="text-xs text-ink-soft font-bold truncate">
                Leader: {leader?.name || '...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="chip hidden sm:inline-flex font-mono">{room.room_code}</span>
            <Link href="/" className="btn btn-quiet btn-sm">
              <House className="w-4 h-4" strokeWidth={3} />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <p className="mb-6 flex items-center gap-2 text-sm font-bold text-coral">
            <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}

        {/* Letter selection */}
        {phase === 'letter_selection' && (
          <div className="card p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl mb-2">
                {isLeader ? 'Pick a letter' : `Waiting for ${leader?.name || 'the leader'}`}
              </h1>
              <p className="text-ink-soft">
                {isLeader
                  ? 'Everyone answers with words starting with your letter.'
                  : 'They are choosing the letter for this round.'}
              </p>
            </div>

            {usedLetters.length > 0 && (
              <p className="text-center text-sm text-ink-soft font-bold mb-6">
                Already played: {usedLetters.join(' · ')}
              </p>
            )}

            {isLeader ? (
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 sm:gap-3">
                {ALPHABET.map(option => {
                  const used = usedLetters.includes(option);
                  return (
                    <button
                      key={option}
                      onClick={() => selectLetter(option)}
                      disabled={used || busy}
                      className={`tile aspect-square text-lg font-extrabold
                                  ${used ? 'tile-dead cursor-not-allowed' : 'tile-active cursor-pointer'}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-center py-6">
                <Loader className="w-8 h-8 animate-spin text-ink-soft" strokeWidth={2.5} />
              </div>
            )}
          </div>
        )}

        {/* Playing */}
        {phase === 'playing' && (
          <div className="space-y-6">
            {/* Letter + timer */}
            <div className="card p-6">
              <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
                <span className="w-20 h-20 rounded-xl bg-amber border-2 border-line shrink-0
                                 flex items-center justify-center text-5xl font-extrabold text-[var(--on-amber)]">
                  {letter}
                </span>

                <div className="grow min-w-[12rem]">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`chip ${timeIsShort ? 'chip-coral' : 'chip-teal'}`}>
                      <Timer className="w-4 h-4" strokeWidth={2.5} />
                      {secondsLeft}s left
                    </span>
                    <span className="text-sm font-bold text-ink-soft">
                      {submittedCount}/{activePlayers.length} in
                    </span>
                  </div>
                  <div className="h-4 border-2 border-line rounded-full bg-sunken overflow-hidden">
                    <div
                      className={`h-full ${timeIsShort ? 'bg-coral' : 'bg-leaf'}`}
                      style={{ width: `${progress}%`, transition: 'width 1s linear' }}
                    />
                  </div>
                </div>

                {isLeader && (
                  <button onClick={endRound} disabled={isScoring} className="btn btn-coral shrink-0">
                    <CircleStop className="w-4 h-4" strokeWidth={3} />
                    Stop
                  </button>
                )}
              </div>
            </div>

            {/* Answers */}
            {canPlay && (
              <div className="card p-6">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="text-xl">
                    Words starting with <span className="text-amber">{letter}</span>
                  </h2>
                  <span className="text-xs font-bold text-ink-soft flex items-center gap-1.5">
                    {saveState === 'error' ? (
                      <><CircleAlert className="w-3.5 h-3.5 text-coral" strokeWidth={2.5} />Not saved</>
                    ) : saveState === 'saving' ? (
                      <><Loader className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />Saving</>
                    ) : saveState === 'saved' ? (
                      <><Check className="w-3.5 h-3.5" strokeWidth={2.5} />Saved</>
                    ) : (
                      <>Saved automatically</>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  {CATEGORIES.map(category => (
                    <label key={category.id} className="block">
                      <span className="block text-sm font-extrabold mb-1.5">{category.label}</span>
                      <input
                        type="text"
                        value={myAnswers[category.id]}
                        onChange={(e) => {
                          dirtyRef.current = true;
                          setMyAnswers(prev => ({
                            ...prev,
                            [category.id]: e.target.value
                          }));
                        }}
                        placeholder={category.placeholder}
                        className="field"
                      />
                    </label>
                  ))}
                </div>
                <button
                  onClick={markDone}
                  disabled={busy || hasSubmitted}
                  className="btn btn-leaf btn-lg w-full"
                >
                  {hasSubmitted
                    ? <><Check className="w-5 h-5" strokeWidth={3} />Waiting for the others</>
                    : <><Send className="w-5 h-5" strokeWidth={3} />I&apos;m done</>}
                </button>
                <p className="mt-3 text-sm text-center text-ink-soft font-semibold">
                  {hasSubmitted
                    ? 'Keep editing if you think of something better - changes still count.'
                    : 'Your answers are saved as you type, so nothing is lost if the round ends early.'}
                </p>
              </div>
            )}

            {/* Who has answered */}
            <div className="card p-6">
              <h2 className="text-lg mb-4">Players</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePlayers.map(player => {
                  const entry = answersByPlayer[player.id];
                  const done = !!entry?.submitted;
                  const typing = !done && !!entry;
                  return (
                    <li key={player.id} className="panel p-3 flex items-center justify-between gap-3">
                      <span className="font-bold truncate">
                        {player.name}
                        {player.id === currentPlayer?.id && (
                          <span className="text-ink-soft font-semibold"> (you)</span>
                        )}
                      </span>
                      <span className={`chip shrink-0 ${done ? 'chip-leaf' : typing ? 'chip-teal' : 'chip-amber'}`}>
                        {done
                          ? <><Check className="w-3.5 h-3.5" strokeWidth={3} />Done</>
                          : typing
                            ? <><PencilLine className="w-3.5 h-3.5" strokeWidth={2.5} />Writing</>
                            : <><Hourglass className="w-3.5 h-3.5" strokeWidth={2.5} />Thinking</>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Review */}
        {phase === 'reviewing' && (
          <div className="space-y-6">
            <div className="card p-6 text-center">
              <span className="chip chip-amber mb-3">Round {roundNumber}</span>
              <h1 className="text-3xl">
                Results for <span className="text-amber">{letter}</span>
              </h1>
            </div>

            {isScoring && (
              <div className="card p-5 flex items-center gap-4">
                <Loader className="w-6 h-6 animate-spin shrink-0" strokeWidth={2.5} />
                <div>
                  <p className="font-extrabold">Checking every word...</p>
                  <p className="text-sm text-ink-soft">Looking answers up in the dictionary.</p>
                </div>
              </div>
            )}

            {/* Scores this round */}
            <div className="card p-6">
              <h2 className="text-lg mb-4">Scores</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {leaderboard.map(player => (
                  <li key={player.id} className="panel p-4 flex items-center justify-between gap-3">
                    <span className="font-bold truncate">{player.name}</span>
                    <span className="text-right shrink-0">
                      <span className="block font-extrabold text-leaf">
                        +{roundScores[player.id] || 0}
                      </span>
                      <span className="block text-xs text-ink-soft font-bold">
                        {totalScores[player.id] || 0} total
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Per-answer breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePlayers.map(player => (
                <div key={player.id} className="card p-5">
                  <h2 className="text-base mb-3">{player.name}</h2>
                  <ul className="space-y-2">
                    {CATEGORIES.map(category => {
                      const breakdown = breakdowns[player.id]?.[category.id];
                      const answer = answersByPlayer[player.id]?.[category.id];
                      const points = breakdown?.points || 0;

                      return (
                        <li key={category.id} className="panel p-3">
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <span className="block text-xs uppercase tracking-wide font-extrabold text-ink-soft">
                                {category.label}
                              </span>
                              <span className="block font-bold truncate">
                                {answer || <span className="text-ink-soft font-semibold">-</span>}
                              </span>
                              {breakdown && (
                                <span className="block text-xs text-ink-soft font-semibold mt-0.5">
                                  {breakdown.reason}
                                </span>
                              )}
                            </div>
                            <span className={`chip shrink-0 ${points > 0 ? 'chip-leaf' : 'chip-coral'}`}>
                              {points}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Scoring key */}
            <div className="panel p-5">
              <h2 className="text-sm mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" strokeWidth={2.5} />
                How points work
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink-soft font-semibold">
                <li><b className="text-ink">{POINTS.UNIQUE_VALID}</b> - unique and verified</li>
                <li><b className="text-ink">{POINTS.SHARED_VALID}</b> - verified, someone else had it too</li>
                <li><b className="text-ink">{POINTS.UNIQUE_UNVERIFIED}</b> - unique but unverified</li>
                <li><b className="text-ink">{POINTS.SHARED_UNVERIFIED}</b> - unverified and shared</li>
                <li className="sm:col-span-2">
                  <b className="text-ink">0</b> - wrong letter, not a real word, or wrong category
                </li>
              </ul>
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isLeader ? (
                <button onClick={nextRound} disabled={busy} className="btn btn-leaf btn-lg grow">
                  <ArrowRight className="w-5 h-5" strokeWidth={3} />
                  Next round
                </button>
              ) : (
                <p className="panel p-4 grow text-sm font-bold text-ink-soft flex items-center gap-2">
                  <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  Waiting for {leader?.name} to start the next round
                </p>
              )}

              {isRoomOwner && (
                <button onClick={endGame} disabled={busy} className="btn btn-quiet shrink-0">
                  <Flag className="w-4 h-4" strokeWidth={3} />
                  End game
                </button>
              )}
            </div>
          </div>
        )}

        {/* Final results */}
        {phase === 'finished' && (
          <div className="space-y-6">
            <div className="card p-8 text-center">
              <span className="w-16 h-16 rounded-xl bg-amber border-2 border-line mx-auto mb-4
                               flex items-center justify-center">
                <Trophy className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />
              </span>
              {(totalScores[leaderboard[0]?.id] || 0) > 0 ? (
                <>
                  <h1 className="text-3xl mb-1">{leaderboard[0]?.name} wins</h1>
                  <p className="text-ink-soft font-bold">
                    {totalScores[leaderboard[0]?.id] || 0} points over {roundNumber} rounds
                  </p>
                </>
              ) : (
                <h1 className="text-2xl">Nobody scored a point</h1>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">Final standings</h2>
              <ul className="space-y-3">
                {leaderboard.map((player, index) => (
                  <li
                    key={player.id}
                    className={`panel p-4 flex items-center gap-3 ${index === 0 ? 'bg-amber-soft' : ''}`}
                  >
                    <span className="w-9 h-9 rounded-lg bg-surface border-2 border-line shrink-0
                                     flex items-center justify-center font-extrabold text-sm">
                      {index + 1}
                    </span>
                    <span className="font-bold grow truncate">
                      {player.name}
                      {player.id === currentPlayer?.id && (
                        <span className="text-ink-soft font-semibold"> (you)</span>
                      )}
                    </span>
                    <span className="font-extrabold shrink-0">{totalScores[player.id] || 0}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">Game summary</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="panel p-4">
                  <p className="text-3xl font-extrabold">{roundNumber}</p>
                  <p className="text-sm text-ink-soft font-bold">Rounds played</p>
                </div>
                <div className="panel p-4">
                  <p className="text-3xl font-extrabold">{allLetters.length}</p>
                  <p className="text-sm text-ink-soft font-bold">Letters used</p>
                </div>
              </div>
              {allLetters.length > 0 && (
                <p className="mt-4 font-mono font-bold tracking-widest text-center">
                  {allLetters.join(' · ')}
                </p>
              )}
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isRoomOwner ? (
                <button onClick={backToLobby} disabled={busy} className="btn btn-leaf btn-lg grow">
                  <ArrowLeft className="w-5 h-5" strokeWidth={3} />
                  Back to lobby
                </button>
              ) : (
                <p className="panel p-4 grow text-sm font-bold text-ink-soft flex items-center gap-2">
                  <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  Waiting for {activePlayers[0]?.name} to return everyone to the lobby
                </p>
              )}
              <Link href="/" className="btn btn-quiet shrink-0">
                <House className="w-4 h-4" strokeWidth={3} />
                All games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
