// Coverage and lookup checks for the curated word lists.
//   node test-wordlists.mjs
//
// The coverage check matters: a letter with an empty or thin list is a letter
// where the round leader can accidentally score everyone at zero, because
// answers fall through to a dictionary that does not hold proper nouns.

import {
  COMPREHENSIVE_NAMES,
  COMPREHENSIVE_PLACES,
  COMPREHENSIVE_ANIMALS,
  COMPREHENSIVE_THINGS,
  findInComprehensiveLists
} from './src/lib/comprehensiveWordLists.js';

const LISTS = {
  name: COMPREHENSIVE_NAMES,
  place: COMPREHENSIVE_PLACES,
  animal: COMPREHENSIVE_ANIMALS,
  thing: COMPREHENSIVE_THINGS
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MIN_PER_LETTER = 3;

let failures = 0;
const fail = (message) => {
  failures++;
  console.log(`  FAIL  ${message}`);
};

console.log('1. Coverage\n');
let total = 0;
for (const [category, words] of Object.entries(LISTS)) {
  total += words.length;

  const counts = Object.fromEntries(
    ALPHABET.map(letter => [letter, words.filter(w => w[0] === letter).length])
  );
  const thin = ALPHABET.filter(letter => counts[letter] < MIN_PER_LETTER);
  const duplicates = [...new Set(words.filter((w, i) => words.indexOf(w) !== i))];
  const misordered = words.filter(w => w !== w.toLowerCase());

  console.log(
    `  ${category.padEnd(7)} ${String(words.length).padStart(4)} words  ` +
    `min/letter ${Math.min(...Object.values(counts))}`
  );

  if (thin.length) fail(`${category}: fewer than ${MIN_PER_LETTER} words for "${thin.join(', ')}"`);
  if (duplicates.length) fail(`${category}: duplicates - ${duplicates.join(', ')}`);
  if (misordered.length) fail(`${category}: entries must be lowercase - ${misordered.join(', ')}`);
}
console.log(`\n  ${total} words total\n`);

console.log('2. Lookup handling\n');
const CASES = [
  ['Victor', 'name', true, 'capitalisation ignored'],
  ['  yetunde  ', 'name', true, 'surrounding whitespace'],
  ['José', 'name', true, 'accents stripped'],
  ['charles', 'name', true, 'name ending in s is not singularised'],
  ['Athens', 'place', true, 'place ending in s is not singularised'],
  ['Port Harcourt', 'place', true, 'multi-word place'],
  ['dogs', 'animal', true, 'simple plural'],
  ['butterflies', 'animal', true, '-ies plural'],
  ['foxes', 'animal', true, '-es plural'],
  ['x-ray', 'thing', true, 'hyphenated'],
  ['xray', 'thing', true, 'hyphen omitted'],
  ['X Ray', 'thing', true, 'space instead of hyphen'],
  ['zzzzz', 'thing', false, 'gibberish rejected'],
  ['lagos', 'animal', false, 'wrong category rejected'],
  ['', 'name', false, 'empty string'],
  [null, 'name', false, 'null input'],
  ['dog', 'nonsense', false, 'unknown category']
];

for (const [word, category, expected, label] of CASES) {
  const actual = findInComprehensiveLists(word, category);
  if (actual !== expected) {
    fail(`${label}: findInComprehensiveLists(${JSON.stringify(word)}, "${category}") returned ${actual}`);
  } else {
    console.log(`  ok    ${label}`);
  }
}

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
