// Word validation service using Dictionary API + Comprehensive local word lists
// This provides much better coverage for names, places, animals, and things

import { findInComprehensiveLists } from './comprehensiveWordLists.js';

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const BEHIND_THE_NAME_API_BASE = 'https://www.behindthename.com/api/lookup.json';

// Cache to avoid repeated API calls for the same words
const wordCache = new Map();
const nameCache = new Map();

/**
 * Validates a name using Behind the Name API
 * @param {string} name - The name to validate
 * @returns {Promise<{isValid: boolean, meaning?: string, gender?: string, origin?: string}>}
 */
async function validateNameWithBehindTheName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false };
  }

  const cleanName = name.trim().toLowerCase();
  
  // Check cache first
  if (nameCache.has(cleanName)) {
    return nameCache.get(cleanName);
  }

  try {
    // Behind the Name API - no key required for basic lookup
    const response = await fetch(`${BEHIND_THE_NAME_API_BASE}?name=${encodeURIComponent(cleanName)}`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Check if we got valid name data
      if (data && data.length > 0) {
        const nameData = data[0];
        const result = {
          isValid: true,
          meaning: nameData.meaning || '',
          gender: nameData.gender || '',
          origin: nameData.usage?.join(', ') || '',
          source: 'behindthename'
        };
        
        // Cache the result
        nameCache.set(cleanName, result);
        return result;
      } else {
        // Name not found in Behind the Name
        const result = { isValid: false, source: 'behindthename' };
        nameCache.set(cleanName, result);
        return result;
      }
    } else {
      // API error
      console.warn('Behind the Name API error:', response.status);
      return { isValid: false, source: 'behindthename', error: 'API error' };
    }
  } catch (error) {
    console.error('Error validating name with Behind the Name:', error);
    // On network error, don't penalize - let other validation methods handle it
    return { isValid: false, source: 'behindthename', error: 'Network error' };
  }
}

/**
 * Enhanced validation using comprehensive local lists + dictionary API
 * @param {string} word - The word to validate
 * @param {string} category - The category to check against
 * @returns {Promise<{isValid: boolean, isInComprehensiveList: boolean, definition?: string, partOfSpeech?: string}>}
 */
export async function validateWordEnhanced(word, category) {
  if (!word || typeof word !== 'string') {
    return { isValid: false, isInComprehensiveList: false };
  }

  const cleanWord = word.trim().toLowerCase();
  
  // First check our comprehensive lists (faster and more reliable for names/places)
  const isInComprehensiveList = findInComprehensiveLists(cleanWord, category);
  
  if (isInComprehensiveList) {
    return {
      isValid: true,
      isInComprehensiveList: true,
      source: 'comprehensive_list',
      definition: `Valid ${category} from curated list`
    };
  }
  
  // If not in our lists, check dictionary API
  const dictionaryResult = await validateWord(cleanWord);
  
  return {
    ...dictionaryResult,
    isInComprehensiveList: false,
    source: dictionaryResult.isValid ? 'dictionary_api' : 'unknown'
  };
}
export async function validateWord(word) {
  if (!word || typeof word !== 'string') {
    return { isValid: false };
  }

  const cleanWord = word.trim().toLowerCase();
  
  // Check cache first
  if (wordCache.has(cleanWord)) {
    return wordCache.get(cleanWord);
  }

  try {
    const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(cleanWord)}`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Extract first definition and part of speech
      const firstEntry = data[0];
      const firstMeaning = firstEntry?.meanings?.[0];
      const firstDefinition = firstMeaning?.definitions?.[0];
      
      const result = {
        isValid: true,
        definition: firstDefinition?.definition || '',
        partOfSpeech: firstMeaning?.partOfSpeech || '',
        word: firstEntry?.word || cleanWord
      };
      
      // Cache the result
      wordCache.set(cleanWord, result);
      return result;
    } else {
      // Word not found in dictionary
      const result = { isValid: false };
      wordCache.set(cleanWord, result);
      return result;
    }
  } catch (error) {
    console.error('Error validating word:', error);
    // On network error, assume word is valid to not penalize players
    return { isValid: true, definition: 'Could not verify - network error' };
  }
}

/**
 * Enhanced category validation using comprehensive lists + dictionary
 * @param {string} word - The word to validate
 * @param {string} category - The category ('name', 'place', 'animal', 'thing')
 * @returns {Promise<{isValid: boolean, isCorrectCategory: boolean, source: string, reason: string}>}
 */
export async function validateWordAndCategory(word, category) {
  if (!word || !word.trim()) {
    return {
      isValid: false,
      isCorrectCategory: false,
      source: 'none',
      reason: 'No answer'
    };
  }

  const cleanWord = word.trim().toLowerCase();
  
  // Check comprehensive lists first (most reliable for names/places)
  const isInComprehensiveList = findInComprehensiveLists(cleanWord, category);
  
  if (isInComprehensiveList) {
    return {
      isValid: true,
      isCorrectCategory: true,
      source: 'comprehensive_list',
      reason: 'Valid word from curated list'
    };
  }
  
  // Special handling for names - use Behind the Name API
  if (category === 'name') {
    const nameValidation = await validateNameWithBehindTheName(cleanWord);
    
    if (nameValidation.isValid) {
      return {
        isValid: true,
        isCorrectCategory: true,
        source: 'behindthename',
        reason: 'Valid name from Behind the Name database',
        meaning: nameValidation.meaning,
        origin: nameValidation.origin,
        gender: nameValidation.gender
      };
    }
  }
  
  // If not in comprehensive lists, try dictionary API
  const dictionaryResult = await validateWord(cleanWord);
  
  if (dictionaryResult.isValid) {
    // Check if the dictionary word fits the category
    const categoryMatch = validateCategoryFromDictionary(cleanWord, category, dictionaryResult);
    
    return {
      isValid: true,
      isCorrectCategory: categoryMatch,
      source: 'dictionary_api',
      reason: categoryMatch ? 'Valid dictionary word in correct category' : `Dictionary word but not a valid ${category}`,
      definition: dictionaryResult.definition
    };
  }
  
  // Word not found anywhere
  return {
    isValid: false,
    isCorrectCategory: false,
    source: 'unknown',
    reason: 'Word not found in dictionary or curated lists'
  };
}

/**
 * Original category validation for dictionary words
 */
function validateCategoryFromDictionary(word, category, wordData) {
  const partOfSpeech = wordData?.partOfSpeech?.toLowerCase() || '';
  const definition = wordData?.definition?.toLowerCase() || '';
  
  switch (category) {
    case 'name':
      return isLikelyName(word, definition);
    case 'place':
      return isLikelyPlace(word, definition, partOfSpeech);
    case 'animal':
      return isLikelyAnimal(word, definition, partOfSpeech);
    case 'thing':
      return isLikelyThing(word, definition, partOfSpeech);
    default:
      return true;
  }
}

// Helper functions for category validation
function isLikelyName(word, definition) {
  // Common name patterns or if it's capitalized in common usage
  const nameIndicators = [
    'given name', 'surname', 'first name', 'last name', 'personal name',
    'biblical', 'mythological', 'character', 'person named'
  ];
  
  // Check if definition contains name indicators
  if (nameIndicators.some(indicator => definition.includes(indicator))) {
    return true;
  }
  
  // Enhanced common names list
  const commonNames = [
    'alice', 'bob', 'charlie', 'david', 'emma', 'frank', 'grace', 'henry',
    'john', 'jane', 'mary', 'mike', 'nancy', 'paul', 'sarah', 'tom',
    'alex', 'anna', 'ben', 'chris', 'diana', 'eric', 'fiona', 'george',
    'helen', 'ian', 'julia', 'kevin', 'lisa', 'mark', 'nina', 'oscar',
    'pete', 'quinn', 'rachel', 'steve', 'tina', 'uma', 'victor', 'wendy',
    'adam', 'beth', 'carl', 'dana', 'evan', 'faith', 'gary', 'hope',
    'jack', 'kate', 'luke', 'mia', 'noah', 'olivia', 'rose', 'sam'
  ];
  
  return commonNames.includes(word.toLowerCase());
}

function isLikelyPlace(word, definition, partOfSpeech) {
  const placeIndicators = [
    'city', 'town', 'country', 'state', 'province', 'region', 'area',
    'location', 'place', 'capital', 'village', 'district', 'county',
    'continent', 'island', 'mountain', 'river', 'lake', 'ocean', 'sea',
    'street', 'avenue', 'road', 'building', 'landmark'
  ];
  
  // Check definition for place indicators
  if (placeIndicators.some(indicator => definition.includes(indicator))) {
    return true;
  }
  
  // Enhanced common places list
  const commonPlaces = [
    'paris', 'london', 'tokyo', 'beijing', 'moscow', 'rome', 'berlin',
    'madrid', 'amsterdam', 'vienna', 'prague', 'budapest', 'warsaw',
    'stockholm', 'oslo', 'copenhagen', 'helsinki', 'athens', 'dublin',
    'lisbon', 'brussels', 'zurich', 'geneva', 'munich', 'hamburg',
    'barcelona', 'milan', 'florence', 'venice', 'naples', 'turin',
    'australia', 'canada', 'france', 'germany', 'italy', 'spain',
    'england', 'scotland', 'ireland', 'wales', 'russia', 'china',
    'japan', 'india', 'brazil', 'mexico', 'egypt', 'greece'
  ];
  
  return commonPlaces.includes(word.toLowerCase());
}

function isLikelyAnimal(word, definition, partOfSpeech) {
  const animalIndicators = [
    'animal', 'mammal', 'bird', 'fish', 'reptile', 'amphibian', 'insect',
    'species', 'creature', 'wildlife', 'domestic', 'wild', 'pet',
    'carnivore', 'herbivore', 'omnivore', 'predator', 'prey'
  ];
  
  // Must be a noun and contain animal-related terms
  return partOfSpeech.includes('noun') && 
         animalIndicators.some(indicator => definition.includes(indicator));
}

function isLikelyThing(word, definition, partOfSpeech) {
  // Things are typically nouns that aren't names, places, or animals
  // We'll be inclusive here - if it's a noun, it's likely a "thing"
  return partOfSpeech.includes('noun') || 
         partOfSpeech.includes('object') ||
         definition.includes('device') ||
         definition.includes('tool') ||
         definition.includes('object') ||
         definition.includes('item');
}

/**
 * Batch validate multiple words using enhanced validation (comprehensive lists + dictionary)
 * @param {Array<{word: string, category: string}>} wordList
 * @returns {Promise<Array<{word: string, category: string, isValid: boolean, isCorrectCategory: boolean, reason: string, source: string}>>}
 */
export async function batchValidateWords(wordList) {
  const results = [];
  
  // Process words with a small delay to avoid overwhelming the API
  for (const {word, category} of wordList) {
    if (!word || !word.trim()) {
      results.push({
        word: word || '',
        category,
        isValid: false,
        isCorrectCategory: false,
        reason: 'No answer',
        source: 'none'
      });
      continue;
    }
    
    // Use enhanced validation that checks comprehensive lists first
    const validation = await validateWordAndCategory(word, category);
    
    results.push({
      word: word.trim(),
      category,
      isValid: validation.isValid,
      isCorrectCategory: validation.isCorrectCategory,
      reason: validation.reason,
      source: validation.source,
      definition: validation.definition,
      meaning: validation.meaning,
      origin: validation.origin,
      gender: validation.gender
    });
    
    // Small delay to be respectful to APIs (only applies if we hit external APIs)
    if (validation.source === 'dictionary_api' || validation.source === 'behindthename') {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  
  return results;
}
