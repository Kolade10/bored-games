import { supabase } from '@/lib/supabase';

// Charades is played on one device, so persistence has two jobs: survive a
// refresh, and survive it in a room with bad wifi. The database is the durable
// copy; a local mirror is written first so the game never stalls waiting on the
// network, and can still be resumed if the request failed.

const ID_KEY = 'boredgame:charades:gameid';
const MIRROR_KEY = 'boredgame:charades:state';
const STATE_VERSION = 1;

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

const local = {
  get(key) {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or full - the database copy still stands */
    }
  },
  clear(key) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }
};

export const getActiveGameId = () => local.get(ID_KEY);

export function clearActiveGame() {
  local.clear(ID_KEY);
  local.clear(MIRROR_KEY);
}

/**
 * Starts persisting a new game. Returns its id, or null if the table is not
 * there yet - the game then runs from the local mirror alone rather than
 * refusing to start.
 */
export async function createGame(state) {
  const payload = { ...state, version: STATE_VERSION };
  local.set(MIRROR_KEY, payload);

  const { data, error } = await supabase
    .from('charades_games')
    .insert({ state: payload })
    .select('id')
    .single();

  if (error) {
    if (!MISSING_TABLE.has(error.code)) console.error('Could not save game:', error);
    local.clear(ID_KEY);
    return null;
  }

  local.set(ID_KEY, data.id);
  return data.id;
}

/** Writes the mirror immediately, then pushes to the database. */
export async function saveGame(id, state, { finished = false } = {}) {
  const payload = { ...state, version: STATE_VERSION };
  local.set(MIRROR_KEY, payload);
  if (!id) return false;

  const { error } = await supabase
    .from('charades_games')
    .update({ state: payload, finished })
    .eq('id', id);

  if (error) {
    console.error('Could not save game:', error);
    return false;
  }
  if (finished) local.clear(ID_KEY);
  return true;
}

/**
 * The game to offer a resume for, if any. Prefers the stored row, and falls
 * back to the local mirror when the row cannot be fetched.
 */
export async function loadActiveGame() {
  const id = getActiveGameId();
  const mirror = local.get(MIRROR_KEY);

  if (!id) return mirror && !mirror.finished ? { id: null, state: mirror } : null;

  const { data, error } = await supabase
    .from('charades_games')
    .select('id, state, finished')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    if (error && !MISSING_TABLE.has(error.code)) console.error('Could not load game:', error);
    return mirror ? { id: null, state: mirror } : null;
  }
  if (data.finished) {
    clearActiveGame();
    return null;
  }

  // A mirror newer than the row means the last write did not land.
  const best = mirror && (mirror.savedAt || 0) > (data.state?.savedAt || 0) ? mirror : data.state;
  return { id: data.id, state: best };
}
