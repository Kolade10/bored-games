// The whole pair bank, for the seed generator and the tests only.
//
// Application code must not import this file - it drags all 298 pairs into
// whatever bundle it lands in, and both words of a pair together are the one
// thing the game cannot afford to leak. Components import './build.js' for the
// settings and './game.js' for the logic; the words come from the server.

import { GENERAL } from './general.js';
import { ENTERTAINMENT } from './entertainment.js';
import { SPORTS } from './sports.js';
import { FUNNY } from './funny.js';
import { RELATIONSHIPS } from './relationships.js';
import { NIGERIAN } from './nigerian.js';
import { shuffle } from './game.js';

export * from './build.js';
export * from './game.js';

export const PAIRS = [
  ...GENERAL, ...ENTERTAINMENT, ...SPORTS, ...FUNNY, ...RELATIONSHIPS, ...NIGERIAN
];

/**
 * Picks the pairs for a whole game, in play order.
 *
 * Chosen up front so no pair can repeat within a game, and so a later round
 * cannot hand out a pair an earlier round already burned. Which of the two
 * words becomes the civilian word is decided per round when roles are dealt,
 * so the same pair never feels one-directional.
 */
export function selectPairs({ rounds = 3, categories = [], difficulty = 'mixed', usedIds = [] } = {}) {
  const wanted = categories.length ? new Set(categories) : null;
  const skip = new Set(usedIds);

  let pool = PAIRS.filter(p => !wanted || wanted.has(p.category));
  if (difficulty !== 'mixed') {
    const matching = pool.filter(p => p.difficulty === difficulty);
    // Never leave a narrow combination with nothing to play.
    if (matching.length >= rounds) pool = matching;
  }
  if (!pool.length) pool = PAIRS;

  const fresh = shuffle(pool.filter(p => !skip.has(p.id)));
  const rest = shuffle(pool.filter(p => skip.has(p.id)));
  return [...fresh, ...rest].slice(0, rounds);
}
