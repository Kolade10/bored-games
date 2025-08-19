// Test script for word validation
import { validateWord, validateWordAndCategory, batchValidateWords } from './src/lib/wordValidation.js';

async function testWordValidation() {
  console.log('Testing word validation...\n');

  // Test individual word validation
  console.log('1. Testing individual words:');
  const testWords = ['apple', 'elephant', 'paris', 'xyzabc123'];
  
  for (const word of testWords) {
    const result = await validateWord(word);
    console.log(`  ${word}: ${result.isValid ? 'Valid' : 'Invalid'} - ${result.definition || 'No definition'}`);
  }

  console.log('\n2. Testing category validation:');
  const categoryTests = [
    { word: 'apple', category: 'thing' },
    { word: 'elephant', category: 'animal' },
    { word: 'paris', category: 'place' },
    { word: 'alice', category: 'name' }
  ];

  for (const test of categoryTests) {
    const validation = await validateWordAndCategory(test.word, test.category);
    console.log(`  ${test.word} as ${test.category}: Valid=${validation.isValid}, Category=${validation.isCorrectCategory}, Source=${validation.source}, Reason=${validation.reason}`);
  }

  console.log('\n3. Testing batch validation with Behind the Name:');
  const batchTest = [
    { word: 'alexander', category: 'name' },    // Should be found in Behind the Name
    { word: 'sophia', category: 'name' },       // Should be found in Behind the Name
    { word: 'alex', category: 'name' },         // Should be in comprehensive list
    { word: 'paris', category: 'place' },       // Should be in comprehensive list
    { word: 'ant', category: 'animal' },        // Should be in dictionary
    { word: 'book', category: 'thing' }         // Should be in dictionary
  ];

  const batchResults = await batchValidateWords(batchTest);
  batchResults.forEach(result => {
    let output = `  ${result.word} (${result.category}): Valid=${result.isValid}, Category=${result.isCorrectCategory}, Source=${result.source} - ${result.reason}`;
    
    if (result.meaning) {
      output += `\n    Meaning: ${result.meaning}`;
    }
    if (result.origin) {
      output += `\n    Origin: ${result.origin}`;
    }
    if (result.gender) {
      output += `\n    Gender: ${result.gender}`;
    }
    if (result.definition) {
      output += `\n    Definition: ${result.definition}`;
    }
    
    console.log(output);
  });
}

// Run the test
testWordValidation().catch(console.error);
