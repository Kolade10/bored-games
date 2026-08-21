// Undercover - word pairs.
//
// A pair has to sit in a narrow band: close enough that the undercover can bluff
// through a round, far enough apart that a careful clue actually separates them.
// Difficulty here means how close the two words are, not how obscure they are -
// nobody enjoys a round where half the table has never heard of the word.

export const CATEGORIES = {
  general: { label: 'General', icon: 'Shapes' },
  entertainment: { label: 'Entertainment', icon: 'Clapperboard' },
  sports: { label: 'Sports', icon: 'Trophy' },
  funny: { label: 'Funny', icon: 'Laugh' },
  relationships: { label: 'Relationships', icon: 'Heart' },
  nigerian: { label: 'Nigerian', icon: 'MapPin' }
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', tone: 'bg-leaf', hint: 'Clearly different' },
  medium: { label: 'Medium', tone: 'bg-amber', hint: 'Related' },
  hard: { label: 'Hard', tone: 'bg-coral', hint: 'Very close' }
};

const CODES = { e: 'easy', m: 'medium', h: 'hard' };

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;
export const ROUND_OPTIONS = [3, 5, 10];
export const CLUE_ROUND_OPTIONS = [1, 2];

/** Clue rounds the group probably wants, given how many are playing. */
export const suggestedClueRounds = (players) => (players >= 9 ? 2 : 1);

/**
 * @param {string} category
 * @param {string} prefix
 * @param {Array<[string, string, string, string?]>} rows [code, wordA, wordB, sub?]
 */
export function build(category, prefix, rows) {
  return rows.map(([code, a, b, sub], index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    category,
    sub: sub || null,
    difficulty: CODES[code] || 'medium',
    words: [a, b]
  }));
}
