'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
// Not '@/lib/password/index.js' - that one carries the word bank, and the
// browser is never allowed to see it.
import {
  CATEGORIES, DIFFICULTIES, MIN_PLAYERS, TEAM_OPTIONS, ROUND_OPTIONS,
  TURN_SECONDS, SCORING_MODES, TEAM_COLOURS, TEAM_DEFAULT_NAMES
} from '@/lib/password/build.js';
import { balancedTeams, pickClueGiver, pointsForStep } from '@/lib/password/game.js';
import Link from 'next/link';
import {
  ArrowRight, Ban, Check, CircleAlert, Clapperboard, Ear, Eye, EyeOff, Heart,
  Hourglass, House, KeyRound, Laugh, Loader, MapPin, MessageSquare, Play,
  Shapes, SkipForward, Timer, Trophy, UserRound, Users, Utensils
} from 'lucide-react';

const CATEGORY_ICONS = { Shapes, Utensils, Clapperboard, Trophy, Laugh, Heart, MapPin };

const CategoryIcon = ({ category, className }) => {
  const Icon = CATEGORY_ICONS[CATEGORIES[category]?.icon] || Shapes;
  return <Icon className={className} strokeWidth={2.5} />;
};

const TEAM_TEXT = {
  'bg-coral': 'text-[var(--on-coral)]',
  'bg-teal': 'text-[var(--on-teal)]',
  'bg-leaf': 'text-[var(--on-leaf)]',
  'bg-amber': 'text-[var(--on-amber)]'
};

const SECONDS_OPTIONS = [30, 45, 60, 90];

export default function PasswordGame({ room, players, currentPlayer, gameSession }) {
  const [turns, setTurns] = useState([]);
  const [plays, setPlays] = useState([]);
  const [recap, setRecap] = useState({});
  const [secret, setSecret] = useState(null);
  const [clueStep, setClueStep] = useState(0);
  const [wordHidden, setWordHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState([]);
  const [difficulty, setDifficulty] = useState('mixed');
  const [teamCount, setTeamCount] = useState(2);
  const [totalRounds, setTotalRounds] = useState(3);
  const [scoring, setScoring] = useState('risk');
  const [seconds, setSeconds] = useState(TURN_SECONDS);

  const config = useMemo(() => gameSession.round_data || {}, [gameSession.round_data]);
  const teams = useMemo(() => config.teams || [], [config.teams]);
  const started = teams.length > 0;
  const gameOver = !!config.finished;

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const me = currentPlayer && !currentPlayer.is_spectator ? currentPlayer : null;
  const isHost = !!me && activePlayers[0]?.id === me.id;
  const nameOf = (id) => activePlayers.find(p => p.id === id)?.name || 'someone';

  const plannedRounds = config.rounds || totalRounds;
  const turnSeconds = config.seconds || seconds;
  const scoringMode = config.scoring || scoring;
  const totalTurns = plannedRounds * Math.max(1, teams.length);

  // ------------------------------------------------------------------ loading

  const load = useCallback(async () => {
    const [turnsResult, playsResult] = await Promise.all([
      supabase
        .from('password_turns')
        .select('id, session_id, turn_number, round_number, team_id, clue_giver_id, started_at, ended_at, seconds, scoring, points, correct_count, passed_count')
        .eq('session_id', gameSession.id)
        .order('turn_number'),
      // Never `select('*')` here: word_id is revoked and would 401 the lot.
      supabase
        .from('password_plays')
        .select('id, turn_number, play_order, result, points, clue_step')
        .eq('session_id', gameSession.id)
        .order('play_order')
    ]);

    if (turnsResult.error) {
      console.error('Error loading turns:', turnsResult.error);
      setError('Could not load the game. Has migration 11 been run?');
      return;
    }
    setTurns(turnsResult.data || []);
    setPlays(playsResult.data || []);
  }, [gameSession.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`password-${gameSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'password_turns', filter: `session_id=eq.${gameSession.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'password_plays', filter: `session_id=eq.${gameSession.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameSession.id, load]);

  // A ticking clock, only while one is actually running.
  const liveTurn = turns.find(t => !t.ended_at) || null;
  const running = !!liveTurn?.started_at;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);

  const endsAt = liveTurn?.started_at
    ? new Date(liveTurn.started_at).getTime() + (liveTurn.seconds || turnSeconds) * 1000
    : null;
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : (liveTurn?.seconds || turnSeconds);
  const expired = !!endsAt && remaining <= 0;

  // ------------------------------------------------------------------ shape of play

  const teamOf = useCallback(
    (playerId) => teams.find(t => (t.members || []).includes(playerId)) || null,
    [teams]
  );
  const myTeam = me ? teamOf(me.id) : null;
  const turnTeam = liveTurn ? teams.find(t => t.id === liveTurn.team_id) : null;
  const iAmGiver = !!me && liveTurn?.clue_giver_id === me.id;
  const iAmGuessing = !!me && !!turnTeam && !iAmGiver && (turnTeam.members || []).includes(me.id);

  const turnPlays = liveTurn ? plays.filter(p => p.turn_number === liveTurn.turn_number) : [];
  const nextTurnNumber = turns.length ? Math.max(...turns.map(t => t.turn_number)) + 1 : 1;
  const lastEnded = turns.filter(t => t.ended_at).sort((a, b) => b.turn_number - a.turn_number)[0] || null;

  const teamScores = useMemo(() => {
    const tally = Object.fromEntries(teams.map(t => [t.id, 0]));
    turns.forEach(t => { if (tally[t.team_id] !== undefined) tally[t.team_id] += t.points || 0; });
    return tally;
  }, [turns, teams]);

  const giverStats = useMemo(() => {
    const stats = {};
    turns.forEach(t => {
      if (!t.clue_giver_id) return;
      const row = stats[t.clue_giver_id] || { turns: 0, points: 0, correct: 0, passed: 0 };
      row.turns += 1;
      row.points += t.points || 0;
      row.correct += t.correct_count || 0;
      row.passed += t.passed_count || 0;
      stats[t.clue_giver_id] = row;
    });
    return stats;
  }, [turns]);

  const standings = [...teams].sort((a, b) => (teamScores[b.id] || 0) - (teamScores[a.id] || 0));

  const stage = gameOver
    ? 'finished'
    : !started
      ? 'setup'
      : liveTurn
        ? (liveTurn.started_at ? 'playing' : 'ready')
        : 'recap';

  // ------------------------------------------------------------------ actions

  const startGame = async () => {
    if (!isHost || busy) return;
    if (activePlayers.length < MIN_PLAYERS) {
      setError(`Password needs at least ${MIN_PLAYERS} players.`);
      return;
    }
    if (teamCount > activePlayers.length) {
      setError('More teams than players. Pick fewer teams.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const split = balancedTeams(activePlayers.map(p => p.id), teamCount);
      const built = split.map((members, i) => ({
        id: String.fromCharCode(65 + i),
        name: TEAM_DEFAULT_NAMES[i] || `Team ${i + 1}`,
        colour: TEAM_COLOURS[i % TEAM_COLOURS.length],
        members
      }));
      const settings = {
        categories, difficulty, rounds: totalRounds,
        scoring, seconds, teams: built
      };

      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ current_round: 1, max_rounds: totalRounds, round_data: settings })
        .eq('id', gameSession.id);
      if (sessionError) throw sessionError;
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err.message || 'Could not start the game.');
    } finally {
      setBusy(false);
    }
  };

  // The host deals the turns. One writer means two phones cannot create the
  // same turn twice, and the unique index catches it if they somehow race.
  const dealNextTurn = useCallback(async () => {
    const number = nextTurnNumber;
    if (number > totalTurns) {
      await supabase
        .from('game_sessions')
        .update({ round_data: { ...config, finished: true } })
        .eq('id', gameSession.id);
      return;
    }

    const roundNumber = Math.floor((number - 1) / teams.length) + 1;
    const team = teams[(number - 1) % teams.length];
    const members = (team.members || []).filter(id => activePlayers.some(p => p.id === id));
    const previous = turns
      .filter(t => t.team_id === team.id)
      .sort((a, b) => a.turn_number - b.turn_number)
      .map(t => t.clue_giver_id)
      .filter(Boolean);

    const { error: insertError } = await supabase.from('password_turns').insert({
      session_id: gameSession.id,
      turn_number: number,
      round_number: roundNumber,
      team_id: team.id,
      clue_giver_id: pickClueGiver(members, previous),
      seconds: turnSeconds,
      scoring: scoringMode
    });
    // 23505 just means another client got there first, which is fine.
    if (insertError && insertError.code !== '23505') {
      console.error('Error dealing turn:', insertError);
      setError('Could not start the next turn.');
      return;
    }
    if (roundNumber !== gameSession.current_round) {
      await supabase
        .from('game_sessions')
        .update({ current_round: roundNumber })
        .eq('id', gameSession.id);
    }
    await load();
  }, [nextTurnNumber, totalTurns, teams, turns, activePlayers, turnSeconds,
      scoringMode, gameSession.id, gameSession.current_round, config, load]);

  // First turn is dealt as soon as the teams exist; later ones are dealt by the
  // host tapping through the recap.
  useEffect(() => {
    if (!isHost || !started || gameOver || busy) return;
    if (turns.length > 0) return;
    dealNextTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, started, gameOver, turns.length]);

  const beginTurn = async () => {
    if (!iAmGiver || !liveTurn || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('password_turns')
        .update({ started_at: new Date().toISOString() })
        .eq('id', liveTurn.id)
        .is('started_at', null);
      if (updateError) throw updateError;
      setNow(Date.now());
      await deal(null, 0);
    } catch (err) {
      console.error('Error starting turn:', err);
      setError('Could not start the turn.');
    } finally {
      setBusy(false);
    }
  };

  const deal = useCallback(async (result, step) => {
    if (!me || !liveTurn) return;
    const { data, error: rpcError } = await supabase.rpc('password_next_word', {
      p_session_id: gameSession.id,
      p_turn_number: liveTurn.turn_number,
      p_player_id: me.id,
      p_result: result,
      p_clue_step: step
    });
    if (rpcError) {
      console.error('Error dealing word:', rpcError);
      setError('Could not get the next word.');
      return;
    }
    if (!data?.ok) {
      if (!data?.expired) setError(data?.error || 'Could not get the next word.');
      setSecret(null);
      return;
    }
    setClueStep(0);
    setSecret(data.exhausted
      ? { exhausted: true }
      : { word: data.word, forbidden: data.forbidden || [] });
  }, [me, liveTurn, gameSession.id]);

  const resolve = async (result) => {
    if (!iAmGiver || busy || expired) return;
    setBusy(true);
    setError('');
    await deal(result, clueStep);
    setBusy(false);
  };

  const endTurn = useCallback(async () => {
    if (!liveTurn) return;
    const { error: rpcError } = await supabase.rpc('password_end_turn', {
      p_session_id: gameSession.id,
      p_turn_number: liveTurn.turn_number
    });
    if (rpcError) console.error('Error ending turn:', rpcError);
    setSecret(null);
    setClueStep(0);
    await load();
  }, [liveTurn, gameSession.id, load]);

  // Whoever is looking at the clock when it runs out closes the turn. The RPC
  // is idempotent, so it does not matter if several of them do.
  const closingRef = useRef(null);
  useEffect(() => {
    if (!expired || !liveTurn) return;
    if (!iAmGiver && !isHost) return;
    if (closingRef.current === liveTurn.turn_number) return;
    closingRef.current = liveTurn.turn_number;
    endTurn();
  }, [expired, liveTurn, iAmGiver, isHost, endTurn]);

  // The clue giver reloading mid-turn gets their word back.
  const liveTurnId = liveTurn?.id;
  useEffect(() => {
    if (!liveTurnId || !iAmGiver || !liveTurn?.started_at || secret) return;
    let cancelled = false;
    supabase
      .rpc('password_current_word', {
        p_session_id: gameSession.id,
        p_turn_number: liveTurn.turn_number,
        p_player_id: me.id
      })
      .then(({ data }) => {
        if (cancelled || !data?.ok || !data.word) return;
        setSecret({ word: data.word, forbidden: data.forbidden || [] });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTurnId, iAmGiver, liveTurn?.started_at]);

  useEffect(() => { setSecret(null); setClueStep(0); setWordHidden(false); }, [liveTurnId]);

  // Words are only released once a turn is over, so the recap is fetched then.
  const recapKey = lastEnded?.turn_number;
  useEffect(() => {
    if (!recapKey || recap[recapKey]) return;
    let cancelled = false;
    supabase
      .rpc('password_turn_words', { p_session_id: gameSession.id, p_turn_number: recapKey })
      .then(({ data }) => {
        if (cancelled || !data?.ok) return;
        setRecap(prev => ({ ...prev, [recapKey]: data.words || [] }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapKey, gameSession.id]);

  const nextTurn = async () => {
    if (!isHost || busy) return;
    setBusy(true);
    await dealNextTurn();
    setBusy(false);
  };

  const backToLobby = async () => {
    if (!isHost || busy) return;
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

  // ---------------------------------------------------------------- rendering

  const TeamBadge = ({ team, className = '' }) => (
    <span className={`chip ${className}`}>
      <span className={`w-3 h-3 rounded-full border-2 border-line ${team.colour}`} />
      {team.name}
    </span>
  );

  const clock = (
    <div className={`card p-4 flex items-center justify-center gap-3 ${remaining <= 10 && running ? 'bg-coral-soft' : ''}`}>
      <Timer className="w-6 h-6 shrink-0" strokeWidth={2.5} />
      <span className="text-4xl font-extrabold tabular-nums tracking-tight">{remaining}</span>
      <span className="text-sm font-bold text-ink-soft">seconds left</span>
    </div>
  );

  const scoreboard = (
    <div className="card p-5">
      <h2 className="text-lg mb-3">Scores</h2>
      <ul className="space-y-2">
        {standings.map(t => (
          <li key={t.id} className={`panel p-3 flex items-center gap-3 ${myTeam?.id === t.id ? 'bg-amber-soft' : ''}`}>
            <span className={`w-8 h-8 rounded-lg border-2 border-line shrink-0 ${t.colour}
                              flex items-center justify-center font-extrabold text-sm ${TEAM_TEXT[t.colour]}`}>
              {t.id}
            </span>
            <span className="font-bold grow truncate">
              {t.name}
              <span className="text-ink-soft font-semibold">
                {' '}- {(t.members || []).map(nameOf).join(', ')}
              </span>
            </span>
            <span className="font-extrabold shrink-0 tabular-nums">{teamScores[t.id] || 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const header = (
    <header className="bg-surface border-b-2 border-line">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-teal border-2 border-line flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-[var(--on-teal)]" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold leading-tight truncate">
              {started && liveTurn
                ? `Round ${liveTurn.round_number} of ${plannedRounds}`
                : 'Password'}
            </p>
            <p className="text-xs text-ink-soft font-bold font-mono truncate">{room.room_code}</p>
          </div>
        </div>
        <Link href="/" className="btn btn-quiet btn-sm">
          <House className="w-4 h-4" strokeWidth={3} />
        </Link>
      </div>
    </header>
  );

  const recapList = (number) => {
    const words = recap[number];
    if (!words) {
      return (
        <p className="text-sm font-bold text-ink-soft flex items-center gap-2">
          <Loader className="w-4 h-4 animate-spin" strokeWidth={2.5} />
          Fetching the words...
        </p>
      );
    }
    if (!words.length) {
      return <p className="text-sm font-semibold text-ink-soft">No words made it out of that turn.</p>;
    }
    return (
      <ul className="space-y-2">
        {words.map(w => (
          <li key={w.play_order} className="panel p-3 flex items-center gap-3">
            {w.result === 'correct'
              ? <Check className="w-4 h-4 shrink-0 text-leaf" strokeWidth={3} />
              : w.result === 'passed'
                ? <SkipForward className="w-4 h-4 shrink-0 text-ink-soft" strokeWidth={3} />
                : <Ban className="w-4 h-4 shrink-0 text-ink-soft" strokeWidth={3} />}
            <span className={`font-bold grow truncate ${w.result === 'correct' ? '' : 'text-ink-soft line-through'}`}>
              {w.word}
            </span>
            {w.points > 0 && <span className="chip chip-leaf shrink-0">+{w.points}</span>}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen">
      {header}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {error && (
          <p className="flex items-center gap-2 text-sm font-bold text-coral">
            <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}

        {!me && stage !== 'setup' && (
          <p className="chip"><Eye className="w-4 h-4" strokeWidth={2.5} />Watching</p>
        )}

        {/* Setup */}
        {stage === 'setup' && (
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl mb-2">
              {isHost ? 'Set up the game' : 'Waiting to start'}
            </h1>
            <p className="text-ink-soft mb-6">
              One player per team sees a secret word and describes it out loud.
              Their team shouts guesses. The forbidden clues are off limits.
            </p>

            <div className="panel p-4 mb-6 flex items-center gap-2 text-sm font-bold">
              <Users className="w-4 h-4 shrink-0" strokeWidth={2.5} />
              {activePlayers.length} here
              {activePlayers.length < MIN_PLAYERS && (
                <span className="text-coral">- need at least {MIN_PLAYERS}</span>
              )}
            </div>

            {isHost ? (
              <div className="space-y-6">
                <div>
                  <span className="block text-sm font-extrabold mb-2">
                    Categories <span className="text-ink-soft font-semibold">(all if none picked)</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORIES).map(([id, meta]) => {
                      const on = categories.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => setCategories(prev =>
                            on ? prev.filter(c => c !== id) : [...prev, id])}
                          className={`chip cursor-pointer ${on ? 'chip-teal' : ''}`}
                        >
                          <CategoryIcon category={id} className="w-3.5 h-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-extrabold mb-2">Difficulty</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[...Object.keys(DIFFICULTIES), 'mixed'].map(id => (
                      <button
                        key={id}
                        onClick={() => setDifficulty(id)}
                        className={`tile h-12 font-extrabold text-sm ${
                          difficulty === id ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        {DIFFICULTIES[id]?.label || 'Mixed'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-extrabold mb-2">Teams</span>
                    <div className="grid grid-cols-3 gap-2">
                      {TEAM_OPTIONS.map(n => (
                        <button
                          key={n}
                          onClick={() => setTeamCount(n)}
                          disabled={n > activePlayers.length}
                          className={`tile h-12 font-extrabold ${
                            teamCount === n ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-sm font-extrabold mb-2">Rounds each</span>
                    <div className="grid grid-cols-4 gap-2">
                      {ROUND_OPTIONS.map(n => (
                        <button
                          key={n}
                          onClick={() => setTotalRounds(n)}
                          className={`tile h-12 font-extrabold ${
                            totalRounds === n ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-extrabold mb-2">Seconds per turn</span>
                  <div className="grid grid-cols-4 gap-2">
                    {SECONDS_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setSeconds(n)}
                        className={`tile h-12 font-extrabold ${
                          seconds === n ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-extrabold mb-2">Scoring</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SCORING_MODES).map(([id, meta]) => (
                      <button
                        key={id}
                        onClick={() => setScoring(id)}
                        className={`tile h-auto py-3 flex-col gap-0.5 ${
                          scoring === id ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        <span className="font-extrabold text-sm">{meta.label}</span>
                        <span className="text-xs font-bold opacity-80">{meta.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={busy || activePlayers.length < MIN_PLAYERS}
                  className="btn btn-teal btn-lg w-full"
                >
                  {busy
                    ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Drawing teams</>
                    : <><Play className="w-5 h-5" strokeWidth={3} />Draw teams and start</>}
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

        {/* Between turns: whose go it is */}
        {stage === 'ready' && liveTurn && turnTeam && (
          <>
            <div className="card p-6 sm:p-8 text-center">
              <TeamBadge team={turnTeam} className="mb-4" />
              <h1 className="text-2xl sm:text-3xl mb-2">
                {iAmGiver ? 'You are giving the clues' : `${nameOf(liveTurn.clue_giver_id)} is giving the clues`}
              </h1>
              <p className="text-ink-soft font-semibold mb-6">
                {iAmGiver
                  ? 'Hold the phone so only you can see it. Describe the word without using it or any of the forbidden clues.'
                  : iAmGuessing
                    ? 'Shout your guesses out loud. You have not got long.'
                    : `${turnTeam.name} are up. Listen out for a forbidden clue.`}
              </p>

              {iAmGiver ? (
                <button onClick={beginTurn} disabled={busy} className="btn btn-teal btn-lg w-full">
                  {busy
                    ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Starting</>
                    : <><Play className="w-5 h-5" strokeWidth={3} />Start the clock</>}
                </button>
              ) : (
                <p className="panel p-4 font-bold flex items-center justify-center gap-2">
                  <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  Waiting for {nameOf(liveTurn.clue_giver_id)} to start
                </p>
              )}
            </div>
            {scoreboard}
          </>
        )}

        {/* The clue giver */}
        {stage === 'playing' && liveTurn && iAmGiver && (
          <>
            {clock}

            {secret?.exhausted ? (
              <div className="card p-6 text-center">
                <p className="font-extrabold mb-2">That is every word in the bank</p>
                <p className="text-ink-soft font-semibold mb-4">Nothing left to give with these settings.</p>
                <button onClick={endTurn} className="btn btn-teal w-full">
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                  End the turn
                </button>
              </div>
            ) : secret ? (
              <>
                <div className="card p-6">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft">Your word</p>
                    <div className="flex items-center gap-2">
                      <span className="chip chip-amber">
                        Worth {pointsForStep(clueStep, scoringMode)}
                      </span>
                      <button
                        onClick={() => setWordHidden(h => !h)}
                        className="chip cursor-pointer"
                        title={wordHidden ? 'Show it' : 'Hide it for a second'}
                      >
                        {wordHidden
                          ? <><Eye className="w-3.5 h-3.5" strokeWidth={2.5} />Show</>
                          : <><EyeOff className="w-3.5 h-3.5" strokeWidth={2.5} />Hide</>}
                      </button>
                    </div>
                  </div>
                  <p className="text-4xl font-extrabold tracking-tight mb-4 break-words">
                    {wordHidden ? '• • • • •' : secret.word}
                  </p>

                  {!wordHidden && secret.forbidden?.length > 0 && (
                    <div className="panel p-4 bg-coral-soft">
                      <p className="text-xs uppercase tracking-wide font-extrabold mb-2 flex items-center gap-2">
                        <Ban className="w-3.5 h-3.5" strokeWidth={3} />
                        Do not say
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {secret.forbidden.map(f => (
                          <span key={f} className="chip">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => resolve('correct')}
                    disabled={busy || expired}
                    className="btn btn-leaf btn-lg h-20"
                  >
                    <Check className="w-6 h-6" strokeWidth={3} />
                    Got it
                  </button>
                  <button
                    onClick={() => resolve('passed')}
                    disabled={busy || expired}
                    className="btn btn-quiet btn-lg h-20"
                  >
                    <SkipForward className="w-6 h-6" strokeWidth={3} />
                    Pass
                  </button>
                </div>

                {scoringMode === 'risk' && (
                  <button
                    onClick={() => setClueStep(s => s + 1)}
                    disabled={busy || expired || pointsForStep(clueStep, scoringMode) <= 1}
                    className="btn btn-quiet w-full"
                  >
                    <MessageSquare className="w-4 h-4" strokeWidth={3} />
                    {pointsForStep(clueStep, scoringMode) <= 1
                      ? 'Already down to 1 point'
                      : `Another clue - drops it to ${pointsForStep(clueStep + 1, scoringMode)}`}
                  </button>
                )}

                <div className="panel p-4 flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-leaf" strokeWidth={3} />
                    {liveTurn.correct_count} right
                  </span>
                  <span className="flex items-center gap-2 text-ink-soft">
                    <SkipForward className="w-4 h-4" strokeWidth={3} />
                    {liveTurn.passed_count} passed
                  </span>
                  <span className="chip chip-leaf">{liveTurn.points} points</span>
                </div>
              </>
            ) : (
              <div className="card p-8 text-center">
                <Loader className="w-6 h-6 mx-auto mb-3 animate-spin" strokeWidth={2.5} />
                <p className="font-bold">Getting your word</p>
              </div>
            )}
          </>
        )}

        {/* Everyone who is not the clue giver */}
        {stage === 'playing' && liveTurn && turnTeam && !iAmGiver && (
          <>
            {clock}
            <div className="card p-6 text-center">
              <span className="w-14 h-14 rounded-xl bg-amber border-2 border-line mx-auto mb-4 flex items-center justify-center">
                {iAmGuessing
                  ? <Ear className="w-7 h-7 text-[var(--on-amber)]" strokeWidth={2.5} />
                  : <Eye className="w-7 h-7 text-[var(--on-amber)]" strokeWidth={2.5} />}
              </span>
              <h1 className="text-2xl mb-2">
                {iAmGuessing ? 'Shout your guesses' : `${turnTeam.name} are guessing`}
              </h1>
              <p className="text-ink-soft font-semibold">
                {iAmGuessing
                  ? `${nameOf(liveTurn.clue_giver_id)} can see the word. Say what you think it is - out loud, as fast as you can.`
                  : `${nameOf(liveTurn.clue_giver_id)} is describing a word to them. Call out any forbidden clue you hear.`}
              </p>
            </div>

            <div className="panel p-4 flex items-center justify-between gap-3 text-sm font-bold">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-leaf" strokeWidth={3} />
                {liveTurn.correct_count} right
              </span>
              <span className="flex items-center gap-2 text-ink-soft">
                <SkipForward className="w-4 h-4" strokeWidth={3} />
                {liveTurn.passed_count} passed
              </span>
              <span className="chip chip-leaf">{liveTurn.points} points</span>
            </div>

            {/* Blank tiles, one per word - progress without a single letter of it */}
            {turnPlays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {turnPlays.map(p => (
                  <span
                    key={p.id}
                    className={`w-10 h-10 rounded-lg border-2 border-line flex items-center justify-center
                                ${p.result === 'correct' ? 'bg-leaf' : p.result === 'live' ? 'bg-amber' : 'bg-surface'}`}
                  >
                    {p.result === 'correct'
                      ? <Check className="w-5 h-5 text-[var(--on-leaf)]" strokeWidth={3} />
                      : p.result === 'live'
                        ? <Hourglass className="w-4 h-4 text-[var(--on-amber)]" strokeWidth={3} />
                        : <SkipForward className="w-4 h-4 text-ink-soft" strokeWidth={3} />}
                  </span>
                ))}
              </div>
            )}

            {!iAmGuessing && scoreboard}
          </>
        )}

        {/* Recap between turns */}
        {stage === 'recap' && lastEnded && (
          <>
            <div className="card p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h1 className="text-2xl">
                  {teams.find(t => t.id === lastEnded.team_id)?.name || 'That team'} scored {lastEnded.points}
                </h1>
                <span className="chip chip-leaf">
                  {lastEnded.correct_count} right, {lastEnded.passed_count} passed
                </span>
              </div>
              <p className="text-sm text-ink-soft font-semibold mb-4">
                {nameOf(lastEnded.clue_giver_id)} was giving the clues.
              </p>
              {recapList(lastEnded.turn_number)}
            </div>

            {scoreboard}

            <div className="card p-5">
              {isHost ? (
                <button onClick={nextTurn} disabled={busy} className="btn btn-teal btn-lg w-full">
                  {busy
                    ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Setting up</>
                    : nextTurnNumber > totalTurns
                      ? <><Trophy className="w-5 h-5" strokeWidth={3} />See final scores</>
                      : <><ArrowRight className="w-5 h-5" strokeWidth={3} />Next turn</>}
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

        {/* Final */}
        {stage === 'finished' && (
          <>
            <div className="card p-8 text-center">
              <span className="w-16 h-16 rounded-xl bg-amber border-2 border-line mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />
              </span>
              <h1 className="text-3xl mb-1">
                {standings.length > 1 && teamScores[standings[0]?.id] === teamScores[standings[1]?.id]
                  ? 'It is a tie'
                  : `${standings[0]?.name} win`}
              </h1>
              <p className="text-ink-soft font-bold">
                {teamScores[standings[0]?.id] || 0} points over {plannedRounds} rounds
              </p>
            </div>

            {scoreboard}

            <div className="card p-6">
              <h2 className="text-lg mb-4">Best clue givers</h2>
              <ul className="space-y-2">
                {activePlayers
                  .filter(p => giverStats[p.id])
                  .sort((a, b) => giverStats[b.id].points - giverStats[a.id].points)
                  .map(p => (
                    <li key={p.id} className="panel p-3 flex items-center gap-3 text-sm">
                      <UserRound className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                      <span className="font-bold grow truncate">
                        {p.name}{p.id === me?.id && <span className="text-ink-soft font-semibold"> (you)</span>}
                      </span>
                      <span className="text-ink-soft font-semibold shrink-0">
                        {giverStats[p.id].correct} words
                      </span>
                      <span className="font-extrabold shrink-0 tabular-nums">{giverStats[p.id].points}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isHost ? (
                <button onClick={backToLobby} disabled={busy} className="btn btn-teal btn-lg grow">
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
          </>
        )}
      </div>
    </div>
  );
}
