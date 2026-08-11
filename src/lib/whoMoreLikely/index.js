import { CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, SCORING, hasBonusRound } from './build.js';
import { FUNNY } from './funny.js';
import { RELATIONSHIP } from './relationship.js';
import { PERSONALITY } from './personality.js';
import { MONEY } from './money.js';
import { FOOD } from './food.js';
import { MUSIC } from './music.js';
import { ENTERTAINMENT } from './entertainment.js';
import { TRAVEL } from './travel.js';
import { EVERYDAY } from './everyday.js';
import { FUTURE } from './future.js';
import { SAVAGE } from './savage.js';
import { NIGERIAN } from './nigerian.js';

export { CATEGORIES, DIFFICULTIES, ROUND_OPTIONS, SCORING, hasBonusRound };

export const QUESTIONS = [
  ...FUNNY, ...RELATIONSHIP, ...PERSONALITY, ...MONEY, ...FOOD, ...MUSIC,
  ...ENTERTAINMENT, ...TRAVEL, ...EVERYDAY, ...FUTURE, ...SAVAGE, ...NIGERIAN
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
 * Picks the questions for a game.
 *
 * Deliberately not a random sample: it rotates categories so ten rounds do not
 * all come from one place, keeps a mix of difficulties, and refuses to put two
 * questions sharing a tag next to each other so you never get "forget their
 * keys" straight after "forget their phone".
 */
export function selectQuestions({ rounds = 10, categories = [], seenIds = [] } = {}) {
  const seen = new Set(seenIds);
  const wanted = categories.length ? new Set(categories) : null;

  const eligible = QUESTIONS.filter(q => !wanted || wanted.has(q.category));
  const pool = eligible.length ? eligible : QUESTIONS;

  const unseen = shuffle(pool.filter(q => !seen.has(q.id)));
  const fallback = shuffle(pool.filter(q => seen.has(q.id)));
  const candidates = [...unseen, ...fallback];

  const picked = [];
  const usedCategories = [];

  for (let round = 0; round < rounds && candidates.length; round++) {
    const previous = picked[picked.length - 1];
    const recent = new Set(usedCategories.slice(-3));
    // Ease in, then let the harder, more revealing ones land later.
    const wantDifficulty = round < rounds * 0.3 ? 'easy' : round < rounds * 0.7 ? 'medium' : 'hard';

    let bestIndex = 0;
    let bestScore = -Infinity;
    candidates.forEach((q, index) => {
      let score = 0;
      if (!recent.has(q.category)) score += 5;
      if (q.difficulty === wantDifficulty) score += 3;
      if (previous && q.tags.some(t => previous.tags.includes(t))) score -= 12;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const [chosen] = candidates.splice(bestIndex, 1);
    picked.push(chosen);
    usedCategories.push(chosen.category);
  }

  return picked;
}

/**
 * Agreement is about the *person*, not the wording on the button.
 *
 * If Victor picks himself and Kolade picks "Victor", they have named the same
 * person and that is an agreement - even though one pressed "Me" and the other
 * pressed a name. Comparing the labels instead would call that a disagreement
 * and call "we both picked Me" (two different people) a match, which is the
 * opposite of what the game is about.
 */
export function scoreRound({ pickA, pickB, isFinalRound = false, streak = 0 }) {
  const matched = !!pickA && pickA === pickB;
  if (!matched) return { matched, points: 0, streak: 0, bonus: 0 };

  const nextStreak = streak + 1;
  const bonus = SCORING.streakBonuses[nextStreak] || 0;
  const base = SCORING.match * (isFinalRound ? SCORING.finalRoundMultiplier : 1);

  return { matched, points: base + bonus, streak: nextStreak, bonus };
}
