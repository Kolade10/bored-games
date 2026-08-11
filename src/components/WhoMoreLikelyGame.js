'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, selectQuestions, hasBonusRound
} from '@/lib/whoMoreLikely/index.js';
import Link from 'next/link';
import {
  ArrowRight, Brain, Clapperboard, Eye, Flame, Heart, Hourglass, House, Laugh,
  Loader, MapPin, Music, Play, Plane, Sparkles, Trophy, Users, Utensils, Wallet
} from 'lucide-react';

const CATEGORY_ICONS = {
  Laugh, Heart, Brain, Wallet, Utensils, Music, Clapperboard, Plane, House, Sparkles, Flame, MapPin
};

const CategoryIcon = ({ category, className }) => {
  const Icon = CATEGORY_ICONS[CATEGORIES[category]?.icon] || Laugh;
  return <Icon className={className} strokeWidth={2.5} />;
};

const SUSPENSE_MS = 1200;

export default function WhoMoreLikelyGame({ room, players, currentPlayer, gameSession }) {
  const [rounds, setRounds] = useState([]);
  const [picks, setPicks] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [suspense, setSuspense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [roundCount, setRoundCount] = useState(10);
  const [chosenCategories, setChosenCategories] = useState([]);

  const roundNumber = gameSession.current_round || 1;
  const shownRef = useRef(null);

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const me = currentPlayer && !currentPlayer.is_spectator ? currentPlayer : null;
  const partner = me ? activePlayers.find(p => p.id !== me.id) : activePlayers[1];
  const isRoomOwner = !!me && activePlayers[0]?.id === me.id;
  const nameOf = (id) => activePlayers.find(p => p.id === id)?.name || 'them';

  const round = rounds.find(r => r.round_number === roundNumber) || null;
  const question = round?.question || null;
  const gameOver = !!gameSession.round_data?.finished || (rounds.length > 0 && roundNumber > rounds.length);

  const roundPicks = picks.filter(p => p.round_number === roundNumber);
  const iPicked = !!me && roundPicks.some(p => p.player_id === me.id);
  const partnerPicked = !!partner && roundPicks.some(p => p.player_id === partner.id);

  const revealedFor = (n) => revealed.filter(r => r.round_number === n);
  const choiceOf = (n, playerId) =>
    revealedFor(n).find(r => r.player_id === playerId)?.chosen_player_id || null;

  const stage = !round
    ? 'setup'
    : round.resolved
      ? (suspense ? 'suspense' : 'revealed')
      : iPicked
        ? 'waiting'
        : 'picking';

  const load = useCallback(async () => {
    const [roundsResult, picksResult] = await Promise.all([
      supabase.from('wml_rounds').select('*').eq('session_id', gameSession.id).order('round_number'),
      supabase
        .from('wml_picks')
        .select('id, session_id, round_number, player_id, picked_at')
        .eq('session_id', gameSession.id)
    ]);

    if (roundsResult.error) {
      console.error('Error loading rounds:', roundsResult.error);
      setError('Could not load the game. Has migration 8 been run?');
      return;
    }

    setRounds(roundsResult.data || []);
    setPicks(picksResult.data || []);

    const { data } = await supabase.rpc('wml_reveal', { p_session_id: gameSession.id });
    if (Array.isArray(data)) setRevealed(data);
  }, [gameSession.id]);

  useEffect(() => {
    load();
  }, [load, roundNumber]);

  useEffect(() => {
    const channel = supabase
      .channel(`wml-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wml_rounds',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wml_picks',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession.id, load]);

  // A beat of "let's see what you both picked" before the answers land.
  useEffect(() => {
    if (!round?.resolved || shownRef.current === roundNumber) return;
    shownRef.current = roundNumber;
    setSuspense(true);
    const timer = setTimeout(() => setSuspense(false), SUSPENSE_MS);
    return () => clearTimeout(timer);
  }, [round?.resolved, roundNumber]);

  useEffect(() => {
    setError('');
  }, [roundNumber]);

  const startGame = async () => {
    if (!isRoomOwner || busy) return;
    if (activePlayers.length < 2) {
      setError('This one needs both of you here.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const picked = selectQuestions({ rounds: roundCount, categories: chosenCategories });
      const bonus = hasBonusRound(picked.length);

      const rows = picked.map((q, index) => ({
        session_id: gameSession.id,
        round_number: index + 1,
        question_id: q.id,
        question: q,
        // Longer games finish on a double-points round.
        double_points: bonus && index === picked.length - 1
      }));

      const { error: insertError } = await supabase.from('wml_rounds').insert(rows);
      if (insertError) throw insertError;

      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ current_round: 1, max_rounds: rows.length })
        .eq('id', gameSession.id);
      if (sessionError) throw sessionError;

      await load();
    } catch (err) {
      console.error('Error starting game:', err);
      setError('Could not start the game. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (chosenPlayerId) => {
    if (!me || busy || iPicked) return;

    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('wml_submit_pick', {
      p_session_id: gameSession.id,
      p_round_number: roundNumber,
      p_player_id: me.id,
      p_chosen_player_id: chosenPlayerId
    });

    if (rpcError) {
      console.error('Error submitting pick:', rpcError);
      setError('Could not send that. Please try again.');
    } else if (!data?.ok) {
      setError(data?.error || 'That was not accepted.');
    }

    await load();
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

  const stats = useMemo(() => {
    const done = rounds.filter(r => r.resolved);
    const matches = done.filter(r => r.matched);
    const byCategory = {};
    done.forEach(r => {
      const c = r.question?.category;
      if (!c) return;
      byCategory[c] = byCategory[c] || { agreed: 0, total: 0 };
      byCategory[c].total++;
      if (r.matched) byCategory[c].agreed++;
    });

    const ranked = Object.entries(byCategory)
      .filter(([, v]) => v.total >= 1)
      .sort((a, b) => (b[1].agreed / b[1].total) - (a[1].agreed / a[1].total));

    const disagreements = done.filter(r => !r.matched);

    return {
      total: rounds.length,
      done: done.length,
      matches: matches.length,
      points: done.reduce((sum, r) => sum + (r.points || 0), 0),
      longestStreak: Math.max(0, ...done.map(r => r.streak_after || 0)),
      percent: done.length ? Math.round((matches.length / done.length) * 100) : 0,
      mostAgreed: ranked[0]?.[0] || null,
      mostDisagreed: ranked.length > 1 ? ranked[ranked.length - 1][0] : null,
      biggestDisagreement: disagreements.find(r => r.question?.difficulty === 'hard')?.question?.text
        || disagreements[disagreements.length - 1]?.question?.text
        || null
    };
  }, [rounds]);

  const currentStreak = useMemo(() => {
    const done = rounds.filter(r => r.resolved && r.round_number <= roundNumber);
    return done.length ? done[done.length - 1].streak_after || 0 : 0;
  }, [rounds, roundNumber]);

  const choiceButton = (player, label, sublabel) => (
    <button
      key={player.id}
      onClick={() => pick(player.id)}
      disabled={busy}
      className="tile tile-active cursor-pointer p-6 flex-col gap-1 min-h-32"
    >
      <span className="text-xl font-extrabold">{label}</span>
      <span className="text-xs font-bold text-ink-soft">{sublabel}</span>
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-amber border-2 border-line flex items-center justify-center shrink-0">
              <Laugh className="w-5 h-5 text-[var(--on-amber)]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-tight truncate">
                {rounds.length ? `Round ${Math.min(roundNumber, rounds.length)} of ${rounds.length}` : "Who's More Likely?"}
              </p>
              <p className="text-xs text-ink-soft font-bold font-mono truncate">{room.room_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentStreak >= 3 && !gameOver && (
              <span className="chip chip-coral">
                <Flame className="w-4 h-4" strokeWidth={2.5} />
                {currentStreak}
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
          <p className="mb-5 text-sm font-bold text-coral">{error}</p>
        )}

        {!me && !gameOver && (
          <p className="chip mb-5">
            <Eye className="w-4 h-4" strokeWidth={2.5} />
            Watching
          </p>
        )}

        {/* Setup */}
        {stage === 'setup' && !gameOver && (
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl mb-2">
              {isRoomOwner ? "Who's more likely?" : 'Waiting to start'}
            </h1>
            <p className="text-ink-soft mb-6">
              You both pick who is more likely, in secret. Then you find out whether
              you see each other the same way.
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
                          roundCount === n ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        <span className="text-lg">{n}</span>
                        <span className="text-[0.6rem] uppercase tracking-wide">{label}</span>
                      </button>
                    ))}
                  </div>
                  {hasBonusRound(roundCount) && (
                    <p className="mt-2 text-xs font-bold text-ink-soft flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Final round is worth double
                    </p>
                  )}
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
                          className={`chip cursor-pointer ${on ? 'chip-amber' : ''}`}
                        >
                          <CategoryIcon category={id} className="w-3.5 h-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={startGame} disabled={busy} className="btn btn-amber btn-lg w-full">
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

        {/* A round */}
        {round && !gameOver && (
          <div className="space-y-5">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="chip chip-amber">
                  <CategoryIcon category={question.category} className="w-3.5 h-3.5" />
                  {CATEGORIES[question.category]?.label}
                </span>
                <span className="chip">
                  <span className={`w-2 h-2 rounded-full ${DIFFICULTIES[question.difficulty]?.tone}`} />
                  {DIFFICULTIES[question.difficulty]?.label}
                </span>
                {round.double_points && (
                  <span className="chip chip-coral">
                    <Flame className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Double points
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl">{question.text}</h1>
            </div>

            {stage === 'picking' && me && partner && (
              <div className="grid grid-cols-2 gap-3">
                {choiceButton(me, 'Me', me.name)}
                {choiceButton(partner, partner.name, 'My partner')}
              </div>
            )}

            {stage === 'picking' && !me && (
              <div className="card p-8 text-center">
                <p className="font-extrabold">They are choosing.</p>
              </div>
            )}

            {stage === 'waiting' && (
              <div className="card p-8 text-center">
                <Hourglass className="w-8 h-8 mx-auto mb-3 text-ink-soft" strokeWidth={2.5} />
                <p className="font-extrabold">Locked in.</p>
                <p className="text-sm text-ink-soft font-semibold mt-1">
                  {partnerPicked ? 'Revealing...' : `Waiting for ${partner?.name || 'your partner'}.`}
                </p>
              </div>
            )}

            {stage === 'suspense' && (
              <div className="card p-8 text-center">
                <Eye className="w-8 h-8 mx-auto mb-3 animate-pulse" strokeWidth={2.5} />
                <p className="font-extrabold">Let&apos;s see what you both picked...</p>
              </div>
            )}

            {stage === 'revealed' && (
              <>
                <div className={`card p-6 text-center ${round.matched ? 'bg-leaf-soft' : ''}`}>
                  <div className="flex justify-center mb-3">
                    <span className={`w-14 h-14 rounded-xl border-2 border-line flex items-center justify-center
                                      ${round.matched ? 'bg-leaf' : 'bg-amber'}`}>
                      {round.matched
                        ? <Heart className="w-7 h-7 text-[var(--on-leaf)]" strokeWidth={2.5} />
                        : <Laugh className="w-7 h-7 text-[var(--on-amber)]" strokeWidth={2.5} />}
                    </span>
                  </div>

                  <h2 className="text-2xl mb-1">
                    {round.matched ? 'You agree!' : 'You disagree!'}
                  </h2>
                  {round.matched && (
                    <p className="text-ink-soft font-bold mb-4">
                      You both said {nameOf(choiceOf(roundNumber, activePlayers[0]?.id))}
                    </p>
                  )}
                  {!round.matched && (
                    <p className="text-ink-soft font-bold mb-4">
                      Someone has explaining to do
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-left">
                    {activePlayers.map(p => (
                      <div key={p.id} className="panel p-3">
                        <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft mb-1">
                          {p.name}{p.id === me?.id && ' (you)'} said
                        </p>
                        <p className="font-bold truncate">
                          {nameOf(choiceOf(roundNumber, p.id))}
                        </p>
                      </div>
                    ))}
                  </div>

                  {round.points > 0 && (
                    <p className="mt-4 text-xl font-extrabold text-leaf">+{round.points}</p>
                  )}
                  {round.matched && round.streak_after >= 3 && (
                    <p className="mt-2 chip chip-coral">
                      <Flame className="w-4 h-4" strokeWidth={2.5} />
                      {round.streak_after} match streak
                    </p>
                  )}
                </div>

                <div className="card p-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="chip">
                      <Heart className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {stats.matches}/{stats.done} matched
                    </span>
                    <span className="chip">{stats.points} points</span>
                  </div>
                  {isRoomOwner ? (
                    <button onClick={advance} disabled={busy} className="btn btn-amber btn-lg w-full">
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

            {/* Who has locked in - never what they chose */}
            {(stage === 'picking' || stage === 'waiting') && (
              <div className="panel p-4 flex flex-wrap gap-2">
                {activePlayers.map(p => {
                  const done = roundPicks.some(x => x.player_id === p.id);
                  return (
                    <span key={p.id} className={`chip ${done ? 'chip-leaf' : 'chip-amber'}`}>
                      {done
                        ? <Users className="w-3.5 h-3.5" strokeWidth={2.5} />
                        : <Hourglass className="w-3.5 h-3.5" strokeWidth={2.5} />}
                      {p.name}: {done ? 'locked in' : 'thinking'}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {gameOver && (
          <div className="space-y-5">
            <div className="card p-8 text-center">
              <div className="flex justify-center mb-4">
                <span className="w-16 h-16 rounded-xl bg-amber border-2 border-line flex items-center justify-center">
                  {stats.percent >= 60
                    ? <Heart className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />
                    : <Laugh className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />}
                </span>
              </div>
              <h1 className="text-3xl mb-2">
                {stats.percent >= 80 ? 'Seriously in sync'
                  : stats.percent >= 60 ? 'You know each other well'
                  : stats.percent >= 40 ? 'Some explaining to do'
                  : 'You two really do not agree'}
              </h1>
              <p className="text-5xl font-extrabold my-4">{stats.percent}%</p>
              <p className="text-ink-soft font-bold">
                {stats.matches} of {stats.done} answers matched
              </p>
              <p className="text-xs text-ink-soft font-semibold mt-3">
                A game statistic, not a verdict on anything.
              </p>
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">The numbers</h2>
              <ul className="space-y-2 text-sm font-semibold">
                <li className="panel p-3 flex justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Heart className="w-4 h-4" strokeWidth={2.5} />Matches
                  </span><b>{stats.matches}/{stats.done}</b>
                </li>
                <li className="panel p-3 flex justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Flame className="w-4 h-4" strokeWidth={2.5} />Longest streak
                  </span><b>{stats.longestStreak}</b>
                </li>
                <li className="panel p-3 flex justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" strokeWidth={2.5} />Points
                  </span><b>{stats.points}</b>
                </li>
                {stats.mostAgreed && (
                  <li className="panel p-3 flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={stats.mostAgreed} className="w-4 h-4" />Most agreed
                    </span><b>{CATEGORIES[stats.mostAgreed]?.label}</b>
                  </li>
                )}
                {stats.mostDisagreed && (
                  <li className="panel p-3 flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={stats.mostDisagreed} className="w-4 h-4" />Most disagreed
                    </span><b>{CATEGORIES[stats.mostDisagreed]?.label}</b>
                  </li>
                )}
                {stats.biggestDisagreement && (
                  <li className="panel p-3">
                    <span className="block text-ink-soft mb-1">Biggest disagreement</span>
                    <b>{stats.biggestDisagreement}</b>
                  </li>
                )}
              </ul>
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isRoomOwner ? (
                <button onClick={backToLobby} disabled={busy} className="btn btn-amber btn-lg grow">
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
