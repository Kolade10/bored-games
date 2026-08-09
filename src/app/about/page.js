import Link from 'next/link';
import {
  ArrowLeft, Grid3x3, Link2, Paintbrush, PencilLine, Sparkles, Users, Zap
} from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

const CURRENT = [
  {
    Icon: Grid3x3,
    title: 'Tic Tac Toe',
    body: 'The classic 3x3 grid for two players. Winner of a round opens the next one.'
  },
  {
    Icon: PencilLine,
    title: 'Name Place Animal Thing',
    body: 'One letter, four categories, sixty seconds. Answers nobody else thought of score the most.'
  }
];

const UPCOMING = [
  {
    Icon: Link2,
    title: 'Word Chain',
    body: 'Every word starts with the last letter of the one before it.'
  },
  {
    Icon: Paintbrush,
    title: 'Drawing Guess',
    body: 'One player draws, everyone else guesses. Talent optional.'
  }
];

const PRINCIPLES = [
  {
    Icon: Zap,
    title: 'No sign-up',
    body: 'Type a name, get a room code, play. Nothing to install and no account to create.'
  },
  {
    Icon: Users,
    title: 'Built for a group',
    body: 'Everyone sees the same board at the same time. Rooms hold spectators when they fill up.'
  },
  {
    Icon: Sparkles,
    title: 'Short by design',
    body: 'Games run a few minutes, not a few hours. Good for a break, a queue, or a slow meeting.'
  }
];

function GameRow({ Icon, title, body }) {
  return (
    <li className="flex gap-4 items-start">
      <span className="w-10 h-10 rounded-xl bg-sunken border-2 border-line flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" strokeWidth={2.5} />
      </span>
      <div>
        <h3 className="text-base mb-0.5">{title}</h3>
        <p className="text-sm text-ink-soft">{body}</p>
      </div>
    </li>
  );
}

export default function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader current="/about" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl lg:text-5xl mb-4">About BoredGame</h1>
        <p className="text-lg text-ink-soft mb-10 max-w-2xl">
          Party games that work over a room code. The kind of thing you reach for
          when two people are bored in different places.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {PRINCIPLES.map(({ Icon, title, body }) => (
            <div key={title} className="card p-5">
              <span className="w-10 h-10 rounded-xl bg-amber border-2 border-line flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-[var(--on-amber)]" strokeWidth={2.5} />
              </span>
              <h2 className="text-base mb-1">{title}</h2>
              <p className="text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <section className="card p-6">
            <h2 className="text-xl mb-4">Playable now</h2>
            <ul className="space-y-4">
              {CURRENT.map(game => <GameRow key={game.title} {...game} />)}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="text-xl mb-4">On the list</h2>
            <ul className="space-y-4">
              {UPCOMING.map(game => <GameRow key={game.title} {...game} />)}
            </ul>
          </section>
        </div>

        <section className="panel p-6 mb-10">
          <h2 className="text-lg mb-2">How it is built</h2>
          <p className="text-ink-soft">
            Next.js and React for the interface, Tailwind for styling, and Supabase
            for the database and realtime sync that keeps every player&apos;s screen
            in step. Game state lives server-side so refreshing never loses your place.
          </p>
        </section>

        <Link href="/" className="btn btn-quiet">
          <ArrowLeft className="w-4 h-4" strokeWidth={3} />
          Back to games
        </Link>
      </div>
    </div>
  );
}
