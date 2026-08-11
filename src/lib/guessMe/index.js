import { CATEGORIES, DIFFICULTIES, SCORING, TYPES } from './types.js';
import { RELATIONSHIP } from './relationship.js';
import { PERSONALITY } from './personality.js';
import { FUNNY } from './funny.js';
import { FOOD } from './food.js';
import { MUSIC } from './music.js';
import { ENTERTAINMENT } from './entertainment.js';
import { TRAVEL } from './travel.js';
import { LIFESTYLE } from './lifestyle.js';
import { FUTURE } from './future.js';
import { NIGERIAN } from './nigerian.js';

export { CATEGORIES, DIFFICULTIES, SCORING, TYPES };

export const QUESTIONS = [
  ...RELATIONSHIP, ...PERSONALITY, ...FUNNY, ...FOOD, ...MUSIC,
  ...ENTERTAINMENT, ...TRAVEL, ...LIFESTYLE, ...FUTURE, ...NIGERIAN
];

export const ROUND_OPTIONS = [
  { rounds: 5, label: 'Quick' },
  { rounds: 10, label: 'Standard' },
  { rounds: 15, label: 'Long' },
  { rounds: 20, label: 'Marathon' }
];

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Roughly half easy/medium and a real share of hard, so a game has some teeth
// without becoming a series of impossible questions.
const DIFFICULTY_MIX = ['easy', 'medium', 'hard', 'medium', 'easy', 'hard', 'medium', 'easy'];

/**
 * Picks the questions for a game.
 *
 * Not a plain random sample: it prefers questions the pair has not seen, keeps
 * the categories rotating, follows a difficulty rhythm, and refuses to put two
 * questions that share a tag next to each other - which is what stops
 * "favourite food" being followed immediately by "favourite Nigerian food".
 *
 * @param {object} options
 * @param {number} options.rounds how many questions to return
 * @param {string[]} [options.categories] restrict to these category ids
 * @param {string[]} [options.seenIds] question ids this pair has already had
 * @returns {Array<object>} questions, in play order
 */
export function selectQuestions({ rounds = 10, categories = [], seenIds = [] } = {}) {
  const seen = new Set(seenIds);
  const wanted = categories.length ? new Set(categories) : null;

  const eligible = QUESTIONS.filter(q => !wanted || wanted.has(q.category));
  const pool = eligible.length ? eligible : QUESTIONS;

  // Unseen first; fall back to seen ones only once the pool is exhausted.
  const unseen = shuffle(pool.filter(q => !seen.has(q.id)));
  const fallback = shuffle(pool.filter(q => seen.has(q.id)));
  const candidates = [...unseen, ...fallback];

  const picked = [];
  const usedCategories = [];

  for (let round = 0; round < rounds && candidates.length; round++) {
    const wantDifficulty = DIFFICULTY_MIX[round % DIFFICULTY_MIX.length];
    const previous = picked[picked.length - 1];
    const recentCategories = new Set(usedCategories.slice(-2));

    const scoreCandidate = (q) => {
      let score = 0;
      if (q.difficulty === wantDifficulty) score += 4;
      if (!recentCategories.has(q.category)) score += 3;
      // Never follow a question with one that covers the same ground.
      if (previous && q.tags?.some(t => previous.tags?.includes(t))) score -= 10;
      if (previous && q.type === previous.type) score -= 2;
      return score;
    };

    let bestIndex = 0;
    let bestScore = -Infinity;
    candidates.forEach((q, index) => {
      const score = scoreCandidate(q);
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

/** Points for a guess, mirroring the rules enforced in the database. */
export function scoreGuess({ question, answer, guess, streak = 0 }) {
  const base = question.difficulty === 'hard' ? SCORING.hardBase : SCORING.base;

  if (question.type === 'number' || question.type === 'slider') {
    const answerValue = Number(answer);
    const guessValue = Number(guess);
    if (Number.isNaN(answerValue) || Number.isNaN(guessValue)) {
      return { points: 0, match: false, closeness: 'far' };
    }

    const span = question.type === 'slider'
      ? 100
      : Math.max(1, (question.max ?? 100) - (question.min ?? 0));
    const delta = Math.abs(answerValue - guessValue);

    if (delta === 0) {
      return {
        points: (base + SCORING.perfectMatchBonus) * Math.max(1, streak + 1),
        match: true,
        closeness: 'exact'
      };
    }
    if (delta <= span * 0.05) return { points: SCORING.veryClose, match: false, closeness: 'very-close' };
    if (delta <= span * 0.15) return { points: SCORING.close, match: false, closeness: 'close' };
    return { points: 0, match: false, closeness: 'far' };
  }

  const same = String(answer).trim().toLowerCase() === String(guess).trim().toLowerCase();
  return {
    points: same ? base * Math.max(1, streak + 1) : 0,
    match: same,
    closeness: same ? 'exact' : 'far'
  };
}

/** Extra points awarded on hitting a streak milestone. */
export const streakBonus = (streak) => SCORING.streakBonuses[streak] || 0;
