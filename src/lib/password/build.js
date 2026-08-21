// Password - the word bank.
//
// Every entry carries forbidden clues: the obvious things a clue giver would
// reach for first. Nothing enforces them technically, because the clues are
// spoken out loud - they are shown on the clue giver's screen and the table
// keeps them honest, which is how the party version of this game works anyway.

export const CATEGORIES = {
  general: { label: 'General', icon: 'Shapes' },
  food: { label: 'Food', icon: 'Utensils' },
  entertainment: { label: 'Entertainment', icon: 'Clapperboard' },
  sports: { label: 'Sports', icon: 'Trophy' },
  funny: { label: 'Funny', icon: 'Laugh' },
  relationships: { label: 'Relationships', icon: 'Heart' },
  nigerian: { label: 'Nigerian', icon: 'MapPin' }
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', tone: 'bg-leaf' },
  medium: { label: 'Medium', tone: 'bg-amber' },
  hard: { label: 'Hard', tone: 'bg-coral' }
};

const CODES = { e: 'easy', m: 'medium', h: 'hard' };

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;
export const TEAM_OPTIONS = [2, 3, 4];
export const ROUND_OPTIONS = [1, 3, 5, 10];
export const TURN_SECONDS = 60;

// Risk and reward: the longer it takes, the less it is worth.
export const POINT_STEPS = [5, 3, 1];

export const SCORING_MODES = {
  risk: { label: 'Risk & Reward', hint: '5 points, then 3, then 1' },
  classic: { label: 'Classic', hint: '1 point per word' }
};

export const TEAM_COLOURS = ['bg-coral', 'bg-teal', 'bg-leaf', 'bg-amber'];
export const TEAM_DEFAULT_NAMES = ['Red', 'Blue', 'Green', 'Gold'];

/**
 * @param {string} category
 * @param {string} prefix
 * @param {Array<[string, string, string, string?]>} rows
 *   [difficultyCode, word, pipe-separated forbidden clues, subcategory?]
 */
export function build(category, prefix, rows) {
  return rows.map(([code, word, forbidden, sub], index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    category,
    sub: sub || null,
    difficulty: CODES[code] || 'medium',
    word,
    forbidden: forbidden ? forbidden.split('|').map(f => f.trim()).filter(Boolean) : []
  }));
}
