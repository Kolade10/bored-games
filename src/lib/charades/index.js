import { CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, TURN_SECONDS, MAX_TEAMS } from './build.js';
import { GENERAL } from './general.js';
import { ENTERTAINMENT } from './entertainment.js';
import { SPORTS } from './sports.js';
import { FOOD } from './food.js';
import { EVERYDAY } from './everyday.js';
import { FUNNY } from './funny.js';
import { COUPLES } from './couples.js';
import { TRICKY } from './tricky.js';
import { NIGERIAN } from './nigerian.js';

export { CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, TURN_SECONDS, MAX_TEAMS };

export const WORDS = [
  ...GENERAL, ...ENTERTAINMENT, ...SPORTS, ...FOOD, ...EVERYDAY,
  ...FUNNY, ...COUPLES, ...TRICKY, ...NIGERIAN
];

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Builds the deck for a whole game.
 *
 * One deck is drawn up front and shared by every team, which is what stops a
 * later team getting a word an earlier team already burned through. Each turn
 * takes from the front of the deck and hands back whatever it did not use.
 *
 * @param {object} options
 * @param {string[]} [options.categories] restrict to these categories
 * @param {'easy'|'medium'|'hard'|'mixed'} [options.difficulty]
 * @param {string[]} [options.excludeIds] words seen in recent games
 */
export function buildDeck({ categories = [], difficulty = 'mixed', excludeIds = [] } = {}) {
  const wanted = categories.length ? new Set(categories) : null;
  const skip = new Set(excludeIds);

  let pool = WORDS.filter(w => !wanted || wanted.has(w.category));
  if (difficulty !== 'mixed') {
    const matching = pool.filter(w => w.difficulty === difficulty);
    // Never leave a category/difficulty combination with nothing to play.
    if (matching.length >= 20) pool = matching;
  }
  if (!pool.length) pool = WORDS;

  // Interleave categories so a turn does not become ten animals in a row.
  const interleave = (words) => {
    const byCategory = {};
    words.forEach(w => {
      (byCategory[w.category] = byCategory[w.category] || []).push(w);
    });

    const order = shuffle(Object.keys(byCategory));
    const out = [];
    let added = true;
    while (added) {
      added = false;
      for (const key of order) {
        const next = byCategory[key].shift();
        if (next) {
          out.push(next);
          added = true;
        }
      }
    }
    return out;
  };

  // Interleave each group separately, so every unseen word is dealt before any
  // repeat. Mixing them first would let a recently played word jump the queue
  // whenever its category happened to come round.
  const fresh = interleave(shuffle(pool.filter(w => !skip.has(w.id))));
  const rest = interleave(shuffle(pool.filter(w => skip.has(w.id))));

  return [...fresh, ...rest];
}

/** How many words a turn could plausibly get through, plus headroom. */
export const TURN_DECK_SIZE = 40;
