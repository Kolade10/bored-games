# BoredGame - Supabase Setup Instructions

## 🗄️ Database Setup

**IMPORTANT: You need to run the SQL commands in your Supabase dashboard before the multiplayer features will work.**

### Step 1: Access Supabase SQL Editor
1. Go to [supabase.com](https://supabase.com) and sign in
2. Open your project: `lecvxldydknhytsjzaju`
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Run the Database Schema
1. Copy all the SQL commands from `database_schema.sql`
2. Paste them into the SQL Editor
3. Click "Run" to execute the commands

This will create:
- **Tables**: rooms, players, game_sessions, rounds, player_answers, scores, tic_tac_toe_moves
- **Indexes**: For better performance
- **Row Level Security**: With open policies for now
- **Realtime**: Enabled for all tables
- **Functions**: For cleanup and activity tracking
- **Triggers**: For automatic updates

### Step 3: Verify Setup
After running the SQL, you should see the following tables in your database:
- `rooms`
- `players` 
- `game_sessions`
- `rounds`
- `player_answers`
- `scores`
- `tic_tac_toe_moves`

### Step 4: Test the Application
1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click on a game (Tic Tac Toe or Name Place Animal Thing)
4. Create a room or join with a room code
5. Test multiplayer functionality

## 🎮 Features Implemented

### ✅ Room Management
- Auto-generated 6-character room codes
- Player limits (2 for Tic Tac Toe, 2-6 for Name Place Animal Thing)
- Spectator support when rooms are full
- Real-time player list updates
- Automatic room cleanup after 1 hour of inactivity

### ✅ User Management
- Local storage for player names
- No authentication required
- Unique names per room
- Reconnection support

### ✅ Tic Tac Toe
- Real-time multiplayer gameplay
- Turn-based system
- Win/draw detection
- New round capability
- Spectator viewing

### ✅ Name Place Animal Thing
- Round-based gameplay (3 rounds default)
- Rotating leadership system
- Leader selects letters (no repeats)
- 60-second timer with leader stop capability
- Real-time answer submission
- Automatic scoring:
  - Unique answers: 10 points
  - Duplicate answers: 5 points
- Round-by-round score tracking
- Final leaderboard

### ✅ Real-time Features
- Live player actions
- Synchronized game state
- Real-time score updates
- Instant room updates
- Automatic reconnection

### ✅ Game Flow
- Room lobby with player management
- Game session management
- Score persistence
- Game history (cleared with room)
- Next round/end game options

## 🚀 Ready to Play!

Once you've run the database setup, your multiplayer BoredGame platform is fully functional! Players can:

1. **Create or join rooms** with room codes
2. **Play Tic Tac Toe** in real-time with another player
3. **Play Name Place Animal Thing** with 2-6 players
4. **Take turns as round leaders** picking letters
5. **Submit answers** within time limits
6. **View live scores** and leaderboards
7. **Start new rounds** or end games as desired

The application handles all edge cases like player disconnections, room cleanup, and real-time synchronization automatically using Supabase's real-time capabilities.

## 🔧 Development Notes

- All game state is managed in Supabase
- Real-time subscriptions keep all players synchronized
- Local storage handles player name persistence
- Room codes are unique and auto-generated
- Scoring algorithm is implemented server-side for fairness
- Cleanup functions prevent database bloat

Enjoy your multiplayer gaming platform! 🎮
