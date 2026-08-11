// Checks on the Who's More Likely? question bank.
//   node test-whomorelikely.mjs

import {
  QUESTIONS, CATEGORIES, selectQuestions, scoreRound
} from './src/lib/whoMoreLikely/index.js';

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log('1. Bank\n');
console.log(`  ${QUESTIONS.length} questions`);

const byCategory = {};
const byDifficulty = {};
const ids = new Set();
const texts = new Set();
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

for (const q of QUESTIONS) {
  byCategory[q.category] = (byCategory[q.category] || 0) + 1;
  byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;

  if (ids.has(q.id)) fail(`duplicate id ${q.id}`);
  ids.add(q.id);

  const key = q.text.trim().toLowerCase();
  if (texts.has(key)) fail(`duplicate question: "${q.text}"`);
  texts.add(key);

  if (!CATEGORIES[q.category]) fail(`${q.id}: unknown category`);
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) fail(`${q.id}: bad difficulty`);
  if (!q.tags?.length) fail(`${q.id}: needs a tag`);
  if (EMOJI.test(q.text)) fail(`${q.id}: emoji in text - this codebase uses icons`);
  // Every question must fit the one fixed phrasing, or the two choices stop
  // making sense.
  if (!q.text.startsWith('Who is more likely to ')) fail(`${q.id}: wrong phrasing - "${q.text}"`);
  if (!q.text.endsWith('?')) fail(`${q.id}: missing question mark`);
  if (q.text.length > 110) fail(`${q.id}: too long to read at a glance`);
}

console.log('\n  by category');
for (const id of Object.keys(CATEGORIES)) {
  const count = byCategory[id] || 0;
  console.log(`    ${CATEGORIES[id].label.padEnd(15)} ${String(count).padStart(3)}`);
  if (count < 20) fail(`category "${id}" has only ${count}`);
}
console.log('\n  by difficulty');
Object.entries(byDifficulty).forEach(([d, c]) => console.log(`    ${d.padEnd(15)} ${String(c).padStart(3)}`));

console.log('\n2. Selection\n');
for (const rounds of [5, 10, 15, 20]) {
  const picked = selectQuestions({ rounds });
  if (picked.length !== rounds) fail(`asked ${rounds}, got ${picked.length}`);
  if (new Set(picked.map(q => q.id)).size !== picked.length) fail(`${rounds}: repeated a question`);

  let clashes = 0;
  for (let i = 1; i < picked.length; i++) {
    if (picked[i].tags.some(t => picked[i - 1].tags.includes(t))) clashes++;
  }
  if (clashes) fail(`${rounds}: ${clashes} near-identical questions back to back`);

  const cats = new Set(picked.map(q => q.category)).size;
  if (rounds >= 10 && cats < 6) fail(`${rounds}-round game only used ${cats} categories`);
  console.log(`  ok    ${rounds} rounds: ${cats} categories, no repeats, no adjacent overlap`);
}

const seen = QUESTIONS.slice(0, 100).map(q => q.id);
if (selectQuestions({ rounds: 10, seenIds: seen }).some(q => seen.includes(q.id))) {
  fail('reused a seen question while unseen ones remained');
} else console.log('  ok    unseen questions preferred');

if (selectQuestions({ rounds: 5, categories: ['savage'] }).some(q => q.category !== 'savage')) {
  fail('category filter leaked');
} else console.log('  ok    category filter respected');

console.log('\n3. Scoring - agreement is about the person, not the button\n');

const A = 'player-a';
const B = 'player-b';
const cases = [
  // A presses "Me" (=A), B presses A's name. Same person -> agreement.
  [{ pickA: A, pickB: A }, true, 10, 'both name A (A pressed Me, B pressed their name)'],
  [{ pickA: B, pickB: B }, true, 10, 'both name B'],
  // A presses "Me" (=A), B presses "Me" (=B). Different people -> no match.
  [{ pickA: A, pickB: B }, false, 0, 'each names themselves - not an agreement'],
  [{ pickA: B, pickB: A }, false, 0, 'each names the other - not an agreement'],
  [{ pickA: A, pickB: A, isFinalRound: true }, true, 20, 'final round doubles'],
  [{ pickA: A, pickB: A, streak: 2 }, true, 15, 'third match adds the +5 bonus'],
  [{ pickA: A, pickB: A, streak: 4 }, true, 20, 'fifth match adds +10'],
  [{ pickA: A, pickB: A, streak: 9 }, true, 35, 'tenth match adds +25']
];

for (const [input, wantMatch, wantPoints, label] of cases) {
  const r = scoreRound(input);
  if (r.matched !== wantMatch || r.points !== wantPoints) {
    fail(`${label}: expected match=${wantMatch} points=${wantPoints}, got match=${r.matched} points=${r.points}`);
  } else {
    console.log(`  ok    ${label} -> ${r.matched ? 'match' : 'no match'}, ${r.points}`);
  }
}

if (scoreRound({ pickA: A, pickB: B }).streak !== 0) fail('a disagreement must reset the streak');
else console.log('  ok    disagreement resets the streak');

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
