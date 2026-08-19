# Bored Games 🎮

A multiplayer game platform built with Next.js and Supabase. Create a room,
share the six-character code, and play in real time.

## Features

- **Tic Tac Toe**: Classic 3x3 grid game for two players
- **Name Place Animal Thing**: Word game with a shared letter and a 60s timer
- **Word Duel**: Head-to-head Wordle where you each set the other's word
- **Trivia**: Ten general knowledge questions from [OpenTDB](https://opentdb.com), solo or against friends
- **Guess Me**: A couples game - one answers about themselves, the other predicts
- **Who's More Likely?**: Both secretly pick which of you is more likely, then compare
- **Charades**: One phone passed around teams - act it out, tilt down for correct, up to pass
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

### Charades
- Played on **one device**, passed between teams - no room code and no database
- Solo team, or 2-4 teams with custom names; 1, 3, 5 or 10 rounds
- 60 seconds a turn. Tilt the phone **down** for correct, **up** to pass
- Tap zones at the bottom do the same, for devices with no motion sensor
- 481 prompts across nine categories; Nigerian is the largest at 111
- No word repeats within a game, and recent games are avoided too

When a turn starts the game goes fullscreen and asks for a landscape lock.
Where the browser refuses (iOS Safari has no orientation lock), the stage is
rotated 90 degrees with CSS instead, so it still plays sideways on an upright
phone. Orientation is detected with `matchMedia`, which is dependable where a
plain resize listener is not.

The tilt signal is gravity along the axis pointing out of the screen, read from
`devicemotion`. Held up with the screen facing the guessers that axis reads
about zero; tip the screen towards the floor and it swings to -9.8, towards the
ceiling +9.8. One number covers the whole gesture and it does not care which
way the phone was turned to get into landscape - unlike `beta` and `gamma`,
which need different maths per orientation and go unstable exactly where this
game holds the phone. The resting angle is calibrated at the start of each
turn. If the gestures feel reversed there is a **flip** toggle on the ready
screen.

Word bank lives in [src/lib/charades](src/lib/charades). Run
`node test-charades.mjs` after editing it.

### Who's More Likely?
- Two players; a scenario appears and you both privately pick one of you
- Both picks are revealed at once - naming the same person is an agreement
- Agreement scores 10, with streak bonuses at 3, 5, 7 and 10 in a row
- Games of 10+ rounds end on a double-points round
- 5, 10, 15 or 20 rounds across 12 categories

Agreement is judged on the **person named, not the button pressed**. If Victor
picks himself and Kolade picks Victor, they named the same person and that is a
match - so "Me" from one and the partner's name from the other agree, while
both pressing "Me" (two different people) does not.

Question bank lives in [src/lib/whoMoreLikely](src/lib/whoMoreLikely), one file
per category, storing only the stem of each question. Run
`node test-whomorelikely.mjs` after editing it.

### Guess Me
- Two players; one answers a question about themselves in secret, the other predicts it
- Roles swap every round, so you both answer and guess equally
- 5, 10, 15 or 20 rounds, with the categories you choose
- Correct prediction 10 points, hard questions 15, streaks multiply it
- Number and slider questions give partial credit for being close
- Open-ended questions are judged by the answerer - they decide if "Tokyo" counts as "Japan"
- Each side reads the question from their own angle: the answerer sees "What's my
  ideal weekend?", the guesser sees "What's Kolade's ideal weekend?"
- Questions about which of you is which ("who is the better driver?") show both
  players the same two names rather than "Me"/"You", so the answerer picking
  themselves and the guesser picking that same person counts as a match

Question bank lives in [src/lib/guessMe](src/lib/guessMe), one file per
category. Run `node test-guessme.mjs` after editing it: the test enforces
option counts, unique ids and wording, at least ten questions per category, and
that selection never puts two similar questions back to back.

### Trivia
- The room owner picks a category, a difficulty, and 5, 10, 15 or 30 seconds per question
- Ten multiple-choice questions, the same set in the same order for everyone
- A question closes once every player has answered or the timer runs out, then the answer shows
- One point per correct answer
- A room of one works fine, for when you just want the questions

### Word Duel
- You each secretly set a real word for the other, 5 to 10 letters
- Guesses allowed = word length + 1, so a 7-letter word gives 8 tries
- Green is right letter right place, amber is right letter wrong place
- Solve it to win; if you both solve it, fewest guesses takes the round
- Both words are validated against the dictionary before they can be locked in

Answers are checked against curated word lists first, then
[dictionaryapi.dev](https://dictionaryapi.dev). Names and places that are not in
either are scored as "unverified" rather than rejected, since no dictionary
covers every proper noun.

The lists live in [comprehensiveWordLists.js](src/lib/comprehensiveWordLists.js)
— roughly 2,700 words grouped by first letter, covering all 26 letters in every
category. Lookups ignore case, accents, hyphens and spacing, and accept plurals
for animals and things (`foxes` matches `fox`). When adding words, keep them
lowercase, keep the letter grouping, and re-run:

```bash
node test-wordlists.mjs
```

It fails if any letter drops below three words, if there are duplicates, or if
an entry is not lowercase — a thin letter is one the round leader can pick to
accidentally score everybody zero.
