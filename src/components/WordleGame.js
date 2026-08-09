'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { validateWord } from '@/lib/wordValidation';
import Link from 'next/link';
import {
  CircleAlert, Delete, Eye, Flag, Hourglass, House, Loader, RotateCcw, Send,
  Swords, Trophy
} from 'lucide-react';

const MIN_LENGTH = 5;
const MAX_LENGTH = 10;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const isSolved = (guesses) => guesses.some(g => /^g+$/.test(g.pattern));

/** Best-known state for each letter, for colouring the keyboard. */
const RANK = { b: 0, y: 1, g: 2 };

export default function WordleGame({ room, players, currentPlayer, gameSession }) {
  const [words, setWords] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [secret, setSecret] = useState('');
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const activePlayers = useMemo(
    () => players
      .filter(p => !p.is_spectator)
      .sort((a, b) => (a.player_order || 0) - (b.player_order || 0)),
    [players]
  );

  const me = currentPlayer && !currentPlayer.is_spectator ? currentPlayer : null;
  const opponent = me ? activePlayers.find(p => p.id !== me.id) : activePlayers[1];
  const boardOwner = me || activePlayers[0];

  // The word I have to solve was set by my opponent; the one I set is theirs.
  const myTarget = words.find(w => w.solver_id === boardOwner?.id) || null;
  const theirTarget = words.find(w => w.solver_id === opponent?.id) || null;

  const myGuesses = useMemo(
    () => guesses
      .filter(g => g.player_id === boardOwner?.id)
      .sort((a, b) => a.guess_number - b.guess_number),
    [guesses, boardOwner?.id]
  );
  const theirGuesses = useMemo(
    () => guesses.filter(g => g.player_id === opponent?.id),
    [guesses, opponent?.id]
  );

  const myMax = myTarget ? myTarget.word_length + 1 : 0;
  const theirMax = theirTarget ? theirTarget.word_length + 1 : 0;
  const mySolved = isSolved(myGuesses);
  const theirSolved = isSolved(theirGuesses);
  const myFinished = !!myTarget && (mySolved || myGuesses.length >= myMax);
  const theirFinished = !!theirTarget && (theirSolved || theirGuesses.length >= theirMax);

  const bothWordsSet = words.length >= 2;
  const phase = !bothWordsSet
    ? 'setting'
    : myFinished && theirFinished
      ? 'finished'
      : 'playing';

  const iHaveSet = !!theirTarget;

  const load = useCallback(async () => {
    const [wordsResult, guessesResult] = await Promise.all([
      supabase
        .from('wordle_words')
        .select('id, session_id, setter_id, solver_id, word_length, created_at')
        .eq('session_id', gameSession.id),
      supabase
        .from('wordle_guesses')
        .select('*')
        .eq('session_id', gameSession.id)
    ]);

    if (wordsResult.error) {
      console.error('Error loading words:', wordsResult.error);
      setError('Could not load the game. Has migration 4 been run?');
      return;
    }

    setWords(wordsResult.data || []);
    setGuesses(guessesResult.data || []);
  }, [gameSession.id]);

  useEffect(() => {
    load();
  }, [load, gameSession.round_data?.round_seq]);

  useEffect(() => {
    const channel = supabase
      .channel(`wordle-${gameSession.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wordle_words',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wordle_guesses',
        filter: `session_id=eq.${gameSession.id}`
      }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession.id, load]);

  // Words are only released once both players are done.
  useEffect(() => {
    if (phase !== 'finished' || revealed) return;

    supabase
      .rpc('wordle_reveal', { p_session_id: gameSession.id })
      .then(({ data, error: revealError }) => {
        if (revealError) {
          console.error('Error revealing words:', revealError);
          return;
        }
        if (data?.ready) setRevealed(data.words || []);
      });
  }, [phase, revealed, gameSession.id]);

  const wordFor = (playerId) =>
    revealed?.find(w => w.solver_id === playerId)?.word || '';

  const setSecretWord = async () => {
    if (!me || !opponent || busy) return;

    const clean = secret.trim().toLowerCase();
    if (!/^[a-z]+$/.test(clean)) {
      setError('Letters only, no spaces or punctuation.');
      return;
    }
    if (clean.length < MIN_LENGTH || clean.length > MAX_LENGTH) {
      setError(`Pick a word between ${MIN_LENGTH} and ${MAX_LENGTH} letters.`);
      return;
    }

    setBusy(true);
    setError('');

    const check = await validateWord(clean);
    if (!check.isValid && !check.unavailable) {
      setError(`"${clean}" is not in the dictionary. Try another word.`);
      setBusy(false);
      return;
    }

    // Do NOT chain .select() here. That switches the request to
    // Prefer: return=representation, which asks PostgREST to return every
    // column including `word` - and SELECT on `word` is revoked from anon, so
    // the insert comes back 401. The bare insert sends return=minimal.
    const { error: insertError } = await supabase.from('wordle_words').insert({
      session_id: gameSession.id,
      setter_id: me.id,
      solver_id: opponent.id,
      word: clean
    });

    if (insertError) {
      console.error('Error setting word:', insertError);
      setError(
        insertError.code === '23505'
          ? 'You have already set a word for this round.'
          : 'Could not save your word. Please try again.'
      );
    } else {
      setSecret('');
    }
    setBusy(false);
  };

  const submitGuess = useCallback(async () => {
    if (!me || !myTarget || busy || myFinished) return;
    if (draft.length !== myTarget.word_length) {
      setError(`Guess must be ${myTarget.word_length} letters.`);
      setShake(true);
      return;
    }

    setBusy(true);
    setError('');

    const check = await validateWord(draft);
    if (!check.isValid && !check.unavailable) {
      setError(`"${draft}" is not a word.`);
      setShake(true);
      setBusy(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('wordle_submit_guess', {
      p_session_id: gameSession.id,
      p_player_id: me.id,
      p_guess: draft
    });

    if (rpcError) {
      console.error('Error submitting guess:', rpcError);
      setError('Could not submit your guess. Please try again.');
    } else if (!data?.ok) {
      setError(data?.error || 'Guess rejected.');
      setShake(true);
    } else {
      setDraft('');
      await load();
    }

    setBusy(false);
  }, [me, myTarget, busy, myFinished, draft, gameSession.id, load]);

  // Physical keyboard, so desktop players can just type.
  useEffect(() => {
    if (phase !== 'playing' || !me || myFinished) return;

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        submitGuess();
      } else if (event.key === 'Backspace') {
        setDraft(value => value.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        setDraft(value =>
          value.length < (myTarget?.word_length || 0)
            ? value + event.key.toLowerCase()
            : value
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, me, myFinished, myTarget?.word_length, submitGuess]);

  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(timer);
  }, [shake]);

  const letterStates = useMemo(() => {
    const states = {};
    myGuesses.forEach(({ guess, pattern }) => {
      [...guess].forEach((letter, index) => {
        const mark = pattern[index];
        if (!(letter in states) || RANK[mark] > RANK[states[letter]]) {
          states[letter] = mark;
        }
      });
    });
    return states;
  }, [myGuesses]);

  const newGame = async () => {
    if (!me || busy) return;
    setBusy(true);
    try {
      await supabase.from('wordle_guesses').delete().eq('session_id', gameSession.id);
      await supabase.from('wordle_words').delete().eq('session_id', gameSession.id);

      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({
          round_data: { round_seq: (gameSession.round_data?.round_seq || 0) + 1 }
        })
        .eq('id', gameSession.id);

      if (updateError) throw updateError;

      setWords([]);
      setGuesses([]);
      setRevealed(null);
      setSecret('');
      setDraft('');
      setError('');
    } catch (err) {
      console.error('Error starting new game:', err);
      setError('Could not start a new round.');
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
      setError('Could not end the game.');
    }
  };

  const TILE_TONE = {
    g: 'bg-leaf text-[var(--on-leaf)]',
    y: 'bg-amber text-[var(--on-amber)]',
    b: 'bg-sunken text-ink-soft'
  };

  const renderBoard = () => {
    if (!myTarget) return null;
    const rows = [];

    for (let row = 0; row < myMax; row++) {
      const past = myGuesses[row];
      const isCurrent = !past && row === myGuesses.length && !myFinished;
      const cells = [];

      for (let col = 0; col < myTarget.word_length; col++) {
        const letter = past ? past.guess[col] : isCurrent ? draft[col] : '';
        const tone = past ? TILE_TONE[past.pattern[col]] : 'bg-surface';

        cells.push(
          <div
            key={col}
            className={`tile aspect-square min-w-0 font-extrabold uppercase
                        text-[clamp(0.7rem,4vw,1.5rem)] ${tone}
                        ${isCurrent && letter ? 'border-ink' : ''}`}
          >
            {letter || ''}
          </div>
        );
      }

      rows.push(
        <div
          key={row}
          className={`grid gap-1.5 ${isCurrent && shake ? 'animate-pulse' : ''}`}
          style={{ gridTemplateColumns: `repeat(${myTarget.word_length}, minmax(0, 1fr))` }}
        >
          {cells}
        </div>
      );
    }

    return <div className="space-y-1.5">{rows}</div>;
  };

  const result = () => {
    if (mySolved && theirSolved) {
      if (myGuesses.length < theirGuesses.length) return { text: 'You win', tone: 'chip-leaf' };
      if (myGuesses.length > theirGuesses.length) return { text: 'You lose', tone: 'chip-coral' };
      return { text: "It's a draw", tone: 'chip' };
    }
    if (mySolved) return { text: 'You win', tone: 'chip-leaf' };
    if (theirSolved) return { text: 'You lose', tone: 'chip-coral' };
    return { text: 'Nobody solved it', tone: 'chip' };
  };

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-leaf border-2 border-line flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-[var(--on-leaf)]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-tight truncate">Word Duel</p>
              <p className="text-xs text-ink-soft font-bold font-mono">{room.room_code}</p>
            </div>
          </div>
          <Link href="/" className="btn btn-quiet btn-sm">
            <House className="w-4 h-4" strokeWidth={3} />
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <p className="mb-5 flex items-center gap-2 text-sm font-bold text-coral">
            <CircleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}

        {!me && (
          <p className="chip mb-5">
            <Eye className="w-4 h-4" strokeWidth={2.5} />
            Watching {boardOwner?.name}&apos;s board
          </p>
        )}

        {/* Phase 1: choose a word for your opponent */}
        {phase === 'setting' && (
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl mb-2">
              {iHaveSet ? 'Word locked in' : `Set a word for ${opponent?.name || 'your opponent'}`}
            </h1>
            <p className="text-ink-soft mb-6">
              {iHaveSet
                ? `Waiting for ${opponent?.name || 'them'} to set yours...`
                : `Between ${MIN_LENGTH} and ${MAX_LENGTH} letters. They get one guess more than the word is long, so a longer word is not automatically meaner.`}
            </p>

            {me && !iHaveSet ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSecretWord(); }}
                  placeholder="Their word..."
                  maxLength={MAX_LENGTH}
                  autoFocus
                  className="field grow font-mono text-lg tracking-widest lowercase"
                />
                <button onClick={setSecretWord} disabled={busy} className="btn btn-leaf shrink-0">
                  {busy
                    ? <><Loader className="w-4 h-4 animate-spin" strokeWidth={3} />Checking</>
                    : <><Send className="w-4 h-4" strokeWidth={3} />Lock it in</>}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-ink-soft font-bold">
                <Loader className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                {iHaveSet ? 'Waiting for your opponent' : 'Spectating'}
              </div>
            )}

            {secret.length > 0 && !iHaveSet && (
              <p className="mt-3 text-sm text-ink-soft font-semibold">
                {secret.length} letters
                {secret.length >= MIN_LENGTH && secret.length <= MAX_LENGTH &&
                  ` - they get ${secret.length + 1} guesses`}
              </p>
            )}
          </div>
        )}

        {/* Phase 2 and 3: the board */}
        {phase !== 'setting' && myTarget && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="chip">
                {myTarget.word_length} letters &middot; {myGuesses.length}/{myMax} guesses
              </span>
              <span className={`chip ${theirFinished ? 'chip-leaf' : 'chip-amber'}`}>
                {opponent?.name || 'Opponent'}:{' '}
                {theirFinished
                  ? theirSolved ? `solved in ${theirGuesses.length}` : 'out of guesses'
                  : `${theirGuesses.length}/${theirMax}`}
              </span>
            </div>

            <div className="card p-4 sm:p-6">{renderBoard()}</div>

            {phase === 'playing' && me && !myFinished && (
              <>
                {/* On-screen keyboard, which is also the mobile input */}
                <div className="space-y-1.5">
                  {KEY_ROWS.map((row, index) => (
                    <div key={row} className="flex gap-1.5 justify-center">
                      {index === 2 && (
                        <button
                          onClick={submitGuess}
                          disabled={busy}
                          className="btn btn-leaf btn-sm px-2 grow-0"
                          aria-label="Submit guess"
                        >
                          Enter
                        </button>
                      )}
                      {[...row].map(letter => (
                        <button
                          key={letter}
                          onClick={() => setDraft(v =>
                            v.length < myTarget.word_length ? v + letter : v
                          )}
                          className={`tile flex-1 min-w-0 h-12 font-extrabold uppercase text-sm
                                      tile-active cursor-pointer
                                      ${TILE_TONE[letterStates[letter]] || ''}`}
                        >
                          {letter}
                        </button>
                      ))}
                      {index === 2 && (
                        <button
                          onClick={() => setDraft(v => v.slice(0, -1))}
                          className="btn btn-quiet btn-sm px-2 grow-0"
                          aria-label="Delete letter"
                        >
                          <Delete className="w-4 h-4" strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-ink-soft font-semibold">
                  Type on your keyboard or tap the letters
                </p>
              </>
            )}

            {phase === 'playing' && myFinished && (
              <div className="card p-5 flex items-center gap-3">
                <Hourglass className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                <p className="font-bold">
                  {mySolved ? `Solved in ${myGuesses.length}.` : 'Out of guesses.'}{' '}
                  <span className="text-ink-soft font-semibold">
                    Waiting for {opponent?.name || 'your opponent'} to finish.
                  </span>
                </p>
              </div>
            )}

            {phase === 'finished' && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-12 h-12 rounded-xl bg-amber border-2 border-line flex items-center justify-center shrink-0">
                    <Trophy className="w-6 h-6 text-[var(--on-amber)]" strokeWidth={2.5} />
                  </span>
                  <div>
                    <h2 className="text-2xl">{me ? result().text : 'Round over'}</h2>
                    <p className="text-sm text-ink-soft font-semibold">
                      Fewest guesses wins when you both solve it
                    </p>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {[boardOwner, opponent].filter(Boolean).map(player => {
                    const theirs = player.id === boardOwner?.id ? myGuesses : theirGuesses;
                    const solvedIt = player.id === boardOwner?.id ? mySolved : theirSolved;
                    return (
                      <li key={player.id} className="panel p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold truncate">
                            {player.name}
                            {player.id === me?.id && (
                              <span className="text-ink-soft font-semibold"> (you)</span>
                            )}
                          </p>
                          <p className="text-sm text-ink-soft font-semibold">
                            had{' '}
                            <span className="font-mono font-extrabold uppercase text-ink">
                              {wordFor(player.id) || '?????'}
                            </span>
                          </p>
                        </div>
                        <span className={`chip shrink-0 ${solvedIt ? 'chip-leaf' : 'chip-coral'}`}>
                          {solvedIt ? `${theirs.length} guesses` : 'missed'}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {me && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={newGame} disabled={busy} className="btn btn-leaf grow">
                      <RotateCcw className="w-4 h-4" strokeWidth={3} />
                      New words
                    </button>
                    <button onClick={endGame} className="btn btn-quiet grow">
                      <Flag className="w-4 h-4" strokeWidth={3} />
                      Back to lobby
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
