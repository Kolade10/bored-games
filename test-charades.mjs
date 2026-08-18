// Checks on the charades word bank and deck building.
//   node test-charades.mjs

import { WORDS, CATEGORIES, buildDeck } from './src/lib/charades/index.js';

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log('1. Bank\n');
console.log(`  ${WORDS.length} words and phrases`);

const byCategory = {};
const bySub = {};
const byDifficulty = {};
const ids = new Set();
const texts = new Set();
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

for (const w of WORDS) {
  byCategory[w.category] = (byCategory[w.category] || 0) + 1;
  byDifficulty[w.difficulty] = (byDifficulty[w.difficulty] || 0) + 1;
  if (w.sub) bySub[`${w.category}/${w.sub}`] = (bySub[`${w.category}/${w.sub}`] || 0) + 1;

  if (ids.has(w.id)) fail(`duplicate id ${w.id}`);
  ids.add(w.id);

  const key = w.text.trim().toLowerCase();
  if (texts.has(key)) fail(`duplicate word: "${w.text}"`);
  texts.add(key);

  if (!CATEGORIES[w.category]) fail(`${w.id}: unknown category ${w.category}`);
  if (!['easy', 'medium', 'hard'].includes(w.difficulty)) fail(`${w.id}: bad difficulty`);
  if (!w.text?.trim()) fail(`${w.id}: empty`);
  if (EMOJI.test(w.text)) fail(`${w.id}: emoji - this codebase uses icons`);
  // Has to be readable at a glance in landscape, at a large type size.
  if (w.text.length > 34) fail(`${w.id}: too long to read at a glance - "${w.text}"`);
  if (/[?]/.test(w.text)) fail(`${w.id}: charades prompts are not questions - "${w.text}"`);
}

console.log('\n  by category');
for (const id of Object.keys(CATEGORIES)) {
  const count = byCategory[id] || 0;
  console.log(`    ${CATEGORIES[id].label.padEnd(15)} ${String(count).padStart(4)}`);
  if (count < 25) fail(`category "${id}" has only ${count}`);
}
if ((byCategory.nigerian || 0) < 100) {
  fail(`Nigerian should be the biggest section, has ${byCategory.nigerian}`);
}

console.log('\n  by difficulty');
Object.entries(byDifficulty).forEach(([d, c]) => console.log(`    ${d.padEnd(15)} ${String(c).padStart(4)}`));

console.log('\n  Nigerian subcategories');
Object.entries(bySub).filter(([k]) => k.startsWith('nigerian/'))
  .forEach(([k, c]) => console.log(`    ${k.replace('nigerian/', '').padEnd(15)} ${String(c).padStart(4)}`));

console.log('\n2. Deck building\n');

const full = buildDeck();
if (full.length !== WORDS.length) fail(`deck should hold every word, got ${full.length}/${WORDS.length}`);
if (new Set(full.map(w => w.id)).size !== full.length) fail('deck repeated a word');
console.log(`  ok    full deck has all ${full.length} words, no repeats`);

// A 4 team x 10 round game is the most demanding: 40 turns.
const demanding = buildDeck();
if (demanding.length < 40 * 12) {
  fail(`only ${demanding.length} words - a 4 team, 10 round game could run dry`);
} else {
  console.log(`  ok    enough for 40 turns (${Math.floor(demanding.length / 40)} words per turn available)`);
}

const nigerianOnly = buildDeck({ categories: ['nigerian'] });
if (nigerianOnly.some(w => w.category !== 'nigerian')) fail('category filter leaked');
else console.log(`  ok    category filter respected (${nigerianOnly.length} Nigerian words)`);

const easyOnly = buildDeck({ difficulty: 'easy' });
if (easyOnly.some(w => w.difficulty !== 'easy')) fail('difficulty filter leaked');
else console.log(`  ok    difficulty filter respected (${easyOnly.length} easy words)`);

// A narrow combination must still yield a playable deck rather than nothing.
const narrow = buildDeck({ categories: ['couples'], difficulty: 'hard' });
if (narrow.length < 10) fail(`narrow selection returned only ${narrow.length} words`);
else console.log(`  ok    narrow selection still playable (${narrow.length} words)`);

const excluded = WORDS.slice(0, 200).map(w => w.id);
const avoiding = buildDeck({ excludeIds: excluded });
const firstHundred = avoiding.slice(0, 100);
if (firstHundred.some(w => excluded.includes(w.id))) {
  fail('recently played words were dealt before fresh ones');
} else console.log('  ok    recently played words are dealt last');

// Categories should interleave rather than clump.
let clumps = 0;
for (let i = 2; i < 60; i++) {
  if (full[i].category === full[i - 1].category && full[i].category === full[i - 2].category) clumps++;
}
if (clumps > 3) fail(`${clumps} runs of three same-category words in the first 60`);
else console.log(`  ok    categories interleave (${clumps} triple runs in the first 60)`);

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
