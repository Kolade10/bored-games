# Bored Games 🎮

A multiplayer game platform built with Next.js and Supabase. Create a room,
share the six-character code, and play in real time.

## Features

- **Tic Tac Toe**: Classic 3x3 grid game for two players
- **Name Place Animal Thing**: Word game with a shared letter and a 60s timer
- **Room System**: Create and join game rooms with unique codes
- **Real-time Multiplayer**: Live game updates using Supabase realtime
- **Spectator Mode**: Watch when a room is already full
- **Room Chat**: Talk to everyone in the room, in the lobby and mid-game
- **Your Rooms**: The home page lists rooms you still have a seat in
- **No accounts**: Just pick a name

## Getting Started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database must be set up before multiplayer works - see
[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md). Short version: run
`database_schema.sql`, then `database_migration_2.sql`, in the Supabase SQL
editor.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Styling**: Tailwind CSS v4
- **Icons**: [lucide-react](https://lucide.dev)
- **Deployment**: Vercel

## Design system

Board-game look: warm paper, ink outlines, hard offset shadows, solid colour
fills. **No gradients, no purple, no emoji** - icons are always lucide
components so they scale and inherit colour.

Everything lives in [globals.css](src/app/globals.css) as CSS variables plus a
handful of component classes. Change a token there and it moves everywhere.

| Class | Use |
| --- | --- |
| `.card` | A panel that sits on the page - white, 2px ink border, 4px hard shadow |
| `.panel` | Recessed block for lists and secondary content inside a card |
| `.btn` + `.btn-amber` / `-teal` / `-coral` / `-leaf` / `-quiet` | Buttons; they press into the page on click |
| `.btn-lg` / `.btn-sm` | Button sizes |
| `.chip` + `.chip-amber` / `-teal` / `-coral` / `-leaf` | Small status pills |
| `.field` | Text inputs |
| `.tile` + `.tile-active` / `.tile-dead` | Board squares and letter keys |

Colour tokens: `--paper`, `--surface`, `--sunken`, `--ink`, `--ink-soft`,
`--line`, plus `--amber` / `--teal` / `--coral` / `--leaf` each with a `-soft`
variant and an `--on-*` foreground. Light and dark are both defined; every
foreground/background pair clears WCAG AA (4.5:1) in both themes, so if you
change an accent, re-check its `--on-*` partner.

Headings use Bricolage Grotesque, body text uses Geist, both via `next/font`.

## Project Layout

```
src/app/                  routes: home, games, /room/[roomCode], about, leaderboard
src/app/database-test/    connectivity check for the Supabase tables
src/components/           RoomManager (create/join) + the two game components
src/lib/supabase.js       Supabase client, room codes, per-room player identity
src/lib/rooms.js          shared join logic (seat, spectator, reconnect)
src/lib/wordValidation.js answer checking for Name Place Animal Thing
```

## Game Rules

### Tic Tac Toe
- Two players take turns placing X and O; three in a row wins
- Who goes first is drawn at random at the start of every round, and plays as X
- Extra players joining a full room become spectators

### Name Place Animal Thing
- The round leader picks a letter that has not been used yet
- Everyone fills in Name, Place, Animal and Thing starting with that letter
- 60 seconds, or until everyone has submitted, or until the leader stops it
- Leadership rotates each round; play as many rounds as you like

Scoring per answer:

| Points | When |
| --- | --- |
| 15 | Unique answer, verified for its category |
| 10 | Verified answer another player also gave |
| 5 | Unique answer that could not be verified (proper nouns, dictionary offline) |
| 3 | Unverified answer another player also gave |
| 0 | Wrong starting letter, not a real word, or wrong category |

Answers are checked against curated word lists first, then
[dictionaryapi.dev](https://dictionaryapi.dev). Names and places that are not in
either are scored as "unverified" rather than rejected, since no dictionary
covers every proper noun.

The lists live in [comprehensiveWordLists.js](src/lib/comprehensiveWordLists.js)
— roughly 1,900 words grouped by first letter, covering all 26 letters in every
category. Lookups ignore case, accents, hyphens and spacing, and accept plurals
for animals and things (`foxes` matches `fox`). When adding words, keep them
lowercase, keep the letter grouping, and re-run:

```bash
node test-wordlists.mjs
```

It fails if any letter drops below three words, if there are duplicates, or if
an entry is not lowercase — a thin letter is one the round leader can pick to
accidentally score everybody zero.
