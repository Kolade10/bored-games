import { supabase, setRoomPlayerId } from './supabase';

/**
 * Adds a player to a room, or returns the existing row when someone reconnects
 * with a name that is already taken in that room. Players joining a full room
 * become spectators. The resulting player id is remembered for the room code so
 * a reload maps back to the same seat.
 *
 * @param {{id: string, room_code: string, max_players: number}} room
 * @param {Array<object>} existingPlayers players already in the room
 * @param {string} name trimmed display name
 * @returns {Promise<object>} the player row
 */
export async function joinRoomAsPlayer(room, existingPlayers, name) {
  const existing = existingPlayers.find(
    p => p.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    setRoomPlayerId(room.room_code, existing.id);
    return existing;
  }

  const activePlayers = existingPlayers.filter(p => !p.is_spectator);
  const isFull = activePlayers.length >= room.max_players;

  const { data, error } = await supabase
    .from('players')
    .insert({
      room_id: room.id,
      name,
      is_spectator: isFull,
      player_order: isFull
        ? null
        : Math.max(0, ...activePlayers.map(p => p.player_order || 0)) + 1
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A player with this name already exists in the room');
    }
    throw error;
  }

  setRoomPlayerId(room.room_code, data.id);
  return data;
}
