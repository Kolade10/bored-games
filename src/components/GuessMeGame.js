'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, selectQuestions } from '@/lib/guessMe/index.js';
import { questionFor } from '@/lib/guessMe/perspective.js';
import Link from 'next/link';
import {
  ArrowRight, Brain, Check, CircleAlert, Clapperboard, Flame, Frown, Heart,
  Hourglass, House, Laugh, Lightbulb, Loader, MapPin, Music, PartyPopper,
  Plane, Play, Send, Sparkles, Trophy, Utensils, Wallet, X
} from 'lucide-react';

const CLOSENESS_LABEL = {
  exact: 'Spot on',
  'very-close': 'Very close',
  close: 'Close',
  far: 'Not this time'
};

const CATEGORY_ICONS = {
  Heart, Brain, Laugh, Utensils, Music, Clapperboard, Plane, Wallet, Sparkles, MapPin
};

const CategoryIcon = ({ category, className }) => {
  const Icon = CATEGORY_ICONS[CATEGORIES[category]?.icon] || Heart;
  return <Icon className={className} strokeWidth={2.5} />;
};

const DifficultyDot = ({ difficulty }) => (
  <span className={`w-2 h-2 rounded-full ${DIFFICULTIES[difficulty]?.tone || 'bg-sunken'}`} />
);

/**
 * Options like "who is the better driver" are stored as {answerer}/{partner}
 * tokens and shown as the two players' actual names. Both sides therefore see
 * and submit the same value, so the answerer picking themselves and the guesser
 * picking that same person counts as a match - which "Me"/"You" wording could
 * never do.
 */
const resolveTokens = (value, answererName, guesserName) =>
  String(value ?? '')
    .replace('{answerer}', answererName)
    .replace('{partner}', guesserName);

export default function GuessMeGame({ room, players, currentPlayer, gameSession }) {
  const [rounds, setRounds] = useState([]);
  const [answersById, setAnswersById] = useState({});
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Owner setup
  const [roundCount, setRoundCount] = useState(10);
  const [chosenCategories, setChosenCategories] = useState([]);

  const roundNumber = gameSession.current_round || 1;

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const me = currentPlayer && !currentPlayer.is_spectator ? currentPlayer : null;
  const isRoomOwner = !!me && activePlayers[0]?.id === me.id;
  const nameOf = (id) => activePlayers.find(p => p.id === id)?.name || 'your partner';

  const round = rounds.find(r => r.round_number === roundNumber) || null;
  const question = round?.question || null;
  const gameOver = !!gameSession.round_data?.finished || (rounds.length > 0 && roundNumber > rounds.length);

  const iAnswer = !!me && round?.answerer_id === me.id;
  const iGuess = !!me && round?.guesser_id === me.id;

  // Both players see the same two names, so there is no "me"/"you" confusion.
  const label = (value) =>
    round ? resolveTokens(value, nameOf(round.answerer_id), nameOf(round.guesser_id)) : String(value ?? '');

  const stage = !round
    ? 'setup'
    : round.resolved
      ? 'revealed'
      : round.needs_adjudication
        ? 'adjudicating'
        : !round.answered_at
          ? 'answering'
          : 'guessing';

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('guessme_rounds')
      .select('id, session_id, round_number, question_id, question, answerer_id, guesser_id, answered_at, guess, guessed_at, is_match, closeness, points, needs_adjudication, resolved')
      .eq('session_id', gameSession.id)
      .order('round_number');

    if (loadError) {
      console.error('Error loading rounds:', loadError);
      setError('Could not load the game. Has migration 7 been run?');
      return;
    }

    setRounds(data || []);

    // Answers are only released for rounds that are already settled.
    const { data: revealed } = await supabase
      .rpc('guessme_reveal', { p_session_id: gameSession.id });
    if (Array.isArray(revealed)) {
      setAnswersById(Object.fromEntries(revealed.map(r => [r.round_number, r.answer])));
    }
  }, [gameSession.id]);

  useEffect(() => {
    load();
  }, [load, roundNumber]);

  useEffect(() => {
    const channel = supabase
      .channel(`guessme-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'guessme_rounds',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession.id, load]);

  useEffect(() => {
    setDraft('');
    setError('');
  }, [roundNumber, stage]);

  const startGame = async () => {
    if (!isRoomOwner || busy) return;
    if (activePlayers.length < 2) {
      setError('Guess Me needs both of you here.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const picked = selectQuestions({ rounds: roundCount, categories: chosenCategories });
      const [a, b] = activePlayers;

      const rows = picked.map((q, index) => ({
        session_id: gameSession.id,
        round_number: index + 1,
        question_id: q.id,
        question: q,
        // Roles alternate so both answer and guess an equal number of times.
        answerer_id: index % 2 === 0 ? a.id : b.id,
        guesser_id: index % 2 === 0 ? b.id : a.id
      }));

      const { error: insertError } = await supabase.from('guessme_rounds').insert(rows);
      if (insertError) throw insertError;

      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ current_round: 1, max_rounds: rows.length })
        .eq('id', gameSession.id);
      if (sessionError) throw sessionError;

      await load();
    } catch (err) {
      console.error('Error starting Guess Me:', err);
      setError('Could not start the game. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (value) => {
    const payload = String(value ?? draft).trim();
    if (!me || !payload || busy) return;

    setBusy(true);
    setError('');

    const fn = iAnswer ? 'guessme_submit_answer' : 'guessme_submit_guess';
    const args = iAnswer
      ? { p_session_id: gameSession.id, p_round_number: roundNumber, p_player_id: me.id, p_answer: payload }
      : { p_session_id: gameSession.id, p_round_number: roundNumber, p_player_id: me.id, p_guess: payload };

    const { data, error: rpcError } = await supabase.rpc(fn, args);

    if (rpcError) {
      console.error('Error submitting:', rpcError);
      setError('Could not send that. Please try again.');
    } else if (!data?.ok) {
      setError(data?.error || 'That was not accepted.');
    } else {
      if (data.answer) {
        setAnswersById(prev => ({ ...prev, [roundNumber]: data.answer }));
      }
      setDraft('');
      await load();
    }

    setBusy(false);
  };

  const adjudicate = async (accepted) => {
    if (!me || busy) return;
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('guessme_adjudicate', {
      p_session_id: gameSession.id,
      p_round_number: roundNumber,
      p_player_id: me.id,
      p_accepted: accepted
    });
    if (rpcError || !data?.ok) {
      setError(data?.error || 'Could not record that.');
    } else {
      await load();
    }
    setBusy(false);
  };

  const advance = async () => {
    if (!isRoomOwner || busy) return;
    setBusy(true);
    try {
      if (roundNumber >= rounds.length) {
        await supabase
          .from('game_sessions')
          .update({ round_data: { ...(gameSession.round_data || {}), finished: true } })
          .eq('id', gameSession.id);
      } else {
        await supabase
          .from('game_sessions')
          .update({ current_round: roundNumber + 1 })
          .eq('id', gameSession.id);
      }
    } catch (err) {
      console.error('Error advancing:', err);
      setError('Could not move on.');
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
    } finally {
      setBusy(false);
    }
  };

  // ---- stats -------------------------------------------------------------
  const stats = useMemo(() => {
    const resolved = rounds.filter(r => r.resolved);
    const scores = {};
    const streaks = {};
    const best = {};
    let longestStreak = 0;
    let perfectMatches = 0;
    const running = {};

    activePlayers.forEach(p => { scores[p.id] = 0; streaks[p.id] = 0; running[p.id] = 0; });

    resolved
      .sort((a, b) => a.round_number - b.round_number)
      .forEach(r => {
        scores[r.guesser_id] = (scores[r.guesser_id] || 0) + (r.points || 0);
        if (r.is_match) {
          perfectMatches++;
          running[r.guesser_id] = (running[r.guesser_id] || 0) + 1;
          longestStreak = Math.max(longestStreak, running[r.guesser_id]);
          streaks[r.guesser_id] = running[r.guesser_id];
          const cat = r.question?.category;
          if (cat) best[cat] = (best[cat] || 0) + 1;
        } else {
          running[r.guesser_id] = 0;
          streaks[r.guesser_id] = 0;
        }
      });

    const matchRate = resolved.length
      ? Math.round((resolved.filter(r => r.is_match).length / resolved.length) * 100)
      : 0;
    const bestCategory = Object.entries(best).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const missed = resolved.filter(r => !r.is_match);

    return {
      scores, streaks, longestStreak, perfectMatches, matchRate, bestCategory,
      resolvedCount: resolved.length,
      hardest: missed[missed.length - 1]?.question?.text || null
    };
  }, [rounds, activePlayers]);

  const myStreak = me ? stats.streaks[me.id] || 0 : 0;
  const leaderboard = [...activePlayers].sort((a, b) => (stats.scores[b.id] || 0) - (stats.scores[a.id] || 0));

  // ---- inputs ------------------------------------------------------------
  const renderInput = () => {
    if (!question) return null;
    const options = question.options || [];

    if (['multiple_choice', 'this_or_that', 'yes_no'].includes(question.type)) {
      return (
        <div className={`grid gap-3 ${question.type === 'multiple_choice' ? 'sm:grid-cols-2' : 'grid-cols-2'}`}>
          {options.map(option => (
            <button
              key={option}
              onClick={() => submit(option)}
              disabled={busy}
              className="tile tile-active cursor-pointer min-h-16 px-4 py-3 text-left font-bold justify-start"
            >
              {label(option)}
            </button>
          ))}
        </div>
      );
    }

    if (question.type === 'slider') {
      const value = draft === '' ? 50 : Number(draft);
      return (
        <div className="space-y-4">
          <input
            type="range" min="0" max="100" value={value}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full"
          />
          <div className="flex justify-between text-xs font-bold text-ink-soft">
            <span>{question.labels?.[0]}</span>
            <span className="text-2xl font-extrabold text-ink">{value}</span>
            <span>{question.labels?.[1]}</span>
          </div>
          <button onClick={() => submit(String(value))} disabled={busy} className="btn btn-amber btn-lg w-full">
            <Send className="w-5 h-5" strokeWidth={3} />
            Lock it in
          </button>
        </div>
      );
    }

    if (question.type === 'number') {
      return (
        <div className="space-y-4">
          <input
            type="number"
            min={question.min} max={question.max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`${question.min} - ${question.max}`}
            className="field text-center text-2xl font-extrabold"
          />
          {question.unit && (
            <p className="text-center text-sm font-bold text-ink-soft">{question.unit}</p>
          )}
          <button onClick={() => submit()} disabled={busy || draft === ''} className="btn btn-amber btn-lg w-full">
            <Send className="w-5 h-5" strokeWidth={3} />
            Lock it in
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) submit(); }}
          placeholder="Type your answer..."
          maxLength={80}
          className="field"
        />
        <button onClick={() => submit()} disabled={busy || !draft.trim()} className="btn btn-amber btn-lg w-full">
          <Send className="w-5 h-5" strokeWidth={3} />
          Lock it in
        </button>
      </div>
    );
  };

  const waiting = (text) => (
    <div className="card p-8 text-center">
      <Hourglass className="w-8 h-8 mx-auto mb-3 text-ink-soft" strokeWidth={2.5} />
      <p className="font-extrabold">{text}</p>
      <p className="text-sm text-ink-soft font-semibold mt-1">No peeking.</p>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-coral border-2 border-line flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 text-[var(--on-coral)]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-tight truncate">
                {rounds.length ? `Round ${Math.min(roundNumber, rounds.length)} of ${rounds.length}` : 'Guess Me'}
              </p>
              <p className="text-xs text-ink-soft font-bold font-mono truncate">{room.room_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {myStreak >= 3 && !gameOver && (
              <span className="chip chip-coral">
                <Flame className="w-4 h-4" strokeWidth={2.5} />
                {myStreak}
              </span>
            )}
            <Link href="/" className="btn btn-quiet btn-sm">
              <House className="w-4 h-4" strokeWidth={3} />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <p className="mb-5 flex items-center gap-2 text-sm font-bold text-coral">
            <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}

        {/* Setup */}
        {stage === 'setup' && !gameOver && (
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl mb-2">
              {isRoomOwner ? 'How well do you know each other?' : 'Waiting to start'}
            </h1>
            <p className="text-ink-soft mb-6">
              One of you answers about yourself, the other tries to predict it. Roles swap every round.
            </p>

            {isRoomOwner ? (
              <div className="space-y-6">
                <div>
                  <span className="block text-sm font-extrabold mb-2">Game length</span>
                  <div className="grid grid-cols-4 gap-2">
                    {ROUND_OPTIONS.map(({ rounds: n, label }) => (
                      <button
                        key={n}
                        onClick={() => setRoundCount(n)}
                        className={`tile h-16 flex-col gap-0.5 font-extrabold ${
                          roundCount === n ? 'bg-coral text-[var(--on-coral)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        <span className="text-lg">{n}</span>
                        <span className="text-[0.6rem] uppercase tracking-wide">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-extrabold mb-2">
                    Categories <span className="text-ink-soft font-semibold">(all if none picked)</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORIES).map(([id, meta]) => {
                      const on = chosenCategories.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => setChosenCategories(prev =>
                            on ? prev.filter(c => c !== id) : [...prev, id]
                          )}
                          className={`chip cursor-pointer ${on ? 'chip-coral' : ''}`}
                        >
                          <CategoryIcon category={id} className="w-3.5 h-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={startGame} disabled={busy} className="btn btn-coral btn-lg w-full">
                  {busy
                    ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Setting up</>
                    : <><Play className="w-5 h-5" strokeWidth={3} />Start</>}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-ink-soft font-bold">
                <Loader className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                {activePlayers[0]?.name} is setting things up
              </div>
            )}
          </div>
        )}

        {/* A live round */}
        {round && !gameOver && (
          <div className="space-y-5">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="chip chip-coral">
                  <CategoryIcon category={question.category} className="w-3.5 h-3.5" />
                  {CATEGORIES[question.category]?.label}
                </span>
                <span className="chip">
                  <DifficultyDot difficulty={question.difficulty} />
                  {DIFFICULTIES[question.difficulty]?.label}
                </span>
              </div>

              {/* The answerer reads it in the first person; everyone else reads
                  it as a question about them. */}
              <h1 className="text-xl sm:text-2xl mb-2">
                {questionFor(
                  question,
                  iAnswer ? 'answerer' : 'guesser',
                  nameOf(round.answerer_id)
                )}
              </h1>
              <p className="text-sm font-bold text-ink-soft">
                {stage === 'answering' && iAnswer && 'Answer honestly - they have to guess this.'}
                {stage === 'guessing' && iGuess && 'Pick what you think they said.'}
                {stage === 'revealed' && 'Reveal'}
              </p>
            </div>

            {stage === 'answering' && (iAnswer
              ? <div className="card p-6">{renderInput()}</div>
              : waiting(`${nameOf(round.answerer_id)} is answering...`))}

            {stage === 'guessing' && (iGuess
              ? <div className="card p-6">{renderInput()}</div>
              : waiting(`${nameOf(round.guesser_id)} is guessing...`))}

            {stage === 'adjudicating' && (iAnswer ? (
              <div className="card p-6">
                <p className="font-extrabold mb-1">You said</p>
                <p className="text-lg mb-4">{label(answersById[roundNumber]) || '...'}</p>
                <p className="font-extrabold mb-1">{nameOf(round.guesser_id)} guessed</p>
                <p className="text-lg mb-5">{label(round.guess)}</p>
                <p className="text-sm text-ink-soft font-semibold mb-4">Close enough?</p>
                <div className="flex gap-3">
                  <button onClick={() => adjudicate(true)} disabled={busy} className="btn btn-leaf grow">
                    <Check className="w-4 h-4" strokeWidth={3} />That counts
                  </button>
                  <button onClick={() => adjudicate(false)} disabled={busy} className="btn btn-coral grow">
                    <X className="w-4 h-4" strokeWidth={3} />Not quite
                  </button>
                </div>
              </div>
            ) : waiting(`${nameOf(round.answerer_id)} is deciding if that counts...`))}

            {stage === 'revealed' && (
              <>
                <div className={`card p-6 text-center ${round.is_match ? 'bg-leaf-soft' : ''}`}>
                  <div className="flex justify-center mb-3">
                    <span className={`w-14 h-14 rounded-xl border-2 border-line flex items-center justify-center
                                      ${round.is_match ? 'bg-leaf' : 'bg-sunken'}`}>
                      {round.is_match
                        ? <PartyPopper className="w-7 h-7 text-[var(--on-leaf)]" strokeWidth={2.5} />
                        : <Frown className="w-7 h-7 text-ink-soft" strokeWidth={2.5} />}
                    </span>
                  </div>
                  <h2 className="text-2xl mb-4">
                    {round.is_match ? 'MATCH!' : CLOSENESS_LABEL[round.closeness] || 'Missed'}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="panel p-3">
                      <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft mb-1">
                        {nameOf(round.answerer_id)} said
                      </p>
                      <p className="font-bold break-words">{label(answersById[roundNumber]) || '...'}</p>
                    </div>
                    <div className="panel p-3">
                      <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft mb-1">
                        {nameOf(round.guesser_id)} guessed
                      </p>
                      <p className="font-bold break-words">{label(round.guess)}</p>
                    </div>
                  </div>
                  {round.points > 0 && (
                    <p className="mt-4 text-xl font-extrabold text-leaf">+{round.points}</p>
                  )}
                  {stats.streaks[round.guesser_id] >= 3 && (
                    <p className="mt-2 chip chip-coral">
                      <Flame className="w-4 h-4" strokeWidth={2.5} />
                      {stats.streaks[round.guesser_id]} in a row
                    </p>
                  )}
                </div>

                <div className="card p-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {leaderboard.map(p => (
                      <span key={p.id} className="chip">
                        {p.name}: {stats.scores[p.id] || 0}
                      </span>
                    ))}
                  </div>
                  {isRoomOwner ? (
                    <button onClick={advance} disabled={busy} className="btn btn-coral btn-lg w-full">
                      {roundNumber >= rounds.length
                        ? <><Trophy className="w-5 h-5" strokeWidth={3} />See results</>
                        : <><ArrowRight className="w-5 h-5" strokeWidth={3} />Next round</>}
                    </button>
                  ) : (
                    <p className="text-sm font-bold text-ink-soft flex items-center gap-2">
                      <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                      Waiting for {activePlayers[0]?.name}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {gameOver && (
          <div className="space-y-5">
            <div className="card p-8 text-center">
              <div className="flex justify-center mb-4">
                <span className="w-16 h-16 rounded-xl bg-coral border-2 border-line flex items-center justify-center">
                  <Heart className="w-8 h-8 text-[var(--on-coral)]" strokeWidth={2.5} />
                </span>
              </div>
              <h1 className="text-3xl mb-4">
                {(stats.scores[leaderboard[0]?.id] || 0) === (stats.scores[leaderboard[1]?.id] || 0)
                  ? "It's a tie"
                  : `${leaderboard[0]?.name} wins`}
              </h1>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {leaderboard.map(p => (
                  <div key={p.id} className="panel p-4">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="text-3xl font-extrabold">{stats.scores[p.id] || 0}</p>
                  </div>
                ))}
              </div>
              <div className="panel p-5">
                <p className="text-4xl font-extrabold">{stats.matchRate}%</p>
                <p className="text-sm font-bold text-ink-soft">How well you knew each other</p>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">The numbers</h2>
              <ul className="space-y-2 text-sm font-semibold">
                <li className="panel p-3 flex justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Flame className="w-4 h-4" strokeWidth={2.5} />Longest streak
                  </span><b>{stats.longestStreak}</b>
                </li>
                <li className="panel p-3 flex justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Heart className="w-4 h-4" strokeWidth={2.5} />Matches
                  </span><b>{stats.perfectMatches} of {stats.resolvedCount}</b>
                </li>
                {stats.bestCategory && (
                  <li className="panel p-3 flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={stats.bestCategory} className="w-4 h-4" />Best category
                    </span>
                    <b>{CATEGORIES[stats.bestCategory]?.label}</b>
                  </li>
                )}
                {stats.hardest && (
                  <li className="panel p-3">
                    <span className="flex items-center gap-2 text-ink-soft mb-1">
                      <Lightbulb className="w-4 h-4" strokeWidth={2.5} />Tripped you up
                    </span>
                    <b>{stats.hardest}</b>
                  </li>
                )}
              </ul>
              <p className="text-xs text-ink-soft font-semibold mt-4">
                A game statistic, not a verdict on your relationship.
              </p>
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isRoomOwner ? (
                <button onClick={backToLobby} disabled={busy} className="btn btn-coral btn-lg grow">
                  <House className="w-5 h-5" strokeWidth={3} />
                  Back to lobby
                </button>
              ) : (
                <p className="panel p-4 grow text-sm font-bold text-ink-soft flex items-center gap-2">
                  <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  Waiting for {activePlayers[0]?.name}
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
