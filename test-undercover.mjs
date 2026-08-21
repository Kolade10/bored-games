// Checks on the Undercover word-pair bank and round setup.
//   node test-undercover.mjs

import { readFileSync } from 'fs';
import {
  PAIRS, CATEGORIES, selectPairs, assignUndercovers
} from './src/lib/undercover/index.js';

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log('1. Bank\n');
console.log(`  ${PAIRS.length} word pairs`);

const byCategory = {};
const byDifficulty = {};
const ids = new Set();
const seenPairs = new Set();
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

for (const p of PAIRS) {
  byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] || 0) + 1;

  if (ids.has(p.id)) fail(`duplicate id ${p.id}`);
  ids.add(p.id);

  const [a, b] = p.words;
  if (!a?.trim() || !b?.trim()) fail(`${p.id}: needs two words`);
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) {
    fail(`${p.id}: both words are the same - "${a}"`);
  }
  // Order does not matter, so treat A/B and B/A as the same pair.
  const key = [a, b].map(w => w.trim().toLowerCase()).sort().join(' | ');
  if (seenPairs.has(key)) fail(`duplicate pair: ${key}`);
  seenPairs.add(key);

  if (!CATEGORIES[p.category]) fail(`${p.id}: unknown category`);
  if (!['easy', 'medium', 'hard'].includes(p.difficulty)) fail(`${p.id}: bad difficulty`);
  [a, b].forEach(w => {
    if (EMOJI.test(w)) fail(`${p.id}: emoji in "${w}" - this codebase uses icons`);
    if (w.length > 24) fail(`${p.id}: "${w}" is too long to show as a secret word`);
  });
  // One word containing the other makes the undercover instantly obvious.
  const [short, long] = [a, b].sort((x, y) => x.length - y.length);
  if (long.toLowerCase().includes(short.toLowerCase()) && short.length > 3) {
    fail(`${p.id}: "${long}" contains "${short}" - too easy to spot`);
  }
}

console.log('\n  by category');
for (const id of Object.keys(CATEGORIES)) {
  const count = byCategory[id] || 0;
  console.log(`    ${CATEGORIES[id].label.padEnd(15)} ${String(count).padStart(4)}`);
  if (count < 25) fail(`category "${id}" has only ${count}`);
}
if ((byCategory.nigerian || 0) < 60) {
  fail(`Nigerian should be the biggest section, has ${byCategory.nigerian}`);
}
console.log('\n  by difficulty');
Object.entries(byDifficulty).forEach(([d, c]) => console.log(`    ${d.padEnd(15)} ${String(c).padStart(4)}`));

console.log('\n2. Pair selection\n');
for (const rounds of [3, 5, 10]) {
  const picked = selectPairs({ rounds });
  if (picked.length !== rounds) fail(`asked for ${rounds}, got ${picked.length}`);
  if (new Set(picked.map(p => p.id)).size !== picked.length) fail(`${rounds}: repeated a pair`);
  console.log(`  ok    ${rounds} rounds: ${picked.length} pairs, none repeated`);
}

const nigerianOnly = selectPairs({ rounds: 5, categories: ['nigerian'] });
if (nigerianOnly.some(p => p.category !== 'nigerian')) fail('category filter leaked');
else console.log('  ok    category filter respected');

const hardOnly = selectPairs({ rounds: 5, difficulty: 'hard' });
if (hardOnly.some(p => p.difficulty !== 'hard')) fail('difficulty filter leaked');
else console.log('  ok    difficulty filter respected');

const narrow = selectPairs({ rounds: 10, categories: ['relationships'], difficulty: 'hard' });
if (narrow.length !== 10) fail(`narrow selection returned ${narrow.length}, should still fill 10 rounds`);
else console.log('  ok    narrow selection still fills the game');

const used = PAIRS.slice(0, 100).map(p => p.id);
if (selectPairs({ rounds: 10, usedIds: used }).some(p => used.includes(p.id))) {
  fail('reused a pair from a previous game while fresh ones remained');
} else console.log('  ok    previously used pairs are avoided');

console.log('\n3. Undercover assignment\n');
for (const [players, rounds] of [[4, 3], [5, 5], [6, 10], [10, 10], [4, 10]]) {
  const ids2 = Array.from({ length: players }, (_, i) => `p${i}`);
  const picks = assignUndercovers(ids2, rounds);

  if (picks.length !== rounds) fail(`${players}p/${rounds}r: got ${picks.length} assignments`);
  const counts = {};
  picks.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const values = ids2.map(id => counts[id] || 0);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread > 1) fail(`${players}p/${rounds}r: uneven - someone was undercover ${Math.max(...values)}x, someone ${Math.min(...values)}x`);

  let backToBack = 0;
  for (let i = 1; i < picks.length; i++) if (picks[i] === picks[i - 1]) backToBack++;
  if (players > 1 && backToBack > 0) fail(`${players}p/${rounds}r: same player undercover twice running`);

  console.log(`  ok    ${players} players, ${rounds} rounds: spread ${spread}, no back-to-back`);
}

console.log('\n4. The bank stays on the server\n');
// Both words of a pair together are the one thing the game cannot leak. An
// import of index.js from a component ships all 298 pairs to every browser.
const componentSource = readFileSync('./src/components/UndercoverGame.js', 'utf8');
if (/from\s+['"]@\/lib\/undercover(\/index\.js)?['"]/.test(componentSource)) {
  fail('UndercoverGame imports the bank - import build.js and game.js instead');
} else {
  console.log('  ok    UndercoverGame imports build.js and game.js, not the bank');
}

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
