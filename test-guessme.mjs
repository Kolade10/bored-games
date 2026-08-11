// Checks on the Guess Me question bank and selection.
//   node test-guessme.mjs

import { QUESTIONS, CATEGORIES, selectQuestions, scoreGuess } from './src/lib/guessMe/index.js';

const OPTION_COUNTS = { multiple_choice: 4, this_or_that: 2, yes_no: 2 };
let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log('1. Bank\n');
console.log(`  ${QUESTIONS.length} questions`);

const byCategory = {};
const byType = {};
const byDifficulty = {};
const ids = new Set();
const texts = new Set();

for (const q of QUESTIONS) {
  byCategory[q.category] = (byCategory[q.category] || 0) + 1;
  byType[q.type] = (byType[q.type] || 0) + 1;
  byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;

  if (ids.has(q.id)) fail(`duplicate id ${q.id}`);
  ids.add(q.id);

  const key = q.text.trim().toLowerCase();
  if (texts.has(key)) fail(`duplicate question text: "${q.text}"`);
  texts.add(key);

  if (!CATEGORIES[q.category]) fail(`${q.id}: unknown category ${q.category}`);
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) fail(`${q.id}: bad difficulty`);
  if (!q.tags?.length) fail(`${q.id}: needs at least one tag`);
  if (!q.text?.trim()) fail(`${q.id}: empty text`);

  const expected = OPTION_COUNTS[q.type];
  if (expected) {
    if (!Array.isArray(q.options) || q.options.length !== expected) {
      fail(`${q.id}: ${q.type} needs exactly ${expected} options, has ${q.options?.length ?? 0}`);
    } else if (new Set(q.options).size !== q.options.length) {
      fail(`${q.id}: duplicate options`);
    }
  }
  if (q.type === 'number' && (q.min === undefined || q.max === undefined || q.min >= q.max)) {
    fail(`${q.id}: number question needs min < max`);
  }
  if (q.type === 'slider' && (!q.labels || q.labels.length !== 2)) {
    fail(`${q.id}: slider needs two labels`);
  }
}

console.log('\n  by category');
for (const id of Object.keys(CATEGORIES)) {
  const count = byCategory[id] || 0;
  console.log(`    ${CATEGORIES[id].label.padEnd(14)} ${String(count).padStart(3)}`);
  if (count < 10) fail(`category "${id}" has only ${count} questions`);
}
console.log('\n  by type');
Object.entries(byType).forEach(([t, c]) => console.log(`    ${t.padEnd(16)} ${String(c).padStart(3)}`));
console.log('\n  by difficulty');
Object.entries(byDifficulty).forEach(([d, c]) => console.log(`    ${d.padEnd(16)} ${String(c).padStart(3)}`));

// The design rule for this codebase is icons, never emoji.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
for (const q of QUESTIONS) {
  if (EMOJI.test(q.text)) fail(`${q.id}: emoji in question text`);
  (q.options || []).forEach(o => { if (EMOJI.test(o)) fail(`${q.id}: emoji in option "${o}"`); });
}
console.log('  ok    no emoji in questions or options');

// Person-referring options must use tokens, so both players see the same two
// names and "the answerer picked themselves" matches "the guesser picked them".
const PERSON_WORDING = /^(me|you)\b/i;
let tokenQuestions = 0;
for (const q of QUESTIONS) {
  (q.options || []).forEach(o => {
    if (PERSON_WORDING.test(o)) fail(`${q.id}: option "${o}" uses me/you wording instead of {answerer}/{partner}`);
    if (o === '{answerer}' || o === '{partner}') tokenQuestions++;
  });
}
console.log(`  ok    ${tokenQuestions} person options use name tokens`);

console.log('\n2. Selection\n');
for (const rounds of [5, 10, 15, 20]) {
  const picked = selectQuestions({ rounds });
  if (picked.length !== rounds) fail(`asked for ${rounds}, got ${picked.length}`);
  if (new Set(picked.map(q => q.id)).size !== picked.length) fail(`${rounds}-round game repeated a question`);

  let adjacentTagClash = 0;
  for (let i = 1; i < picked.length; i++) {
    if (picked[i].tags.some(t => picked[i - 1].tags.includes(t))) adjacentTagClash++;
  }
  if (adjacentTagClash > 0) fail(`${rounds}-round game put ${adjacentTagClash} similar questions back to back`);
  console.log(`  ok    ${rounds} rounds: ${new Set(picked.map(q => q.category)).size} categories, no repeats, no adjacent overlap`);
}

const seen = QUESTIONS.slice(0, 40).map(q => q.id);
const avoided = selectQuestions({ rounds: 10, seenIds: seen });
if (avoided.some(q => seen.includes(q.id))) fail('selection reused a seen question while unseen ones remained');
else console.log('  ok    unseen questions are preferred');

const restricted = selectQuestions({ rounds: 5, categories: ['nigerian'] });
if (restricted.some(q => q.category !== 'nigerian')) fail('category filter leaked other categories');
else console.log('  ok    category filter respected');

console.log('\n3. Scoring\n');
const mc = { type: 'multiple_choice', difficulty: 'easy' };
const hard = { type: 'multiple_choice', difficulty: 'hard' };
const slider = { type: 'slider', difficulty: 'easy' };

const cases = [
  [scoreGuess({ question: mc, answer: 'A', guess: 'A' }).points, 10, 'correct guess'],
  [scoreGuess({ question: mc, answer: 'A', guess: 'B' }).points, 0, 'wrong guess'],
  [scoreGuess({ question: hard, answer: 'A', guess: 'A' }).points, 15, 'hard question'],
  [scoreGuess({ question: mc, answer: 'A', guess: 'A', streak: 2 }).points, 30, 'third in a streak'],
  [scoreGuess({ question: slider, answer: 80, guess: 80 }).points, 15, 'slider exact (perfect match bonus)'],
  [scoreGuess({ question: slider, answer: 80, guess: 77 }).points, 7, 'slider very close'],
  [scoreGuess({ question: slider, answer: 80, guess: 70 }).points, 5, 'slider close'],
  [scoreGuess({ question: slider, answer: 80, guess: 20 }).points, 0, 'slider far']
];

for (const [actual, expected, label] of cases) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`);
  else console.log(`  ok    ${label} = ${actual}`);
}

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
