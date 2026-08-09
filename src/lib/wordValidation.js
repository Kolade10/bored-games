// Word validation for Name Place Animal Thing.
//
// Answers are checked against curated local lists first (instant, and the only
// sensible source for proper nouns), then against the free Dictionary API.
//
// Every answer resolves to one of four statuses:
//   'valid'          - recognised and it fits the category
//   'wrong-category' - a real word, but not a plausible answer for the category
//   'not-found'      - not a word we can find anywhere
//   'unverified'     - we could not check it (API down, or a proper noun that
//                      no dictionary covers). Scored generously rather than 0.

import { findInComprehensiveLists } from './comprehensiveWordLists.js';

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// Categories made up of proper nouns: a dictionary miss proves nothing, so we
// give the player the benefit of the doubt instead of scoring them zero.
const PROPER_NOUN_CATEGORIES = new Set(['name', 'place']);

// Cache to avoid repeated API calls for the same words
const wordCache = new Map();

/**
 * Looks a word up in the Dictionary API.
 * @param {string} word
 * @returns {Promise<{isValid: boolean, unavailable?: boolean, definition?: string, partOfSpeech?: string}>}
 */
export async function validateWord(word) {
  if (!word || typeof word !== 'string') {
    return { isValid: false };
  }

  const cleanWord = word.trim().toLowerCase();

  if (wordCache.has(cleanWord)) {
    return wordCache.get(cleanWord);
  }

  try {
    const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(cleanWord)}`);

    if (response.status === 404) {
      const result = { isValid: false };
      wordCache.set(cleanWord, result);
      return result;
    }

    if (!response.ok) {
      // Rate limited or down - do not cache, and do not punish the player.
      return { isValid: false, unavailable: true };
    }

    const data = await response.json();
    const firstEntry = data[0];
    const firstMeaning = firstEntry?.meanings?.[0];

    const result = {
      isValid: true,
      definition: firstMeaning?.definitions?.[0]?.definition || '',
      partOfSpeech: firstMeaning?.partOfSpeech || '',
      word: firstEntry?.word || cleanWord
    };

    wordCache.set(cleanWord, result);
    return result;
  } catch (error) {
    console.error('Error validating word:', error);
    return { isValid: false, unavailable: true };
  }
}

/**
 * Validates a word against a category.
 * @param {string} word
 * @param {'name'|'place'|'animal'|'thing'} category
 * @returns {Promise<{status: string, isValid: boolean, isCorrectCategory: boolean, source: string, reason: string, definition?: string}>}
 */
export async function validateWordAndCategory(word, category) {
  if (!word || !word.trim()) {
    return {
      status: 'not-found',
      isValid: false,
      isCorrectCategory: false,
      source: 'none',
      reason: 'No answer'
    };
  }

  const cleanWord = word.trim().toLowerCase();

  // Curated lists first - fast, offline, and the best source for proper nouns.
  if (findInComprehensiveLists(cleanWord, category)) {
    return {
      status: 'valid',
      isValid: true,
      isCorrectCategory: true,
      source: 'curated_list',
      reason: 'Known word from our word list'
    };
  }

  const dictionaryResult = await validateWord(cleanWord);

  if (dictionaryResult.unavailable) {
    return {
      status: 'unverified',
      isValid: false,
      isCorrectCategory: false,
      source: 'unavailable',
      reason: 'Could not be checked (dictionary unavailable)'
    };
  }

  if (dictionaryResult.isValid) {
    const fitsCategory = matchesCategory(cleanWord, category, dictionaryResult);
    return {
      status: fitsCategory ? 'valid' : 'wrong-category',
      isValid: true,
      isCorrectCategory: fitsCategory,
      source: 'dictionary_api',
      reason: fitsCategory
        ? 'Valid dictionary word in the right category'
        : `A real word, but not a ${category}`,
      definition: dictionaryResult.definition
    };
  }

  // Not in the dictionary. For names and places that is expected, so treat it
  // as unverified; for animals and things it means the word is not real.
  if (PROPER_NOUN_CATEGORIES.has(category)) {
    return {
      status: 'unverified',
      isValid: false,
      isCorrectCategory: false,
      source: 'unknown',
      reason: `Could not verify this ${category}`
    };
  }

  return {
    status: 'not-found',
    isValid: false,
    isCorrectCategory: false,
    source: 'unknown',
    reason: 'Not found in the dictionary'
  };
}

/**
 * Decides whether a dictionary entry plausibly belongs to a category.
 */
function matchesCategory(word, category, wordData) {
  const partOfSpeech = wordData?.partOfSpeech?.toLowerCase() || '';
  const definition = wordData?.definition?.toLowerCase() || '';

  switch (category) {
    case 'name':
      return isLikelyName(definition);
    case 'place':
      return isLikelyPlace(definition);
    case 'animal':
      return isLikelyAnimal(definition, partOfSpeech);
    case 'thing':
      return isLikelyThing(definition, partOfSpeech);
    default:
      return true;
  }
}

const NAME_INDICATORS = [
  'given name', 'surname', 'first name', 'last name', 'personal name',
  'biblical', 'mythological', 'character', 'person named'
];

const PLACE_INDICATORS = [
  'city', 'town', 'country', 'state', 'province', 'region', 'area',
  'location', 'place', 'capital', 'village', 'district', 'county',
  'continent', 'island', 'mountain', 'river', 'lake', 'ocean', 'sea',
  'street', 'avenue', 'road', 'building', 'landmark'
];

const ANIMAL_INDICATORS = [
  'animal', 'mammal', 'bird', 'fish', 'reptile', 'amphibian', 'insect',
  'species', 'creature', 'wildlife', 'domestic', 'wild', 'pet',
  'carnivore', 'herbivore', 'omnivore', 'predator', 'prey', 'rodent'
];

const isLikelyName = (definition) =>
  NAME_INDICATORS.some(indicator => definition.includes(indicator));

const isLikelyPlace = (definition) =>
  PLACE_INDICATORS.some(indicator => definition.includes(indicator));

const isLikelyAnimal = (definition, partOfSpeech) =>
  partOfSpeech.includes('noun') &&
  ANIMAL_INDICATORS.some(indicator => definition.includes(indicator));

// "Thing" is deliberately inclusive - any noun counts as an object.
const isLikelyThing = (definition, partOfSpeech) =>
  partOfSpeech.includes('noun') ||
  ['device', 'tool', 'object', 'item'].some(hint => definition.includes(hint));

/**
 * Validates a list of answers. Duplicate word/category pairs are looked up
 * once, and lookups run concurrently in small batches to keep scoring fast
 * without hammering the free API.
 *
 * @param {Array<{word: string, category: string}>} wordList
 * @returns {Promise<Array<object>>} results in the same order as the input
 */
export async function batchValidateWords(wordList) {
  const BATCH_SIZE = 4;
  const cacheKey = ({ word, category }) => `${category}:${word.trim().toLowerCase()}`;

  const uniqueEntries = [];
  const seen = new Set();
  for (const entry of wordList) {
    if (!entry.word || !entry.word.trim()) continue;
    const key = cacheKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEntries.push(entry);
  }

  const resultsByKey = new Map();
  for (let i = 0; i < uniqueEntries.length; i += BATCH_SIZE) {
    const batch = uniqueEntries.slice(i, i + BATCH_SIZE);
    const validations = await Promise.all(
      batch.map(entry => validateWordAndCategory(entry.word, entry.category))
    );
    batch.forEach((entry, index) => {
      resultsByKey.set(cacheKey(entry), validations[index]);
    });
  }

  return wordList.map(entry => {
    if (!entry.word || !entry.word.trim()) {
      return {
        word: entry.word || '',
        category: entry.category,
        status: 'not-found',
        isValid: false,
        isCorrectCategory: false,
        reason: 'No answer',
        source: 'none'
      };
    }

    const validation = resultsByKey.get(cacheKey(entry));
    return {
      word: entry.word.trim(),
      category: entry.category,
      ...validation
    };
  });
}
