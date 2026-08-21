'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
// Not '@/lib/undercover/index.js' - that one carries the pair bank, and both
// words of a pair together are exactly what the browser must never hold.
import {
  CATEGORIES, DIFFICULTIES, MIN_PLAYERS, ROUND_OPTIONS, CLUE_ROUND_OPTIONS,
  suggestedClueRounds
} from '@/lib/undercover/build.js';
import { SCORING } from '@/lib/undercover/game.js';
import Link from 'next/link';
import {
  ArrowRight, Brain, CircleAlert, Clapperboard, Eye, EyeOff, Heart, Hourglass,
  House, Laugh, Loader, MapPin, Play, Send, Shapes, Trophy, UserRound, Users, Vote
} from 'lucide-react';

const CATEGORY_ICONS = { Shapes, Clapperboard, Trophy, Laugh, Heart, MapPin };

const CategoryIcon = ({ category, className }) => {
  const Icon = CATEGORY_ICONS[CATEGORIES[category]?.icon] || Shapes;
  return <Icon className={className} strokeWidth={2.5} />;
};

const SUSPENSE_MS = 1400;

export default function UndercoverGame({ room, players, currentPlayer, gameSession }) {
  const [rounds, setRounds] = useState([]);
  const [clues, setClues] = useState([]);
  const [votes, setVotes] = useState([]);
  const [reveals, setReveals] = useState({});
  const [myRole, setMyRole] = useState(null);
  const [wordHidden, setWordHidden] = useState(false);
  const [draft, setDraft] = useState('');
  const [suspense, setSuspense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState([]);
  const [difficulty, setDifficulty] = useState('mixed');
  const [totalRounds, setTotalRounds] = useState(3);
  const [clueRounds, setClueRounds] = useState(1);

  const roundNumber = gameSession.current_round || 1;
  const suspenseShownRef = useRef(null);

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const me = currentPlayer && !currentPlayer.is_spectator ? currentPlayer : null;
  const isHost = !!me && activePlayers[0]?.id === me.id;
  const nameOf = (id) => activePlayers.find(p => p.id === id)?.name || 'someone';

  const round = rounds.find(r => r.round_number === roundNumber) || null;
  const config = gameSession.round_data || {};
  const plannedRounds = config.rounds || totalRounds;
  const gameOver = !!config.finished;

  const roundClues = clues.filter(c => c.round_number === roundNumber);
  const roundVotes = votes.filter(
    v => v.round_number === roundNumber && v.vote_round === (round?.vote_round || 1)
  );

  // Which pass through the table we are on, derived from how many clues exist.
  const currentClueRound = round
    ? Math.min(round.clue_rounds, Math.floor(roundClues.length / Math.max(1, activePlayers.length)) + 1)
    : 1;
  const thisPassClues = roundClues.filter(c => c.clue_round === currentClueRound);

  const speakingOrder = useMemo(() => {
    const order = Array.isArray(round?.turn_order) ? round.turn_order : [];
    return order.filter(id => activePlayers.some(p => p.id === id));
  }, [round?.turn_order, activePlayers]);

  const currentSpeaker = speakingOrder.find(
    id => !thisPassClues.some(c => c.player_id === id)
  ) || null;
  const myTurn = !!me && currentSpeaker === me.id;

  const iVoted = !!me && roundVotes.some(v => v.voter_id === me.id);
  const allVoted = roundVotes.length >= activePlayers.length;
  const reveal = reveals[roundNumber] || null;

  const load = useCallback(async () => {
    const [roundsResult, cluesResult, votesResult] = await Promise.all([
      supabase
        .from('undercover_rounds')
        .select('id, session_id, round_number, category, difficulty, turn_order, clue_rounds, phase, vote_round, tied_ids, eliminated_id, caught, final_guess, final_guess_correct, winning_side, resolved')
        .eq('session_id', gameSession.id)
        .order('round_number'),
      supabase.from('undercover_clues').select('*').eq('session_id', gameSession.id),
      supabase
        .from('undercover_votes')
        .select('id, session_id, round_number, vote_round, voter_id')
        .eq('session_id', gameSession.id)
    ]);

    if (roundsResult.error) {
      console.error('Error loading rounds:', roundsResult.error);
      setError('Could not load the game. Has migration 10 been run?');
      return;
    }

    const list = roundsResult.data || [];
    setRounds(list);
    setClues(cluesResult.data || []);
    setVotes(votesResult.data || []);

    // Full truth is only released for rounds that have finished.
    const done = list.filter(r => r.resolved);
    if (done.length) {
      const results = await Promise.all(done.map(r =>
        supabase.rpc('undercover_reveal', {
          p_session_id: gameSession.id,
          p_round_number: r.round_number
        })
      ));
      const map = {};
      done.forEach((r, i) => {
        const data = results[i]?.data;
        if (data?.ready) map[r.round_number] = data;
      });
      setReveals(map);
    }
  }, [gameSession.id]);

  useEffect(() => { load(); }, [load, roundNumber]);

  useEffect(() => {
    const channel = supabase
      .channel(`undercover-${gameSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_rounds', filter: `session_id=eq.${gameSession.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_clues', filter: `session_id=eq.${gameSession.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_votes', filter: `session_id=eq.${gameSession.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameSession.id, load]);

  // Your word, and only yours. Keyed on ids rather than the objects, because a
  // reload of the players list must not refetch and flicker the word.
  const meId = me?.id;
  const roundId = round?.id;
  useEffect(() => {
    if (!roundId || !meId) { setMyRole(null); return; }
    let cancelled = false;
    supabase
      .rpc('undercover_my_role', {
        p_session_id: gameSession.id,
        p_round_number: roundNumber,
        p_player_id: meId
      })
      .then(({ data, error: roleError }) => {
        if (cancelled) return;
        if (roleError) { console.error('Error loading role:', roleError); return; }
        if (data?.ok) setMyRole(data);
      });
    return () => { cancelled = true; };
  }, [gameSession.id, roundNumber, roundId, meId]);

  useEffect(() => { setDraft(''); setWordHidden(false); }, [roundNumber, round?.phase]);

  // A beat before the elimination lands.
  useEffect(() => {
    const key = `${roundNumber}:${round?.phase}`;
    if (round?.phase !== 'reveal' && round?.phase !== 'final_guess') return;
    if (suspenseShownRef.current === key) return;
    suspenseShownRef.current = key;
    setSuspense(true);
    const timer = setTimeout(() => setSuspense(false), SUSPENSE_MS);
    return () => clearTimeout(timer);
  }, [round?.phase, roundNumber]);

  const dealRound = async (n, settings) => {
    const { data, error: rpcError } = await supabase.rpc('undercover_deal', {
      p_session_id: gameSession.id,
      p_round_number: n,
      p_categories: settings.categories,
      p_difficulty: settings.difficulty,
      p_clue_rounds: settings.clueRounds
    });
    if (rpcError) throw rpcError;
    if (!data?.ok) throw new Error(data?.error || 'Could not deal the round.');
  };

  const startGame = async () => {
    if (!isHost || busy) return;
    if (activePlayers.length < MIN_PLAYERS) {
      setError(`Undercover needs at least ${MIN_PLAYERS} players.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const settings = { categories, difficulty, rounds: totalRounds, clueRounds };
      await dealRound(1, settings);
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ current_round: 1, max_rounds: totalRounds, round_data: settings })
        .eq('id', gameSession.id);
      if (sessionError) throw sessionError;
      await load();
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err.message || 'Could not start the game.');
    } finally {
      setBusy(false);
    }
  };

  const submitClue = async () => {
    const clue = draft.trim();
    if (!me || !clue || busy) return;

    // Saying the word outright would end the round on the spot.
    if (myRole?.word && clue.toLowerCase().includes(myRole.word.toLowerCase())) {
      setError('That gives your word away. Try a clue about it instead.');
      return;
    }

    setBusy(true);
    setError('');
    const { error: insertError } = await supabase.from('undercover_clues').insert({
      session_id: gameSession.id,
      round_number: roundNumber,
      clue_round: currentClueRound,
      player_id: me.id,
      clue
    });

    if (insertError) {
      console.error('Error submitting clue:', insertError);
      setError('Could not send that clue.');
    } else {
      setDraft('');
      // Last clue of the last pass opens the voting. Guarded on phase so it
      // does not matter if two clients decide at once.
      const willHave = roundClues.length + 1;
      if (willHave >= activePlayers.length * round.clue_rounds) {
        await supabase
          .from('undercover_rounds')
          .update({ phase: 'voting' })
          .eq('session_id', gameSession.id)
          .eq('round_number', roundNumber)
          .eq('phase', 'clues');
      }
      await load();
    }
    setBusy(false);
  };

  const castVote = async (targetId) => {
    if (!me || busy) return;
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('undercover_vote', {
      p_session_id: gameSession.id,
      p_round_number: roundNumber,
      p_voter_id: me.id,
      p_target_id: targetId
    });
    if (rpcError) {
      console.error('Error voting:', rpcError);
      setError('Could not record your vote.');
    } else if (!data?.ok) {
      setError(data?.error || 'Vote rejected.');
    }
    await load();
    setBusy(false);
  };

  // Only the host counts, so a race cannot process the same votes twice.
  useEffect(() => {
    if (!isHost || !round || busy) return;
    if (!['voting', 'revote'].includes(round.phase)) return;
    if (roundVotes.length < activePlayers.length) return;

    supabase
      .rpc('undercover_tally', { p_session_id: gameSession.id, p_round_number: roundNumber })
      .then(({ error: tallyError }) => {
        if (tallyError) console.error('Error counting votes:', tallyError);
        load();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, round?.phase, roundVotes.length, activePlayers.length, roundNumber]);

  const submitFinalGuess = async () => {
    const guess = draft.trim();
    if (!me || !guess || busy) return;
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('undercover_final_guess', {
      p_session_id: gameSession.id,
      p_player_id: me.id,
      p_round_number: roundNumber,
      p_guess: guess
    });
    if (rpcError || !data?.ok) {
      setError(data?.error || 'Could not send that guess.');
    } else {
      setDraft('');
    }
    await load();
    setBusy(false);
  };

  const nextRound = async () => {
    if (!isHost || busy) return;
    setBusy(true);
    try {
      if (roundNumber >= plannedRounds) {
        await supabase
          .from('game_sessions')
          .update({ round_data: { ...config, finished: true } })
          .eq('id', gameSession.id);
      } else {
        const next = roundNumber + 1;
        await dealRound(next, {
          categories: config.categories || [],
          difficulty: config.difficulty || 'mixed',
          clueRounds: config.clueRounds || 1
        });
        await supabase
          .from('game_sessions')
          .update({ current_round: next })
          .eq('id', gameSession.id);
      }
      await load();
    } catch (err) {
      console.error('Error advancing:', err);
      setError(err.message || 'Could not start the next round.');
    } finally {
      setBusy(false);
    }
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

  // Scores follow the spec: surviving civilians on a civilian win, the
  // undercover for surviving or for stealing it, and anyone who actually
  // pointed at the right person.
  const scores = useMemo(() => {
    const tally = Object.fromEntries(activePlayers.map(p => [p.id, 0]));
    const stats = Object.fromEntries(activePlayers.map(p => [p.id, {
      undercoverWins: 0, correctAccusations: 0, votesReceived: 0, timesUndercover: 0
    }]));

    Object.values(reveals).forEach(r => {
      if (!r?.ready) return;
      const uc = r.undercover_id;
      if (stats[uc]) stats[uc].timesUndercover += 1;

      (r.votes || []).forEach(v => {
        if (stats[v.target_id]) stats[v.target_id].votesReceived += 1;
        if (v.target_id === uc && stats[v.voter_id]) {
          stats[v.voter_id].correctAccusations += 1;
          tally[v.voter_id] = (tally[v.voter_id] || 0) + SCORING.correctAccusation;
        }
      });

      if (r.winning_side === 'civilians') {
        activePlayers.forEach(p => {
          if (p.id !== uc && p.id !== r.eliminated_id) {
            tally[p.id] = (tally[p.id] || 0) + SCORING.civilianWin;
          }
        });
      } else if (r.winning_side === 'undercover') {
        if (tally[uc] !== undefined) {
          tally[uc] += r.caught ? SCORING.undercoverGuessBonus : SCORING.undercoverSurvives;
          if (stats[uc]) stats[uc].undercoverWins += 1;
        }
      }
    });

    return { tally, stats };
  }, [reveals, activePlayers]);

  const leaderboard = [...activePlayers].sort(
    (a, b) => (scores.tally[b.id] || 0) - (scores.tally[a.id] || 0)
  );

  const stage = gameOver ? 'finished' : !round ? 'setup' : round.phase;

  // ---------------------------------------------------------------- rendering

  const header = (
    <header className="bg-surface border-b-2 border-line">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-coral border-2 border-line flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5 text-[var(--on-coral)]" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold leading-tight truncate">
              {round ? `Round ${roundNumber} of ${plannedRounds}` : 'Undercover'}
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

  const yourWordCard = myRole && (
    <div className={`card p-5 ${myRole.is_undercover ? 'bg-coral-soft' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft">
          {myRole.is_undercover ? 'You are the undercover' : 'Your word'}
        </p>
        <button
          onClick={() => setWordHidden(h => !h)}
          className="chip cursor-pointer"
          title={wordHidden ? 'Show my word' : 'Hide it from the person next to me'}
        >
          {wordHidden
            ? <><Eye className="w-3.5 h-3.5" strokeWidth={2.5} />Show</>
            : <><EyeOff className="w-3.5 h-3.5" strokeWidth={2.5} />Hide</>}
        </button>
      </div>
      <p className="text-3xl font-extrabold tracking-tight">
        {wordHidden ? '• • • • •' : myRole.word}
      </p>
      {myRole.is_undercover && !wordHidden && (
        <p className="text-sm text-ink-soft font-semibold mt-1">
          Everyone else has a different word. Blend in.
        </p>
      )}
    </div>
  );

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
              Everyone gets the same word except one person. Give clues, work out
              who does not belong, and vote.
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
                          className={`chip cursor-pointer ${on ? 'chip-coral' : ''}`}
                        >
                          <CategoryIcon category={id} className="w-3.5 h-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-extrabold mb-2">How close should the words be?</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[...Object.keys(DIFFICULTIES), 'mixed'].map(id => (
                      <button
                        key={id}
                        onClick={() => setDifficulty(id)}
                        className={`tile h-14 flex-col gap-0.5 font-extrabold text-sm ${
                          difficulty === id ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                        }`}
                      >
                        {DIFFICULTIES[id]?.label || 'Mixed'}
                      </button>
                    ))}
                  </div>
                  {DIFFICULTIES[difficulty] && (
                    <p className="mt-2 text-xs font-bold text-ink-soft">
                      {DIFFICULTIES[difficulty].hint}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-extrabold mb-2">Rounds</span>
                    <div className="grid grid-cols-3 gap-2">
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
                  <div>
                    <span className="block text-sm font-extrabold mb-2">Clue passes</span>
                    <div className="grid grid-cols-2 gap-2">
                      {CLUE_ROUND_OPTIONS.map(n => (
                        <button
                          key={n}
                          onClick={() => setClueRounds(n)}
                          className={`tile h-12 font-extrabold ${
                            clueRounds === n ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {suggestedClueRounds(activePlayers.length) === 2 && clueRounds === 1 && (
                      <p className="mt-2 text-xs font-bold text-ink-soft">
                        Two passes suits a group this size
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={busy || activePlayers.length < MIN_PLAYERS}
                  className="btn btn-coral btn-lg w-full"
                >
                  {busy
                    ? <><Loader className="w-5 h-5 animate-spin" strokeWidth={3} />Dealing</>
                    : <><Play className="w-5 h-5" strokeWidth={3} />Deal the words</>}
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

        {/* Your word, shown through the whole live round */}
        {round && !gameOver && stage !== 'reveal' && yourWordCard}

        {/* Clues */}
        {stage === 'clues' && round && (
          <>
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="text-lg">Clues</h2>
                <span className="chip">
                  Pass {currentClueRound} of {round.clue_rounds}
                </span>
              </div>
              <p className="text-sm text-ink-soft font-semibold mb-4">
                One word each, in order. Show you know your word without saying it.
              </p>

              <ol className="space-y-2">
                {speakingOrder.map((id, index) => {
                  const said = thisPassClues.find(c => c.player_id === id);
                  const isNow = currentSpeaker === id;
                  return (
                    <li
                      key={id}
                      className={`panel p-3 flex items-center gap-3 ${isNow ? 'bg-amber-soft' : ''}`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-surface border-2 border-line shrink-0
                                       flex items-center justify-center text-xs font-extrabold">
                        {index + 1}
                      </span>
                      <span className="font-bold truncate">
                        {nameOf(id)}{id === me?.id && ' (you)'}
                      </span>
                      <span className="grow text-right font-extrabold truncate">
                        {said ? said.clue : isNow ? 'thinking...' : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {myTurn && me && (
              <div className="card p-5">
                <h2 className="text-lg mb-3">Your clue</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitClue(); }}
                    placeholder="One word..."
                    maxLength={40}
                    autoFocus
                    className="field grow"
                  />
                  <button onClick={submitClue} disabled={busy || !draft.trim()} className="btn btn-coral shrink-0">
                    <Send className="w-4 h-4" strokeWidth={3} />
                    Say it
                  </button>
                </div>
              </div>
            )}

            {!myTurn && me && (
              <div className="card p-5 flex items-center gap-3">
                <Hourglass className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                <p className="font-bold">
                  {currentSpeaker ? `${nameOf(currentSpeaker)} is giving a clue` : 'Everyone has spoken'}
                </p>
              </div>
            )}

            {/* Earlier passes stay on screen - the whole game is comparing them */}
            {currentClueRound > 1 && (
              <div className="panel p-4">
                <h3 className="text-sm mb-2">Pass 1</h3>
                <div className="flex flex-wrap gap-2">
                  {roundClues.filter(c => c.clue_round === 1).map(c => (
                    <span key={c.id} className="chip">
                      {nameOf(c.player_id)}: <b>{c.clue}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Voting */}
        {(stage === 'voting' || stage === 'revote') && round && (
          <>
            <div className="card p-5">
              <h2 className="text-xl mb-1">
                {stage === 'revote' ? 'It was a tie - vote again' : 'Who is the undercover?'}
              </h2>
              <p className="text-sm text-ink-soft font-semibold mb-4">
                {stage === 'revote'
                  ? 'Only the tied players can be picked this time.'
                  : 'Nobody sees a single vote until everyone has voted.'}
              </p>

              {me && !iVoted ? (
                <div className="space-y-2">
                  {activePlayers
                    .filter(p => p.id !== me.id)
                    .filter(p => stage !== 'revote' || (round.tied_ids || []).includes(p.id))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => castVote(p.id)}
                        disabled={busy}
                        className="tile tile-active cursor-pointer w-full p-4 justify-start gap-3 font-bold"
                      >
                        <UserRound className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                        {p.name}
                      </button>
                    ))}
                </div>
              ) : (
                <div className="panel p-4 flex items-center gap-3">
                  <Vote className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                  <p className="font-bold">
                    {me ? 'Vote locked in.' : 'Voting in progress.'}{' '}
                    <span className="text-ink-soft font-semibold">
                      {roundVotes.length}/{activePlayers.length} voted
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="panel p-4 flex flex-wrap gap-2">
              {activePlayers.map(p => {
                const done = roundVotes.some(v => v.voter_id === p.id);
                return (
                  <span key={p.id} className={`chip ${done ? 'chip-leaf' : 'chip-amber'}`}>
                    {done
                      ? <Vote className="w-3.5 h-3.5" strokeWidth={2.5} />
                      : <Hourglass className="w-3.5 h-3.5" strokeWidth={2.5} />}
                    {p.name}
                  </span>
                );
              })}
            </div>

            {allVoted && !isHost && (
              <p className="text-sm font-bold text-ink-soft flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                Counting the votes...
              </p>
            )}
          </>
        )}

        {/* The undercover's last chance */}
        {stage === 'final_guess' && round && (
          suspense ? (
            <div className="card p-8 text-center">
              <Eye className="w-8 h-8 mx-auto mb-3 animate-pulse" strokeWidth={2.5} />
              <p className="font-extrabold">The votes are in...</p>
            </div>
          ) : (
            <div className="card p-6">
              <h2 className="text-2xl mb-1">{nameOf(round.eliminated_id)} was the undercover</h2>
              <p className="text-ink-soft font-semibold mb-5">
                But there is one last chance to steal it.
              </p>

              {myRole?.is_undercover && me ? (
                <>
                  <p className="font-extrabold mb-3">What was everyone else&apos;s word?</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitFinalGuess(); }}
                      placeholder="Your guess..."
                      maxLength={40}
                      autoFocus
                      className="field grow"
                    />
                    <button onClick={submitFinalGuess} disabled={busy || !draft.trim()} className="btn btn-coral shrink-0">
                      <Send className="w-4 h-4" strokeWidth={3} />
                      Guess
                    </button>
                  </div>
                </>
              ) : (
                <p className="panel p-4 font-bold flex items-center gap-2">
                  <Hourglass className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  {nameOf(round.eliminated_id)} is guessing your word...
                </p>
              )}
            </div>
          )
        )}

        {/* Round reveal */}
        {stage === 'reveal' && round && reveal && (
          suspense ? (
            <div className="card p-8 text-center">
              <Eye className="w-8 h-8 mx-auto mb-3 animate-pulse" strokeWidth={2.5} />
              <p className="font-extrabold">The votes are in...</p>
            </div>
          ) : (
            <>
              <div className={`card p-6 text-center ${reveal.winning_side === 'civilians' ? 'bg-leaf-soft' : 'bg-coral-soft'}`}>
                <h2 className="text-2xl mb-2">
                  {reveal.winning_side === 'civilians'
                    ? 'The civilians win'
                    : reveal.caught ? 'Caught - and still stole it' : 'The undercover survives'}
                </h2>
                <p className="text-ink-soft font-bold mb-4">
                  {nameOf(reveal.undercover_id)} was the undercover
                  {reveal.eliminated_id && reveal.eliminated_id !== reveal.undercover_id &&
                    `, and ${nameOf(reveal.eliminated_id)} was voted out`}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="panel p-4">
                    <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft mb-1">Everyone else</p>
                    <p className="font-extrabold">{reveal.civilian_word}</p>
                  </div>
                  <div className="panel p-4">
                    <p className="text-xs uppercase tracking-wide font-extrabold text-ink-soft mb-1">Undercover</p>
                    <p className="font-extrabold">{reveal.undercover_word}</p>
                  </div>
                </div>

                {reveal.final_guess && (
                  <p className="mt-4 text-sm font-bold">
                    Guessed &quot;{reveal.final_guess}&quot; -{' '}
                    {reveal.final_guess_correct ? 'right, and the win is stolen' : 'not quite'}
                  </p>
                )}
              </div>

              <div className="card p-5">
                <h3 className="text-sm mb-3">Who voted for whom</h3>
                <ul className="space-y-2">
                  {(reveal.votes || []).map((v, i) => (
                    <li key={i} className="panel p-2.5 text-sm font-bold flex items-center gap-2">
                      {nameOf(v.voter_id)}
                      <ArrowRight className="w-3.5 h-3.5 text-ink-soft shrink-0" strokeWidth={3} />
                      <span className={v.target_id === reveal.undercover_id ? 'text-leaf' : ''}>
                        {nameOf(v.target_id)}
                      </span>
                      {v.vote_round > 1 && <span className="chip ml-auto">revote</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-5">
                <div className="flex flex-wrap gap-2 mb-4">
                  {leaderboard.map(p => (
                    <span key={p.id} className="chip">{p.name}: {scores.tally[p.id] || 0}</span>
                  ))}
                </div>
                {isHost ? (
                  <button onClick={nextRound} disabled={busy} className="btn btn-coral btn-lg w-full">
                    {roundNumber >= plannedRounds
                      ? <><Trophy className="w-5 h-5" strokeWidth={3} />See final scores</>
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
          )
        )}

        {/* Final */}
        {stage === 'finished' && (
          <>
            <div className="card p-8 text-center">
              <span className="w-16 h-16 rounded-xl bg-amber border-2 border-line mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />
              </span>
              <h1 className="text-3xl mb-1">{leaderboard[0]?.name} wins</h1>
              <p className="text-ink-soft font-bold">
                {scores.tally[leaderboard[0]?.id] || 0} points over {plannedRounds} rounds
              </p>
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">Final scores</h2>
              <ul className="space-y-3">
                {leaderboard.map((p, index) => (
                  <li key={p.id} className={`panel p-4 flex items-center gap-3 ${index === 0 ? 'bg-amber-soft' : ''}`}>
                    <span className="w-9 h-9 rounded-lg bg-surface border-2 border-line shrink-0
                                     flex items-center justify-center font-extrabold text-sm">
                      {index + 1}
                    </span>
                    <span className="font-bold grow truncate">
                      {p.name}{p.id === me?.id && <span className="text-ink-soft font-semibold"> (you)</span>}
                    </span>
                    <span className="font-extrabold shrink-0">{scores.tally[p.id] || 0}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-6">
              <h2 className="text-lg mb-4">Worth knowing</h2>
              <ul className="space-y-2 text-sm font-semibold">
                {(() => {
                  const best = [...activePlayers].sort((a, b) => scores.stats[b.id].undercoverWins - scores.stats[a.id].undercoverWins)[0];
                  const detective = [...activePlayers].sort((a, b) => scores.stats[b.id].correctAccusations - scores.stats[a.id].correctAccusations)[0];
                  const suspicious = [...activePlayers].sort((a, b) => scores.stats[b.id].votesReceived - scores.stats[a.id].votesReceived)[0];
                  const rows = [];
                  if (best && scores.stats[best.id].undercoverWins > 0) {
                    rows.push(['Best undercover', `${best.name} - ${scores.stats[best.id].undercoverWins} got away with it`]);
                  }
                  if (detective && scores.stats[detective.id].correctAccusations > 0) {
                    rows.push(['Best detective', `${detective.name} - ${scores.stats[detective.id].correctAccusations} correct calls`]);
                  }
                  if (suspicious && scores.stats[suspicious.id].votesReceived > 0) {
                    rows.push(['Most suspicious', `${suspicious.name} - ${scores.stats[suspicious.id].votesReceived} votes received`]);
                  }
                  return rows.map(([label, value]) => (
                    <li key={label} className="panel p-3 flex justify-between gap-3">
                      <span className="text-ink-soft">{label}</span>
                      <b className="text-right">{value}</b>
                    </li>
                  ));
                })()}
              </ul>
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3">
              {isHost ? (
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
          </>
        )}
      </div>
    </div>
  );
}
