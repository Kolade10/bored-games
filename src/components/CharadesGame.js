'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Brain, Check, Clapperboard, Heart, House, Laugh, MapPin,
  Play, RotateCcw, Shapes, SkipForward, Smartphone, Trophy, Users, Utensils
} from 'lucide-react';
import {
  CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, TURN_SECONDS, MAX_TEAMS,
  buildDeck, TURN_DECK_SIZE
} from '@/lib/charades/index.js';
import {
  useTilt, requestTiltPermission, TILT_SUPPORTED, TILT_NEEDS_PERMISSION
} from '@/lib/charades/useTilt.js';

const CATEGORY_ICONS = {
  Shapes, Clapperboard, Trophy, Utensils, House, Laugh, Heart, Brain, MapPin
};

const CategoryIcon = ({ category, className }) => {
  const Icon = CATEGORY_ICONS[CATEGORIES[category]?.icon] || Shapes;
  return <Icon className={className} strokeWidth={2.5} />;
};

const DEFAULT_NAMES = ['Team 1', 'Team 2', 'Team 3', 'Team 4'];
const RECENT_KEY = 'boredgame:charades:recent';
const BEST_KEY = 'boredgame:charades:best';

const readRecent = () => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};

export default function CharadesGame() {
  // setup -> ready -> countdown -> playing -> turnEnd -> final
  const [phase, setPhase] = useState('mode');
  const [teamCount, setTeamCount] = useState(1);
  // Blank, not pre-filled: "Team 1" is the placeholder and the fallback, so
  // nobody has to clear the box before typing their own name.
  const [names, setNames] = useState(['', '', '', '']);
  const [categories, setCategories] = useState([]);
  const [difficulty, setDifficulty] = useState('mixed');
  const [rounds, setRounds] = useState(3);

  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [history, setHistory] = useState([]); // one entry per completed turn
  const [turnIndex, setTurnIndex] = useState(0); // counts every turn in the game

  const [deck, setDeck] = useState([]);
  const [turnWords, setTurnWords] = useState([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [turnResults, setTurnResults] = useState([]); // {word, got}
  const [flash, setFlash] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [countdown, setCountdown] = useState(3);

  const [tiltReady, setTiltReady] = useState(!TILT_NEEDS_PERMISSION && TILT_SUPPORTED);
  const [inverted, setInverted] = useState(false);
  const [portrait, setPortrait] = useState(false);

  const deadlineRef = useRef(0);
  const wakeLockRef = useRef(null);

  const teams = useMemo(
    () => Array.from({ length: teamCount }, (_, i) => ({
      index: i,
      name: (names[i] || '').trim() || DEFAULT_NAMES[i]
    })),
    [teamCount, names]
  );

  const totalTurns = teams.length * rounds;
  const activeTeam = teams[turnIndex % teams.length] || teams[0];
  const currentRound = Math.floor(turnIndex / teams.length) + 1;
  const word = turnWords[wordIndex] || null;

  const standings = useMemo(
    () => teams
      .map(t => ({ ...t, score: scores[t.index] }))
      .sort((a, b) => b.score - a.score),
    [teams, scores]
  );

  // Landscape is the intended way to hold this, but the game should not be a
  // dead end if the phone is upright.
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // Keep the screen awake while acting.
  useEffect(() => {
    if (phase !== 'playing' || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    let released = false;
    navigator.wakeLock.request('screen')
      .then(lock => { if (released) lock.release(); else wakeLockRef.current = lock; })
      .catch(() => {});
    return () => {
      released = true;
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [phase]);

  const nextWord = useCallback((got) => {
    setTurnResults(prev => [...prev, { word: turnWords[wordIndex], got }]);
    setWordIndex(i => i + 1);
    setFlash(got ? 'correct' : 'pass');
    setTimeout(() => setFlash(null), 320);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(got ? 40 : [20, 40, 20]);
    }
  }, [turnWords, wordIndex]);

  const handleCorrect = useCallback(() => {
    if (phase !== 'playing') return;
    setScores(prev => {
      const next = [...prev];
      next[activeTeam.index] += 1;
      return next;
    });
    nextWord(true);
  }, [phase, activeTeam, nextWord]);

  const handlePass = useCallback(() => {
    if (phase !== 'playing') return;
    nextWord(false);
  }, [phase, nextWord]);

  const { reading } = useTilt({
    active: phase === 'playing',
    inverted,
    onDown: handleCorrect,
    onUp: handlePass
  });

  // Countdown into the turn.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      deadlineRef.current = Date.now() + TURN_SECONDS * 1000;
      setSecondsLeft(TURN_SECONDS);
      setPhase('playing');
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Turn clock.
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setPhase('turnEnd');
    }, 200);
    return () => clearInterval(tick);
  }, [phase]);

  // Bank the turn once time is up.
  useEffect(() => {
    if (phase !== 'turnEnd') return;
    const got = turnResults.filter(r => r.got).length;
    setHistory(prev => [...prev, {
      team: activeTeam.index,
      teamName: activeTeam.name,
      round: currentRound,
      got,
      passed: turnResults.length - got,
      words: turnResults
    }]);
    // Hand back whatever this turn did not reach, and remember what it used.
    setDeck(prev => prev.slice(turnResults.length));
    if (typeof window !== 'undefined') {
      const used = turnResults.map(r => r.word?.id).filter(Boolean);
      const recent = [...used, ...readRecent()].slice(0, 250);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = () => {
    const fresh = buildDeck({ categories, difficulty, excludeIds: readRecent() });
    setDeck(fresh);
    setScores([0, 0, 0, 0]);
    setHistory([]);
    setTurnIndex(0);
    setPhase('ready');
  };

  const beginTurn = async () => {
    if (TILT_NEEDS_PERMISSION && !tiltReady) {
      setTiltReady(await requestTiltPermission());
    }
    setTurnWords(deck.slice(0, TURN_DECK_SIZE));
    setWordIndex(0);
    setTurnResults([]);
    setCountdown(3);
    setPhase('countdown');
  };

  const nextTurn = () => {
    const next = turnIndex + 1;
    if (next >= totalTurns) {
      setPhase('final');
      if (teams.length === 1 && typeof window !== 'undefined') {
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (scores[0] > best) localStorage.setItem(BEST_KEY, String(scores[0]));
      }
      return;
    }
    setTurnIndex(next);
    setPhase('ready');
  };

  const playAgain = () => {
    setPhase('mode');
    setScores([0, 0, 0, 0]);
    setHistory([]);
    setTurnIndex(0);
  };

  const stats = useMemo(() => {
    const totals = history.reduce((acc, h) => {
      acc.got += h.got;
      acc.passed += h.passed;
      return acc;
    }, { got: 0, passed: 0 });
    const best = history.reduce((max, h) => Math.max(max, h.got), 0);
    let longest = 0;
    history.forEach(h => {
      let run = 0;
      h.words.forEach(w => {
        run = w.got ? run + 1 : 0;
        longest = Math.max(longest, run);
      });
    });
    return {
      ...totals,
      best,
      longest,
      average: history.length ? (totals.got / history.length).toFixed(1) : '0'
    };
  }, [history]);

  const previousBest = typeof window !== 'undefined'
    ? Number(localStorage.getItem(BEST_KEY) || 0)
    : 0;

  /* ------------------------------------------------------------------ */

  const Shell = ({ children, wide }) => (
    <div className="min-h-screen">
      <header className="bg-surface border-b-2 border-line">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-coral border-2 border-line flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[var(--on-coral)]" strokeWidth={2.5} />
            </span>
            <p className="font-extrabold truncate">Charades</p>
          </div>
          <Link href="/" className="btn btn-quiet btn-sm">
            <House className="w-4 h-4" strokeWidth={3} />
          </Link>
        </div>
      </header>
      <div className={`${wide ? 'max-w-3xl' : 'max-w-xl'} mx-auto px-4 py-8`}>{children}</div>
    </div>
  );

  /* Gameplay is its own full-bleed screen - no chrome competing with the word */
  if (phase === 'countdown' || phase === 'playing') {
    const urgent = secondsLeft <= 10;
    return (
      <div
        className={`fixed inset-0 flex flex-col select-none touch-none
                    ${flash === 'correct' ? 'bg-leaf' : flash === 'pass' ? 'bg-amber' : 'bg-paper'}`}
      >
        {portrait && (
          <div className="absolute top-0 inset-x-0 z-10 bg-ink text-paper text-center py-2 text-sm font-bold flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4" strokeWidth={2.5} />
            Turn your phone sideways
          </div>
        )}

        <div className="flex items-center justify-between px-4 pt-3 text-sm font-extrabold">
          <span className="truncate">{activeTeam.name}</span>
          <span>{scores[activeTeam.index]}</span>
        </div>

        {phase === 'countdown' ? (
          <div className="grow flex items-center justify-center">
            <p className="text-[22vw] leading-none font-extrabold">
              {countdown > 0 ? countdown : 'GO'}
            </p>
          </div>
        ) : (
          <>
            <div className="grow flex items-center justify-center px-6 text-center">
              <p className="text-[clamp(2rem,9vw,5rem)] leading-tight font-extrabold break-words">
                {flash === 'correct' ? 'CORRECT'
                  : flash === 'pass' ? 'PASS'
                  : word?.text || 'Out of words'}
              </p>
            </div>

            <p className={`text-center font-extrabold tabular-nums
                           ${urgent ? 'text-coral text-[14vw]' : 'text-[9vw]'}`}>
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
              {String(secondsLeft % 60).padStart(2, '0')}
            </p>

            {/* Tap zones stand in for tilting when the sensor is unavailable,
                and give anyone a way to play if a gesture is missed. */}
            <div className="flex border-t-2 border-line">
              <button
                onClick={handlePass}
                className="grow py-5 font-extrabold flex items-center justify-center gap-2 border-r-2 border-line"
              >
                <SkipForward className="w-5 h-5" strokeWidth={3} />
                Tilt up / tap to pass
              </button>
              <button
                onClick={handleCorrect}
                className="grow py-5 font-extrabold flex items-center justify-center gap-2 bg-leaf text-[var(--on-leaf)]"
              >
                <Check className="w-5 h-5" strokeWidth={3} />
                Tilt down / tap for correct
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === 'mode') {
    return (
      <Shell>
        <h1 className="text-3xl mb-2">Charades</h1>
        <p className="text-ink-soft mb-6">
          One phone, passed around. Hold it up, act out the word, and let your team
          shout. Tilt the phone down when they get it, up to skip.
        </p>

        <div className="card p-6 mb-4">
          <h2 className="text-lg mb-4">How many teams?</h2>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setTeamCount(n)}
                className={`tile h-16 flex-col gap-0.5 font-extrabold ${
                  teamCount === n ? 'bg-coral text-[var(--on-coral)]' : 'tile-active cursor-pointer'
                }`}
              >
                <span className="text-xl">{n}</span>
                <span className="text-[0.6rem] uppercase tracking-wide">
                  {n === 1 ? 'Solo' : 'Teams'}
                </span>
              </button>
            ))}
          </div>
          {teamCount === 1 && previousBest > 0 && (
            <p className="mt-3 text-sm font-bold text-ink-soft">
              Your best so far: {previousBest}
            </p>
          )}
        </div>

        <div className="card p-6 mb-4">
          <h2 className="text-lg mb-1">Team names</h2>
          <p className="text-sm text-ink-soft mb-4">
            Leave one blank and it keeps the default.
          </p>
          <div className="space-y-3">
            {Array.from({ length: teamCount }).map((_, i) => (
              <input
                key={i}
                type="text"
                value={names[i]}
                onChange={(e) => setNames(prev => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })}
                placeholder={DEFAULT_NAMES[i]}
                maxLength={24}
                className="field"
              />
            ))}
          </div>
        </div>

        <button onClick={() => setPhase('setup')} className="btn btn-coral btn-lg w-full">
          Next
          <ArrowRight className="w-5 h-5" strokeWidth={3} />
        </button>
      </Shell>
    );
  }

  if (phase === 'setup') {
    return (
      <Shell>
        <h1 className="text-2xl mb-6">Set up the game</h1>

        <div className="card p-6 mb-4">
          <h2 className="text-lg mb-1">Categories</h2>
          <p className="text-sm text-ink-soft mb-4">Pick any, or none for everything.</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORIES).map(([id, meta]) => {
              const on = categories.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => setCategories(prev =>
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

        <div className="card p-6 mb-4">
          <h2 className="text-lg mb-4">Difficulty</h2>
          <div className="grid grid-cols-4 gap-2">
            {['easy', 'medium', 'hard', 'mixed'].map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`tile h-14 font-extrabold text-sm capitalize ${
                  difficulty === d ? 'bg-amber text-[var(--on-amber)]' : 'tile-active cursor-pointer'
                }`}
              >
                {d === 'mixed' ? 'Mixed' : (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${DIFFICULTIES[d].tone}`} />
                    {DIFFICULTIES[d].label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-6 mb-4">
          <h2 className="text-lg mb-1">Rounds</h2>
          <p className="text-sm text-ink-soft mb-4">
            {teams.length === 1
              ? `${rounds} turn${rounds > 1 ? 's' : ''} of 60 seconds.`
              : `Every team gets ${rounds} turn${rounds > 1 ? 's' : ''} of 60 seconds.`}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ROUND_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setRounds(n)}
                className={`tile h-14 font-extrabold ${
                  rounds === n ? 'bg-coral text-[var(--on-coral)]' : 'tile-active cursor-pointer'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-5 mb-4">
          <h2 className="text-sm mb-2">How to play</h2>
          <ul className="text-sm text-ink-soft font-semibold space-y-1.5">
            <li>Hold the phone up so your team cannot see it. Do not speak.</li>
            <li>Tilt the phone <b className="text-ink">down</b> when they guess it.</li>
            <li>Tilt <b className="text-ink">up</b> to skip. Skipping costs nothing.</li>
            <li>You can tap the bottom of the screen instead if you prefer.</li>
          </ul>
          {!TILT_SUPPORTED && (
            <p className="mt-3 text-sm font-bold">
              This device has no tilt sensor, so tap the buttons at the bottom instead.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setPhase('mode')} className="btn btn-quiet">Back</button>
          <button onClick={startGame} className="btn btn-coral btn-lg grow">
            <Play className="w-5 h-5" strokeWidth={3} />
            Start
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'ready') {
    return (
      <Shell>
        <div className="card p-8 text-center mb-4">
          <p className="chip mb-4">Round {currentRound} of {rounds}</p>
          <h1 className="text-3xl mb-2">{activeTeam.name}</h1>
          <p className="text-ink-soft font-bold mb-6">
            Give the phone to whoever is acting.
          </p>
          <button onClick={beginTurn} className="btn btn-coral btn-lg w-full">
            <Play className="w-5 h-5" strokeWidth={3} />
            We&apos;re ready
          </button>
          {TILT_SUPPORTED && (
            <button
              onClick={() => setInverted(v => !v)}
              className="mt-3 text-sm font-bold text-ink-soft underline"
            >
              {inverted ? 'Tilt controls are flipped' : 'Tilt feels backwards? Flip it'}
            </button>
          )}
        </div>

        {teams.length > 1 && history.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm mb-3">Scoreboard</h2>
            <ul className="space-y-2">
              {standings.map((t, i) => (
                <li key={t.index} className={`panel p-3 flex justify-between gap-3 ${
                  t.index === activeTeam.index ? 'bg-amber-soft' : ''
                }`}>
                  <span className="font-bold truncate">{i + 1}. {t.name}</span>
                  <b>{t.score}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Shell>
    );
  }

  if (phase === 'turnEnd') {
    const last = history[history.length - 1];
    return (
      <Shell>
        <div className="card p-8 text-center mb-4">
          <h1 className="text-2xl mb-1">{last?.teamName} finished</h1>
          <p className="text-6xl font-extrabold my-4">{last?.got ?? 0}</p>
          <p className="text-ink-soft font-bold">
            {last?.got ?? 0} guessed, {last?.passed ?? 0} passed
          </p>
        </div>

        {teams.length > 1 && (
          <div className="card p-5 mb-4">
            <h2 className="text-sm mb-3">Standings</h2>
            <ul className="space-y-2">
              {standings.map((t, i) => (
                <li key={t.index} className="panel p-3 flex justify-between gap-3">
                  <span className="font-bold truncate">{i + 1}. {t.name}</span>
                  <b>{t.score}</b>
                </li>
              ))}
            </ul>
          </div>
        )}

        {last?.words?.length > 0 && (
          <div className="card p-5 mb-4">
            <h2 className="text-sm mb-3">That turn</h2>
            <div className="flex flex-wrap gap-2">
              {last.words.map((w, i) => (
                <span key={i} className={`chip ${w.got ? 'chip-leaf' : ''}`}>
                  {w.got
                    ? <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    : <SkipForward className="w-3.5 h-3.5" strokeWidth={2.5} />}
                  {w.word?.text}
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={nextTurn} className="btn btn-coral btn-lg w-full">
          {turnIndex + 1 >= totalTurns
            ? <><Trophy className="w-5 h-5" strokeWidth={3} />Final scores</>
            : <><ArrowRight className="w-5 h-5" strokeWidth={3} />Next team</>}
        </button>
      </Shell>
    );
  }

  // Final
  const winner = standings[0];
  return (
    <Shell>
      <div className="card p-8 text-center mb-4">
        <div className="flex justify-center mb-4">
          <span className="w-16 h-16 rounded-xl bg-amber border-2 border-line flex items-center justify-center">
            <Trophy className="w-8 h-8 text-[var(--on-amber)]" strokeWidth={2.5} />
          </span>
        </div>
        {teams.length === 1 ? (
          <>
            <h1 className="text-3xl mb-1">You scored {scores[0]}</h1>
            <p className="text-ink-soft font-bold">
              {previousBest > scores[0]
                ? `Your best is still ${previousBest}`
                : 'That is your best yet'}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl mb-1">{winner?.name} wins</h1>
            <p className="text-ink-soft font-bold">{winner?.score} words</p>
          </>
        )}
      </div>

      {teams.length > 1 && (
        <div className="card p-6 mb-4">
          <h2 className="text-lg mb-4">Final scores</h2>
          <ul className="space-y-3">
            {standings.map((t, i) => (
              <li key={t.index} className={`panel p-4 flex items-center gap-3 ${i === 0 ? 'bg-amber-soft' : ''}`}>
                <span className="w-9 h-9 rounded-lg bg-surface border-2 border-line shrink-0 flex items-center justify-center font-extrabold text-sm">
                  {i + 1}
                </span>
                <span className="font-bold grow truncate">{t.name}</span>
                <b>{t.score}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-6 mb-4">
        <h2 className="text-lg mb-4">Game stats</h2>
        <ul className="space-y-2 text-sm font-semibold">
          <li className="panel p-3 flex justify-between"><span>Words guessed</span><b>{stats.got}</b></li>
          <li className="panel p-3 flex justify-between"><span>Words passed</span><b>{stats.passed}</b></li>
          <li className="panel p-3 flex justify-between"><span>Best turn</span><b>{stats.best}</b></li>
          <li className="panel p-3 flex justify-between"><span>Average per turn</span><b>{stats.average}</b></li>
          <li className="panel p-3 flex justify-between"><span>Longest streak</span><b>{stats.longest}</b></li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={playAgain} className="btn btn-coral btn-lg grow">
          <RotateCcw className="w-5 h-5" strokeWidth={3} />
          Play again
        </button>
        <Link href="/" className="btn btn-quiet shrink-0">
          <House className="w-4 h-4" strokeWidth={3} />
          All games
        </Link>
      </div>
    </Shell>
  );
}
