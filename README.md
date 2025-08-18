# Bored Games 🎮

A fun multiplayer game platform built with Next.js and Supabase, featuring various games that can be played in real-time with friends.

## Features

- **Tic Tac Toe**: Classic 3x3 grid game for two players
- **Name Place Thing**: Word association game with categories
- **Room System**: Create and join game rooms with unique codes
- **Real-time Multiplayer**: Live game updates using Supabase realtime
- **Spectator Mode**: Watch games without participating
- **Leaderboard**: Track wins and player statistics

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Setup

1. Create a Supabase project
2. Copy your environment variables to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Run the database schema from `database_schema.sql`
4. Start the development server

See `SETUP_INSTRUCTIONS.md` for detailed setup instructions.

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Game Rules

### Tic Tac Toe
- Two players take turns placing X and O
- First to get three in a row wins
- Supports spectators

### Name Place Thing
- Players fill categories with words starting with a given letter
- Points awarded for unique answers
- Multiple rounds with different letters
