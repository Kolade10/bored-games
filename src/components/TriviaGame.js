'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchTriviaQuestions, TRIVIA_CATEGORIES, TRIVIA_DIFFICULTIES, TIME_OPTIONS
} from '@/lib/trivia';
import Link from 'next/link';
import {
  ArrowRight, BrainCircuit, Check, CircleAlert, Eye, Flag, Hourglass, House,
  Loader, Play, Timer, Trophy, Users, X
} from 'lucide-react';

const QUESTION_COUNT = 10;

export default function TriviaGame({ room, players, currentPlayer, gameSession }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [myPick, setMyPick] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Owner's setup choices
  const [category, setCategory] = useState('9');
  const [difficulty, setDifficulty] = useState('');
  const [seconds, setSeconds] = useState(15);

  const questionNumber = gameSession.current_round || 1;
  const revealedForRef = useRef(null);

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const me = currentPlayer && !currentPlayer.is_spectator ? currentPlayer : null;
  const isRoomOwner = !!me && activePlayers[0]?.id === me.id;
  const isSolo = activePlayers.length === 1;

  const question = questions.find(q => q.question_number === questionNumber) || null;
  const questionAnswers = answers.filter(a => a.question_number === questionNumber);
  const myAnswer = me ? questionAnswers.find(a => a.player_id === me.id) : null;

  const secondsLeft = question?.started_at
    ? Math.max(0, question.time_limit - Math.floor((now - new Date(question.started_at).getTime()) / 1000))
    : question?.time_limit || 0;

  const everyoneAnswered =
    activePlayers.length > 0 && questionAnswers.length >= activePlayers.length;
  const isClosed = !!question?.started_at && (secondsLeft <= 0 || everyoneAnswered);
  const isLastQuestion = questionNumber >= questions.length;
  const gameOver = !!gameSession.round_data?.finished;

  const phase = gameOver
    ? 'finished'
    : questions.length === 0
      ? 'setup'
      : isClosed
        ? 'revealed'
        : 'playing';

  const load = useCallback(async () => {
    const [questionsResult, answersResult] = await Promise.all([
      supabase
        .from('trivia_questions')
        .select('id, session_id, question_number, question, options, category, difficulty, time_limit, started_at')
        .eq('session_id', gameSession.id)
        .order('question_number'),
      supabase
        .from('trivia_answers')
        .select('*')
        .eq('session_id', gameSession.id)
    ]);

    if (questionsResult.error) {
      console.error('Error loading questions:', questionsResult.error);
      setError('Could not load the quiz. Has migration 6 been run?');
      return;
    }

    setQuestions(questionsResult.data || []);
    setAnswers(answersResult.data || []);
  }, [gameSession.id]);

  useEffect(() => {
    load();
  }, [load, questionNumber]);

  useEffect(() => {
    const channel = supabase
      .channel(`trivia-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trivia_questions',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trivia_answers',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession.id, load]);

  // Clock, only while a question is live.
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [phase]);

  // Fresh question: clear the previous one's local state.
  useEffect(() => {
    setMyPick(null);
    setCorrectAnswer(null);
    revealedForRef.current = null;
  }, [questionNumber]);

  // Once the question closes, ask the server for the answer. Players who
  // answered already got it back from their own submission, but anyone who ran
  // out of time still needs it.
  useEffect(() => {
    if (!isClosed || revealedForRef.current === questionNumber) return;
    revealedForRef.current = questionNumber;

    supabase
      .rpc('trivia_reveal', { p_session_id: gameSession.id, p_question_number: questionNumber })
      .then(({ data, error: revealError }) => {
        if (revealError) {
          console.error('Error revealing answer:', revealError);
          return;
        }
        if (data?.ready) setCorrectAnswer(data.correct_answer);
      });
  }, [isClosed, questionNumber, gameSession.id]);

  const startQuiz = async () => {
    if (!isRoomOwner || busy) return;

    setBusy(true);
    setError('');

    try {
      const fetched = await fetchTriviaQuestions({
        amount: QUESTION_COUNT,
        category,
        difficulty
      });

      const rows = fetched.map((q, index) => ({
        session_id: gameSession.id,
        question_number: index + 1,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        category: q.category,
        difficulty: q.difficulty,
        time_limit: seconds,
        // First question goes live immediately; the rest wait their turn.
        started_at: index === 0 ? new Date().toISOString() : null
      }));

      const { error: insertError } = await supabase.from('trivia_questions').insert(rows);
      if (insertError) throw insertError;

      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ current_round: 1, max_rounds: rows.length })
        .eq('id', gameSession.id);
      if (sessionError) throw sessionError;

      setNow(Date.now());
      await load();
    } catch (err) {
      console.error('Error starting quiz:', err);
      setError(err.message || 'Could not start the quiz.');
    } finally {
      setBusy(false);
    }
  };

  const pickAnswer = async (option) => {
    if (!me || !question || myAnswer || myPick || isClosed || busy) return;

    setMyPick(option);
    setBusy(true);

    const { data, error: rpcError } = await supabase.rpc('trivia_submit_answer', {
      p_session_id: gameSession.id,
      p_player_id: me.id,
      p_question_number: questionNumber,
      p_answer: option
    });

    if (rpcError) {
      console.error('Error submitting answer:', rpcError);
      setError('Could not record your answer.');
      setMyPick(null);
    } else {
      // The server hands back the right answer once your choice is locked.
      if (data?.correct_answer) setCorrectAnswer(data.correct_answer);
      if (!data?.ok && data?.error) setError(data.error);
      await load();
    }

    setBusy(false);
  };

  const nextQuestion = async () => {
    if (!isRoomOwner || busy) return;

    setBusy(true);
    try {
      if (isLastQuestion) {
        const { error: finishError } = await supabase
          .from('game_sessions')
          .update({ round_data: { ...(gameSession.round_data || {}), finished: true } })
          .eq('id', gameSession.id);
        if (finishError) throw finishError;
      } else {
        const next = questionNumber + 1;
        const { error: startError } = await supabase
          .from('trivia_questions')
          .update({ started_at: new Date().toISOString() })
          .eq('session_id', gameSession.id)
          .eq('question_number', next);
        if (startError) throw startError;

        const { error: sessionError } = await supabase
          .from('game_sessions')
          .update({ current_round: next })
          .eq('id', gameSession.id);
        if (sessionError) throw sessionError;

        setNow(Date.now());
      }
    } catch (err) {
      console.error('Error advancing:', err);
      setError('Could not move to the next question.');
    } finally {
      setBusy(false);
    }
  };

  const endGame = async () => {
    if (!isRoomOwner || busy) return;
    setBusy(true);
    try {
      await supabase
        .from('game_sessions')
        .update({ round_data: { ...(gameSession.round_data || {}), finished: true } })
        .eq('id', gameSession.id);
    } catch (err) {
      console.error('Error ending game:', err);
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
    } finally {
      setBusy(false);
    }
  };

  const scores = useMemo(() => {
    const tally = {};
    answers.forEach(a => {
      if (a.is_correct) tally[a.player_id] = (tally[a.player_id] || 0) + 1;
    });
    return tally;
  }, [answers]);

  const leaderboard = [...activePlayers].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  const optionTone = (option) => {
    if (!isClosed || !correctAnswer) {
      return myPick === option || myAnswer?.answer === option
        ? 'bg-amber-soft border-ink'
        : 'bg-surface';
    }
    if (option === correctAnswer) return 'bg-leaf text-[var(--on-leaf)]';
    if ((myAnswer?.answer || myPick) === option) return 'bg-coral text-[var(--on-coral)]';
    return 'bg-sunken text-ink-soft';
  };

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-teal border-2 border-line flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5 h-5 text-[var(--on-teal)]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-tight truncate">
                {questions.length > 0 ? `Question ${questionNumber} of ${questions.length}` : 'Trivia'}
              </p>
              <p className="text-xs text-ink-soft font-bold font-mono truncate">{room.room_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isRoomOwner && phase !== 'finished' && questions.length > 0 && (
              <button onClick={endGame} disabled={busy} className="btn btn-coral btn-sm">
                <Flag className="w-4 h-4" strokeWidth={3} />
                <span className="hidden sm:inline">End quiz</span>
              </button>
            )}
            <Link href="/" className="btn btn-quiet btn-sm">
              <House className="w-4 h-4" strokeWidth={3} />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <p className="mb-5 flex items-center gap-2 text-sm font-bold text-coral">
            <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}

        {!me && phase !== 'setup' && (
          <p className="chip mb-5">
            <Eye className="w-4 h-4" strokeWidth={2.5} />
            Watching
          </p>
        )}

        {/* Setup */}
        {phase === 'setup' && (
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl mb-2">
              {isRoomOwner ? 'Set up the quiz' : 'Waiting for the quiz to start'}
            </h1>
            <p className="text-ink-soft mb-6">
              {isRoomOwner
                ? `${QUESTION_COUNT} multiple-choice questions. Everyone sees the same ones in the same order.`
                : `${activePlayers[0]?.name || 'The room owner'} is choosing the category and difficulty.`}
            </p>

            {isRoomOwner ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="block text-sm font-extrabold mb-1.5">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="field"
                  >
                    {TRIVIA_CATEGORIES.map(c => (
                      <option key={c.id || 'any'} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-extrabold mb-1.5">Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="field"
                  >
                    {TRIVIA_DIFFICULTIES.map(d => (
                      <option key={d.id || 'any'} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="block text-sm font-extrabold mb-1.5">Seconds per question</span>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_OPTIONS.map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSeconds(value)}
                        className={`tile h-12 font-extrabold ${
                          seconds === value ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        {value}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panel p-4 text-sm font-semibold text-ink-soft flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  {isSolo
                    ? 'Playing solo - answers are revealed as soon as you pick one.'
                    : `${activePlayers.length} players. A question closes once everyone has answered or the timer runs out.`}
                </div>

                <button onClick={startQuiz} disabled={busy} className="btn btn-teal btn-lg w-full">
                  {busy
                    ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Fetching questions</>
                    : <><Play className="w-5 h-5" strokeWidth={3} />Start quiz</>}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-ink-soft font-bold">
                <Loader className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                Waiting for the room owner
              </div>
            )}
          </div>
        )}

        {/* Question */}
        {(phase === 'playing' || phase === 'revealed') && question && (
          <div className="space-y-5">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <span className="chip chip-teal">{question.category || 'Trivia'}</span>
                <div className="flex items-center gap-2">
                  <span className="chip">{question.difficulty || 'any'}</span>
                  <span className={`chip ${secondsLeft <= 5 && !isClosed ? 'chip-coral' : 'chip-amber'}`}>
                    <Timer className="w-4 h-4" strokeWidth={2.5} />
                    {isClosed ? 'closed' : `${secondsLeft}s`}
                  </span>
                </div>
              </div>

              <div className="h-3 border-2 border-line rounded-full bg-sunken overflow-hidden mb-4">
                <div
                  className={`h-full ${secondsLeft <= 5 && !isClosed ? 'bg-coral' : 'bg-leaf'}`}
                  style={{
                    width: `${question.time_limit ? (secondsLeft / question.time_limit) * 100 : 0}%`,
                    transition: 'width 250ms linear'
                  }}
                />
              </div>

              <h1 className="text-xl sm:text-2xl">{question.question}</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(question.options || []).map(option => {
                const locked = !!myAnswer || !!myPick || isClosed || !me;
                return (
                  <button
                    key={option}
                    onClick={() => pickAnswer(option)}
                    disabled={locked}
                    className={`tile min-h-16 px-4 py-3 text-left font-bold justify-start
                                ${optionTone(option)}
                                ${locked ? 'cursor-default' : 'tile-active cursor-pointer'}`}
                  >
                    <span className="flex items-center gap-2 w-full">
                      {isClosed && correctAnswer === option && (
                        <Check className="w-5 h-5 shrink-0" strokeWidth={3} />
                      )}
                      {isClosed && correctAnswer && correctAnswer !== option &&
                        (myAnswer?.answer || myPick) === option && (
                        <X className="w-5 h-5 shrink-0" strokeWidth={3} />
                      )}
                      <span className="min-w-0">{option}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Who has answered */}
            {!isSolo && (
              <div className="card p-5">
                <h2 className="text-sm mb-3">
                  Answered {questionAnswers.length}/{activePlayers.length}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {activePlayers.map(player => {
                    const theirs = questionAnswers.find(a => a.player_id === player.id);
                    return (
                      <span
                        key={player.id}
                        className={`chip ${
                          !theirs ? 'chip-amber' : isClosed ? (theirs.is_correct ? 'chip-leaf' : 'chip-coral') : 'chip-teal'
                        }`}
                      >
                        {!theirs
                          ? <Hourglass className="w-3.5 h-3.5" strokeWidth={2.5} />
                          : isClosed
                            ? (theirs.is_correct
                                ? <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                : <X className="w-3.5 h-3.5" strokeWidth={3} />)
                            : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        {player.name}
                        {player.id === me?.id && ' (you)'}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === 'revealed' && (
              <div className="card p-5">
                {me && (
                  <p className="font-extrabold mb-3">
                    {!myAnswer
                      ? 'Out of time - no answer recorded.'
                      : myAnswer.is_correct
                        ? 'Correct.'
                        : `Not quite. The answer was ${correctAnswer || '...'}.`}
                  </p>
                )}
                {isRoomOwner ? (
                  <button onClick={nextQuestion} disabled={busy} className="btn btn-leaf btn-lg w-full">
                    {isLastQuestion
                      ? <><Trophy className="w-5 h-5" strokeWidth={3} />See final scores</>
                      : <><ArrowRight className="w-5 h-5" strokeWidth={3} />Next question</>}
                  </button>
                ) : (
                  <p className="text-sm font-bold text-ink-soft flex items-center gap-2">
                    <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                    Waiting for {activePlayers[0]?.name} to continue
                  </p>
                )}
              </div>
            )}

            {/* Running score, hidden in solo where the point is just the questions */}
            {!isSolo && (
              <div className="panel p-4">
                <div className="flex flex-wrap gap-2">
                  {leaderboard.map(player => (
                    <span key={player.id} className="chip">
                      {player.name}: {scores[player.id] || 0}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final */}
        {phase === 'finished' && (
          <div className="space-y-5">
            <div className="card p-8 text-center">
              <span className="w-16 h-16 rounded-xl bg-amber border-2 border-line mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />
              </span>
              {isSolo ? (
                <>
                  <h1 className="text-3xl mb-1">
                    {scores[activePlayers[0]?.id] || 0} out of {answers.length || questions.length}
                  </h1>
                  <p className="text-ink-soft font-bold">Nice work</p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl mb-1">{leaderboard[0]?.name} wins</h1>
                  <p className="text-ink-soft font-bold">
                    {scores[leaderboard[0]?.id] || 0} correct out of {questions.length}
                  </p>
                </>
              )}
            </div>

            {!isSolo && (
              <div className="card p-6">
                <h2 className="text-lg mb-4">Final scores</h2>
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
                        {player.id === me?.id && (
                          <span className="text-ink-soft font-semibold"> (you)</span>
                        )}
                      </span>
                      <span className="font-extrabold shrink-0">
                        {scores[player.id] || 0}/{questions.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isRoomOwner ? (
                <button onClick={backToLobby} disabled={busy} className="btn btn-leaf btn-lg grow">
                  <House className="w-5 h-5" strokeWidth={3} />
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
