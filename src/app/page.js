import Link from "next/link";
import {
  ArrowRight, BrainCircuit, Clock, Eye, Gauge, Grid3x3, Heart, Laugh, Link2,
  KeyRound, Paintbrush, PencilLine, Swords, Users
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import YourRooms from "@/components/YourRooms";

const GAMES = [
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    description: 'Classic 3x3 grid. Take turns, get three in a row, gloat responsibly.',
    players: '2 players',
    difficulty: 'Easy',
    estimatedTime: '2-5 min',
    accent: 'teal',
    Icon: Grid3x3,
    available: true
  },
  {
    id: 'name-place-thing',
    title: 'Name Place Animal Thing',
    description: 'One letter, four categories, sixty seconds. Think fast and score for answers nobody else picked.',
    players: '2-6 players',
    difficulty: 'Medium',
    estimatedTime: '5-10 min',
    accent: 'amber',
    Icon: PencilLine,
    available: true
  },
  {
    id: 'wordle',
    title: 'Word Duel',
    description: 'Wordle, except you each pick the word the other has to crack. Green for right place, amber for right letter.',
    players: '2 players',
    difficulty: 'Medium',
    estimatedTime: '3-8 min',
    accent: 'leaf',
    Icon: Swords,
    available: true
  },
  {
    id: 'trivia',
    title: 'Trivia',
    description: 'Ten general knowledge questions with a countdown. Play against friends, or on your own for the questions alone.',
    players: '1-8 players',
    difficulty: 'Any',
    estimatedTime: '3-10 min',
    accent: 'teal',
    Icon: BrainCircuit,
    available: true
  },
  {
    id: 'guess-me',
    title: 'Guess Me',
    description: 'A couples game. One of you answers about yourself, the other tries to predict it. Roles swap every round.',
    players: '2 players',
    difficulty: 'Easy',
    estimatedTime: '5-20 min',
    accent: 'coral',
    Icon: Heart,
    available: true
  },
  {
    id: 'who-more-likely',
    title: "Who's More Likely?",
    description: 'You both secretly pick which of you is more likely to do something, then find out whether you agree.',
    players: '2 players',
    difficulty: 'Easy',
    estimatedTime: '5-15 min',
    accent: 'amber',
    Icon: Laugh,
    available: true
  },
  {
    id: 'charades',
    title: 'Charades',
    description: 'One phone, passed around. Act it out while your team shouts - tilt down when they get it, up to skip.',
    players: '2-16 players',
    difficulty: 'Easy',
    estimatedTime: '10-20 min',
    accent: 'coral',
    Icon: Users,
    available: true
  },
  {
    id: 'undercover',
    title: 'Undercover',
    description: 'Everyone gets the same secret word. One of you gets a different one. Give clues, spot the impostor, vote them out.',
    players: '4-10 players',
    difficulty: 'Medium',
    estimatedTime: '10-25 min',
    accent: 'coral',
    Icon: Eye,
    available: true
  },
  {
    id: 'password',
    title: 'Password',
    description: 'Describe the secret word to your team - but the four most obvious clues are banned. Answer fast for more points.',
    players: '4-16 players',
    difficulty: 'Medium',
    estimatedTime: '10-20 min',
    accent: 'teal',
    Icon: KeyRound,
    available: true
  },
  {
    id: 'word-chain',
    title: 'Word Chain',
    description: 'Each word has to start with the last letter of the one before it. Break the chain, lose the round.',
    players: '2-4 players',
    difficulty: 'Medium',
    estimatedTime: '10-15 min',
    accent: 'leaf',
    Icon: Link2,
    available: false
  },
  {
    id: 'drawing-guess',
    title: 'Drawing Guess',
    description: 'One player draws, everyone else shouts guesses. Artistic talent strictly optional.',
    players: '3-8 players',
    difficulty: 'Easy',
    estimatedTime: '15-20 min',
    accent: 'coral',
    Icon: Paintbrush,
    available: false
  }
];

const ACCENT_BG = {
  teal: 'bg-teal',
  amber: 'bg-amber',
  leaf: 'bg-leaf',
  coral: 'bg-coral'
};

const ACCENT_TEXT = {
  teal: 'text-[var(--on-teal)]',
  amber: 'text-[var(--on-amber)]',
  leaf: 'text-[var(--on-leaf)]',
  coral: 'text-[var(--on-coral)]'
};

const ACCENT_BTN = {
  teal: 'btn-teal',
  amber: 'btn-amber',
  leaf: 'btn-leaf',
  coral: 'btn-coral'
};

function Stat({ Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-ink-soft shrink-0" strokeWidth={2.5} />
      <div className="min-w-0">
        <div className="text-[0.65rem] uppercase tracking-wide text-ink-soft font-bold">{label}</div>
        <div className="text-sm font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const available = GAMES.filter(g => g.available);
  const upcoming = GAMES.filter(g => !g.available);

  return (
    <div className="min-h-screen">
      <SiteHeader current="/" />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 lg:pt-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl lg:text-6xl mb-4">
            Pick a game.<br />Grab a friend.
          </h1>
          <p className="text-lg text-ink-soft mb-6">
            Share a room code and play together in real time, or pass one phone
            around the room. No accounts, no downloads, no nonsense.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-leaf">
              <span className="w-2 h-2 rounded-full bg-leaf" />
              {available.length} ready to play
            </span>
            <span className="chip">
              {upcoming.length} in the works
            </span>
          </div>
        </div>
      </section>

      {/* Rooms this browser is already in - renders nothing when there are none */}
      <YourRooms />

      {/* Games */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GAMES.map((game) => (
            <article
              key={game.id}
              className={`card overflow-hidden flex flex-col ${game.available ? '' : 'opacity-70'}`}
            >
              {/* Solid colour cap, no gradient */}
              <div className={`${ACCENT_BG[game.accent]} border-b-2 border-line px-6 py-5 flex items-center justify-between gap-4`}>
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl bg-surface border-2 border-line flex items-center justify-center shrink-0">
                    <game.Icon className="w-6 h-6" strokeWidth={2.5} />
                  </span>
                  <h2 className={`text-xl ${ACCENT_TEXT[game.accent]}`}>{game.title}</h2>
                </div>
                {!game.available && (
                  <span className="chip shrink-0">Soon</span>
                )}
              </div>

              <div className="p-6 flex flex-col gap-5 grow">
                <p className="text-ink-soft grow">{game.description}</p>

                <div className="grid grid-cols-3 gap-3 panel p-3">
                  <Stat Icon={Users} label="Players" value={game.players} />
                  <Stat Icon={Gauge} label="Level" value={game.difficulty} />
                  <Stat Icon={Clock} label="Time" value={game.estimatedTime} />
                </div>

                {game.available ? (
                  <Link href={`/games/${game.id}`} className={`btn ${ACCENT_BTN[game.accent]} w-full`}>
                    Play now
                    <ArrowRight className="w-4 h-4" strokeWidth={3} />
                  </Link>
                ) : (
                  <button type="button" disabled className="btn btn-quiet w-full">
                    Not ready yet
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t-2 border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-ink-soft">
          Made for people who are bored. Play nicely.
        </div>
      </footer>
    </div>
  );
}
