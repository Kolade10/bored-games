// Shared vocabulary for the Guess Me question bank.
//
// A question is always written in the first person, from the answerer's side:
// "What's my ideal weekend?" The guesser sees the same wording with a prompt
// asking what their partner picked, which is what makes the reveal land.

// `icon` names a lucide component. This file stays free of React so it can be
// imported by the test script; the components themselves are mapped in
// GuessMeGame, which keeps the imports explicit and tree-shakeable.
export const CATEGORIES = {
  relationship: { label: 'Relationship', icon: 'Heart' },
  personality: { label: 'Personality', icon: 'Brain' },
  funny: { label: 'Funny', icon: 'Laugh' },
  food: { label: 'Food', icon: 'Utensils' },
  music: { label: 'Music', icon: 'Music' },
  entertainment: { label: 'Entertainment', icon: 'Clapperboard' },
  travel: { label: 'Travel', icon: 'Plane' },
  lifestyle: { label: 'Lifestyle', icon: 'Wallet' },
  future: { label: 'Future', icon: 'Sparkles' },
  nigerian: { label: 'Nigerian', icon: 'MapPin' }
};

export const TYPES = {
  multiple_choice: 'multiple_choice',
  this_or_that: 'this_or_that',
  yes_no: 'yes_no',
  number: 'number',
  slider: 'slider',
  open_ended: 'open_ended'
};

// `tone` maps to a palette colour, drawn as a small dot rather than a coloured
// emoji so it inherits the theme.
export const DIFFICULTIES = {
  easy: { label: 'Easy', tone: 'bg-leaf' },
  medium: { label: 'Medium', tone: 'bg-amber' },
  hard: { label: 'Hard', tone: 'bg-coral' }
};

/**
 * Points. Kept in one place because these are the numbers most likely to be
 * tuned after a few real games.
 *
 * Note on the spec's "correct = 10 / perfect match = 15": for a multiple
 * choice question a correct guess is by definition exact, so there is no room
 * between the two. The bonus therefore applies where a guess *can* be near
 * without being exact - number and slider questions - and a hard question is
 * worth 15 instead of 10 either way.
 */
export const SCORING = {
  base: 10,
  hardBase: 15,
  perfectMatchBonus: 5,   // exact hit on a number/slider question
  veryClose: 7,
  close: 5,
  streakBonuses: { 3: 5, 5: 10, 7: 15 }
};

// Multiple choice needs four options; this-or-that exactly two.
export const OPTION_COUNTS = {
  multiple_choice: 4,
  this_or_that: 2,
  yes_no: 2
};

/** Builds a yes/no question without repeating the options every time. */
export const yesNo = (id, category, difficulty, text, tags) => ({
  id, category, type: 'yes_no', difficulty, text, tags,
  options: ['Yes', 'No']
});
