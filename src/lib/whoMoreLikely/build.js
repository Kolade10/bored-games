// Who's More Likely? - shared vocabulary and the question builder.
//
// Every question is the same shape ("Who is more likely to ___?") with the same
// two choices, so the bank stores only the stem. That keeps 500 questions
// readable and makes the wording consistent for free.

export const CATEGORIES = {
  funny: { label: 'Funny', icon: 'Laugh' },
  relationship: { label: 'Relationship', icon: 'Heart' },
  personality: { label: 'Personality', icon: 'Brain' },
  money: { label: 'Money', icon: 'Wallet' },
  food: { label: 'Food', icon: 'Utensils' },
  music: { label: 'Music', icon: 'Music' },
  entertainment: { label: 'Entertainment', icon: 'Clapperboard' },
  travel: { label: 'Travel', icon: 'Plane' },
  everyday: { label: 'Everyday Life', icon: 'House' },
  future: { label: 'Future', icon: 'Sparkles' },
  savage: { label: 'Savage', icon: 'Flame' },
  nigerian: { label: 'Nigerian', icon: 'MapPin' }
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', tone: 'bg-leaf' },
  medium: { label: 'Medium', tone: 'bg-amber' },
  hard: { label: 'Hard', tone: 'bg-coral' }
};

const DIFFICULTY_CODES = { e: 'easy', m: 'medium', h: 'hard' };

export const ROUND_OPTIONS = [
  { rounds: 5, label: 'Quick' },
  { rounds: 10, label: 'Standard' },
  { rounds: 15, label: 'Long' },
  { rounds: 20, label: 'Marathon' }
];

export const SCORING = {
  match: 10,
  finalRoundMultiplier: 2,
  streakBonuses: { 3: 5, 5: 10, 7: 15, 10: 25 }
};

/** Games of 10 or more end on a double-points round. */
export const hasBonusRound = (rounds) => rounds >= 10;

/**
 * Expands compact rows into full question objects.
 * @param {string} category
 * @param {string} prefix short id prefix, e.g. 'fun'
 * @param {Array<[string, string, string]>} rows [difficultyCode, stem, tag]
 */
export function build(category, prefix, rows) {
  return rows.map(([code, stem, tag], index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    category,
    difficulty: DIFFICULTY_CODES[code] || 'medium',
    text: `Who is more likely to ${stem}?`,
    tags: [tag]
  }));
}
