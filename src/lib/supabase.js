import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env.local and set ' +
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Helper function to generate room codes
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Helper function to get/set player name from localStorage
export const getPlayerName = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('playerName') || ''
  }
  return ''
}

export const setPlayerName = (name) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('playerName', name)
  }
}

// Per-room player identity. Names are not a reliable identity (two people can
// pick the same name in different rooms, and a player who reloads needs to map
// back to their existing row), so we remember the player row id per room code.
const playerIdKey = (roomCode) => `boredgame:player:${roomCode.toUpperCase()}`

export const getRoomPlayerId = (roomCode) => {
  if (typeof window === 'undefined' || !roomCode) return null
  return localStorage.getItem(playerIdKey(roomCode))
}

export const setRoomPlayerId = (roomCode, playerId) => {
  if (typeof window === 'undefined' || !roomCode) return
  localStorage.setItem(playerIdKey(roomCode), playerId)
}

export const clearRoomPlayerId = (roomCode) => {
  if (typeof window === 'undefined' || !roomCode) return
  localStorage.removeItem(playerIdKey(roomCode))
}
