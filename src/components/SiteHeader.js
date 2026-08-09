import Link from 'next/link';
import { Dices, House, Info, Trophy } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Home', Icon: House },
  { href: '/about', label: 'About', Icon: Info },
  { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy }
];

/**
 * Top bar for the browsing pages. Room and game screens use their own header
 * so the room code stays the most prominent thing on screen.
 */
export default function SiteHeader({ current }) {
  return (
    <header className="bg-surface border-b-2 border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="w-10 h-10 rounded-xl bg-amber border-2 border-line flex items-center justify-center
                           shadow-[3px_3px_0_var(--shadow)] group-hover:translate-x-[1px] group-hover:translate-y-[1px]
                           group-hover:shadow-[2px_2px_0_var(--shadow)] transition-transform">
            <Dices className="w-5 h-5 text-[var(--on-amber)]" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">BoredGame</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map(({ href, label, Icon }) => {
            const active = current === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg font-bold text-sm border-2
                  ${active
                    ? 'bg-amber-soft border-line'
                    : 'border-transparent text-ink-soft hover:text-ink hover:bg-sunken'}`}
              >
                <Icon className="w-4 h-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
