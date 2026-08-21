// Checks on the Password word bank and team setup.
//   node test-password.mjs

import { readFileSync } from 'fs';
import {
  WORDS, CATEGORIES, balancedTeams, pickClueGiver, pointsForStep
} from './src/lib/password/index.js';

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log('1. Bank\n');
console.log(`  ${WORDS.length} words`);

const byCategory = {};
const byDifficulty = {};
const ids = new Set();
const texts = new Set();
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
let forbiddenTotal = 0;

for (const w of WORDS) {
  byCategory[w.category] = (byCategory[w.category] || 0) + 1;
  byDifficulty[w.difficulty] = (byDifficulty[w.difficulty] || 0) + 1;
  forbiddenTotal += w.forbidden.length;

  if (ids.has(w.id)) fail(`duplicate id ${w.id}`);
  ids.add(w.id);

  const key = w.word.trim().toLowerCase();
  if (texts.has(key)) fail(`duplicate word: "${w.word}"`);
  texts.add(key);

  if (!CATEGORIES[w.category]) fail(`${w.id}: unknown category`);
  if (!['easy', 'medium', 'hard'].includes(w.difficulty)) fail(`${w.id}: bad difficulty`);
  if (!w.word?.trim()) fail(`${w.id}: empty word`);
  if (EMOJI.test(w.word)) fail(`${w.id}: emoji - this codebase uses icons`);
  if (w.word.length > 30) fail(`${w.id}: "${w.word}" too long for a clue giver to take in`);

  // Forbidden clues are the whole point of the mode; every word needs some.
  if (w.forbidden.length < 3) {
    fail(`${w.id}: only ${w.forbidden.length} forbidden clues, needs at least 3`);
  }
  if (new Set(w.forbidden.map(f => f.toLowerCase())).size !== w.forbidden.length) {
    fail(`${w.id}: repeats a forbidden clue`);
  }
  // Banning the word itself is implied, so listing it wastes a slot.
  if (w.forbidden.some(f => f.toLowerCase() === key)) {
    fail(`${w.id}: lists its own word as forbidden`);
  }
}

console.log(`  ${forbiddenTotal} forbidden clues (${(forbiddenTotal / WORDS.length).toFixed(1)} per word)`);

console.log('\n  by category');
for (const id of Object.keys(CATEGORIES)) {
  const count = byCategory[id] || 0;
  console.log(`    ${CATEGORIES[id].label.padEnd(15)} ${String(count).padStart(4)}`);
  if (count < 20) fail(`category "${id}" has only ${count}`);
}
if ((byCategory.nigerian || 0) < 80) {
  fail(`Nigerian should be the biggest section, has ${byCategory.nigerian}`);
}
console.log('\n  by difficulty');
Object.entries(byDifficulty).forEach(([d, c]) => console.log(`    ${d.padEnd(15)} ${String(c).padStart(4)}`));

console.log('\n2. Team formation\n');
for (const [players, teams] of [[4, 2], [9, 3], [9, 4], [16, 4], [5, 4], [4, 4]]) {
  const ids2 = Array.from({ length: players }, (_, i) => `p${i}`);
  const split = balancedTeams(ids2, teams);

  const sizes = split.map(t => t.length);
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total !== players) fail(`${players}p/${teams}t: ${total} players placed`);
  if (new Set(split.flat()).size !== players) fail(`${players}p/${teams}t: someone on two teams`);

  const spread = Math.max(...sizes) - Math.min(...sizes);
  if (spread > 1) fail(`${players}p/${teams}t: uneven teams ${sizes.join('/')}`);
  console.log(`  ok    ${players} players into ${teams} teams: ${sizes.join('/')}`);
}

console.log('\n3. Clue giver rotation\n');
for (const size of [1, 2, 3, 5]) {
  const members = Array.from({ length: size }, (_, i) => `m${i}`);
  const history = [];
  for (let turn = 0; turn < size * 3; turn++) {
    history.push(pickClueGiver(members, [...history]));
  }

  const counts = {};
  history.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const values = members.map(id => counts[id] || 0);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread > 1) fail(`team of ${size}: uneven turns ${values.join('/')}`);

  let backToBack = 0;
  for (let i = 1; i < history.length; i++) if (history[i] === history[i - 1]) backToBack++;
  if (size > 1 && backToBack > 0) fail(`team of ${size}: same clue giver twice running`);

  console.log(`  ok    team of ${size} over ${size * 3} turns: spread ${spread}, no repeats back to back`);
}

if (pickClueGiver([], []) !== null) fail('an empty team should have no clue giver');
else console.log('  ok    empty team handled');

console.log('\n4. Scoring\n');
const cases = [
  [pointsForStep(0), 5, 'first clue'],
  [pointsForStep(1), 3, 'second clue'],
  [pointsForStep(2), 1, 'third clue'],
  [pointsForStep(7), 1, 'never drops below 1'],
  [pointsForStep(0, 'classic'), 1, 'classic mode is always 1'],
  [pointsForStep(2, 'classic'), 1, 'classic mode ignores clue count']
];
for (const [actual, expected, label] of cases) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`);
  else console.log(`  ok    ${label} = ${actual}`);
}

console.log('\n5. The bank stays on the server\n');
// The whole design rests on the browser not having the words. An import of
// index.js from a component would drag all 276 of them into the bundle.
const componentSource = readFileSync('./src/components/PasswordGame.js', 'utf8');
if (/from\s+['"]@\/lib\/password(\/index\.js)?['"]/.test(componentSource)) {
  fail('PasswordGame imports the bank - import build.js and game.js instead');
} else {
  console.log('  ok    PasswordGame imports build.js and game.js, not the bank');
}

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
