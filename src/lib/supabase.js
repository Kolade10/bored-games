import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lecvxldydknhytsjzaju.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlY3Z4bGR5ZGtuaHl0c2p6YWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MzA4NTMsImV4cCI6MjA3MTEwNjg1M30._QOJZ3TY-R6g78uMJuUo4nxWGGomcN46XeOoOk3pkx4'

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
