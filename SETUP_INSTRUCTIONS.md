# BoredGame - Supabase Setup

Everything in the app runs through Supabase: rooms, players, game state and the
realtime sync between clients. Without the steps below the games will load but
nothing multiplayer will work.

## 1. Get the Supabase project

If you already have the project, skip to step 2. Otherwise create one at
[supabase.com](https://supabase.com). Either way you need:

- **Project URL** - Project Settings → API → Project URL
- **anon public key** - Project Settings → API → Project API keys
  (newer projects show this as **Publishable key**, `sb_publishable_...`)

> Supabase pauses free-tier projects after a stretch of inactivity, and a
> paused project stops resolving in DNS entirely - `fetch failed` /
> `ENOTFOUND`, not a clean error. If the app suddenly cannot reach the
> database, check the dashboard for a **Restore project** button before
> assuming anything is wrong with the code.

## 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in both values:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

The app reads these at build time and throws a clear error if either is
missing. When you deploy (Vercel or otherwise), set the same two variables in
the hosting environment.

> The anon key used to be hardcoded in `src/lib/supabase.js`, so it is in this
> repo's git history. Anon keys are meant to be public, but the RLS policies
> here are wide open, so anyone with the key can delete any room. If the repo
> is ever public, rotate the key (Project Settings → API) and update
> `.env.local`.

## 3. Run the SQL

In the Supabase dashboard → SQL Editor → New query. Paste the **contents** of
each file (not the filename) and hit Run:

1. **`database_schema.sql`** - creates the tables, indexes, RLS policies,
   realtime publication, cleanup function and triggers. Skip this on a database
   that already has the tables; it is not idempotent and will error on
   `CREATE TABLE`.
2. **`database_migration_2.sql`** - required, on new and existing databases
   alike. It is idempotent and safe to re-run.
3. **`database_migration_3.sql`** - adds the `chat_messages` table for in-room
   chat. Also idempotent. Until it is run the chat button simply does not
   appear; nothing else is affected.
4. **`database_migration_4.sql`** - adds Word Duel. Required before that game
   can be played. Also idempotent.
5. **`database_migration_5.sql`** - repairs four foreign keys from the original
   schema. Required; see below. Also idempotent.
6. **`database_migration_6.sql`** - adds Trivia. Required before that game can
   be played. Also idempotent.

Migration 6 follows the same pattern as 4: `SELECT` on
`trivia_questions.correct_answer` is revoked from `anon`, so the browser can
read the question and its four options but not which one is right. Answers come
back from `trivia_submit_answer()` the moment you lock a choice in, and
`trivia_reveal()` releases the answer to everyone once the timer expires or
every player has answered.

### What migration 5 fixes

Four foreign keys point at `players(id)` with no `ON DELETE` action. Without
the fix:

- **Leave room silently fails** for anyone who has led a round or started a
  game. The delete is refused with error 23503 and the button appears to do
  nothing.
- **`cleanup_inactive_rooms()` can never delete a room that has played a
  round**, because deleting the room cascades to its players and that delete is
  then refused. This is why old rooms accumulate indefinitely.

They become `ON DELETE SET NULL` rather than `CASCADE`, so a departing leader
does not take the round and everyone's answers with them.

Migration 4 is worth understanding: the secret words are deliberately **not
readable by the browser**. `SELECT` on `wordle_words.word` is revoked from the
`anon` role, and guesses are graded by `wordle_submit_guess()`, a
`SECURITY DEFINER` function that reads the word server-side and returns only
the colour pattern. Without that, either player could read their own answer out
of the network tab. The guess limit is enforced in the same function, so a
tampered client cannot award itself extra tries.

`cat database_migration_2.sql` prints it, or `xclip -sel clip < database_migration_2.sql`
copies it straight to the clipboard.

(`database_migration.sql` is the older one-off that added two columns to
`game_sessions`; `database_migration_2.sql` includes it, so you can skip it.)

### What migration 2 does and why it matters

| Change | Without it |
| --- | --- |
| `REPLICA IDENTITY FULL` on all game tables | Postgres only sends the primary key for `DELETE`s, so realtime subscriptions filtered by `session_id` / `room_id` never fire. The Tic Tac Toe board does not clear for the other player after "New Round", and players who leave stay in the list. |
| Unique index on `scores (session_id, player_id, round_number)` | Every client that reaches the end of a round writes its own score row, multiplying everyone's totals. |
| Unique index on `player_answers (round_id, player_id)` | A double submit creates two answer rows for one player. |
| Unique index on `rounds (session_id, round_number)` | Two rounds can exist for the same round number, which breaks loading the round. |
| Unique indexes on `tic_tac_toe_moves` | Two players clicking simultaneously can both claim the same square. |
| Realtime publication check | Tables added later are not broadcast at all. |

### Verify realtime is on

Database → Replication → `supabase_realtime` should list all seven tables:
`rooms`, `players`, `game_sessions`, `rounds`, `player_answers`, `scores`,
`tic_tac_toe_moves`.

## 4. Check the connection

```bash
npm run dev
```

Open <http://localhost:3000/database-test> - every table should report ✅.

## 5. Play

1. Open <http://localhost:3000>, pick a game, create a room.
2. Open the same room code in a second browser (or a private window) and join.
3. The room owner (first player to join) starts the game.

## Security note

The RLS policies from `database_schema.sql` are `USING (true)` - anyone holding
the anon key can read and write every row, including deleting other people's
rooms. That is fine for a hobby project among friends, but it is the first
thing to tighten if this ever goes public. Doing it properly needs some notion
of identity (Supabase anonymous auth is the lightest option) so policies can
scope writes to the row's own player.
