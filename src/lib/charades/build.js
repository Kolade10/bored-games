// Charades - shared vocabulary and the word builder.
//
// Every entry is something a person can act out without speaking. Anything that
// can only be conveyed by saying the words does not belong here.

export const CATEGORIES = {
  general: { label: 'General', icon: 'Shapes' },
  entertainment: { label: 'Entertainment', icon: 'Clapperboard' },
  sports: { label: 'Sports', icon: 'Trophy' },
  food: { label: 'Food', icon: 'Utensils' },
  everyday: { label: 'Everyday Life', icon: 'House' },
  funny: { label: 'Funny', icon: 'Laugh' },
  couples: { label: 'Couples', icon: 'Heart' },
  tricky: { label: 'Tricky', icon: 'Brain' },
  nigerian: { label: 'Nigerian', icon: 'MapPin' }
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', tone: 'bg-leaf' },
  medium: { label: 'Medium', tone: 'bg-amber' },
  hard: { label: 'Hard', tone: 'bg-coral' }
};

const CODES = { e: 'easy', m: 'medium', h: 'hard' };

export const ROUND_OPTIONS = [1, 3, 5, 10];
export const TURN_SECONDS = 60;
export const MAX_TEAMS = 4;

/**
 * @param {string} category
 * @param {string} prefix short id prefix
 * @param {Array<[string, string, string?]>} rows [difficultyCode, word, subcategory?]
 */
export function build(category, prefix, rows) {
  return rows.map(([code, text, sub], index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    category,
    sub: sub || null,
    difficulty: CODES[code] || 'medium',
    text
  }));
}
